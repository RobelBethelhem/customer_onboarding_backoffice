import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getCorporateCatalog } from '@/lib/corporateCatalog';
import CorporateVerification from '@/lib/models/CorporateVerification';
import type { CorporateRole } from '@/lib/models/CorporateApplication';
import { readEkycToken, verifyIdentity } from '@/lib/faydaTokens';
import { sendSMS } from '@/lib/sms';
import { audit } from '@/lib/audit';
import {
  bad, text, newSecret, hashSecret, matchesHash, normalizeMobile, maskPhone, roleText, personActor, screenName,
  screeningHold, smsInvite, verificationView, newInvite,
} from '@/lib/corporate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROLES: CorporateRole[] = ['signatory', 'director'];
const GROUP_ID = /^[A-Za-z0-9_-]{16,64}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const rolesOf = (v: unknown): CorporateRole[] => (Array.isArray(v) ? ROLES.filter(r => v.includes(r)) : []);
const newVerificationId = () => `V${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

// The photos are not needed to answer the wizard
const LIGHT = '-verification.photo -verification.selfie -verification.livenessFrames';

/**
 * POST /api/corporate/public/verifications — public (web app, through the Fayda backend).
 * A signatory or director of a business account application verifies while the representative
 * is still filling it in:
 *   { mode: 'with_applicant', identity: {ekycToken, faceVerificationToken, faydaPhoto, selfie, …} }
 *       the person verified on the representative's phone (Fayda OTP + live face check) — stored now
 *   { mode: 'link', phone, name? }
 *       an SMS link goes to the person's phone right away; they verify on their own phone
 * Both with { ekycToken (the representative's), groupId, roles, organizationName, categoryName?, applicantPhone? }.
 * Returns { verification, key, link? } — the key lets the wizard follow the record and submit it.
 *
 *   { action: 'status', items: [{ id, key }] }   the wizard asks which have verified (the ticks)
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return bad('Invalid request');
    if (body.action === 'status') return status(body);

    const groupId = text(body.groupId, 64);
    if (!GROUP_ID.test(groupId)) return bad('Invalid request');
    const mode = body.mode === 'with_applicant' || body.mode === 'link' ? body.mode : '';
    if (!mode) return bad('Choose whether the person is with you or gets a link');
    const roles = rolesOf(body.roles);
    if (!roles.length) return bad('Choose whether the person is a signatory, a director or both');
    const organizationName = text(body.organizationName, 150).replace(/\s+/g, ' ');
    if (organizationName.length < 2) return bad('Enter the name of the organization first');

    // Only a representative who verified with Fayda can add people (and send SMS)
    const me = await readEkycToken(String(body.ekycToken || ''));
    if (me.status !== 'valid') {
      return me.status === 'unavailable'
        ? bad('We could not check your Fayda verification right now. Please try again.', 503)
        : bad('Your Fayda verification has expired. Please verify with Fayda again.', 401);
    }
    const applicantName = (me.ekyc.name || '').toUpperCase() || 'The applicant';
    const applicantUin = me.ekyc.uin || '';

    const { rules } = await getCorporateCatalog();
    const all = await CorporateVerification.find({ groupId }).select('phone cancelled applicationId verification.uin verification.fullName').lean() as any[];
    const siblings = all.filter(r => !r.cancelled && !r.applicationId);
    if (siblings.length + 2 > rules.maxPeople) return bad(`An application can have at most ${rules.maxPeople} people, including you`);
    if (all.length >= rules.maxPeople * 3) return bad('Too many people were added and removed. Please start a new application.', 429);

    const key = newSecret();
    const base = {
      verificationId: newVerificationId(), keyHash: hashSecret(key), groupId, mode, roles, applicantName, applicantUin,
      organizationName, categoryName: text(body.categoryName, 100), applicationId: '', cancelled: false,
    };

    // ── On the representative's phone: the person's own Fayda verification and face check ──
    if (mode === 'with_applicant') {
      const i = body.identity || {};
      const identity = await verifyIdentity({
        ekycToken: String(i.ekycToken || ''),
        faceVerificationToken: String(i.faceVerificationToken || ''),
        faydaPhoto: String(i.faydaPhoto || ''),
        selfie: String(i.selfie || ''),
        livenessFrames: Array.isArray(i.livenessFrames) ? i.livenessFrames : [],
        faceVideoId: text(i.faceVideoId, 100),
      });
      if (!identity.verification) return bad(identity.error || 'Please verify with Fayda again.', 401);
      const v = identity.verification;
      if (v.uin && v.uin === applicantUin) {
        return bad('This is your own Fayda ID. The other person must verify with their own Fayda ID.', 409);
      }
      const same = v.uin ? siblings.find(r => r.verification?.uin === v.uin) : undefined;
      if (same) return bad(`${same.verification.fullName || 'This person'} is already on this application.`, 409);
      v.screening = await screenName(v.fullName || '', v.dateOfBirth);

      const rec = await CorporateVerification.create({
        ...base, phone: normalizeMobile(v.phone), enteredName: '', verification: v,
        expiresAt: new Date(Date.now() + 8 * DAY_MS),
      });
      const hold = screeningHold(v.screening);
      await audit(request, {
        module: 'CORPORATE', action: 'VERIFY', entityType: 'CorporateVerification', entityId: rec.verificationId,
        entityName: organizationName, actor: personActor(v.fullName || ''),
        description: `${v.fullName} verified with Fayda as ${roleText(roles)} on the applicant's phone (with ${applicantName}), `
          + `before the application was submitted${hold ? ' — screening match: KYC must escalate to a Senior Approver' : ''}`,
      });
      return NextResponse.json({ success: true, data: { verification: verificationView(rec), key } }, { status: 201 });
    }

    // ── Elsewhere: an SMS link to the person's phone ──────────────────────────────────────
    const phone = normalizeMobile(body.phone);
    if (!phone) return bad('Enter a valid mobile number (09… or 07…)');
    if (phone === normalizeMobile(body.applicantPhone)) {
      return bad('This is your own mobile number — the link must go to the person who verifies.');
    }
    if (siblings.some(r => r.phone === phone)) return bad('This mobile number is already used for another person on this application.');
    const enteredName = text(body.name, 100).replace(/\s+/g, ' ');
    const { link, invite } = newInvite(rules.inviteValidDays);
    const rec = await CorporateVerification.create({
      ...base, phone, enteredName, invite, verification: { status: 'pending' },
      expiresAt: new Date(Date.now() + (rules.inviteValidDays + 7) * DAY_MS),
    });
    const smsSent = await sendSMS(phone, smsInvite(enteredName, applicantName, organizationName, roles, link, rules.inviteValidDays));
    await CorporateVerification.updateOne({ _id: rec._id }, { $set: { 'invite.smsSent': smsSent } });
    rec.invite!.smsSent = smsSent;
    await audit(request, {
      module: 'CORPORATE', action: 'INVITE', entityType: 'CorporateVerification', entityId: rec.verificationId,
      entityName: organizationName, actor: personActor(applicantName), status: smsSent ? 'SUCCESS' : 'FAILURE',
      description: `Verification link sent to ${enteredName ? `${enteredName} ` : ''}(${maskPhone(phone)}) as ${roleText(roles)}, `
        + `before the application was submitted${smsSent ? '' : ' — SMS failed (the applicant can share the link)'}`,
    });
    return NextResponse.json({ success: true, data: { verification: verificationView(rec), key, link } }, { status: 201 });
  } catch (error: any) {
    console.error('[Corporate] Verification error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add the person', detail: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}

/** Which of the wizard's people have verified (missing: removed, expired or already submitted) */
async function status(body: any) {
  const items: { id: string; key: string }[] = (Array.isArray(body.items) ? body.items : []).slice(0, 20)
    .map((i: any) => ({ id: text(i?.id, 40), key: String(i?.key || '') }));
  const recs = await CorporateVerification.find({ verificationId: { $in: items.map(i => i.id) }, cancelled: false }).select(LIGHT);
  return NextResponse.json({
    success: true,
    data: items.map(i => {
      const rec = recs.find(r => r.verificationId === i.id);
      return rec && matchesHash(i.key, rec.keyHash) ? { found: true, ...verificationView(rec) } : { found: false, verificationId: i.id };
    }),
  });
}
