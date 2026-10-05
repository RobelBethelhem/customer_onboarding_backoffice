'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertTriangle, CheckCircle2, RotateCcw, FileText,
} from 'lucide-react';
import { SERVICE_ICON_COMPONENTS } from '@/components/ServiceIcon';
import { SERVICE_ICON_KEYS, SERVICE_ICON_LABELS } from '@/lib/serviceIcons';

interface Service {
  id: string;
  name: string;
  summary: string;
  details: string[];
  icon: string;
  termsTitle: string;
  termsText: string;
  termsVersion: number;
  termsUpdatedAt: string | null;
  active: boolean;
  termsOn?: boolean; // editing only: "customers must accept terms" ticked
}

const withUi = (s: Service): Service => ({ ...s, termsOn: !!s.termsText });

const newService = (): Service => ({
  id: '', name: 'New service', summary: '', details: [], icon: 'star',
  termsTitle: '', termsText: '', termsVersion: 0, termsUpdatedAt: null, active: true, termsOn: false,
});

function move<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={label}
      aria-label={label}
      className={`relative w-10 h-5 shrink-0 rounded-full transition-colors ${on ? 'bg-green-600' : 'bg-gray-300'}`}
    >
      <span className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

/** Additional Services tab of the Products & Services page (KYC officers, admin) */
export default function AdditionalServicesManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [defaults, setDefaults] = useState<Service[]>([]);
  const [meta, setMeta] = useState<{ updatedBy?: string; updatedAt?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/additional-services/manage', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load services');
      setServices(data.data.services.map(withUi));
      setDefaults(data.data.defaults || []);
      setMeta({ updatedBy: data.data.updatedBy, updatedAt: data.data.updatedAt });
      setDirty(false);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (next: Service[]) => { setServices(next); setDirty(true); setMessage(null); };
  const set = (i: number, patch: Partial<Service>) => update(services.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const missingDefaults = defaults.filter(d => !services.some(s => s.id === d.id));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = services.map(s => ({
        id: s.id, name: s.name, summary: s.summary, details: s.details, icon: s.icon, active: s.active,
        termsTitle: s.termsOn ? s.termsTitle : '', termsText: s.termsOn ? s.termsText : '',
      }));
      const res = await fetch('/api/additional-services/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
      setServices(data.data.services.map(withUi));
      setDirty(false);
      setMeta({ updatedBy: 'you', updatedAt: new Date().toISOString() });
      setMessage({ type: 'ok', text: 'Saved — the web app shows the new list right away.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading services…
      </div>
    );
  }

  const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-500">
          Services customers can ask for with their new account; the branch Personal Banker sets them up. Turn a
          service off to hide it, use the arrows to change the order. When a service has terms and conditions, the
          customer must accept them to choose it.
          {meta.updatedAt && (
            <> Last changed {new Date(meta.updatedAt).toLocaleString()}{meta.updatedBy ? ` by ${meta.updatedBy}` : ''}.</>
          )}
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          {missingDefaults.length > 0 && (
            <button type="button" onClick={() => update([...services, ...missingDefaults.map(withUi)])}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <RotateCcw className="w-4 h-4" /> Add back {missingDefaults.length} default service{missingDefaults.length === 1 ? '' : 's'}
            </button>
          )}
          <button type="button" onClick={() => update([...services, newService()])}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Add service
          </button>
        </div>
      </div>

      {message && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
          message.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
          {message.text}
        </div>
      )}

      {services.map((s, i) => {
        const Icon = SERVICE_ICON_COMPONENTS[s.icon] || SERVICE_ICON_COMPONENTS.star;
        return (
          <div key={s.id || `new-${i}`} className={`bg-white rounded-xl border border-gray-200 shadow-sm ${s.active ? '' : 'opacity-60'}`}>
            {/* Header row */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 border-b bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => update(move(services, i, -1))} disabled={i === 0} title="Move up"
                    className="p-0.5 text-gray-500 hover:text-gray-900 disabled:opacity-25"><ChevronUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => update(move(services, i, 1))} disabled={i === services.length - 1} title="Move down"
                    className="p-0.5 text-gray-500 hover:text-gray-900 disabled:opacity-25"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <span className="text-xs font-semibold text-gray-400 w-5">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <input className={`${input} font-semibold md:flex-1`} value={s.name} maxLength={60} placeholder="Service name"
                onChange={e => set(i, { name: e.target.value })} />
              <select className={`${input} md:w-40`} value={s.icon} onChange={e => set(i, { icon: e.target.value })} title="Icon">
                {SERVICE_ICON_KEYS.map(k => <option key={k} value={k}>{SERVICE_ICON_LABELS[k]} icon</option>)}
              </select>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-sm text-gray-700">
                  <Toggle on={s.active} onChange={() => set(i, { active: !s.active })} label="Active" />
                  {s.active ? 'Active' : 'Inactive'}
                </span>
                <button type="button" title="Delete service"
                  onClick={() => {
                    if (window.confirm(`Delete "${s.name}"? Applications that already asked for it keep it. Turning it off keeps it for later.`)) {
                      update(services.filter((_, j) => j !== i));
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Short description</label>
                  <input className={input} value={s.summary} maxLength={160} placeholder="Bank from your phone with the Zemen Bank mobile app."
                    onChange={e => set(i, { summary: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">“What does this mean?” — one point per line</label>
                  <textarea className={input} rows={3} value={s.details.join('\n')} placeholder={'Check your balance anytime\nPay bills from your phone'}
                    onChange={e => set(i, { details: e.target.value.split('\n') })} />
                </div>
              </div>

              {/* Terms and conditions */}
              <div className={`rounded-lg border ${s.termsOn ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'} p-3 space-y-3`}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-green-600" checked={!!s.termsOn}
                    onChange={() => set(i, { termsOn: !s.termsOn })} />
                  <FileText className="w-4 h-4 text-gray-500" />
                  Customers must accept terms and conditions to choose this service
                </label>
                {s.termsOn && (
                  <>
                    <input className={`${input} bg-white`} value={s.termsTitle} maxLength={120}
                      placeholder={`${s.name || 'Service'} Terms and Conditions`}
                      onChange={e => set(i, { termsTitle: e.target.value })} />
                    <textarea className={`${input} bg-white font-mono text-xs leading-relaxed`} rows={10} value={s.termsText} maxLength={20000}
                      placeholder="Paste the terms and conditions here. Blank lines start a new paragraph."
                      onChange={e => set(i, { termsText: e.target.value })} />
                    <p className="text-xs text-gray-500">
                      {s.termsVersion > 0
                        ? `Version ${s.termsVersion}${s.termsUpdatedAt ? `, changed ${new Date(s.termsUpdatedAt).toLocaleString()}` : ''}. `
                        : 'New terms. '}
                      Changing the text saves a new version — each application records the version the customer accepted.
                      {' '}{s.termsText.length.toLocaleString()} / 20,000 characters.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {services.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-white rounded-xl border">
          No services. The web app skips the Additional Services step until at least one is added and active.
        </div>
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border rounded-xl shadow-sm px-4 py-3 flex items-center justify-end gap-3 z-30">
        {dirty && <span className="text-sm text-amber-700 mr-auto sm:mr-0">Unsaved changes</span>}
        {dirty && (
          <button type="button" onClick={load} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Discard
          </button>
        )}
        <button type="button" onClick={save} disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </button>
      </div>
    </div>
  );
}
