import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CorporateApplication, { ICorporateApplication } from '@/lib/models/CorporateApplication';
import { getCorporateCatalog } from '@/lib/corporateCatalog';
import { audit } from '@/lib/audit';
import {
  bad, text, sameSecret, publicView, resendInvite, loadUploads, claimUploads, releaseUploads, fileRef, personActor,
} from '@/lib/corporate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// The status page never needs the photos
const LIGHT = '+accessKey -people.verification.photo -people.verification.selfie -people.verification.livenessFrames';

/** The application, if `key` is its status-page key (anything else looks like "not found") */
async function findWithKey(applicationId: string, key: string): Promise<ICorporateApplication | null> {
  if (!applicationId || !key) return null;
  const app = await CorporateApplication.findOne({ applicationId: text(applicationId, 20) }).select(LIGHT).lean() as ICorporateApplication | null;
  return app && sameSecret(key, app.accessKey) ? app : null;
}

async function view(applicationId: string) {
  const app = await CorporateApplication.findOne({ applicationId }).select(LIGHT).lean() as ICorporateApplication | null;
  const { rules } = await getCorporateCatalog();
  return { ...publicView(app!), rules: { maxFileMb: rules.maxFileMb, signatureRequired: rules.signatureRequired } };
}

const applicantName = (app: ICorporateApplication) => {
  const a = app.people.find(p => p.isApplicant);
  return a?.verification?.fullName || a?.fullName || 'Applicant';
};

/** GET /api/corporate/public/applications/:id?key=… — the applicant's status page */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    const app = await findWithKey(params.id, new URL(request.url).searchParams.get('key') || '');
    if (!app) return bad('Application not found', 404);
    return NextResponse.json({ success: true, data: await view(app.applicationId) });
  } catch (error) {
    console.error('[Corporate] Status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load the application' }, { status: 500 });
  }
}

/**
 * POST /api/corporate/public/applications/:id — the applicant's actions on the status page.
 *   { key, action: 'resend', personId }                    new verification link for a person
 *   { key, action: 'resubmit', documents, signatures }     replace what KYC sent back
 *     documents: [{ docId, fileId, fileKey }], signatures: [{ personId, fileId, fileKey }]
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => null);
    if (!body) return bad('Invalid request');
    const app = await findWithKey(params.id, String(body.key || ''));
    if (!app) return bad('Application not found', 404);
    const by = applicantName(app);

    if (body.action === 'resend') {
      const { rules } = await getCorporateCatalog();
      const result = await resendInvite(app, String(body.personId || ''), by, rules.inviteValidDays);
      if (result.error) return bad(result.error, result.status);
      await audit(request, {
        module: 'CORPORATE', action: 'INVITE', entityType: 'CorporateApplication',
        entityId: app.applicationId, entityName: app.organization.name, actor: personActor(by),
        description: `Verification link sent again to ${result.person!.fullName}${result.smsSent ? '' : ' (SMS failed)'}`,
        status: result.smsSent ? 'SUCCESS' : 'FAILURE',
      });
      if (!result.smsSent) return bad('We could not send the SMS. Please try again in a moment.', 502);
      return NextResponse.json({ success: true, data: await view(app.applicationId) });
    }

    if (body.action === 'resubmit') {
      if (app.status !== 'returned') return bad('This application is not waiting for changes.', 409);
      const { rules } = await getCorporateCatalog();
      const docsIn: any[] = (Array.isArray(body.documents) ? body.documents : []).filter((d: any) => d?.docId && d?.fileId);
      const sigsIn: any[] = (Array.isArray(body.signatures) ? body.signatures : []).filter((s: any) => s?.personId && s?.fileId);

      // Accepted items stay; rejected ones and required ones still missing must be replaced
      const needsDoc = (d: ICorporateApplication['documents'][number]) => d.review?.status === 'rejected' || (d.required && !d.file);
      const needsSig = (p: ICorporateApplication['people'][number]) => p.roles.includes('signatory')
        && (p.signature?.review?.status === 'rejected' || (rules.signatureRequired && !p.signature));
      for (const d of docsIn) {
        const doc = app.documents.find(x => x.docId === d.docId);
        if (!doc || doc.review?.status === 'accepted') return bad(`${doc?.name || 'This document'} cannot be replaced.`);
      }
      for (const s of sigsIn) {
        const p = app.people.find(x => x.id === s.personId);
        if (!p || !p.roles.includes('signatory') || p.signature?.review?.status === 'accepted') return bad('This signature cannot be replaced.');
      }
      const missing = [
        ...app.documents.filter(d => needsDoc(d) && !docsIn.some(x => x.docId === d.docId)).map(d => d.name),
        ...app.people.filter(p => needsSig(p) && !sigsIn.some(x => x.personId === p.id))
          .map(p => `the signature of ${p.verification?.fullName || p.fullName}`),
      ];
      if (missing.length) return bad(`Please upload ${missing.join(', ')}`);
      if (!docsIn.length && !sigsIn.length) return bad('Please upload the documents that were asked for.');

      const refs = [
        ...docsIn.map(d => ({ fileId: String(d.fileId), fileKey: String(d.fileKey || ''), kind: 'document' as const })),
        ...sigsIn.map(s => ({ fileId: String(s.fileId), fileKey: String(s.fileKey || ''), kind: 'signature' as const })),
      ];
      if (new Set(refs.map(r => r.fileId)).size !== refs.length) return bad('The same upload is used twice. Please upload each file separately.');
      const { files, error, fileId: failedFile } = await loadUploads(refs);
      if (error) return bad(error, 400, { fileId: failedFile });
      const fileIds = refs.map(r => r.fileId);
      if (!(await claimUploads(fileIds, app.applicationId))) return bad('These files were already sent.', 409);

      // Replace by position (people and documents never change order)
      const set: Record<string, any> = {};
      for (const d of docsIn) {
        const i = app.documents.findIndex(x => x.docId === d.docId);
        const doc = app.documents[i];
        set[`documents.${i}.file`] = fileRef(files.get(String(d.fileId))!);
        set[`documents.${i}.previousFiles`] = [...(doc.previousFiles || []), ...(doc.file ? [doc.file] : [])];
        set[`documents.${i}.review`] = { status: 'pending', note: '' };
      }
      for (const s of sigsIn) {
        const i = app.people.findIndex(x => x.id === s.personId);
        const old = app.people[i].signature;
        set[`people.${i}.signature`] = {
          ...fileRef(files.get(String(s.fileId))!),
          review: { status: 'pending', note: '' },
          previous: [
            ...(old?.previous || []),
            ...(old ? [{ fileId: old.fileId, fileName: old.fileName, mimeType: old.mimeType, size: old.size, uploadedAt: old.uploadedAt }] : []),
          ],
        };
      }
      const everyoneVerified = app.people.every(p => p.verification?.status === 'verified');
      set.status = everyoneVerified ? 'pending' : 'awaiting_verification';
      const replaced = docsIn.length + sigsIn.length;
      const r = await CorporateApplication.updateOne(
        { _id: app._id, status: 'returned' },
        {
          $set: set,
          $inc: { resubmissionCount: 1 },
          $push: { history: { at: new Date(), by, action: 'Resubmitted', note: `${replaced} file(s) replaced` } },
        }
      );
      if (!r.modifiedCount) {
        await releaseUploads(fileIds, app.applicationId);
        return bad('This application is not waiting for changes.', 409);
      }
      await audit(request, {
        module: 'CORPORATE', action: 'SUBMIT', entityType: 'CorporateApplication',
        entityId: app.applicationId, entityName: app.organization.name, actor: personActor(by),
        description: `Resubmitted (#${(app.resubmissionCount || 0) + 1}) — replaced ${[
          ...docsIn.map(d => app.documents.find(x => x.docId === d.docId)!.name),
          ...sigsIn.map(s => { const p = app.people.find(x => x.id === s.personId)!; return `signature of ${p.verification?.fullName || p.fullName}`; }),
        ].join(', ')}`,
      });
      return NextResponse.json({ success: true, data: await view(app.applicationId) });
    }

    return bad('Unknown action');
  } catch (error: any) {
    console.error('[Corporate] Status action error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update the application', detail: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}
