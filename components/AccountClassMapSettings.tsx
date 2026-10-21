'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, Info } from 'lucide-react';

export interface AccountClassRow {
  productNumber: string;
  accountClass: string;
}

// An account class of the Account Products catalog, with what decides its FlexCube class
interface CatalogClass {
  code: string;
  name: string;
  productNumber: string;
  product: string;
  kind: 'individual' | 'ifb' | 'business'; // ifb: IFB class from Settings; business: its own code
  offered: boolean;                          // product and class are active
}

interface Props {
  rows: AccountClassRow[] | undefined; // undefined until the settings are loaded
  defaultClass: string;
  productCodesOn: boolean;             // "Use Account Product Codes" on: this list is not used
  onChange: (rows: AccountClassRow[], defaultClass: string) => void;
}

/**
 * Settings → FlexCube: the FlexCube account class (ACCLS) a conventional account opens with, by the
 * product number of its account class (Account Products). Saved with the page's Save Changes.
 */
export default function AccountClassMapSettings({ rows, defaultClass, productCodesOn, onChange }: Props) {
  const [catalog, setCatalog] = useState<CatalogClass[] | null>(null);

  // The catalog shows which account class each product number belongs to (best-effort)
  useEffect(() => {
    fetch('/api/account-products/manage', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!data?.success) return;
        setCatalog((data.data.products || []).flatMap((p: any) => (p.classes || []).map((c: any) => ({
          code: String(c.code || ''),
          name: String(c.name || ''),
          productNumber: String(c.productNumber || ''),
          product: String(p.name || ''),
          kind: p.isIFB ? 'ifb' : p.audience === 'organization' ? 'business' : 'individual',
          offered: p.active !== false && c.active !== false,
        }))));
      })
      .catch(() => {});
  }, []);

  const list = rows || [];
  const set = (next: AccountClassRow[]) => onChange(next, defaultClass);
  const setRow = (i: number, patch: Partial<AccountClassRow>) => set(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of list) if (r.productNumber) m.set(r.productNumber, (m.get(r.productNumber) || 0) + 1);
    return m;
  }, [list]);

  // Individual account classes on offer whose product number has no row: they open as the default class
  const missing = (catalog || []).filter(c =>
    c.kind === 'individual' && c.offered && c.productNumber && !counts.has(c.productNumber)
  ).filter((c, i, all) => all.findIndex(o => o.productNumber === c.productNumber) === i);

  const usedBy = (productNumber: string) => (catalog || []).filter(c => productNumber && c.productNumber === productNumber);
  const fallback = defaultClass || 'SPRI';
  const field = 'px-3 py-1.5 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';
  const input = `w-full ${field}`;

  return (
    <div className={`p-4 border rounded-lg space-y-4 ${productCodesOn ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50/40'}`}>
      <div>
        <p className="font-medium text-gray-900">Account Class by Product Number</p>
        <p className="text-sm text-gray-500">
          The FlexCube account class a new account opens with. The product number is the <b>Product no.</b> of
          the account class on Products &amp; Services → Account Products, and the account number is branch +
          product number + XXXXXXXXXX (e.g. 103827XXXXXXXXXX). For conventional accounts; IFB accounts use the IFB
          settings below.
        </p>
      </div>

      {productCodesOn && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          Not used now: &quot;Use Account Product Codes&quot; is on, so accounts open with the class code from Account Products.
        </div>
      )}

      {rows === undefined ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b">
                  <th className="px-2 py-2 w-32">Product no.</th>
                  <th className="px-2 py-2 w-40">FlexCube class</th>
                  <th className="px-2 py-2">Account class in Account Products</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => {
                  const twice = (counts.get(r.productNumber) || 0) > 1;
                  const uses = usedBy(r.productNumber);
                  return (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="px-2 py-1.5">
                        <input className={`${input} ${twice ? 'border-red-400 ring-1 ring-red-300' : ''}`} inputMode="numeric"
                          value={r.productNumber} maxLength={5} placeholder="827" aria-label="Product number"
                          onChange={e => setRow(i, { productNumber: e.target.value.replace(/\D/g, '') })} />
                        {twice && <p className="text-xs text-red-600 mt-1">Listed twice</p>}
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={`${input} uppercase`} value={r.accountClass} maxLength={10} placeholder="DBSV"
                          aria-label="FlexCube account class"
                          onChange={e => setRow(i, { accountClass: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                      </td>
                      <td className="px-2 py-2 text-gray-700">
                        {catalog === null ? (
                          <span className="text-gray-400">—</span>
                        ) : uses.length === 0 ? (
                          <span className="text-gray-400">No account class has this product number</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {uses.map(c => (
                              <li key={`${c.product}-${c.code}`} className={c.offered ? '' : 'text-gray-400'}>
                                <span className="font-mono text-xs">{c.code}</span> {c.name}
                                <span className="text-xs text-gray-500"> · {c.product}</span>
                                {!c.offered && <span className="text-xs"> (off)</span>}
                                {c.kind === 'ifb' && <span className="text-xs text-emerald-700"> — IFB: opens with the IFB class below</span>}
                                {c.kind === 'business' && <span className="text-xs text-gray-500"> — business accounts open with their class code</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <button type="button" title="Remove" aria-label="Remove"
                          onClick={() => set(list.filter((_, j) => j !== i))}
                          className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr><td colSpan={4} className="px-2 py-4 text-center text-gray-500">No rows — every account opens as {fallback}.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={() => set([...list, { productNumber: '', accountClass: '' }])}
            className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-900 font-medium">
            <Plus className="w-4 h-4" /> Add product number
          </button>

          {missing.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 space-y-2">
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                These account classes are offered but their product number is not in the list, so they open as {fallback}:
              </p>
              <ul className="space-y-1">
                {missing.map(c => (
                  <li key={c.productNumber} className="flex items-center justify-between gap-3 flex-wrap">
                    <span><span className="font-mono">{c.productNumber}</span> · <span className="font-mono text-xs">{c.code}</span> {c.name}</span>
                    <button type="button" onClick={() => set([...list, { productNumber: c.productNumber, accountClass: c.code }])}
                      className="text-xs font-medium text-green-700 hover:text-green-900">Add as {c.code}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="default-account-class" className="text-sm font-medium text-gray-700">Other product numbers open as</label>
            <input id="default-account-class" className={`${field} uppercase w-32`} value={defaultClass} maxLength={10} placeholder="SPRI"
              onChange={e => onChange(list, e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </div>
        </>
      )}
    </div>
  );
}
