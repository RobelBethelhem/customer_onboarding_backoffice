'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus, Trash2, Save, Loader2, Search, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { suggestIfbCode } from '@/lib/ifbBranchRules';

interface BranchRow {
  branchName: string;
  conventionalCode: string;
  ifbCode: string;
  branchType: 'Branch' | 'Sub-branch';
  category: 'City' | 'Outline';
  latitude: number | string | null;
  longitude: number | string | null;
  active: boolean;
}

const emptyRow = (): BranchRow => ({
  branchName: '', conventionalCode: '', ifbCode: '', branchType: 'Branch', category: 'City',
  latitude: '', longitude: '', active: true,
});

const cell = 'w-full px-2 py-1.5 border border-gray-200 focus:border-blue-400 rounded outline-none';

/**
 * Settings → Branches (admin): the branch directory. The customer web app loads its branch list
 * from here (GET /api/branches), and IFB accounts open in each branch's IFB code.
 */
export default function IfbBranchSettings() {
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [defaults, setDefaults] = useState<BranchRow[]>([]);
  const [meta, setMeta] = useState<{ updatedBy?: string; updatedAt?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ifb-branches');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setRows(data.data.mappings);
        setDefaults(data.data.defaults);
        setMeta({ updatedBy: data.data.updatedBy, updatedAt: data.data.updatedAt });
      } catch (err) {
        setMessage({ ok: false, text: (err as Error).message || 'Failed to load branches' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (index: number, field: keyof BranchRow, value: any) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [field]: value };
      // A new branch code fills in the IFB code by the bank rule (1xx → 6xx, 3xx → 8xx)
      if (field === 'conventionalCode' && (!row.ifbCode || row.ifbCode === suggestIfbCode(row.conventionalCode))) {
        next.ifbCode = suggestIfbCode(value);
      }
      return next;
    }));
    setMessage(null);
  };

  const addMissingDefaults = () => {
    const have = new Set(rows.map(r => `${r.conventionalCode} ${r.branchName}`));
    const missing = defaults.filter(d => !have.has(`${d.conventionalCode} ${d.branchName}`));
    setRows(prev => [...prev, ...missing]);
    setMessage({ ok: true, text: missing.length ? `Added ${missing.length} branch(es) from the default list — remember to save` : 'Every default branch is already listed' });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ifb-branches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: rows.filter(r => r.branchName || r.conventionalCode) }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      setRows(data.data.mappings);
      setMessage({ ok: true, text: 'Branches saved — the web app shows the changes right away' });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !q || row.conventionalCode.includes(q) || row.ifbCode.includes(q) || row.branchName.toLowerCase().includes(q));
  const activeCount = rows.filter(r => r.active).length;

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Branches</h2>
            <p className="text-sm text-gray-500">
              The branch list customers choose from in the web app, and each branch&apos;s IFB code.
            </p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Branches
        </button>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3 text-sm text-blue-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            Customers see the <strong>shown</strong> branches in the web app (nearest first, using latitude/longitude).
            Untick &ldquo;Shown&rdquo; to hide a branch without deleting it.
          </p>
          <p>
            IFB accounts open in the branch&apos;s <strong>IFB code</strong> — bank rule 1xx → 6xx (Head Quarter 164 → 664)
            and 3xx → 8xx (341 → 841). Branch managers and Personal Bankers keep the branch code and see both.
          </p>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code or branch name"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { setRows(prev => [emptyRow(), ...prev]); setSearch(''); }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" /> Add branch
        </button>
        <button onClick={addMissingDefaults} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
          Add missing defaults
        </button>
        <span className="text-sm text-gray-500">{rows.length} branches · {activeCount} shown</span>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-left text-gray-500">
                <th className="px-3 py-2.5 font-medium min-w-[220px]">Branch name</th>
                <th className="px-3 py-2.5 font-medium w-24">Code</th>
                <th className="px-3 py-2.5 font-medium w-24">IFB code</th>
                <th className="px-3 py-2.5 font-medium w-32">Type</th>
                <th className="px-3 py-2.5 font-medium w-28">Area</th>
                <th className="px-3 py-2.5 font-medium w-28">Latitude</th>
                <th className="px-3 py-2.5 font-medium w-28">Longitude</th>
                <th className="px-3 py-2.5 font-medium w-16 text-center">Shown</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, index }) => (
                <tr key={index} className={`border-t border-gray-100 ${row.active ? '' : 'bg-gray-50 text-gray-400'}`}>
                  <td className="px-3 py-1.5">
                    <input value={row.branchName} onChange={e => update(index, 'branchName', e.target.value)} placeholder="Branch name" className={cell} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={row.conventionalCode} onChange={e => update(index, 'conventionalCode', e.target.value.replace(/\D/g, ''))}
                      placeholder="164" className={`${cell} font-mono`} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={row.ifbCode} onChange={e => update(index, 'ifbCode', e.target.value.replace(/\D/g, ''))}
                      placeholder="664" className={`${cell} font-mono border-green-200 bg-green-50/40`} />
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={row.branchType} onChange={e => update(index, 'branchType', e.target.value)} className={cell}>
                      <option value="Branch">Branch</option>
                      <option value="Sub-branch">Sub-branch</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={row.category} onChange={e => update(index, 'category', e.target.value)} className={cell}>
                      <option value="City">City</option>
                      <option value="Outline">Outline</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={row.latitude ?? ''} onChange={e => update(index, 'latitude', e.target.value)} placeholder="9.0105" className={`${cell} font-mono`} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={row.longitude ?? ''} onChange={e => update(index, 'longitude', e.target.value)} placeholder="38.7613" className={`${cell} font-mono`} />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" checked={row.active} onChange={e => update(index, 'active', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  </td>
                  <td className="px-1 text-center">
                    <button
                      onClick={() => setRows(prev => prev.filter((_, i) => i !== index))}
                      title="Delete"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="text-center text-gray-500 py-8">No branches match</p>}
        </div>
      </div>

      {meta.updatedAt && (
        <p className="text-xs text-gray-400">
          Last saved {new Date(meta.updatedAt).toLocaleString()}{meta.updatedBy ? ` by ${meta.updatedBy}` : ''}
        </p>
      )}
    </div>
  );
}
