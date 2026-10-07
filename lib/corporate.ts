import crypto from 'crypto';
import { NextResponse } from 'next/server';
import CorporateFile, { ICorporateFile } from '@/lib/models/CorporateFile';
import { screenCustomer } from '@/lib/sanctionsScreening';
import { sendSMS } from '@/lib/sms';
import CorporateApplication, {
  ICorporateApplication, ICorporatePerson, CorporateRole, SigningRule,
} from '@/lib/models/CorporateApplication';
import type { ICorporateRules } from '@/lib/models/CorporateCatalog';

export const newSecret = () => crypto.randomBytes(24).toString('base64url');
export const hashSecret = (s: string) => crypto.createHash('sha256').update(String(s)).digest('hex');

/** Where SMS links point: the web app (WEB_APP_URL, e.g. https://onboard.zemenbank.com) */
export const webAppUrl = () => (process.env.WEB_APP_URL || 'https://onboard.zemenbank.com').replace(/\/+$/, '');
export const inviteLink = (token: string) => `${webAppUrl()}/?invite=${token}`;
export const statusLink = (applicationId: string, key: string) => `${webAppUrl()}/?corporate=${applicationId}&key=${key}`;

export const SIGNING_RULES: Record<SigningRule, string> = {
  single: 'Any one signatory alone',
  any_two: 'Any two signatories jointly',
  all: 'All signatories jointly',
  other: 'Other',
};

export const roleText = (roles: CorporateRole[]) =>
  roles.includes('signatory') && roles.includes('director') ? 'signatory and director'
    : roles.includes('signatory') ? 'signatory'
    : roles.includes('director') ? 'director'
    : 'representative';

/** 09XXXXXXXX / 07XXXXXXXX / +2519XXXXXXXX → 09XXXXXXXX, or '' when it is not an Ethiopian mobile */
export function normalizeMobile(phone: unknown): string {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  const m = digits.match(/^(?:251|0)?([79]\d{8})$/);
  return m ? `0${m[1]}` : '';
}

export const maskPhone = (phone: string) => (phone && phone.length >= 6 ? `${phone.slice(0, 2)}******${phone.slice(-2)}` : phone);

/** Next application number: one above the highest in use (ZMC-00001 …) */
export async function nextCorporateId(): Promise<string> {
  const ids = await CorporateApplication.find({ applicationId: /^ZMC-\d+$/ }).select('applicationId -_id').lean() as { applicationId: string }[];
  const top = ids.reduce((max, a) => Math.max(max, parseInt(a.applicationId.slice(4), 10) || 0), 0);
  return `ZMC-${String(top + 1).padStart(5, '0')}`;
}

export const verificationCounts = (app: Pick<ICorporateApplication, 'people'>) => ({
  verified: app.people.filter(p => p.verification?.status === 'verified').length,
  total: app.people.length,
});

/** Why the application cannot be approved yet (empty = it can) */
export function approvalBlockers(app: ICorporateApplication, rules: ICorporateRules): string[] {
  const blockers: string[] = [];
  const unverified = app.people.filter(p => p.verification?.status !== 'verified');
  if (unverified.length) blockers.push(`${unverified.map(p => p.fullName).join(', ')} not verified with Fayda yet`);
  // required documents, and optional ones that were uploaded, must be checked and accepted
  const docs = app.documents.filter(d => (d.required || d.file) && d.review?.status !== 'accepted');
  if (docs.length) blockers.push(`Documents not accepted: ${docs.map(d => d.name).join(', ')}`);
  const sigs = app.people.filter(p => p.roles.includes('signatory') && (rules.signatureRequired || p.signature)
    && p.signature?.review?.status !== 'accepted');
  if (sigs.length) blockers.push(`Specimen signatures not accepted: ${sigs.map(p => p.verification?.fullName || p.fullName).join(', ')}`);
  return blockers;
}

/** What the representative sees on the status page */
export function publicView(app: ICorporateApplication) {
  const returned = app.status === 'returned';
  return {
    applicationId: app.applicationId,
    status: app.status,
    organizationName: app.organization.name,
    categoryName: app.organization.categoryName,
    submittedAt: app.submittedAt,
    people: app.people.map((p: ICorporatePerson) => ({
      id: p.id,
      fullName: p.verification?.status === 'verified' ? p.verification.fullName || p.fullName : p.fullName,
      roles: p.roles,
      isApplicant: p.isApplicant,
      verified: p.verification?.status === 'verified',
      phone: maskPhone(p.phone),
      inviteSentAt: p.invite?.sentAt,
      inviteExpiresAt: p.invite?.expiresAt,
      signature: p.signature ? {
        fileName: p.signature.fileName,
        status: p.signature.review?.status || 'pending',
        note: returned && p.signature.review?.status === 'rejected' ? p.signature.review.note : undefined,
      } : null,
    })),
    documents: app.documents.map(d => ({
      docId: d.docId,
      name: d.name,
      required: d.required,
      fileName: d.file?.fileName || '',
      status: d.file ? d.review?.status || 'pending' : 'missing',
      note: returned && d.review?.status === 'rejected' ? d.review.note : undefined,
    })),
    returnReason: returned ? app.returnReason : undefined,
    rejectionReason: app.status === 'rejected' ? app.rejectionReason : undefined,
    cifNumber: app.status === 'approved' ? app.cifNumber : undefined,
    accountNumber: app.status === 'approved' ? app.accountNumber : undefined,
    branch: app.branch,
  };
}

/** Allowed upload types, checked against the file's first bytes too (not just its name) */
export function sniffMime(buf: Buffer): string {
  if (buf.length >= 4 && buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return '';
}

// ─── Route helpers ───────────────────────────────────────────────────────────────────────────
export const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status });
export const text = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

/** Applicant / invited person as the actor of an audit event */
export const personActor = (name: string) => ({ performedBy: name || 'Applicant', performedByName: name || '', performedByRole: 'applicant' });

/** Compare secrets without leaking timing */
export function sameSecret(a: string, b: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(hashSecret(a || '')), Buffer.from(hashSecret(b || '')));
}

/**
 * Uploads referenced by an application: each must exist, belong to the caller (its key), be of the
 * right kind and not be used by another application. `fileId` names the one that failed, so the
 * web app can ask for that upload again (unused uploads are deleted after a week).
 */
export async function loadUploads(
  refs: { fileId: string; fileKey: string; kind: 'document' | 'signature' }[]
): Promise<{ files: Map<string, ICorporateFile>; error?: string; fileId?: string; usedBy?: string }> {
  const files = new Map<string, ICorporateFile>();
  if (!refs.length) return { files };
  const found = await CorporateFile.find({ fileId: { $in: refs.map(r => r.fileId) } }).select('-data');
  for (const ref of refs) {
    const f = found.find((x: ICorporateFile) => x.fileId === ref.fileId);
    if (!f || f.keyHash !== hashSecret(ref.fileKey || '')) return { files, fileId: ref.fileId, error: 'An uploaded file has expired. Please upload it again.' };
    if (f.applicationId) return { files, fileId: ref.fileId, usedBy: f.applicationId, error: 'An uploaded file was already sent with an application. Please upload it again.' };
    if (f.kind !== ref.kind) return { files, fileId: ref.fileId, error: 'An uploaded file is of the wrong kind. Please upload it again.' };
    files.set(f.fileId, f);
  }
  return { files };
}

export const fileRef = (f: ICorporateFile) => ({
  fileId: f.fileId, fileName: f.fileName, mimeType: f.mimeType, size: f.size, uploadedAt: new Date(),
});

// Uploads no application uses (wizard abandoned) are deleted after this
export const UNUSED_UPLOAD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Give the uploads to the application (they stop expiring). False when one was taken meanwhile,
 * e.g. by a second click on Submit — nothing is claimed then.
 */
export async function claimUploads(fileIds: string[], applicationId: string): Promise<boolean> {
  if (!fileIds.length) return true;
  const r = await CorporateFile.updateMany(
    { fileId: { $in: fileIds }, applicationId: '' },
    { $set: { applicationId, expiresAt: null } }
  );
  if (r.modifiedCount === fileIds.length) return true;
  await releaseUploads(fileIds, applicationId);
  return false;
}

/** Undo claimUploads: the files become unused uploads again */
export async function releaseUploads(fileIds: string[], applicationId: string) {
  if (!fileIds.length) return;
  await CorporateFile.updateMany(
    { fileId: { $in: fileIds }, applicationId },
    { $set: { applicationId: '', expiresAt: new Date(Date.now() + UNUSED_UPLOAD_MS) } }
  );
}

// ─── Screening ───────────────────────────────────────────────────────────────────────────────
export interface ScreeningSummary {
  status: 'MATCHED' | 'CLEAR' | 'ERROR';
  riskLevel: string;
  hasPEP: boolean;
  blocked: boolean;
  matches: { fullName: string; sanctionType: string; sourceId: string; matchScore: number; matchStrength: string; reason?: string }[];
  checkedAt: Date;
  error?: string;
}

/** PEP / sanctions screening of a person (Fayda name and birth date) or of the organization's name */
export async function screenName(fullName: string, dateOfBirth?: string): Promise<ScreeningSummary> {
  try {
    const parts = fullName.trim().split(/\s+/);
    const s = await screenCustomer({
      fullName,
      firstName: parts.length > 1 ? parts[0] : '',
      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
      lastName: parts.length > 1 ? parts[parts.length - 1] : '',
      dateOfBirth,
    });
    return {
      status: s.status, riskLevel: s.riskLevel, hasPEP: s.hasPEP, blocked: s.blocked, checkedAt: new Date(),
      matches: s.matches.slice(0, 5).map(m => ({
        fullName: m.fullName, sanctionType: m.sanctionType, sourceId: m.sourceId,
        matchScore: m.matchScore, matchStrength: m.matchStrength, reason: m.reason,
      })),
    };
  } catch (e: any) {
    console.error('[Corporate] Screening failed:', e.message);
    return { status: 'ERROR', riskLevel: 'UNKNOWN', hasPEP: false, blocked: false, matches: [], checkedAt: new Date(), error: 'Screening could not run' };
  }
}

/** A PEP or sanctions match: KYC cannot approve, only escalate to a Senior Approver */
export const screeningHold = (s?: { hasPEP?: boolean; blocked?: boolean } | null) => !!(s && (s.hasPEP || s.blocked));

// ─── Verification links ──────────────────────────────────────────────────────────────────────
export const MAX_INVITE_SENDS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * New verification link for a person who has not verified yet (the old link stops working),
 * sent by SMS. `by` is who asked for it (the applicant or a staff member).
 */
export async function resendInvite(
  app: Pick<ICorporateApplication, '_id' | 'applicationId' | 'status' | 'organization' | 'people'>,
  personId: string,
  by: string,
  validDays: number,
  maxSends = MAX_INVITE_SENDS
): Promise<{ error?: string; status?: number; smsSent?: boolean; person?: ICorporatePerson }> {
  if (app.status !== 'awaiting_verification') return { error: 'Everyone on this application has already verified.', status: 409 };
  const index = app.people.findIndex(p => p.id === personId && !p.isApplicant);
  const person = app.people[index];
  if (!person) return { error: 'Person not found', status: 404 };
  if (person.verification?.status === 'verified') return { error: `${person.fullName} has already verified.`, status: 409 };
  const sentCount = person.invite?.sentCount || 0;
  if (sentCount >= maxSends) return { error: `The link was already sent ${sentCount} times. Please contact the bank.`, status: 429 };

  const token = newSecret();
  const invite = {
    tokenHash: hashSecret(token), sentAt: new Date(), sentCount: sentCount + 1,
    expiresAt: new Date(Date.now() + validDays * DAY_MS), smsSent: false,
  };
  const r = await CorporateApplication.updateOne(
    { _id: app._id, status: 'awaiting_verification', [`people.${index}.id`]: person.id, [`people.${index}.verification.status`]: 'pending' },
    {
      $set: { [`people.${index}.invite`]: invite },
      $push: { history: { at: new Date(), by, action: 'Verification link sent again', note: `${person.fullName} (${maskPhone(person.phone)})` } },
    }
  );
  if (!r.modifiedCount) return { error: 'The application changed meanwhile. Please reload it.', status: 409 };

  const applicant = app.people.find(p => p.isApplicant);
  const smsSent = await sendSMS(person.phone, smsInvite(
    person.fullName, applicant?.verification?.fullName || applicant?.fullName || 'The applicant',
    app.organization.name, person.roles, inviteLink(token), validDays
  ));
  await CorporateApplication.updateOne({ _id: app._id, [`people.${index}.invite.tokenHash`]: invite.tokenHash }, { $set: { [`people.${index}.invite.smsSent`]: smsSent } });
  return { smsSent, person };
}

// ─── SMS texts ───────────────────────────────────────────────────────────────────────────────
export const smsInvite = (name: string, applicant: string, org: string, roles: CorporateRole[], link: string, days: number) =>
  `Dear ${name},\n\n${applicant} added you as ${roleText(roles)} of ${org} on a Zemen Bank business account application. ` +
  `Please verify your identity with your Fayda ID here: ${link}\n\nThe link works for ${days} days.`;

export const smsSubmitted = (id: string, org: string, othersToVerify: number, link: string) =>
  `Your business account application ${id} for ${org} was received.` +
  (othersToVerify ? ` We sent a verification link to ${othersToVerify} ${othersToVerify === 1 ? 'person' : 'people'}; it goes to our team once everyone has verified.` : ' Our team will review it.') +
  `\n\nFollow it here: ${link}`;

export const smsAllVerified = (id: string, org: string) =>
  `Everyone on business account application ${id} (${org}) has verified their identity. Our team is now reviewing it.`;

export const smsReturned = (id: string, org: string, reason: string, link: string) =>
  `Business account application ${id} (${org}) needs changes: ${reason}\n\nPlease open: ${link}`;

export const smsRejected = (id: string, org: string, reason: string) =>
  `We could not approve business account application ${id} (${org}). Reason: ${reason}`;

export const smsApproved = (org: string, cif: string, account: string, branch: string) =>
  `The Zemen Bank account of ${org} is open.\n\nCIF: ${cif}\nAccount: ${account}\nBranch: ${branch}\n\nThank you for banking with Zemen Bank!`;
