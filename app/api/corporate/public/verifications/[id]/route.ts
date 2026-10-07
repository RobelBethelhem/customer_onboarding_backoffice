import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getCorporateCatalog } from '@/lib/corporateCatalog';
import CorporateVerification, { ICorporateVerification } from '@/lib/models/CorporateVerification';
import { sendSMS } from '@/lib/sms';
import { audit } from '@/lib/audit';
import {
  bad, text, matchesHash, maskPhone, personActor, smsInvite, verificationView, newInvite, MAX_INVITE_SENDS,
} from '@/lib/corporate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LIGHT = '-verification.photo -verification.selfie -verification.livenessFrames';

/** The record, if `key` is the representative's key for it (anything else looks like "not found") */
async function findWithKey(id: string, key: string): Promise<ICorporateVerification | null> {
  const rec = await CorporateVerification.findOne({ verificationId: text(id, 40), cancelled: false }).select(LIGHT);
  return rec && matchesHash(key, rec.keyHash) ? rec : null;
}

/** GET /api/corporate/public/verifications/:id?key=… — has this person verified yet? */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    const rec = await findWithKey(params.id, new URL(request.url).searchParams.get('key') || '');
    if (!rec) return bad('Not found', 404);
    return NextResponse.json({ success: true, data: verificationView(rec) });
  } catch (error) {
    console.error('[Corporate] Verification status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load the verification' }, { status: 500 });
  }
}

/**
 * POST /api/corporate/public/verifications/:id — the representative, before submitting:
 *   { key, action: 'resend' }   a new SMS link (the old one stops working) → { verification, link }
 *   { key, action: 'cancel' }   the person was removed from the application; the link stops working
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => null);
    if (!body) return bad('Invalid request');
    const rec = await findWithKey(params.id, String(body.key || ''));
    if (!rec) return bad('Not found', 404);
    if (rec.applicationId) return bad('The application was already submitted. Follow it on its status page.', 409);

    if (body.action === 'cancel') {
      await CorporateVerification.updateOne({ _id: rec._id, applicationId: '' }, { $set: { cancelled: true, 'invite.tokenHash': '' } });
      return NextResponse.json({ success: true, data: { verificationId: rec.verificationId, cancelled: true } });
    }

    if (body.action === 'resend') {
      if (rec.mode !== 'link') return bad('This person verified with you — no link is needed.', 409);
      if (rec.verification?.status === 'verified') return bad(`${rec.verification.fullName || 'This person'} has already verified.`, 409);
      const sentCount = rec.invite?.sentCount || 0;
      if (sentCount >= MAX_INVITE_SENDS) return bad(`The link was already sent ${sentCount} times. Please share it another way or contact the bank.`, 429);
      const { rules } = await getCorporateCatalog();
      const { link, invite } = newInvite(rules.inviteValidDays, sentCount);
      const r = await CorporateVerification.updateOne(
        { _id: rec._id, applicationId: '', cancelled: false, 'verification.status': 'pending' },
        { $set: { invite, expiresAt: new Date(Date.now() + (rules.inviteValidDays + 7) * 24 * 60 * 60 * 1000) } }
      );
      if (!r.modifiedCount) return bad('This person has just verified or was removed. Please check the list again.', 409);
      const smsSent = await sendSMS(rec.phone, smsInvite(rec.enteredName, rec.applicantName, rec.organizationName, rec.roles, link, rules.inviteValidDays));
      await CorporateVerification.updateOne({ _id: rec._id, 'invite.tokenHash': invite.tokenHash }, { $set: { 'invite.smsSent': smsSent } });
      await audit(request, {
        module: 'CORPORATE', action: 'INVITE', entityType: 'CorporateVerification', entityId: rec.verificationId,
        entityName: rec.organizationName, actor: personActor(rec.applicantName), status: smsSent ? 'SUCCESS' : 'FAILURE',
        description: `Verification link sent again to ${maskPhone(rec.phone)} before the application was submitted${smsSent ? '' : ' — SMS failed'}`,
      });
      const fresh = await CorporateVerification.findById(rec._id).select(LIGHT);
      return NextResponse.json({ success: true, data: { verification: verificationView(fresh!), link } });
    }

    return bad('Unknown action');
  } catch (error: any) {
    console.error('[Corporate] Verification action error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update the verification', detail: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}
