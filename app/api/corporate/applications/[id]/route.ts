import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CorporateApplication, { CorporateStatus, ICorporateApplication } from '@/lib/models/CorporateApplication';
import WorkflowSettings, { defaultWorkflowSettings } from '@/lib/models/WorkflowSettings';
import { createCorporateCustomerAndAccount, accountSetupFor, FlexCubeConfig } from '@/lib/flexcube';
import { getCorporateCatalog } from '@/lib/corporateCatalog';
import { ifbBranchFor } from '@/lib/ifbBranches';
import { requireRole } from '@/lib/apiAuth';
import { sendSMS } from '@/lib/sms';
import { audit, AuditEvent } from '@/lib/audit';
import type { AuditAction, AuditStatus } from '@/lib/auditTypes';
import {
  approvalBlockers, resendInvite, roleText, screeningHold, statusLink, SIGNING_RULES,
  smsApproved, smsRejected, smsReturned, text,
} from '@/lib/corporate';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // FlexCube: CIF, then the account

const STAFF = ['admin', 'kyc', 'senior_approver'] as const;
const KYC_STATUSES: CorporateStatus[] = ['pending', 'in_review'];
const STALE_APPROVAL_MS = 10 * 60 * 1000;

function getFlexCubeConfig(settings: any): FlexCubeConfig {
  return {
    customerServiceUrl: settings?.flexcubeCustomerServiceUrl || 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService',
    accountServiceUrl: settings?.flexcubeAccountServiceUrl || 'http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService',
    iaServiceUrl: settings?.flexcubeIaServiceUrl || undefined,
    userId: settings?.flexcubeUserId || 'FYDA_USR',
    source: settings?.flexcubeSource || 'EXTFYDA',
    defaultBranch: settings?.flexcubeBranch || '103',
    timeout: settings?.flexcubeTimeout || 30000,
  };
}

/** The application for staff: no status-page key, no verification-link hashes */
function staffView(app: ICorporateApplication, rules: Awaited<ReturnType<typeof getCorporateCatalog>>['rules']) {
  return {
    ...app,
    accessKey: undefined,
    people: app.people.map(p => ({ ...p, invite: p.invite ? { ...p.invite, tokenHash: undefined } : undefined })),
    signingRuleText: app.signingRule === 'other' ? app.signingRuleOther : SIGNING_RULES[app.signingRule],
    blockers: approvalBlockers(app, rules),
    approvalStale: app.status === 'approving' && !!app.approvalStartedAt
      && Date.now() - new Date(app.approvalStartedAt).getTime() > STALE_APPROVAL_MS,
    rules,
  };
}

async function load(applicationId: string) {
  return await CorporateApplication.findOne({ applicationId: String(applicationId).slice(0, 20) }).lean() as ICorporateApplication | null;
}

/** GET /api/corporate/applications/:id — everything KYC needs to decide */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireRole(request, [...STAFF]);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const app = await load(params.id);
    if (!app) return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    const { rules } = await getCorporateCatalog();
    await audit(request, {
      module: 'CORPORATE', action: 'VIEW', entityType: 'CorporateApplication',
      entityId: app.applicationId, entityName: app.organization.name, description: 'Viewed business account application',
    });
    return NextResponse.json({ success: true, data: staffView(app, rules) });
  } catch (error) {
    console.error('[Corporate] Detail error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load the application' }, { status: 500 });
  }
}

/**
 * PATCH /api/corporate/applications/:id — KYC decisions. Body: { action, … }
 *   review                                   pick up (pending → in review)
 *   document  { docId, decision, note }      accept / reject one document
 *   signature { personId, decision, note }   accept / reject a specimen signature
 *   resend_invite { personId }               new verification link by SMS
 *   return { reason }                        back to the applicant to replace rejected files
 *   reject { reason } · escalate { reason } · approve · release
 * KYC officers act on pending / in-review applications, Senior Approvers on escalated ones; admin
 * can only resend links (no decisions, as for individual accounts).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireRole(request, [...STAFF]);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const role = request.headers.get('x-user-role') || '';
    const actor = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'unknown';

    const app = await load(params.id);
    if (!app) return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    const { rules } = await getCorporateCatalog();

    const auditAction: AuditAction =
      action === 'approve' ? 'APPROVE' : action === 'reject' ? 'REJECT' : action === 'return' ? 'RETURN'
      : action === 'escalate' ? 'ESCALATE' : action === 'review' ? 'REVIEW'
      : action === 'document' || action === 'signature' ? 'DOCUMENT_REVIEW'
      : action === 'resend_invite' ? 'INVITE' : 'UPDATE';
    const log = (description: string, status: AuditStatus = 'SUCCESS', extra: Partial<AuditEvent> = {}) => audit(request, {
      module: 'CORPORATE', action: auditAction, status, entityType: 'CorporateApplication',
      entityId: app.applicationId, entityName: app.organization.name, description, ...extra,
    });
    const refuse = async (error: string, httpStatus: number) => {
      await log(`Refused: ${error}`, 'DENIED');
      return NextResponse.json({ success: false, error }, { status: httpStatus });
    };
    const done = async (description: string) => {
      await log(description);
      const fresh = await load(params.id);
      return NextResponse.json({ success: true, data: staffView(fresh!, rules) });
    };
    const entry = (what: string, note = '') => ({ at: new Date(), by: actor, action: what, note });
    const changed = () => NextResponse.json({ success: false, error: 'The application was changed meanwhile. Please reload it.' }, { status: 409 });

    // Who may decide: KYC on pending / in review, a Senior Approver on escalated applications
    const escalated = app.status === 'escalated';
    const mayDecide = escalated ? role === 'senior_approver' : role === 'kyc' && KYC_STATUSES.includes(app.status);
    const decisionError = escalated
      ? 'Only a Senior Approver can act on an escalated application'
      : role !== 'kyc' ? 'Only a KYC officer can act on this application'
      : `This application is ${app.status.replace('_', ' ')} and cannot be changed now`;
    const decisionStatuses = escalated ? ['escalated'] : KYC_STATUSES;

    // ── Pick up ─────────────────────────────────────────────────────────────────────────────
    if (action === 'review') {
      if (role !== 'kyc') return refuse('Only a KYC officer can start the review', 403);
      const r = await CorporateApplication.updateOne(
        { _id: app._id, status: 'pending' },
        { $set: { status: 'in_review', reviewedBy: actor, reviewedAt: new Date() }, $push: { history: entry('Review started') } }
      );
      if (!r.modifiedCount) return changed();
      return done('Started review');
    }

    // ── One document / signature ────────────────────────────────────────────────────────────
    if (action === 'document' || action === 'signature') {
      if (!mayDecide) return refuse(decisionError, 403);
      const decision = ['accepted', 'rejected', 'pending'].includes(body.decision) ? body.decision : '';
      if (!decision) return refuse('Choose accept or reject', 400);
      const note = text(body.note, 500);
      if (decision === 'rejected' && note.length < 3) return refuse('Say why it is rejected — the applicant sees this note', 400);
      const review = { status: decision, note: decision === 'rejected' ? note : '', by: actor, at: new Date() };

      if (action === 'document') {
        const doc = app.documents.find(d => d.docId === body.docId);
        if (!doc?.file) return refuse('Document not found', 404);
        const r = await CorporateApplication.updateOne(
          { _id: app._id, status: { $in: decisionStatuses }, documents: { $elemMatch: { docId: doc.docId, 'file.fileId': doc.file.fileId } } },
          { $set: { 'documents.$.review': review }, $push: { history: entry(`Document ${decision}`, `${doc.name}${review.note ? `: ${review.note}` : ''}`) } }
        );
        if (!r.modifiedCount) return changed();
        return done(`${doc.name}: ${decision}${review.note ? ` — ${review.note}` : ''}`);
      }
      const person = app.people.find(p => p.id === body.personId);
      if (!person?.signature) return refuse('Signature not found', 404);
      const r = await CorporateApplication.updateOne(
        { _id: app._id, status: { $in: decisionStatuses }, people: { $elemMatch: { id: person.id, 'signature.fileId': person.signature.fileId } } },
        { $set: { 'people.$.signature.review': review }, $push: { history: entry(`Signature ${decision}`, `${person.verification?.fullName || person.fullName}${review.note ? `: ${review.note}` : ''}`) } }
      );
      if (!r.modifiedCount) return changed();
      return done(`Specimen signature of ${person.verification?.fullName || person.fullName}: ${decision}${review.note ? ` — ${review.note}` : ''}`);
    }

    // ── Verification link again ─────────────────────────────────────────────────────────────
    if (action === 'resend_invite') {
      const result = await resendInvite(app, String(body.personId || ''), actor, rules.inviteValidDays, 10);
      if (result.error) return refuse(result.error, result.status || 400);
      if (!result.smsSent) {
        await log(`Verification link for ${result.person!.fullName}: SMS failed`, 'FAILURE');
        return NextResponse.json({ success: false, error: 'The SMS could not be sent. Please try again.' }, { status: 502 });
      }
      return done(`Verification link sent again to ${result.person!.fullName}`);
    }

    // ── An approval that never finished (server stopped during the FlexCube calls) ─────────
    if (action === 'release') {
      if (role !== 'kyc' && role !== 'senior_approver') return refuse('Only KYC or a Senior Approver can do this', 403);
      if (app.status !== 'approving' || !app.approvalStartedAt || Date.now() - new Date(app.approvalStartedAt).getTime() < STALE_APPROVAL_MS) {
        return refuse('The approval is still running — wait a few minutes', 409);
      }
      const back = app.approvalFrom && app.approvalFrom !== 'approving' ? app.approvalFrom : 'in_review';
      const r = await CorporateApplication.updateOne(
        { _id: app._id, status: 'approving', approvalStartedAt: app.approvalStartedAt },
        { $set: { status: back }, $unset: { approvalStartedAt: 1, approvalFrom: 1 }, $push: { history: entry('Unfinished approval released', 'Check FlexCube before approving again') } }
      );
      if (!r.modifiedCount) return changed();
      return done(`Released an approval that did not finish (back to ${back.replace('_', ' ')})`);
    }

    const applicant = app.people.find(p => p.isApplicant);
    const reason = text(body.reason, 500);

    // ── Back to the applicant ───────────────────────────────────────────────────────────────
    if (action === 'return') {
      if (!mayDecide) return refuse(decisionError, 403);
      if (reason.length < 5) return refuse('Write what the applicant must change', 400);
      const rejected = app.documents.some(d => d.review?.status === 'rejected')
        || app.people.some(p => p.signature?.review?.status === 'rejected');
      if (!rejected) return refuse('Reject the documents or signatures the applicant must replace first', 400);
      const r = await CorporateApplication.updateOne(
        { _id: app._id, status: { $in: decisionStatuses } },
        { $set: { status: 'returned', returnReason: reason, returnedAt: new Date(), returnedBy: actor }, $push: { history: entry('Returned to the applicant', reason) } }
      );
      if (!r.modifiedCount) return changed();
      // the SMS carries the status-page link, where the applicant uploads the replacements
      const withKey = await CorporateApplication.findById(app._id).select('+accessKey -people -documents -history -screening').lean() as { accessKey: string } | null;
      if (applicant?.phone && withKey) sendSMS(applicant.phone, smsReturned(app.applicationId, app.organization.name, reason, statusLink(app.applicationId, withKey.accessKey)));
      return done(`Returned to the applicant: ${reason}`);
    }

    if (action === 'reject') {
      // also possible while people are still verifying (e.g. nobody ever verifies)
      const allowed = mayDecide || (role === 'kyc' && app.status === 'awaiting_verification');
      if (!allowed) return refuse(decisionError, 403);
      if (reason.length < 5) return refuse('Write the reason for rejecting', 400);
      const r = await CorporateApplication.updateOne(
        { _id: app._id, status: app.status },
        { $set: { status: 'rejected', rejectionReason: reason, rejectedAt: new Date(), rejectedBy: actor }, $push: { history: entry('Rejected', reason) } }
      );
      if (!r.modifiedCount) return changed();
      if (applicant?.phone) sendSMS(applicant.phone, smsRejected(app.applicationId, app.organization.name, reason));
      return done(`Rejected: ${reason}`);
    }

    if (action === 'escalate') {
      if (role !== 'kyc' || !KYC_STATUSES.includes(app.status)) return refuse(role !== 'kyc' ? 'Only a KYC officer can escalate' : decisionError, 403);
      if (reason.length < 5) return refuse('Write why it goes to a Senior Approver', 400);
      const r = await CorporateApplication.updateOne(
        { _id: app._id, status: { $in: KYC_STATUSES } },
        { $set: { status: 'escalated', escalationReason: reason, escalatedAt: new Date(), escalatedBy: actor }, $push: { history: entry('Escalated to a Senior Approver', reason) } }
      );
      if (!r.modifiedCount) return changed();
      return done(`Escalated to a Senior Approver: ${reason}`);
    }

    // ── Approve: corporate CIF + account in FlexCube ────────────────────────────────────────
    if (action === 'approve') {
      if (!mayDecide) return refuse(decisionError, 403);
      if (!escalated && app.complianceHold) {
        return refuse('PEP / sanctions match: a KYC officer cannot approve this application. Please escalate it to a Senior Approver.', 403);
      }
      const blockers = approvalBlockers(app, rules);
      if (blockers.length) return refuse(`Not ready to approve: ${blockers.join('; ')}`, 400);

      // Only one approval at a time — a second click, or a colleague, finds it taken
      const claimed = await CorporateApplication.updateOne(
        { _id: app._id, status: app.status },
        { $set: { status: 'approving', approvalStartedAt: new Date(), approvalFrom: app.status } }
      );
      if (!claimed.modifiedCount) return changed();

      const settings = (await WorkflowSettings.findById('default')) || (await WorkflowSettings.create(defaultWorkflowSettings));
      const flexcubeEnabled = settings.flexcubeEnabled !== false;
      const config = getFlexCubeConfig(settings);

      // IFB accounts open in the IFB branch — resolved again in case the mapping was added later
      let branchCode = app.branchCode;
      let conventionalBranchCode = app.conventionalBranchCode || '';
      if (app.isIFB) {
        const ifbCode = await ifbBranchFor(conventionalBranchCode || app.branchCode);
        if (ifbCode && ifbCode !== branchCode) { conventionalBranchCode = conventionalBranchCode || branchCode; branchCode = ifbCode; }
      }
      // Organizations always open the class the product names (the individual SPRI mapping does not apply)
      const setup = accountSetupFor(
        { isIFB: app.isIFB, accountClassCode: app.accountClassCode, tierId: app.tierId },
        { useProductAccountClass: true, flexcubeIfbAccountClass: settings.flexcubeIfbAccountClass, flexcubeIfbAccountCode: settings.flexcubeIfbAccountCode }
      );
      const nameOf = (p: ICorporateApplication['people'][number]) => p.verification?.fullName || p.fullName;
      const directors = app.people.filter(p => p.roles.includes('director')).map(nameOf);
      const signatories = app.people.filter(p => p.roles.includes('signatory')).map(nameOf);
      const pep = app.people.some(p => p.verification?.screening?.hasPEP);

      let cifNumber = app.cifNumber || '';
      let accountNumber = '';
      let flexcubeMessage = '';
      if (flexcubeEnabled) {
        const o = app.organization;
        const result = await createCorporateCustomerAndAccount({
          name: o.name, categoryName: o.categoryName, branchCode: branchCode || config.defaultBranch,
          tin: o.tin, vatNumber: o.vatNumber, registrationNumber: o.registrationNumber,
          registeredAddress: o.registeredAddress, sameCorrespondenceAddress: o.sameCorrespondenceAddress,
          correspondenceAddress: o.correspondenceAddress,
          phone: o.phone, fax: o.fax, email: o.email, mobile: o.mobile || applicant?.phone || '',
          directors: directors.length ? directors : signatories,
          promotionType: app.promotionType || 'Walk in customer',
          wealthSource: o.sourceOfFunds, otherWealthSource: o.otherSourceOfFunds,
          industry: o.industry, otherIndustry: o.otherIndustry, annualIncome: o.annualIncome,
          pep, agentNationalId: applicant?.verification?.uin || applicant?.verification?.fan || '',
          tierId: setup.tierId, accountClass: setup.accountClass, islamic: setup.islamic,
          existingCif: app.cifNumber || undefined,
        }, config);

        if (!result.success || !result.accountNumber) {
          // Back to where it was; a CIF that was created is kept so a retry only opens the account
          await CorporateApplication.updateOne(
            { _id: app._id, status: 'approving' },
            {
              $set: {
                status: app.status, flexcubeMessage: result.message, branchCode, conventionalBranchCode,
                ...(result.cifNumber ? { cifNumber: result.cifNumber } : {}),
              },
              $unset: { approvalStartedAt: 1, approvalFrom: 1 },
              $push: { history: entry('Approval failed in FlexCube', result.message) },
            }
          );
          await log(`FlexCube failed: ${result.message}`, 'FAILURE', { action: 'APPROVE_FAILED' });
          return NextResponse.json({ success: false, error: `FlexCube integration failed: ${result.message}`, cifNumber: result.cifNumber }, { status: 502 });
        }
        cifNumber = result.cifNumber || cifNumber;
        accountNumber = result.accountNumber;
        flexcubeMessage = result.message + (setup.islamic ? ` (IFB, CreateIACustAcc, class ${setup.accountClass})` : ` (class ${setup.accountClass})`);
      } else {
        // FlexCube switched off (testing): local numbers in the same shape
        cifNumber = cifNumber || String(9000000 + Math.floor(Math.random() * 999999));
        const product = String(setup.tierId || '100').padStart(3, '0').slice(-3);
        accountNumber = `${String(branchCode || '103').padStart(3, '0')}${product}${cifNumber}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
        flexcubeMessage = `Local generation (FlexCube disabled) — CIF: ${cifNumber}, Account: ${accountNumber}`;
      }

      await CorporateApplication.updateOne(
        { _id: app._id, status: 'approving' },
        {
          $set: {
            status: 'approved', approvedBy: actor, approvedAt: new Date(), cifNumber, accountNumber, flexcubeMessage,
            branchCode, conventionalBranchCode,
          },
          $unset: { approvalStartedAt: 1, approvalFrom: 1 },
          $push: { history: entry('Approved', `CIF ${cifNumber}, account ${accountNumber}`) },
        }
      );
      console.log(`[Corporate] ${app.applicationId} ${app.organization.name} approved — ${flexcubeMessage}`);

      // No debits until the account is activated at the branch (same as individual accounts)
      if (flexcubeEnabled) {
        const FAYDA_BACKEND_URL = process.env.FAYDA_BACKEND_URL || 'http://localhost:5000';
        try {
          const res = await fetch(`${FAYDA_BACKEND_URL}/api/flexcube/set-no-debit`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountNumber }),
          });
          const data = await res.json();
          if (data.success) console.log(`[NoDebit] Account ${accountNumber} flagged as No-Debit`);
          else console.error(`[NoDebit] failed to set No-Debit: ${data.error}`);
        } catch (err: any) {
          console.error('[NoDebit] Error calling Fayda backend:', err.message);
        }
      }
      if (applicant?.phone) sendSMS(applicant.phone, smsApproved(app.organization.name, cifNumber, accountNumber, app.branch));

      return done(`Approved — CIF ${cifNumber}, account ${accountNumber}${setup.islamic ? ` (IFB, class ${setup.accountClass})` : ''}`
        + `; ${app.people.length} people (${app.people.map(p => `${nameOf(p)}: ${roleText(p.roles)}`).join(', ')})`
        + (escalated ? ' — Senior Approver decision' : '') + (screeningHold({ hasPEP: pep }) ? ' — PEP involved' : ''));
    }

    return refuse('Unknown action', 400);
  } catch (error: any) {
    console.error('[Corporate] Action error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update the application', detail: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}
