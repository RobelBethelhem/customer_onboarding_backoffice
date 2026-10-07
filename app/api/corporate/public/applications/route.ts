import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CorporateApplication, {
  CorporateRole, ICorporateAddress, ICorporatePerson, SigningRule,
} from '@/lib/models/CorporateApplication';
import CorporateVerification, { ICorporateVerification } from '@/lib/models/CorporateVerification';
import { getCorporateCatalog, documentsFor } from '@/lib/corporateCatalog';
import { findAccountClass } from '@/lib/accountProducts';
import { getBranches, ifbBranchFor } from '@/lib/ifbBranches';
import { verifyIdentity } from '@/lib/faydaTokens';
import { sendSMS } from '@/lib/sms';
import { audit } from '@/lib/audit';
import {
  bad, text, newSecret, hashSecret, normalizeMobile, nextCorporateId, loadUploads, fileRef, claimUploads, releaseUploads,
  inviteLink, statusLink, smsInvite, smsSubmitted, personActor, publicView, screenName, screeningHold, SIGNING_RULES,
  matchesHash, maskPhone,
} from '@/lib/corporate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROLES: CorporateRole[] = ['signatory', 'director'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOV_CODE = /^[A-Z]{1,6}$/;              // FlexCube list-of-values code (industry, source of funds)
const DAY_MS = 24 * 60 * 60 * 1000;

const rolesOf = (v: unknown): CorporateRole[] => (Array.isArray(v) ? ROLES.filter(r => v.includes(r)) : []);

const addressOf = (a: any): ICorporateAddress => ({
  city: text(a?.city, 60),
  subCity: text(a?.subCity, 60),
  woreda: text(a?.woreda, 60),
  houseNumber: text(a?.houseNumber, 30),
});

interface FileInput { fileId?: string; fileKey?: string }

/**
 * POST /api/corporate/public/applications — public (web app, through the Fayda backend).
 * A business account application, sent by the organization's representative after verifying with
 * Fayda. The other signatories and directors get an SMS link to verify with Fayda themselves; the
 * application reaches KYC once everyone has.
 *
 * Body: {
 *   applicant: { ekycToken, faceVerificationToken?, faydaPhoto, selfie, livenessFrames?, faceVideoId?, phone, roles, signature? },
 *   organization: { name, categoryId, subtypeId, registrationNumber, …, registeredAddress, correspondenceAddress },
 *   branchCode, accountTypeId, accountClassCode, signingRule, signingRuleOther,
 *   groupId,                                               // the wizard's id for this application
 *   people: [{ verificationId, verificationKey, roles, signature? }   // verified with the applicant, or link sent
 *          | { fullName, phone, roles, signature? }],               // (older form) link sent on submission
 *   documents: [{ docId, fileId, fileKey }],
 * }   (signature = { fileId, fileKey } from /api/corporate/public/files)
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return bad('Invalid request');
    const { categories, rules } = await getCorporateCatalog();

    // ── Organization ────────────────────────────────────────────────────────────────────────
    const o = body.organization || {};
    const category = categories.find(c => c.active && c.id === o.categoryId);
    if (!category) return bad('Choose the type of your organization');
    const activeSubtypes = category.subtypes.filter(s => s.active);
    const subtype = activeSubtypes.find(s => s.id === o.subtypeId);
    if (activeSubtypes.length && !subtype) return bad(`Choose which kind of ${category.name} it is`);

    const name = text(o.name, 150).replace(/\s+/g, ' ');
    if (name.length < 2) return bad('Enter the name of the organization');
    const registrationNumber = text(o.registrationNumber, 60);
    if (!registrationNumber) return bad('Enter the registration or license number');
    const tin = text(o.tin, 20).replace(/\s/g, '');
    if (tin && !/^\d{10}$/.test(tin)) return bad('The TIN has 10 digits');
    const establishmentDate = /^\d{4}-\d{2}-\d{2}$/.test(String(o.establishmentDate || '')) ? String(o.establishmentDate) : '';

    const industry = text(o.industry, 6).toUpperCase();
    if (!LOV_CODE.test(industry)) return bad('Choose the industry');
    const otherIndustry = text(o.otherIndustry, 100);
    if (industry === 'O' && !otherIndustry) return bad('Describe the industry');
    const sourceOfFunds = text(o.sourceOfFunds, 6).toUpperCase();
    if (!LOV_CODE.test(sourceOfFunds)) return bad('Choose the source of funds');
    const otherSourceOfFunds = text(o.otherSourceOfFunds, 100);
    if (sourceOfFunds === 'O' && !otherSourceOfFunds) return bad('Describe the source of funds');
    const annualIncome = Math.max(0, Math.min(Number(o.annualIncome) || 0, 1e15));

    const mobile = o.mobile ? normalizeMobile(o.mobile) : '';
    if (o.mobile && !mobile) return bad('Enter a valid mobile number for the organization (09… or 07…)');
    const phone = text(o.phone, 20).replace(/[^\d+]/g, '');
    if (!mobile && phone.length < 9) return bad('Enter a phone number for the organization');
    const email = text(o.email, 100).toLowerCase();
    if (email && !EMAIL.test(email)) return bad('Enter a valid email address');

    const registeredAddress = addressOf(o.registeredAddress);
    if (!registeredAddress.city || !registeredAddress.subCity) return bad('Enter the city and sub-city of the registered address');
    const sameCorrespondenceAddress = o.sameCorrespondenceAddress !== false;
    const correspondenceAddress = sameCorrespondenceAddress ? { ...registeredAddress } : addressOf(o.correspondenceAddress);
    if (!correspondenceAddress.city) return bad('Enter the city of the correspondence address');

    // ── Branch and account ──────────────────────────────────────────────────────────────────
    const branch = (await getBranches()).find(b => b.active && b.conventionalCode === text(body.branchCode, 10));
    if (!branch) return bad('Choose a branch');
    const catalogEntry = await findAccountClass(text(body.accountTypeId, 60), text(body.accountClassCode, 30));
    const offered = !!catalogEntry && catalogEntry.product.active && catalogEntry.accountClass.active !== false
      && ['organization', 'both'].includes(catalogEntry.product.audience || 'individual');
    if (!catalogEntry || !offered) return bad('Choose an account type for organizations');
    const { product, accountClass } = catalogEntry;

    // ── People ──────────────────────────────────────────────────────────────────────────────
    const a = body.applicant || {};
    const applicantPhone = normalizeMobile(a.phone);
    if (!applicantPhone) return bad('Enter your mobile number (09… or 07…)');
    const others: any[] = Array.isArray(body.people) ? body.people : [];
    if (others.length + 1 > rules.maxPeople) return bad(`An application can have at most ${rules.maxPeople} people, including you`);

    const people: ICorporatePerson[] = [{
      id: 'P1', fullName: '', phone: applicantPhone, roles: rolesOf(a.roles), isApplicant: true,
      verification: { status: 'pending' },
    }];
    const signatureInputs: (FileInput | undefined)[] = [a.signature];
    const phones = new Set([applicantPhone]);

    // People who verified with the applicant, or got their SMS link, while the form was filled in
    const groupId = text(body.groupId, 64);
    const verificationIds: string[] = others.map(p => text(p?.verificationId, 40)).filter(Boolean);
    if (new Set(verificationIds).size !== verificationIds.length) return bad('The same person is on the application twice.');
    const records: ICorporateVerification[] = verificationIds.length
      ? await CorporateVerification.find({ verificationId: { $in: verificationIds }, cancelled: false }) : [];
    const taken: { rec: ICorporateVerification; status: string }[] = [];

    for (let i = 0; i < others.length; i++) {
      const p = others[i] || {};
      if (p.verificationId) {
        const rec = records.find(r => r.verificationId === text(p.verificationId, 40));
        if (!rec || rec.applicationId || !groupId || rec.groupId !== groupId || !matchesHash(String(p.verificationKey || ''), rec.keyHash)) {
          return bad(`Person ${i + 2} is no longer on this application (removed or expired). Please add them again.`, 400, { verificationId: p.verificationId });
        }
        const verified = rec.verification?.status === 'verified';
        const roles = rolesOf(p.roles).length ? rolesOf(p.roles) : rec.roles;
        if (rec.mode === 'link') {
          if (phones.has(rec.phone)) return bad(`${maskPhone(rec.phone)}: each person needs their own mobile number — the verification link is sent to it`);
          phones.add(rec.phone);
        }
        people.push({
          id: `P${i + 2}`,
          fullName: verified ? rec.verification.fullName || 'Verified person' : rec.enteredName || `Mobile ${maskPhone(rec.phone)}`,
          phone: rec.phone, roles, isApplicant: false,
          ...(verified ? { verifiedVia: rec.mode } : {}),
          verification: verified ? (rec.toObject().verification as any) : { status: 'pending' },
          ...(!verified && rec.invite ? { invite: rec.toObject().invite as any } : {}),
        });
        taken.push({ rec, status: verified ? 'verified' : 'pending' });
        signatureInputs.push(p.signature);
        continue;
      }
      const fullName = text(p.fullName, 100).replace(/\s+/g, ' ');
      if (fullName.split(' ').length < 2) return bad(`Enter the full name of person ${i + 2}`);
      const phone = normalizeMobile(p.phone);
      if (!phone) return bad(`Enter a valid mobile number for ${fullName}`);
      if (phones.has(phone)) return bad(`${fullName}: each person needs their own mobile number — the verification link is sent to it`);
      phones.add(phone);
      const roles = rolesOf(p.roles);
      if (!roles.length) return bad(`Choose whether ${fullName} is a signatory, a director or both`);
      people.push({ id: `P${i + 2}`, fullName, phone, roles, isApplicant: false, verification: { status: 'pending' } });
      signatureInputs.push(p.signature);
    }
    const signatories = people.filter(p => p.roles.includes('signatory'));
    if (!signatories.length) return bad('Add at least one person who signs for the account');

    const signingRule: SigningRule = (Object.keys(SIGNING_RULES) as SigningRule[]).includes(body.signingRule) ? body.signingRule : 'single';
    const signingRuleOther = signingRule === 'other' ? text(body.signingRuleOther, 300) : '';
    if (signingRule === 'other' && !signingRuleOther) return bad('Describe who signs for the account');
    if (signingRule === 'any_two' && signatories.length < 2) return bad('“Any two signatories jointly” needs at least two signatories');

    // ── Documents and signatures ────────────────────────────────────────────────────────────
    const docTypes = documentsFor(category, subtype?.id || '');
    const givenDocs: any[] = (Array.isArray(body.documents) ? body.documents : []).filter((d: any) => d?.docId && d?.fileId);
    if (givenDocs.some(d => !docTypes.some(t => t.id === d.docId))) return bad('A document does not belong to this type of organization. Please go back to the documents step.');
    const missingDocs = docTypes.filter(t => t.required && !givenDocs.some(d => d.docId === t.id));
    if (missingDocs.length) return bad(`Please upload: ${missingDocs.map(t => t.name).join(', ')}`);

    const hasSignature = (i: number) => !!signatureInputs[i]?.fileId && people[i].roles.includes('signatory');
    if (rules.signatureRequired) {
      const without = people.filter((p, i) => p.roles.includes('signatory') && !hasSignature(i));
      if (without.length) return bad(`Please upload the specimen signature of ${without.map(p => p.isApplicant ? 'yourself' : p.fullName).join(', ')}`);
    }

    const refs = [
      ...givenDocs.map(d => ({ fileId: String(d.fileId), fileKey: String(d.fileKey || ''), kind: 'document' as const })),
      ...people.map((_, i) => i).filter(hasSignature)
        .map(i => ({ fileId: String(signatureInputs[i]!.fileId), fileKey: String(signatureInputs[i]!.fileKey || ''), kind: 'signature' as const })),
    ];
    if (new Set(refs.map(r => r.fileId)).size !== refs.length) return bad('The same upload is used twice. Please upload each file separately.');
    const { files, error: uploadError, fileId: failedFile, usedBy } = await loadUploads(refs);
    // Sent again (e.g. the answer to the first Submit was lost): only the uploader has the file keys
    if (usedBy) return bad(`This application was already sent as ${usedBy}. Follow it with the link we sent you by SMS.`, 409, { applicationId: usedBy });
    if (uploadError) return bad(uploadError, 400, { fileId: failedFile });

    // ── The applicant's identity (Fayda eKYC + live face check, signed by the Fayda backend) ──
    const identity = await verifyIdentity({
      ekycToken: String(a.ekycToken || ''),
      faceVerificationToken: String(a.faceVerificationToken || ''),
      faydaPhoto: String(a.faydaPhoto || ''),
      selfie: String(a.selfie || ''),
      livenessFrames: Array.isArray(a.livenessFrames) ? a.livenessFrames : [],
      faceVideoId: text(a.faceVideoId, 100),
    });
    if (!identity.verification) return bad(identity.error || 'Please verify with Fayda again.', 401);
    const me = identity.verification;
    const verifiedUins = people.slice(1).map(p => p.verification.uin).filter(Boolean) as string[];
    if (me.uin && verifiedUins.includes(me.uin)) return bad('You are also added as another person. Each person verifies with their own Fayda ID — please remove them.', 409);
    if (new Set(verifiedUins).size !== verifiedUins.length) return bad('The same Fayda ID verified for two people. Please remove one of them.', 409);
    me.screening = await screenName(me.fullName || '', me.dateOfBirth);
    people[0].fullName = me.fullName || 'Applicant';
    people[0].verification = me;

    // PEP / sanctions screening: the organization's name now, each person when they verify
    const organizationScreening = await screenName(name);
    const complianceHold = screeningHold(organizationScreening) || people.some(p => screeningHold(p.verification?.screening));

    // Interest-free accounts open in the IFB counterpart of the chosen branch (e.g. 164 → 664)
    let branchCode = branch.conventionalCode;
    let conventionalBranchCode = '';
    if (product.isIFB) {
      const ifbCode = await ifbBranchFor(branch.conventionalCode);
      if (ifbCode) { conventionalBranchCode = branch.conventionalCode; branchCode = ifbCode; }
      else console.warn(`[Corporate] No IFB branch code configured for branch ${branch.conventionalCode} — kept as is`);
    }

    // Uploads, and a verification link for everyone except the applicant
    people.forEach((p, i) => {
      const f = hasSignature(i) ? files.get(String(signatureInputs[i]!.fileId)) : undefined;
      if (f) p.signature = { ...fileRef(f), review: { status: 'pending' }, previous: [] };
    });
    const documents = docTypes.map(t => {
      const given = givenDocs.find(d => d.docId === t.id);
      const f = given ? files.get(String(given.fileId)) : undefined;
      return { docId: t.id, name: t.name, required: t.required, file: f ? fileRef(f) : undefined, previousFiles: [], review: { status: 'pending' as const } };
    });
    const tokens = new Map<string, string>();
    for (const p of people.slice(1)) {
      if (p.verification.status === 'verified' || p.invite) continue; // verified already, or link sent already
      const token = newSecret();
      tokens.set(p.id, token);
      p.invite = { tokenHash: hashSecret(token), sentAt: new Date(), sentCount: 1, expiresAt: new Date(Date.now() + rules.inviteValidDays * DAY_MS), smsSent: false };
    }

    const accessKey = newSecret();
    const everyoneVerified = people.every(p => p.verification.status === 'verified');
    const withApplicant = people.filter(p => p.verifiedVia === 'with_applicant').length;
    const viaLink = people.filter(p => p.verifiedVia === 'link').length;
    const waiting = people.filter(p => p.verification.status !== 'verified').length;
    const peopleNote = [
      withApplicant && `${withApplicant} verified with the applicant`,
      viaLink && `${viaLink} verified from the SMS link`,
      waiting && `${waiting} still to verify`,
    ].filter(Boolean).join(', ');
    const record = {
      applicationId: await nextCorporateId(),
      status: everyoneVerified ? 'pending' : 'awaiting_verification',
      accessKey,
      organization: {
        name, categoryId: category.id, categoryName: category.name, subtypeId: subtype?.id || '', subtypeName: subtype?.name || '',
        registrationNumber, registrationIssuedBy: text(o.registrationIssuedBy, 100), establishmentDate,
        tradeLicenseNumber: text(o.tradeLicenseNumber, 60), tin, vatNumber: text(o.vatNumber, 30),
        industry, otherIndustry: industry === 'O' ? otherIndustry : '',
        sourceOfFunds, otherSourceOfFunds: sourceOfFunds === 'O' ? otherSourceOfFunds : '', annualIncome,
        phone, mobile, fax: text(o.fax, 20), email, poBox: text(o.poBox, 20),
        registeredAddress, sameCorrespondenceAddress, correspondenceAddress,
      },
      branch: branch.branchName, branchCode, conventionalBranchCode,
      accountTypeId: product.id, accountTypeName: product.name,
      accountClassCode: accountClass.code, accountClassName: accountClass.name,
      tierId: accountClass.productNumber || '', isIFB: product.isIFB,
      signingRule, signingRuleOther,
      people, documents,
      screening: { organization: organizationScreening },
      complianceHold,
      history: [{
        at: new Date(), by: people[0].fullName, action: 'Submitted',
        note: (everyoneVerified ? 'Sent to KYC' : 'Waiting for verification') + (peopleNote ? ` — ${peopleNote}` : ''),
      }],
      submittedAt: new Date(),
      verifiedAt: everyoneVerified ? new Date() : undefined,
    };

    // Two submissions at the same moment can pick the same number: take the next one and retry
    let app;
    for (let attempt = 1; ; attempt++) {
      try {
        app = await CorporateApplication.create(record);
        break;
      } catch (e: any) {
        if (e?.code !== 11000 || !e?.keyPattern?.applicationId || attempt >= 3) throw e;
        record.applicationId = await nextCorporateId();
      }
    }
    // A second click on Submit finds the uploads taken: keep only the first application
    if (!(await claimUploads(refs.map(r => r.fileId), app.applicationId))) {
      await CorporateApplication.deleteOne({ _id: app._id });
      return bad('This application has already been submitted.', 409);
    }
    // Take over the people's records — unless one changed since they were read (someone just
    // verified, or the same records went with another submission): then start again
    const claimed: ICorporateVerification[] = [];
    for (const { rec, status } of taken) {
      const r = await CorporateVerification.updateOne(
        { _id: rec._id, applicationId: '', cancelled: false, 'verification.status': status },
        { $set: { applicationId: app.applicationId } }
      );
      if (!r.modifiedCount) break;
      claimed.push(rec);
    }
    if (claimed.length !== taken.length) {
      await CorporateVerification.updateMany({ _id: { $in: claimed.map(r => r._id) }, applicationId: app.applicationId }, { $set: { applicationId: '' } });
      await releaseUploads(refs.map(r => r.fileId), app.applicationId);
      await CorporateApplication.deleteOne({ _id: app._id });
      return bad('Someone on the application has just finished verifying. Please press Submit again.', 409);
    }
    if (claimed.length) await CorporateVerification.deleteMany({ _id: { $in: claimed.map(r => r._id) }, applicationId: app.applicationId });

    await audit(request, {
      module: 'CORPORATE', action: 'SUBMIT', entityType: 'CorporateApplication',
      entityId: app.applicationId, entityName: name,
      description: `Submitted by ${people[0].fullName} — ${category.name}${subtype ? ` (${subtype.name})` : ''}, `
        + `${product.name} / ${accountClass.name}, ${people.length} ${people.length === 1 ? 'person' : 'people'}, `
        + `${documents.filter(d => d.file).length} document(s)`
        + (peopleNote ? `; ${peopleNote}` : '')
        + (complianceHold ? ' — screening match: KYC must escalate to a Senior Approver' : ''),
      actor: personActor(people[0].fullName),
    });

    // SMS: a verification link to each person, then the status link to the applicant
    const applicationId = app.applicationId;
    const appId = app._id;
    void (async () => {
      const toInvite = people.map((p, index) => ({ p, index })).filter(({ p }) => tokens.has(p.id));
      const sent = await Promise.all(toInvite.map(({ p }) => sendSMS(
        p.phone, smsInvite(p.fullName, people[0].fullName, name, p.roles, inviteLink(tokens.get(p.id)!), rules.inviteValidDays)
      )));
      if (sent.length) {
        const set: Record<string, boolean> = {};
        sent.forEach((ok, i) => { set[`people.${toInvite[i].index}.invite.smsSent`] = ok; });
        await CorporateApplication.updateOne({ _id: appId }, { $set: set });
      }
      await sendSMS(applicantPhone, smsSubmitted(applicationId, name, waiting, statusLink(applicationId, accessKey)));
    })().catch(e => console.error('[Corporate] SMS after submission failed:', e?.message || e));

    return NextResponse.json({
      success: true,
      data: { applicationId, accessKey, status: app.status, view: publicView(app) },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Corporate] Submission error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to submit the application',
      detail: String(error?.message || error).slice(0, 500),
    }, { status: 500 });
  }
}
