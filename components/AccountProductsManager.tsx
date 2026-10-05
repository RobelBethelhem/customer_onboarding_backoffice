'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertTriangle, CheckCircle2, RotateCcw,
} from 'lucide-react';

interface AccountClass {
  code: string;
  name: string;
  interestRate: number | string | null;
  minBalance: number | string | null;
  maxBalance: number | string | null;
  remarks: string;
  productNumber: string;
  active: boolean;
}

interface AccountProduct {
  id: string;
  name: string;
  description: string;
  isIFB: boolean;
  active: boolean;
  classes: AccountClass[];
}

const emptyClass = (): AccountClass => ({
  code: '', name: '', interestRate: '', minBalance: '', maxBalance: '', remarks: '', productNumber: '', active: true,
});

function move<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// inputs hold strings while editing; the API stores numbers or null
const toField = (v: number | string | null) => (v === null || v === undefined ? '' : String(v));

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

/** Account Products tab of the Products & Services page (KYC officers, admin) */
export default function AccountProductsManager() {
  const [products, setProducts] = useState<AccountProduct[]>([]);
  const [defaults, setDefaults] = useState<AccountProduct[]>([]);
  const [meta, setMeta] = useState<{ updatedBy?: string; updatedAt?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account-products/manage', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load account products');
      setProducts(data.data.products);
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

  const update = (next: AccountProduct[]) => { setProducts(next); setDirty(true); setMessage(null); };
  const setProduct = (pi: number, patch: Partial<AccountProduct>) =>
    update(products.map((p, i) => (i === pi ? { ...p, ...patch } : p)));
  const setClass = (pi: number, ci: number, patch: Partial<AccountClass>) =>
    setProduct(pi, { classes: products[pi].classes.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });

  // Defaults (the bank's product list) that were deleted from the catalog — offered back
  const usedCodes = new Set(products.flatMap(p => p.classes.map(c => c.code.toUpperCase())));
  const missingDefaults = defaults.flatMap(p => p.classes.filter(c => !usedCodes.has(c.code)).map(c => ({ product: p, cls: c })));

  const restoreDefaults = () => {
    let next = products.map(p => ({ ...p, classes: [...p.classes] }));
    for (const { product, cls } of missingDefaults) {
      const target = next.find(p => p.id === product.id);
      if (target) target.classes.push({ ...cls });
      else next = [...next, { ...product, classes: [{ ...cls }] }];
    }
    update(next);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/account-products/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
      setProducts(data.data.products);
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
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading account products…
      </div>
    );
  }

  const input = 'w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">
            The account types and classes customers can choose in the web app. Turn items off to hide them, use the
            arrows to change the order.
            {meta.updatedAt && (
              <> Last changed {new Date(meta.updatedAt).toLocaleString()}{meta.updatedBy ? ` by ${meta.updatedBy}` : ''}.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {missingDefaults.length > 0 && (
            <button type="button" onClick={restoreDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <RotateCcw className="w-4 h-4" /> Add back {missingDefaults.length} default class{missingDefaults.length === 1 ? '' : 'es'}
            </button>
          )}
          <button type="button"
            onClick={() => update([...products, { id: '', name: 'New product', description: '', isIFB: false, active: true, classes: [emptyClass()] }])}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Add product
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

      {products.map((p, pi) => (
        <div key={pi} className={`bg-white rounded-xl border shadow-sm ${p.isIFB ? 'border-emerald-300' : 'border-gray-200'} ${p.active ? '' : 'opacity-60'}`}>
          {/* Product header */}
          <div className={`flex flex-col lg:flex-row lg:items-center gap-3 p-4 border-b rounded-t-xl ${p.isIFB ? 'bg-emerald-50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <OrderButtons
                onUp={() => update(move(products, pi, -1))} onDown={() => update(move(products, pi, 1))}
                upDisabled={pi === 0} downDisabled={pi === products.length - 1} />
              <span className="text-xs font-semibold text-gray-400 w-5">{pi + 1}</span>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={`${input} font-semibold`} value={p.name} placeholder="Product name"
                onChange={e => setProduct(pi, { name: e.target.value })} />
              <input className={input} value={p.description} placeholder="Short description (shown to customers)"
                onChange={e => setProduct(pi, { description: e.target.value })} />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={p.isIFB} onChange={() => setProduct(pi, { isIFB: !p.isIFB })}
                  className="w-4 h-4 accent-emerald-600" />
                IFB (interest-free)
              </label>
              <span className="flex items-center gap-2 text-sm text-gray-700">
                <Toggle on={p.active} onChange={() => setProduct(pi, { active: !p.active })} label="Active" />
                {p.active ? 'Active' : 'Inactive'}
              </span>
              <button type="button" title="Delete product"
                onClick={() => {
                  if (window.confirm(`Delete "${p.name}" and its ${p.classes.length} class(es)? Turning it off keeps it for later.`)) {
                    update(products.filter((_, i) => i !== pi));
                  }
                }}
                className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Classes */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b">
                  <th className="px-3 py-2 w-14">Order</th>
                  <th className="px-2 py-2 w-24">Code</th>
                  <th className="px-2 py-2">Account class</th>
                  <th className="px-2 py-2 w-24">Interest %</th>
                  <th className="px-2 py-2 w-32">Min balance</th>
                  <th className="px-2 py-2 w-32">Max balance</th>
                  <th className="px-2 py-2">Remarks</th>
                  <th className="px-2 py-2 w-24" title="Number sent to FlexCube in the account number template">Product no.</th>
                  <th className="px-2 py-2 w-16">Active</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {p.classes.map((c, ci) => (
                  <tr key={ci} className={`border-b last:border-0 ${c.active ? '' : 'bg-gray-50 text-gray-400'}`}>
                    <td className="px-3 py-1.5">
                      <OrderButtons
                        onUp={() => setProduct(pi, { classes: move(p.classes, ci, -1) })}
                        onDown={() => setProduct(pi, { classes: move(p.classes, ci, 1) })}
                        upDisabled={ci === 0} downDisabled={ci === p.classes.length - 1} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${input} font-mono uppercase`} value={c.code} maxLength={10} placeholder="DBSV"
                        onChange={e => setClass(pi, ci, { code: e.target.value.toUpperCase() })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={input} value={c.name} placeholder="Basic Saving — Digital"
                        onChange={e => setClass(pi, ci, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={input} inputMode="decimal" value={toField(c.interestRate)} placeholder={p.isIFB ? 'none' : '7'}
                        onChange={e => setClass(pi, ci, { interestRate: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={input} inputMode="numeric" value={toField(c.minBalance)} placeholder="5000"
                        onChange={e => setClass(pi, ci, { minBalance: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={input} inputMode="numeric" value={toField(c.maxBalance)} placeholder="—"
                        onChange={e => setClass(pi, ci, { maxBalance: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={input} value={c.remarks} placeholder="Optional"
                        onChange={e => setClass(pi, ci, { remarks: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${input} font-mono`} inputMode="numeric" value={c.productNumber} maxLength={5}
                        onChange={e => setClass(pi, ci, { productNumber: e.target.value.replace(/\D/g, '') })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Toggle on={c.active} onChange={() => setClass(pi, ci, { active: !c.active })} label="Active" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button type="button" title="Delete class"
                        onClick={() => setProduct(pi, { classes: p.classes.filter((_, i) => i !== ci) })}
                        className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
            <button type="button" onClick={() => setProduct(pi, { classes: [...p.classes, emptyClass()] })}
              className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-900 font-medium">
              <Plus className="w-4 h-4" /> Add account class
            </button>
            {p.active && p.classes.every(c => !c.active) && (
              <span className="text-xs text-amber-700">No active class — this product is hidden in the web app.</span>
            )}
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-white rounded-xl border">
          No products. Customers cannot choose an account type until at least one is added.
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
