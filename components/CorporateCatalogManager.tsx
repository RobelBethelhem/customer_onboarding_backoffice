'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Save, Loader2, AlertTriangle, CheckCircle2, RotateCcw, Building2, Wallet,
} from 'lucide-react';

interface Subtype { id: string; name: string; active: boolean }
interface DocumentType { id: string; name: string; description: string; required: boolean; subtypes: string[]; active: boolean }
interface AccountRule { classCode: string; subtypes: string[] }
interface Category {
  id: string; name: string; description: string; subtypes: Subtype[]; documents: DocumentType[];
  accountsLimited?: boolean; accounts?: AccountRule[]; active: boolean;
}
// Account Products for organizations (audience organization / both), to choose from
interface OrgProduct { id: string; name: string; isIFB: boolean; active: boolean; classes: { code: string; name: string; active?: boolean }[] }
interface Rules { maxPeople: number | string; maxFileMb: number | string; signatureRequired: boolean; inviteValidDays: number | string }

function move<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" onClick={onChange} title={label} aria-label={label}
      className={`relative w-10 h-5 shrink-0 rounded-full transition-colors ${on ? 'bg-green-600' : 'bg-gray-300'}`}>
      <span className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function OrderButtons({ onUp, onDown, upDisabled, downDisabled }: {
  onUp: () => void; onDown: () => void; upDisabled: boolean; downDisabled: boolean;
}) {
  return (
    <div className="flex flex-col">
      <button type="button" onClick={onUp} disabled={upDisabled} title="Move up"
        className="p-0.5 text-gray-500 hover:text-gray-900 disabled:opacity-25"><ChevronUp className="w-4 h-4" /></button>
      <button type="button" onClick={onDown} disabled={downDisabled} title="Move down"
        className="p-0.5 text-gray-500 hover:text-gray-900 disabled:opacity-25"><ChevronDown className="w-4 h-4" /></button>
    </div>
  );
}

const emptyDocument = (): DocumentType => ({ id: '', name: '', description: '', required: true, subtypes: [], active: true });

/**
 * Business Accounts tab of the Products & Services page (KYC officers, admin): the kinds of
 * organization that can apply, and the documents each one uploads (KYC procedure 2.3.2–2.3.6).
 */
export default function CorporateCatalogManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rules>({ maxPeople: 10, maxFileMb: 5, signatureRequired: true, inviteValidDays: 14 });
  const [defaults, setDefaults] = useState<Category[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [meta, setMeta] = useState<{ updatedBy?: string; updatedAt?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [orgProducts, setOrgProducts] = useState<OrgProduct[]>([]);

  const load = async () => {
    setLoading(true);
    // the accounts each kind of organization can open are chosen from Account Products
    fetch('/api/account-products/manage', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setOrgProducts((d?.data?.products || []).filter((p: any) => ['organization', 'both'].includes(p.audience || 'individual'))))
      .catch(() => setOrgProducts([]));
    try {
      const res = await fetch('/api/corporate/catalog', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load the business account settings');
      setCategories(data.data.categories);
      setRules(data.data.rules);
      setDefaults(data.data.defaults?.categories || []);
      setMeta({ updatedBy: data.data.updatedBy, updatedAt: data.data.updatedAt });
      setDirty(false);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (next: Category[]) => { setCategories(next); setDirty(true); setMessage(null); };
  const setCategory = (ci: number, patch: Partial<Category>) => update(categories.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const setDocument = (ci: number, di: number, patch: Partial<DocumentType>) =>
    setCategory(ci, { documents: categories[ci].documents.map((d, i) => (i === di ? { ...d, ...patch } : d)) });
  const setSubtype = (ci: number, si: number, patch: Partial<Subtype>) =>
    setCategory(ci, { subtypes: categories[ci].subtypes.map((s, i) => (i === si ? { ...s, ...patch } : s)) });
  const setRule = (patch: Partial<Rules>) => { setRules({ ...rules, ...patch }); setDirty(true); setMessage(null); };
  const toggleOpen = (ci: number) => {
    const next = new Set(open);
    if (next.has(ci)) next.delete(ci); else next.add(ci);
    setOpen(next);
  };

  // Default categories (KYC procedure) that were deleted — offered back
  const missingDefaults = defaults.filter(d => !categories.some(c => c.id === d.id));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/corporate/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories, rules }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
      setCategories(data.data.categories);
      setRules(data.data.rules);
      setDirty(false);
      setMeta({ updatedBy: 'you', updatedAt: new Date().toISOString() });
      setMessage({ type: 'ok', text: 'Saved — the web app uses the new lists right away. Applications already submitted keep their documents.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…</div>;
  }

  const input = 'w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
  const number = (value: number | string, onChange: (v: string) => void, max: number) => (
    <input className={`${input} w-20`} inputMode="numeric" value={value} maxLength={String(max).length}
      onChange={e => onChange(e.target.value.replace(/\D/g, ''))} />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-500">
          The kinds of organization that can open an account in the web app and the documents each one uploads.
          Every signatory and director verifies with Fayda (with the applicant, or from an SMS link), so their IDs are not uploaded.
          For each kind you can also choose which account types it can open.
          {meta.updatedAt && <> Last changed {new Date(meta.updatedAt).toLocaleString()}{meta.updatedBy ? ` by ${meta.updatedBy}` : ''}.</>}
        </p>
        <div className="flex flex-wrap gap-2">
          {missingDefaults.length > 0 && (
            <button type="button" onClick={() => update([...categories, ...missingDefaults.map(d => JSON.parse(JSON.stringify(d)))])}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <RotateCcw className="w-4 h-4" /> Add back {missingDefaults.length} default categor{missingDefaults.length === 1 ? 'y' : 'ies'}
            </button>
          )}
          <button type="button"
            onClick={() => { update([...categories, { id: '', name: 'New category', description: '', subtypes: [], documents: [emptyDocument()], active: true }]); setOpen(new Set(open).add(categories.length)); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Add category
          </button>
        </div>
      </div>

      {message && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${message.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
          {message.text}
        </div>
      )}

      {/* Rules */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Application rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm text-gray-700">
          <label className="flex items-center justify-between gap-3">
            <span>People per application (signatories and directors, 1–10)</span>
            {number(rules.maxPeople, v => setRule({ maxPeople: v }), 10)}
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Largest file (MB, 1–10)</span>
            {number(rules.maxFileMb, v => setRule({ maxFileMb: v }), 10)}
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Verification link valid for (days, 1–30)</span>
            {number(rules.inviteValidDays, v => setRule({ inviteValidDays: v }), 30)}
          </label>
          <span className="flex items-center justify-between gap-3">
            <span>Specimen signature of each signatory required</span>
            <Toggle on={rules.signatureRequired} onChange={() => setRule({ signatureRequired: !rules.signatureRequired })} label="Signature required" />
          </span>
        </div>
      </div>

      {categories.map((c, ci) => {
        const expanded = open.has(ci);
        const activeDocs = c.documents.filter(d => d.active).length;
        const rules = c.accounts || [];
        const setRules = (next: AccountRule[]) => setCategory(ci, { accounts: next });
        const toggleClass = (code: string) => setRules(rules.some(a => a.classCode === code)
          ? rules.filter(a => a.classCode !== code) : [...rules, { classCode: code, subtypes: [] }]);
        const toggleRuleSubtype = (code: string, sid: string) => setRules(rules.map(a => (a.classCode !== code ? a
          : { ...a, subtypes: a.subtypes.includes(sid) ? a.subtypes.filter(x => x !== sid) : [...a.subtypes, sid] })));
        return (
          <div key={ci} className={`bg-white rounded-xl border border-gray-200 shadow-sm ${c.active ? '' : 'opacity-60'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 bg-gray-50 rounded-t-xl border-b">
              <div className="flex items-center gap-2">
                <OrderButtons onUp={() => update(move(categories, ci, -1))} onDown={() => update(move(categories, ci, 1))}
                  upDisabled={ci === 0} downDisabled={ci === categories.length - 1} />
                <button type="button" onClick={() => toggleOpen(ci)} className="p-1 text-gray-500 hover:text-gray-900" title={expanded ? 'Collapse' : 'Expand'}>
                  {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                <Building2 className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className={`${input} font-semibold`} value={c.name} placeholder="Category name" onChange={e => setCategory(ci, { name: e.target.value })} />
                <input className={input} value={c.description} placeholder="Short description (shown to applicants)" onChange={e => setCategory(ci, { description: e.target.value })} />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {c.subtypes.length} sub-types · {activeDocs} documents · {c.accountsLimited ? `${rules.length} account type${rules.length === 1 ? '' : 's'}` : 'all accounts'}
                </span>
                <span className="flex items-center gap-2 text-sm text-gray-700">
                  <Toggle on={c.active} onChange={() => setCategory(ci, { active: !c.active })} label="Active" /> {c.active ? 'Active' : 'Inactive'}
                </span>
                <button type="button" title="Delete category"
                  onClick={() => { if (window.confirm(`Delete "${c.name}"? Turning it off keeps it for later.`)) update(categories.filter((_, i) => i !== ci)); }}
                  className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {expanded && (
              <div className="p-4 space-y-5">
                {/* Sub-types */}
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-2">Sub-types <span className="text-gray-500 font-normal">— the applicant picks one (none = no choice)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {c.subtypes.map((s, si) => (
                      <div key={si} className={`flex items-center gap-2 border rounded-lg px-2 py-1 ${s.active ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                        <input className="px-1 py-0.5 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-green-500 rounded w-44" value={s.name}
                          placeholder="Sub-type name" onChange={e => setSubtype(ci, si, { name: e.target.value })} />
                        <Toggle on={s.active} onChange={() => setSubtype(ci, si, { active: !s.active })} label="Active" />
                        <button type="button" title="Delete sub-type"
                          onClick={() => setCategory(ci, {
                            subtypes: c.subtypes.filter((_, i) => i !== si),
                            documents: c.documents.map(d => ({ ...d, subtypes: d.subtypes.filter(id => id !== s.id) })),
                            accounts: rules.map(a => ({ ...a, subtypes: a.subtypes.filter(id => id !== s.id) })),
                          })}
                          className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setCategory(ci, { subtypes: [...c.subtypes, { id: '', name: '', active: true }] })}
                      className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-900 font-medium px-2"><Plus className="w-4 h-4" /> Add sub-type</button>
                  </div>
                  {c.subtypes.some(s => !s.id) && <p className="text-xs text-gray-500 mt-1">Save new sub-types before limiting documents to them.</p>}
                </div>

                {/* Documents */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 border-b">
                        <th className="px-2 py-2 w-12">Order</th>
                        <th className="px-2 py-2 w-64">Document</th>
                        <th className="px-2 py-2">What exactly (shown to applicants)</th>
                        <th className="px-2 py-2 w-56">Only for</th>
                        <th className="px-2 py-2 w-20">Required</th>
                        <th className="px-2 py-2 w-16">Active</th>
                        <th className="px-2 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {c.documents.map((d, di) => (
                        <tr key={di} className={`border-b last:border-0 align-top ${d.active ? '' : 'bg-gray-50 text-gray-400'}`}>
                          <td className="px-2 py-1.5">
                            <OrderButtons onUp={() => setCategory(ci, { documents: move(c.documents, di, -1) })} onDown={() => setCategory(ci, { documents: move(c.documents, di, 1) })}
                              upDisabled={di === 0} downDisabled={di === c.documents.length - 1} />
                          </td>
                          <td className="px-2 py-1.5"><input className={input} value={d.name} placeholder="Trade license" onChange={e => setDocument(ci, di, { name: e.target.value })} /></td>
                          <td className="px-2 py-1.5">
                            <textarea className={`${input} resize-y`} rows={2} value={d.description} placeholder="Optional" onChange={e => setDocument(ci, di, { description: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            {c.subtypes.filter(s => s.id).length === 0 ? <span className="text-xs text-gray-400">All</span> : (
                              <div className="flex flex-col gap-0.5">
                                {c.subtypes.filter(s => s.id).map(s => (
                                  <label key={s.id} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                                    <input type="checkbox" className="accent-green-600" checked={d.subtypes.includes(s.id)}
                                      onChange={() => setDocument(ci, di, { subtypes: d.subtypes.includes(s.id) ? d.subtypes.filter(x => x !== s.id) : [...d.subtypes, s.id] })} />
                                    {s.name}
                                  </label>
                                ))}
                                {d.subtypes.length === 0 && <span className="text-xs text-gray-400">none ticked = all</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5"><Toggle on={d.required} onChange={() => setDocument(ci, di, { required: !d.required })} label="Required" /></td>
                          <td className="px-2 py-1.5"><Toggle on={d.active} onChange={() => setDocument(ci, di, { active: !d.active })} label="Active" /></td>
                          <td className="px-2 py-1.5">
                            <button type="button" title="Delete document" onClick={() => setCategory(ci, { documents: c.documents.filter((_, i) => i !== di) })}
                              className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => setCategory(ci, { documents: [...c.documents, emptyDocument()] })}
                  className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-900 font-medium"><Plus className="w-4 h-4" /> Add document</button>

                {/* Account types this kind of organization can open */}
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-500" /> Account types they can open
                    <span className="text-gray-500 font-normal">— the web app offers only these at the Account step</span>
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" className="accent-green-600" checked={!c.accountsLimited}
                        onChange={() => setCategory(ci, { accountsLimited: false })} />
                      All accounts for organizations
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" className="accent-green-600" checked={!!c.accountsLimited}
                        onChange={() => setCategory(ci, { accountsLimited: true, accounts: rules })} />
                      Only the ones ticked below
                    </label>
                  </div>
                  {c.accountsLimited && (orgProducts.length === 0 ? (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      No account product is marked “For organizations” yet — set the audience in the Account Products tab first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {orgProducts.map(p => (
                        <div key={p.id} className={`border border-gray-200 rounded-lg p-3 ${p.active ? '' : 'bg-gray-50'}`}>
                          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap mb-1">
                            {p.name}
                            {p.isIFB && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">IFB</span>}
                            {!p.active && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600">inactive product</span>}
                          </p>
                          {p.classes.map(cl => {
                            const rule = rules.find(a => a.classCode === cl.code);
                            const subs = c.subtypes.filter(s => s.id);
                            return (
                              <div key={cl.code} className="py-1.5 border-b last:border-0 border-gray-100">
                                <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                                  <input type="checkbox" className="accent-green-600" checked={!!rule} onChange={() => toggleClass(cl.code)} />
                                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100">{cl.code}</span>
                                  <span className={cl.active === false ? 'text-gray-400 line-through' : ''}>{cl.name}</span>
                                </label>
                                {rule && subs.length > 0 && (
                                  <div className="ml-6 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-700">
                                    <span className="text-gray-500">Only for:</span>
                                    {subs.map(s => (
                                      <label key={s.id} className="flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" className="accent-green-600" checked={rule.subtypes.includes(s.id)}
                                          onChange={() => toggleRuleSubtype(cl.code, s.id)} />
                                        {s.name}
                                      </label>
                                    ))}
                                    {rule.subtypes.length === 0 && <span className="text-gray-400">none ticked = all sub-types</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                  {c.accountsLimited && rules.some(a => !orgProducts.some(p => p.classes.some(cl => cl.code === a.classCode))) && orgProducts.length > 0 && (
                    <p className="text-xs text-amber-700 mt-2">
                      {rules.filter(a => !orgProducts.some(p => p.classes.some(cl => cl.code === a.classCode))).map(a => a.classCode).join(', ')}: no longer
                      an account for organizations — untick it or set its product’s audience again.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {categories.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-white rounded-xl border">No categories — organizations cannot apply until at least one is added.</div>
      )}

      <div className="sticky bottom-0 bg-white/95 backdrop-blur border rounded-xl shadow-sm px-4 py-3 flex items-center justify-end gap-3 z-30">
        {dirty && <span className="text-sm text-amber-700 mr-auto sm:mr-0">Unsaved changes</span>}
        {dirty && <button type="button" onClick={load} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Discard</button>}
        <button type="button" onClick={save} disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </button>
      </div>
    </div>
  );
}
