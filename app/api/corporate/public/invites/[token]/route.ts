import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CorporateApplication, { ICorporateApplication } from '@/lib/models/CorporateApplication';
import CorporateVerification, { ICorporateVerification } from '@/lib/models/CorporateVerification';
import { verifyIdentity } from '@/lib/faydaTokens';
import { sendSMS } from '@/lib/sms';
import { audit } from '@/lib/audit';
import {
  bad, text, hashSecret, roleText, personActor, screenName, screeningHold, smsAllVerified,
} from '@/lib/corporate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FIELDS = 'applicationId status organization.name organization.categoryName people.id people.fullName people.phone '
  + 'people.roles people.isApplicant people.invite people.verification.status people.verification.fullName people.verification.uin';

/** The application and person an SMS verification link belongs to */
async function findInvite(token: string) {
  if (!token || token.length < 20) return null;
  const tokenHash = hashSecret(token);
  const app = await CorporateApplication.findOne({ 'people.invite.tokenHash': tokenHash }).select(FIELDS).lean() as ICorporateApplication | null;
  const person = app?.people.find(p => p.invite?.tokenHash === tokenHash);
  return app && person ? { app, person, tokenHash } : null;
}

/** A link sent while the application was still being filled in (not submitted yet) */
async function findEarlyInvite(token: string): Promise<{ rec: ICorporateVerification; tokenHash: string } | null> {
  if (!token || token.length < 20) return null;
  const tokenHash = hashSecret(token);
  const rec = await CorporateVerification.findOne({ 'invite.tokenHash': tokenHash, applicationId: '', cancelled: false, mode: 'link' })
    .select('-verification.photo -verification.selfie -verification.livenessFrames');
  return rec ? { rec, tokenHash } : null;
}

const NOT_VALID = 'This link is not valid any more. Ask the person who applied to send you a new one.';
const expiredAt = (d?: Date) => !!d && new Date(d).getTime() < Date.now();
const isOpen = (app: ICorporateApplication) => app.status === 'awaiting_verification';

/** GET /api/corporate/public/invites/:token — who the link is for (verification page of the web app) */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    await connectToDatabase();
    const found = await findInvite(params.token);
    if (!found) {
      const early = await findEarlyInvite(params.token);
      if (!early) return bad(NOT_VALID, 404);
      const { rec } = early;
      const verified = rec.verification?.status === 'verified';
      return NextResponse.json({
        success: true,
        data: {
          applicationId: '', submitted: false,
          organizationName: rec.organizationName, categoryName: rec.categoryName, applicantName: rec.applicantName,
          fullName: rec.enteredName, roles: rec.roles, roleText: roleText(rec.roles),
          verified, verifiedName: verified ? rec.verification.fullName : undefined,
          expired: !verified && expiredAt(rec.invite?.expiresAt), expiresAt: rec.invite?.expiresAt, open: true,
        },
      });
    }
    const { app, person } = found;
    const applicant = app.people.find(p => p.isApplicant);
    const verified = person.verification?.status === 'verified';
    return NextResponse.json({
      success: true,
      data: {
        applicationId: app.applicationId,
        submitted: true,
        organizationName: app.organization.name,
        categoryName: app.organization.categoryName,
        applicantName: applicant?.verification?.fullName || applicant?.fullName || '',
        fullName: person.fullName,
        roles: person.roles,
        roleText: roleText(person.roles),
        verified,
        verifiedName: verified ? person.verification.fullName : undefined,
        expired: !verified && !!person.invite?.expiresAt && new Date(person.invite.expiresAt).getTime() < Date.now(),
        expiresAt: person.invite?.expiresAt,
        open: isOpen(app),
      },
    });
  } catch (error) {
    console.error('[Corporate] Invite lookup error:', error);
    return NextResponse.json({ success: false, error: 'Failed to open the link' }, { status: 500 });
  }
}

/**
 * POST /api/corporate/public/invites/:token — the invited person's Fayda verification.
 * Body: { ekycToken, faceVerificationToken?, faydaPhoto, selfie, livenessFrames?, faceVideoId? }
 */
export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    await connectToDatabase();
    const found = await findInvite(params.token);
    if (!found) {
      const early = await findEarlyInvite(params.token);
      if (!early) return bad(NOT_VALID, 404);
      return verifyEarly(request, early.rec, early.tokenHash);
    }
    const { app, person, tokenHash } = found;
    if (person.verification?.status === 'verified') return bad('You have already verified. Thank you!', 409);
    if (!isOpen(app)) return bad('This application is no longer waiting for verification.', 409);
    if (person.invite?.expiresAt && new Date(person.invite.expiresAt).getTime() < Date.now()) {
      return bad('This link has expired. Ask the person who applied to send you a new one.', 410);
    }

    const body = await request.json().catch(() => null);
    if (!body) return bad('Invalid request');
    const identity = await verifyIdentity({
      ekycToken: String(body.ekycToken || ''),
      faceVerificationToken: String(body.faceVerificationToken || ''),
      faydaPhoto: String(body.faydaPhoto || ''),
      selfie: String(body.selfie || ''),
      livenessFrames: Array.isArray(body.livenessFrames) ? body.livenessFrames : [],
      faceVideoId: text(body.faceVideoId, 100),
    }, person.fullName);
    if (!identity.verification) return bad(identity.error || 'Please verify with Fayda again.', 401);
    const v = identity.verification;

    // Everyone verifies with their own Fayda ID
    const same = v.uin ? app.people.find(p => p.id !== person.id && p.verification?.uin === v.uin) : undefined;
    if (same) {
      return bad(`This Fayda ID was already used to verify ${same.verification?.fullName || same.fullName} on this application. Each person verifies with their own Fayda ID.`, 409);
    }

    v.screening = await screenName(v.fullName || '', v.dateOfBirth);
    const hold = screeningHold(v.screening);
    const updated = await CorporateApplication.updateOne(
      {
        _id: app._id,
        status: 'awaiting_verification',
        people: { $elemMatch: { id: person.id, 'invite.tokenHash': tokenHash, 'verification.status': 'pending' } },
        ...(v.uin ? { 'people.verification.uin': { $ne: v.uin } } : {}),
      },
      {
        $set: { 'people.$[person].verification': v, 'people.$[person].verifiedVia': 'link', ...(hold ? { complianceHold: true } : {}) },
        $push: {
          history: {
            at: new Date(), by: v.fullName, action: 'Verified with Fayda',
            note: `${person.fullName} (${roleText(person.roles)})${hold ? ' — screening match' : ''}`,
          },
        },
      },
      // (array filter, not "$": the query looks at the people array twice)
      { arrayFilters: [{ 'person.id': person.id }] }
    );
    if (!updated.modifiedCount) return bad('This link was already used or the application changed. Please open the link again.', 409);

    await audit(request, {
      module: 'CORPORATE', action: 'VERIFY', entityType: 'CorporateApplication',
      entityId: app.applicationId, entityName: app.organization.name, actor: personActor(v.fullName || person.fullName),
      description: `${v.fullName} verified with Fayda as ${roleText(person.roles)} (entered as "${person.fullName}", `
        + `name match ${v.nameMatchScore ?? 0}%)${hold ? ' — screening match: KYC must escalate to a Senior Approver' : ''}`,
    });

    // The last person to verify sends the application to KYC
    const done = await CorporateApplication.updateOne(
      { _id: app._id, status: 'awaiting_verification', 'people.verification.status': { $ne: 'pending' } },
      {
        $set: { status: 'pending', verifiedAt: new Date() },
        $push: { history: { at: new Date(), by: 'SYSTEM', action: 'Everyone verified', note: 'Sent to KYC' } },
      }
    );
    const allVerified = done.modifiedCount === 1;
    if (allVerified) {
      const applicant = app.people.find(p => p.isApplicant);
      if (applicant?.phone) sendSMS(applicant.phone, smsAllVerified(app.applicationId, app.organization.name)); // fire-and-forget
    }

    return NextResponse.json({
      success: true,
      data: { fullName: v.fullName, organizationName: app.organization.name, applicationId: app.applicationId, allVerified, submitted: true },
    });
  } catch (error: any) {
    console.error('[Corporate] Invite verification error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save your verification', detail: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}

/**
 * Verification from a link sent before the application was submitted: stored on the record; the
 * representative's wizard shows the tick, and the application takes it over on submission.
 */
async function verifyEarly(request: Request, rec: ICorporateVerification, tokenHash: string) {
  if (rec.verification?.status === 'verified') return bad('You have already verified. Thank you!', 409);
  if (expiredAt(rec.invite?.expiresAt)) return bad('This link has expired. Ask the person who applied to send you a new one.', 410);
  const body = await request.json().catch(() => null);
  if (!body) return bad('Invalid request');
  const identity = await verifyIdentity({
    ekycToken: String(body.ekycToken || ''),
    faceVerificationToken: String(body.faceVerificationToken || ''),
    faydaPhoto: String(body.faydaPhoto || ''),
    selfie: String(body.selfie || ''),
    livenessFrames: Array.isArray(body.livenessFrames) ? body.livenessFrames : [],
    faceVideoId: text(body.faceVideoId, 100),
  }, rec.enteredName);
  if (!identity.verification) return bad(identity.error || 'Please verify with Fayda again.', 401);
  const v = identity.verification;

  // Everyone verifies with their own Fayda ID
  if (v.uin && v.uin === rec.applicantUin) {
    return bad(`This Fayda ID belongs to ${rec.applicantName}, who applied. Each person verifies with their own Fayda ID.`, 409);
  }
  const same = v.uin ? await CorporateVerification.findOne({
    groupId: rec.groupId, cancelled: false, applicationId: '', verificationId: { $ne: rec.verificationId }, 'verification.uin': v.uin,
  }).select('verification.fullName').lean() as any : null;
  if (same) {
    return bad(`This Fayda ID was already used to verify ${same.verification?.fullName || 'someone else'} on this application. Each person verifies with their own Fayda ID.`, 409);
  }

  v.screening = await screenName(v.fullName || '', v.dateOfBirth);
  const hold = screeningHold(v.screening);
  const updated = await CorporateVerification.updateOne(
    { _id: rec._id, applicationId: '', cancelled: false, 'invite.tokenHash': tokenHash, 'verification.status': 'pending' },
    { $set: { verification: v } }
  );
  // Submitted (or removed) meanwhile: the link now belongs to the application — open it again
  if (!updated.modifiedCount) return bad('The application changed meanwhile. Please open the link again.', 409);

  await audit(request, {
    module: 'CORPORATE', action: 'VERIFY', entityType: 'CorporateVerification', entityId: rec.verificationId,
    entityName: rec.organizationName, actor: personActor(v.fullName || rec.enteredName),
    description: `${v.fullName} verified with Fayda as ${roleText(rec.roles)} from the SMS link, before the application was submitted`
      + (rec.enteredName ? ` (entered as "${rec.enteredName}", name match ${v.nameMatchScore ?? 0}%)` : '')
      + (hold ? ' — screening match: KYC must escalate to a Senior Approver' : ''),
  });
  return NextResponse.json({
    success: true,
    data: { fullName: v.fullName, organizationName: rec.organizationName, applicationId: '', allVerified: false, submitted: false, applicantName: rec.applicantName },
  });
}
