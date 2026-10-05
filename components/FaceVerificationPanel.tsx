'use client';

import { CheckCircle2, XCircle, AlertTriangle, ScanFace } from 'lucide-react';
import type { FaceVerificationResult } from '@/lib/api';
import { formatDate } from '@/lib/api';

type Tone = 'ok' | 'bad' | 'warn';

const TONES: Record<Tone, { box: string; icon: string; title: string; text: string }> = {
  ok: { box: 'bg-green-50 border-green-200', icon: 'text-green-600', title: 'text-green-900', text: 'text-green-700' },
  bad: { box: 'bg-red-50 border-red-200', icon: 'text-red-600', title: 'text-red-900', text: 'text-red-700' },
  warn: { box: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', title: 'text-amber-900', text: 'text-amber-700' },
};

const ACTION_LABELS: Record<string, string> = { mouth: 'opened mouth', turn: 'turned head' };

function Row({ tone, title, detail }: { tone: Tone; title: string; detail?: string }) {
  const t = TONES[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'bad' ? XCircle : AlertTriangle;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${t.box}`}>
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${t.icon}`} />
      <div className="min-w-0">
        <p className={`font-medium ${t.title}`}>{title}</p>
        {detail && <p className={`text-sm ${t.text}`}>{detail}</p>}
      </div>
    </div>
  );
}

/**
 * Result of the web app's face check, done by the Fayda backend: face match with the Fayda photo,
 * liveness actions and the anti-spoof model. Shown to KYC officers before they decide.
 */
export default function FaceVerificationPanel({ fv }: { fv: FaceVerificationResult }) {
  const match = fv.match;
  const live = fv.liveness;
  const anti = live?.antiSpoof;
  const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

  const matchRow = match
    ? match.matched
      ? { tone: 'ok' as Tone, title: `Face matches the Fayda photo — ${pct(match.similarity)} similarity`,
          detail: `Distance ${match.distance} (a match is below ${match.threshold}). Still compare the photos yourself.` }
      : { tone: 'bad' as Tone, title: `Face does NOT match the Fayda photo — ${pct(match.similarity)} similarity`,
          detail: `Distance ${match.distance} (a match is below ${match.threshold}). Check the photos and video carefully.` }
    : { tone: 'warn' as Tone, title: 'Face could not be compared with the Fayda photo', detail: fv.matchError || 'No face found in one of the photos.' };

  const actions = (live?.actions || []).map(a => ACTION_LABELS[a] || a).join(', ');
  const failedChecks = (live?.checks || []).filter(c => !c.passed).map(c => c.detail || c.name).join('; ');
  const livenessRow = !live?.performed
    ? { tone: 'warn' as Tone, title: 'Liveness not verified', detail: live?.reason || 'The live check was not completed. Review the video.' }
    : live.passed
      ? { tone: 'ok' as Tone, title: `Liveness passed${actions ? ` — ${actions}` : ''}`, detail: 'Checked by the server on frames from the live camera.' }
      : { tone: 'bad' as Tone, title: 'Liveness failed', detail: live.reason || failedChecks || 'The actions could not be confirmed.' };

  const antiRow = anti && anti.score !== null && anti.score !== undefined
    ? {
        tone: (anti.score >= anti.threshold ? 'ok' : 'bad') as Tone,
        title: `Anti-spoof: ${anti.score >= anti.threshold ? 'looks like a live person' : 'may be a photo or screen'} (score ${anti.score.toFixed(2)})`,
        detail: `${anti.model || 'MiniFASNet'} · live when ${anti.threshold} or more · ${anti.enforced ? 'enforced' : 'recorded only, not blocking'}`,
      }
    : live?.performed
      ? { tone: 'warn' as Tone, title: 'Anti-spoof check not available', detail: 'The model did not run for this application.' }
      : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
          <ScanFace className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Face Verification</h2>
          <p className="text-sm text-gray-500">
            Checked by the server{fv.checkedAt ? ` on ${formatDate(fv.checkedAt)}` : ''}
            {fv.method === 'compare-at-submission' ? ' when the application was submitted' : ' during the live camera check'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Row {...matchRow} />
        <Row {...livenessRow} />
        {antiRow && <Row {...antiRow} />}
      </div>
    </div>
  );
}
