'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Search, Loader2, Shield, Users, RefreshCw, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { CORPORATE_STATUS, CorporateListItem, CorporateStatus } from '@/lib/corporateTypes';

type Filter = 'open' | CorporateStatus | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'To review' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'awaiting_verification', label: 'Waiting for verification' },
  { id: 'returned', label: 'Returned' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const PAGE = 50;

/** Business account applications (organizations) — KYC officers, Senior Approvers, admin */
export default function CorporateApplicationsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('open');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<CorporateListItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Senior Approvers start on the escalated list
  useEffect(() => {
    if (user?.role === 'senior_approver') setFilter('escalated');
  }, [user?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status: filter, limit: String(PAGE), skip: String(skip) });
      if (query) params.set('search', query);
      const res = await fetch(`/api/corporate/applications?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load');
      setItems(data.data);
      setTotal(data.total);
      setCounts(data.counts || {});
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter, query, skip]);

  useEffect(() => { load(); }, [load]);

  const countFor = (f: Filter) =>
    f === 'all' ? counts.total : f === 'open' ? (counts.pending || 0) + (counts.in_review || 0) : counts[f];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" /> Business Accounts
          </h1>
          <p className="text-gray-500 mt-1">
            Account opening for organizations. Every signatory and director verifies with Fayda before an application reaches KYC.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setSkip(0); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
            {countFor(f.id) ? <span className={`ml-1.5 ${filter === f.id ? 'text-indigo-100' : 'text-gray-400'}`}>{countFor(f.id)}</span> : null}
          </button>
        ))}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); setSkip(0); setQuery(search.trim()); }}
        className="flex gap-2 max-w-xl"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Organization, application ID, TIN, registration no., CIF, person…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Search</button>
      </form>

      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-indigo-600" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            No applications here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">People verified</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(a => (
                  <tr key={a.applicationId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/corporate/${a.applicationId}`} className="font-medium text-gray-900 hover:text-indigo-600">
                        {a.organizationName}
                      </Link>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>{a.applicationId}</span>
                        <span>· by {a.applicantName}</span>
                        {a.complianceHold && (
                          <span className="inline-flex items-center gap-1 text-purple-700"><Shield className="w-3 h-3" /> Screening match</span>
                        )}
                        {a.resubmissionCount > 0 && <span className="text-orange-600">· resubmitted {a.resubmissionCount}×</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.categoryName}
                      {a.subtypeName && <div className="text-xs text-gray-500">{a.subtypeName}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.accountTypeName}
                      {a.isIFB && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs">IFB</span>}
                      <div className="text-xs text-gray-500">{a.accountClassName} · {a.branch}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 ${a.people.verified === a.people.total ? 'text-green-700' : 'text-sky-700'}`}>
                        <Users className="w-4 h-4" /> {a.people.verified} / {a.people.total}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${CORPORATE_STATUS[a.status].color}`}>
                        {CORPORATE_STATUS[a.status].label}
                      </span>
                      {a.status === 'approved' && a.accountNumber && <div className="text-xs text-gray-500 mt-1">{a.accountNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(a.submittedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/corporate/${a.applicationId}`} className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium">
                        Open <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{skip + 1}–{Math.min(skip + PAGE, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Previous</button>
            <button disabled={skip + PAGE >= total} onClick={() => setSkip(skip + PAGE)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
