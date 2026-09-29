'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus, Trash2, Save, Loader2, Search, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { suggestIfbCode } from '@/lib/ifbBranchRules';

interface Mapping { conventionalCode: string; ifbCode: string; branchName: string }

/** Settings → IFB Branches (admin): the conventional → IFB branch code table */
export default function IfbBranchSettings() {
  const [rows, setRows] = useState<Mapping[]>([]);
  const [defaults, setDefaults] = useState<Mapping[]>([]);
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
        setMessage({ ok: false, text: (err as Error).message || 'Failed to load IFB branch codes' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (index: number, field: keyof Mapping, value: string) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [field]: value };
      // Typing a new conventional code fills in the IFB code by the bank rule (1xx → 6xx, 3xx → 8xx)
      if (field === 'conventionalCode' && (!row.ifbCode || row.ifbCode === suggestIfbCode(row.conventionalCode))) {
        next.ifbCode = suggestIfbCode(value);
      }
      return next;
    }));
    setMessage(null);
  };

  const addMissingDefaults = () => {
    const have = new Set(rows.map(r => r.conventionalCode));
    const missing = defaults.filter(d => !have.has(d.conventionalCode));
    setRows(prev => [...prev, ...missing]);
    setMessage({ ok: true, text: missing.length ? `Added ${missing.length} branch(es) from the default rule — remember to save` : 'Every default branch is already listed' });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ifb-branches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: rows.filter(r => r.conventionalCode || r.ifbCode) }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      setRows(data.data.mappings);
      setMessage({ ok: true, text: 'IFB branch codes saved' });
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
            <h2 className="text-lg font-semibold text-gray-900">IFB Branch Codes</h2>
            <p className="text-sm text-gray-500">
              Interest-free (IFB) accounts are opened in the IFB code of the branch the customer chose.
            </p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save IFB Codes
        </button>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3 text-sm text-blue-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          Bank rule: conventional <strong>1xx → 6xx</strong> (Head Quarter 164 → 664) and <strong>3xx → 8xx</strong>
          (341 → 841). Branch managers and Personal Bankers are set up with the conventional code and see
          customers of both codes. Add new branches here as they open.
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
          onClick={() => { setRows(prev => [{ conventionalCode: '', ifbCode: '', branchName: '' }, ...prev]); setSearch(''); }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" /> Add branch
        </button>
        <button onClick={addMissingDefaults} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
          Add missing defaults
        </button>
        <span className="text-sm text-gray-500">{rows.length} branches</span>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-2.5 font-medium">Branch</th>
                <th className="px-4 py-2.5 font-medium w-40">Conventional code</th>
                <th className="px-4 py-2.5 font-medium w-40">IFB code</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, index }) => (
                <tr key={index} className="border-t border-gray-100">
                  <td className="px-4 py-1.5">
                    <input
                      value={row.branchName}
                      onChange={e => update(index, 'branchName', e.target.value)}
                      placeholder="Branch name"
                      className="w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-blue-400 rounded outline-none"
                    />
                  </td>
                  <td className="px-4 py-1.5">
                    <input
                      value={row.conventionalCode}
                      onChange={e => update(index, 'conventionalCode', e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 164"
                      className="w-full px-2 py-1.5 border border-gray-200 focus:border-blue-400 rounded font-mono outline-none"
                    />
                  </td>
                  <td className="px-4 py-1.5">
                    <input
                      value={row.ifbCode}
                      onChange={e => update(index, 'ifbCode', e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 664"
                      className="w-full px-2 py-1.5 border border-green-200 bg-green-50/40 focus:border-green-500 rounded font-mono outline-none"
                    />
                  </td>
                  <td className="px-2 text-center">
                    <button
                      onClick={() => setRows(prev => prev.filter((_, i) => i !== index))}
                      title="Remove"
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
