'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, CheckCircle2, XCircle, Shield, Eye, Loader2, AlertTriangle, FileText, Users,
  Send, Clock, ExternalLink, PenLine, History, Landmark, RotateCcw, UserCheck,
} from 'lucide-react';
import { formatDate } from '@/lib/api';
import { ensureDataUri } from '@/lib/imageUtils';
import { useAuth } from '@/components/AuthProvider';
import FaceVerificationPanel from '@/components/FaceVerificationPanel';
import {
  CORPORATE_STATUS, CorporateApplication, CorporatePerson, CorporateReview, ScreeningSummary,
  roleLabel, fileUrl, INDUSTRY_LABELS, FUNDS_LABELS, CorporateAddress,
} from '@/lib/corporateTypes';

type Dialog =
  | { kind: 'return' | 'reject' | 'escalate' }
  | { kind: 'document'; docId: string; name: string }
  | { kind: 'signature'; personId: string; name: string };

const DIALOG_TEXT: Record<Dialog['kind'], { title: string; hint: string; button: string; color: string }> = {
  return: { title: 'Return to the applicant', hint: 'The applicant gets this by SMS with a link to upload the rejected files again.', button: 'Return', color: 'bg-orange-600 hover:bg-orange-700' },
  reject: { title: 'Reject application', hint: 'The applicant is told by SMS. This cannot be undone.', button: 'Reject', color: 'bg-red-600 hover:bg-red-700' },
  escalate: { title: 'Escalate to a Senior Approver', hint: 'For PEP / sanctions matches or anything a Senior Approver must decide.', button: 'Escalate', color: 'bg-purple-600 hover:bg-purple-700' },
  document: { title: 'Reject document', hint: 'The applicant sees this note when the application is returned.', button: 'Reject document', color: 'bg-red-600 hover:bg-red-700' },
  signature: { title: 'Reject specimen signature', hint: 'The applicant sees this note when the application is returned.', button: 'Reject signature', color: 'bg-red-600 hover:bg-red-700' },
};

const address = (a?: CorporateAddress) =>
  a ? [a.city, a.subCity, a.woreda && `Woreda ${a.woreda}`, a.houseNumber && `House ${a.houseNumber}`].filter(Boolean).join(', ') || '-' : '-';

const money = (n?: number) => (n || n === 0 ? `${Number(n).toLocaleString()} ETB` : '-');

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 font-medium break-words">{value || value === 0 ? value : '-'}</p>
    </div>
  );
}

function Card({ icon: Icon, title, subtitle, children, tone = 'indigo' }: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode; tone?: 'indigo' | 'green' | 'amber' | 'slate';
}) {
  const tones = { indigo: 'bg-indigo-100 text-indigo-600', green: 'bg-green-100 text-green-600', amber: 'bg-amber-100 text-amber-600', slate: 'bg-slate-100 text-slate-600' };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}><Icon className="w-5 h-5" /></div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function ReviewBadge({ review, missing }: { review?: CorporateReview; missing?: boolean }) {
  if (missing) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Not provided</span>;
  const s = review?.status || 'pending';
  const style = s === 'accepted' ? 'bg-green-100 text-green-700' : s === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>{s === 'pending' ? 'To check' : s === 'accepted' ? 'Accepted' : 'Rejected'}</span>;
}

function ScreeningResult({ s, label }: { s?: ScreeningSummary; label: string }) {
  if (!s) return <p className="text-sm text-gray-500">{label}: not screened</p>;
  const hit = s.hasPEP || s.blocked;
  return (
    <div className={`p-3 rounded-lg border text-sm ${s.status === 'ERROR' ? 'bg-amber-50 border-amber-200 text-amber-800' : hit ? 'bg-purple-50 border-purple-200 text-purple-900' : s.status === 'MATCHED' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-800'}`}>
      <p className="font-medium flex items-center gap-1.5">
        <Shield className="w-4 h-4" /> {label}: {s.status === 'ERROR' ? 'screening could not run' : s.status === 'CLEAR' ? 'no match' : `${s.matches.length} possible match${s.matches.length === 1 ? '' : 'es'} (risk ${s.riskLevel})${s.hasPEP ? ' — PEP' : ''}${s.blocked ? ' — sanctions' : ''}`}
      </p>
      {s.matches.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {s.matches.map((m, i) => (
            <li key={i}>{m.fullName} · {m.sanctionType} · {m.sourceId} · {m.matchScore}% ({m.matchStrength}){m.reason ? ` — ${m.reason}` : ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One business account application: organization, people and their Fayda checks, documents, decisions */
export default function CorporateApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [app, setApp] = useState<CorporateApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/corporate/applications/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load');
      setApp(data.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}, label = action) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/corporate/applications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed');
        if (res.status === 409 || res.status === 502) load();
        return false;
      }
      setApp(data.data);
      if (action === 'approve') setNotice(`Account opened — CIF ${data.data.cifNumber}, account ${data.data.accountNumber}`);
      if (action === 'resend_invite') setNotice('Verification link sent again by SMS');
      return true;
    } catch (e: any) {
      setError(e.message || 'Failed');
      return false;
    } finally {
      setBusy('');
    }
  }

  async function confirmDialog() {
    if (!dialog) return;
    const ok = dialog.kind === 'document' ? await act('document', { docId: dialog.docId, decision: 'rejected', note: reason }, `doc:${dialog.docId}`)
      : dialog.kind === 'signature' ? await act('signature', { personId: dialog.personId, decision: 'rejected', note: reason }, `sig:${dialog.personId}`)
      : await act(dialog.kind, { reason });
    if (ok) { setDialog(null); setReason(''); }
  }

  if (loading) return <div className="p-6 flex justify-center min-h-[400px] items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!app) return <div className="p-6"><div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error || 'Application not found'}</div></div>;

  const role = user?.role;
  const isKyc = role === 'kyc';
  const isSenior = role === 'senior_approver';
  const o = app.organization;
  const escalated = app.status === 'escalated';
  const kycStage = app.status === 'pending' || app.status === 'in_review';
  const mayDecide = escalated ? isSenior : isKyc && kycStage;
  const canApprove = mayDecide && (escalated || !app.complianceHold);
  const hasRejected = app.documents.some(d => d.review?.status === 'rejected') || app.people.some(p => p.signature?.review?.status === 'rejected');
  const disabled = !!busy;
  const verified = app.people.filter(p => p.verification?.status === 'verified').length;

  const reviewButtons = (current: CorporateReview | undefined, onAccept: () => void, onReject: () => void, busyKey: string) => mayDecide && (
    <div className="flex gap-2">
      {current?.status !== 'accepted' && (
        <button onClick={onAccept} disabled={disabled} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 disabled:opacity-50">
          {busy === busyKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Accept
        </button>
      )}
      {current?.status !== 'rejected' && (
        <button onClick={onReject} disabled={disabled} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50">
          <XCircle className="w-3.5 h-3.5" /> Reject
        </button>
      )}
    </div>
  );

  const personCard = (p: CorporatePerson) => {
    const v = p.verification;
    const isVerified = v?.status === 'verified';
    const expired = !isVerified && p.invite?.expiresAt && new Date(p.invite.expiresAt).getTime() < Date.now();
    return (
      <div key={p.id} className="border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
              {isVerified ? v.fullName : p.fullName}
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{roleLabel(p.roles)}</span>
              {p.isApplicant && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Applied</span>}
              {!p.isApplicant && isVerified && p.verifiedVia === 'with_applicant' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800" title="Verified on the applicant's phone, in their presence">
                  Verified with the applicant
                </span>
              )}
              {!p.isApplicant && isVerified && p.verifiedVia === 'link' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800" title="Verified on their own phone from the SMS link">
                  Verified from SMS link
                </span>
              )}
            </p>
            {isVerified && v.fullNameAmharic && <p className="text-sm text-gray-600">{v.fullNameAmharic}</p>}
            {!p.isApplicant && isVerified && v.nameMatchScore != null && (
              <p className={`text-xs mt-0.5 ${(v.nameMatchScore ?? 0) < 80 ? 'text-amber-700' : 'text-gray-500'}`}>
                Entered by the applicant as “{p.fullName}” — name match {v.nameMatchScore ?? 0}%
              </p>
            )}
          </div>
          {isVerified ? (
            <span className="flex items-center gap-1 text-sm font-medium text-green-700"><UserCheck className="w-4 h-4" /> Verified with Fayda {formatDate(v.verifiedAt)}</span>
          ) : (
            <span className={`flex items-center gap-1 text-sm font-medium ${expired ? 'text-red-700' : 'text-sky-700'}`}>
              <Clock className="w-4 h-4" /> {expired ? 'Link expired' : 'Not verified yet'}
            </span>
          )}
        </div>

        {isVerified ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4">
              <div className="flex gap-3">
                {[{ src: v.photo, label: 'Fayda photo' }, { src: v.selfie, label: 'Live selfie' }].map(img => (
                  <button key={img.label} type="button" onClick={() => img.src && setPhoto(ensureDataUri(img.src))} className="text-center">
                    <img src={ensureDataUri(img.src, 'not_captured')} alt={img.label} className="w-28 h-32 object-cover rounded-lg border border-gray-200" />
                    <span className="text-xs text-gray-500">{img.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="FAN" value={v.fan} />
                <Field label="UIN" value={v.uin ? `${v.uin.slice(0, 4)}…${v.uin.slice(-4)}` : ''} />
                <Field label="Date of birth" value={v.dateOfBirth} />
                <Field label="Gender" value={v.gender} />
                <Field label="Phone (Fayda)" value={v.phone} />
                <Field label="Phone (link sent to)" value={p.phone} />
                <Field label="Email" value={v.email} />
                <Field label="Address" value={[v.region, v.zone, v.woreda].filter(Boolean).join(', ')} />
              </div>
            </div>
            {v.faceVerification && <FaceVerificationPanel fv={v.faceVerification} />}
            {!!v.livenessFrames?.length && (
              <div className="flex gap-3 flex-wrap">
                {v.livenessFrames.map((f, i) => (
                  <button key={i} type="button" onClick={() => setPhoto(ensureDataUri(f.image))} className="text-center">
                    <img src={ensureDataUri(f.image)} alt={f.label} className="w-20 h-24 object-cover rounded-lg border border-gray-200" />
                    <span className="text-xs text-gray-500">{f.label}</span>
                  </button>
                ))}
              </div>
            )}
            <ScreeningResult s={v.screening} label="PEP / sanctions" />
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap p-3 bg-sky-50 border border-sky-100 rounded-lg text-sm text-sky-900">
            <span>
              Link sent to {p.phone}{p.invite?.sentAt ? ` on ${formatDate(p.invite.sentAt)}` : ''}
              {p.invite?.sentCount && p.invite.sentCount > 1 ? ` (${p.invite.sentCount} times)` : ''}
              {p.invite?.smsSent === false ? ' — SMS not delivered' : ''}
              {p.invite?.expiresAt ? ` · valid until ${formatDate(p.invite.expiresAt)}` : ''}
            </span>
            {app.status === 'awaiting_verification' && (
              <button onClick={() => act('resend_invite', { personId: p.id }, `invite:${p.id}`)} disabled={disabled}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-sky-200 rounded-lg text-sky-700 hover:bg-sky-100 disabled:opacity-50">
                {busy === `invite:${p.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send link again
              </button>
            )}
          </div>
        )}

        {p.roles.includes('signatory') && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><PenLine className="w-4 h-4 text-gray-500" /> Specimen signature</p>
              <div className="flex items-center gap-2">
                <ReviewBadge review={p.signature?.review} missing={!p.signature} />
                {p.signature && reviewButtons(
                  p.signature.review,
                  () => act('signature', { personId: p.id, decision: 'accepted' }, `sig:${p.id}`),
                  () => { setReason(''); setDialog({ kind: 'signature', personId: p.id, name: v?.fullName || p.fullName }); },
                  `sig:${p.id}`
                )}
              </div>
            </div>
            {p.signature && (
              <div className="mt-2 flex items-start gap-4 flex-wrap">
                <a href={fileUrl(p.signature.fileId)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(p.signature.fileId)} alt="Specimen signature" className="h-24 max-w-xs object-contain bg-white border border-gray-200 rounded-lg p-1" />
                </a>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>{p.signature.fileName} · {formatDate(p.signature.uploadedAt)}</p>
                  {p.signature.review?.note && <p className="text-red-700">Note: {p.signature.review.note}</p>}
                  {p.signature.review?.by && <p>Checked by {p.signature.review.by} {formatDate(p.signature.review.at)}</p>}
                  {!!p.signature.previous?.length && (
                    <p>Earlier: {p.signature.previous.map(f => (
                      <a key={f.fileId} href={fileUrl(f.fileId)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline mr-2">{f.fileName}</a>
                    ))}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <button onClick={() => router.push('/corporate')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="w-6 h-6 text-indigo-600" /> {o.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
              <span className="text-gray-500">{app.applicationId}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${CORPORATE_STATUS[app.status].color}`}>{CORPORATE_STATUS[app.status].label}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{o.categoryName}{o.subtypeName ? ` · ${o.subtypeName}` : ''}</span>
              {app.isIFB && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">IFB</span>}
              {app.resubmissionCount > 0 && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Resubmitted {app.resubmissionCount}×</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isKyc && app.status === 'pending' && (
            <button onClick={() => act('review', {}, 'review')} disabled={disabled} className="flex items-center gap-2 px-4 py-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50">
              <Eye className="w-4 h-4" /> {busy === 'review' ? 'Starting…' : 'Start review'}
            </button>
          )}
          {mayDecide && (
            <button onClick={() => { setReason(''); setDialog({ kind: 'return' }); }} disabled={disabled || !hasRejected}
              title={hasRejected ? '' : 'Reject the documents or signatures to be replaced first'}
              className="flex items-center gap-2 px-4 py-2 text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50">
              <RotateCcw className="w-4 h-4" /> Return
            </button>
          )}
          {isKyc && kycStage && (
            <button onClick={() => { setReason(''); setDialog({ kind: 'escalate' }); }} disabled={disabled} className="flex items-center gap-2 px-4 py-2 text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50">
              <Shield className="w-4 h-4" /> Escalate
            </button>
          )}
          {(mayDecide || (isKyc && app.status === 'awaiting_verification')) && (
            <button onClick={() => { setReason(''); setDialog({ kind: 'reject' }); }} disabled={disabled} className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50">
              <XCircle className="w-4 h-4" /> Reject
            </button>
          )}
          {canApprove && (
            <button onClick={() => act('approve', {}, 'approve')} disabled={disabled || app.blockers.length > 0}
              title={app.blockers.length ? app.blockers.join('\n') : ''}
              className="flex items-center gap-2 px-5 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {busy === 'approve' ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening account…</> : <><CheckCircle2 className="w-4 h-4" /> {escalated ? 'Approve (2nd level)' : 'Approve & open account'}</>}
            </button>
          )}
          {isKyc && kycStage && app.complianceHold && (
            <span className="flex items-center gap-2 px-3 py-2 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium"><Shield className="w-4 h-4" /> Screening match — escalate to approve</span>
          )}
          {escalated && !isSenior && <span className="px-3 py-2 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium">Waiting for a Senior Approver</span>}
          {app.approvalStale && (isKyc || isSenior) && (
            <button onClick={() => act('release', {}, 'release')} disabled={disabled} className="flex items-center gap-2 px-4 py-2 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50">
              <RotateCcw className="w-4 h-4" /> Release unfinished approval
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg whitespace-pre-line">{error}</div>}
      {notice && <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">{notice}</div>}

      {/* Situation */}
      {app.complianceHold && !['approved', 'rejected'].includes(app.status) && (
        <div className="p-4 rounded-xl flex items-start gap-3 bg-purple-50 border border-purple-200">
          <Shield className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
          <div className="text-sm text-purple-800">
            <p className="font-medium text-purple-900">PEP / sanctions screening match</p>
            The organization or one of its people matched the screening list. A KYC officer cannot approve it — escalate it to a Senior Approver.
          </div>
        </div>
      )}
      {app.status === 'awaiting_verification' && (
        <div className="p-4 rounded-xl flex items-start gap-3 bg-sky-50 border border-sky-200 text-sm text-sky-900">
          <Users className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
          <div><p className="font-medium">{verified} of {app.people.length} people verified with Fayda</p>
            The application comes to KYC once everyone has verified through the link sent to their phone.</div>
        </div>
      )}
      {app.status === 'approving' && (
        <div className="p-4 rounded-xl flex items-start gap-3 bg-teal-50 border border-teal-200 text-sm text-teal-900">
          <Loader2 className="w-5 h-5 text-teal-600 mt-0.5 shrink-0 animate-spin" />
          <div>
            <p className="font-medium">Opening the account in FlexCube (started {formatDate(app.approvalStartedAt)})</p>
            {app.approvalStale && 'This has taken too long — the server may have stopped. Check FlexCube for a CIF or account of this organization before releasing it and approving again.'}
          </div>
        </div>
      )}
      {(kycStage || escalated) && app.blockers.length > 0 && (
        <div className="p-4 rounded-xl flex items-start gap-3 bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div><p className="font-medium">Before it can be approved</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">{app.blockers.map(b => <li key={b}>{b}</li>)}</ul></div>
        </div>
      )}
      {app.status === 'returned' && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-900">
          <p className="font-medium">Returned by {app.returnedBy} {formatDate(app.returnedAt)}</p>{app.returnReason}
        </div>
      )}
      {escalated && app.escalationReason && (
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-sm text-purple-900">
          <p className="font-medium">Escalated by {app.escalatedBy} {formatDate(app.escalatedAt)}</p>{app.escalationReason}
        </div>
      )}
      {app.status === 'rejected' && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
          <p className="font-medium">Rejected by {app.rejectedBy} {formatDate(app.rejectedAt)}</p>{app.rejectionReason}
        </div>
      )}
      {app.status === 'approved' && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-900 flex items-start gap-3">
          <Landmark className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div><p className="font-medium">CIF {app.cifNumber} · Account {app.accountNumber}</p>
            Approved by {app.approvedBy} {formatDate(app.approvedAt)}{app.flexcubeMessage ? ` — ${app.flexcubeMessage}` : ''}</div>
        </div>
      )}
      {app.status !== 'approved' && app.flexcubeMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          <p className="font-medium">Last FlexCube attempt</p>{app.flexcubeMessage}{app.cifNumber ? ` (CIF ${app.cifNumber} kept — a retry only opens the account)` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card icon={Building2} title="Organization" subtitle={`Submitted ${formatDate(app.submittedAt)}`}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Registration / license no." value={o.registrationNumber} />
              <Field label="Issued by" value={o.registrationIssuedBy} />
              <Field label="Established" value={o.establishmentDate} />
              <Field label="Trade license no." value={o.tradeLicenseNumber} />
              <Field label="TIN" value={o.tin} />
              <Field label="VAT no." value={o.vatNumber} />
              <Field label="Industry" value={o.industry === 'O' ? `Other: ${o.otherIndustry}` : INDUSTRY_LABELS[o.industry] || o.industry} />
              <Field label="Source of funds" value={o.sourceOfFunds === 'O' ? `Other: ${o.otherSourceOfFunds}` : FUNDS_LABELS[o.sourceOfFunds] || o.sourceOfFunds} />
              <Field label="Expected annual income" value={money(o.annualIncome)} />
              <Field label="Phone" value={o.phone} />
              <Field label="Mobile" value={o.mobile} />
              <Field label="Fax" value={o.fax} />
              <Field label="Email" value={o.email} />
              <Field label="P.O. Box" value={o.poBox} />
              <Field label="Registered address" value={address(o.registeredAddress)} />
              <Field label="Correspondence address" value={o.sameCorrespondenceAddress ? 'Same as registered' : address(o.correspondenceAddress)} />
            </div>
            <div className="mt-4"><ScreeningResult s={app.screening?.organization} label="Organization name screening" /></div>
          </Card>
        </div>
        <Card icon={Landmark} title="Account" tone="green">
          <div className="space-y-3">
            <Field label="Product" value={`${app.accountTypeName}${app.isIFB ? ' (interest-free)' : ''}`} />
            <Field label="Account class" value={`${app.accountClassName} (${app.accountClassCode})`} />
            <Field label="Branch" value={`${app.branch} — ${app.branchCode}${app.conventionalBranchCode ? ` (chosen ${app.conventionalBranchCode})` : ''}`} />
            <Field label="Who signs" value={app.signingRuleText} />
            <Field label="People" value={`${app.people.length} (${app.people.filter(p => p.roles.includes('signatory')).length} signatories, ${app.people.filter(p => p.roles.includes('director')).length} directors)`} />
          </div>
        </Card>
      </div>

      <Card icon={Users} title="Signatories and directors" subtitle={`${verified} of ${app.people.length} verified with Fayda (eKYC + live face check)`}>
        <div className="space-y-4">{app.people.map(personCard)}</div>
      </Card>

      <Card icon={FileText} title="Documents" subtitle="Check each document against the KYC procedure" tone="amber">
        <div className="divide-y divide-gray-100">
          {app.documents.map(d => (
            <div key={d.docId} className="py-3 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{d.name} <span className="text-xs text-gray-500 font-normal">{d.required ? 'required' : 'optional'}</span></p>
                {d.file ? (
                  <a href={fileUrl(d.file.fileId)} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1">
                    {d.file.fileName} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : <p className="text-sm text-gray-500">Not uploaded</p>}
                {d.file && <span className="text-xs text-gray-400 ml-2">{Math.round(d.file.size / 1024)} KB · {formatDate(d.file.uploadedAt)}</span>}
                {d.review?.note && <p className="text-sm text-red-700 mt-0.5">Note: {d.review.note}</p>}
                {d.review?.by && <p className="text-xs text-gray-500">Checked by {d.review.by} {formatDate(d.review.at)}</p>}
                {!!d.previousFiles?.length && (
                  <p className="text-xs text-gray-500">Earlier: {d.previousFiles.map(f => (
                    <a key={f.fileId} href={fileUrl(f.fileId)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline mr-2">{f.fileName}</a>
                  ))}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ReviewBadge review={d.review} missing={!d.file} />
                {d.file && reviewButtons(
                  d.review,
                  () => act('document', { docId: d.docId, decision: 'accepted' }, `doc:${d.docId}`),
                  () => { setReason(''); setDialog({ kind: 'document', docId: d.docId, name: d.name }); },
                  `doc:${d.docId}`
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card icon={History} title="History" tone="slate">
        <ol className="space-y-2">
          {[...app.history].reverse().map((h, i) => (
            <li key={i} className="text-sm flex gap-3">
              <span className="text-gray-400 whitespace-nowrap">{formatDate(h.at)}</span>
              <span><span className="font-medium text-gray-900">{h.action}</span> <span className="text-gray-500">by {h.by}</span>{h.note ? <span className="text-gray-700"> — {h.note}</span> : null}</span>
            </li>
          ))}
        </ol>
      </Card>

      {photo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPhoto(null)}>
          <img src={photo} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">{DIALOG_TEXT[dialog.kind].title}</h3>
            {'name' in dialog && <p className="text-sm text-gray-700 mt-1">{dialog.name}</p>}
            <p className="text-sm text-gray-500 mt-2 mb-3">{DIALOG_TEXT[dialog.kind].hint}</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} autoFocus
              placeholder={dialog.kind === 'document' || dialog.kind === 'signature' ? 'What is wrong with it?' : 'Reason…'}
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setDialog(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={confirmDialog} disabled={disabled || reason.trim().length < (dialog.kind === 'document' || dialog.kind === 'signature' ? 3 : 5)}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${DIALOG_TEXT[dialog.kind].color}`}>
                {busy ? 'Saving…' : DIALOG_TEXT[dialog.kind].button}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
