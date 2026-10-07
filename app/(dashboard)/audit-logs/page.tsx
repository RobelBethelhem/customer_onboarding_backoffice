'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  History, Search, Download, Loader2, AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, XCircle, Ban,
} from 'lucide-react';
import { AUDIT_ACTIONS, AUDIT_MODULES, AUDIT_ROLES } from '@/lib/auditTypes';

interface AuditEntry {
  _id: string;
  auditId: string;
  timestamp: string;
  module: string;
  action: string;
  status?: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  description: string;
  performedBy: string;
  performedByName?: string;
  performedByEmail?: string;
  performedByRole?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: { field: string; oldValue: any; newValue: any }[];
  previousData?: any;
  newData?: any;
}

interface Summary {
  byAction: { _id: string; count: number }[];
  byRole: { _id: string | null; count: number }[];
  byStatus: { _id: string; count: number }[];
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Signed in', LOGIN_OTP_SENT: 'Password OK — code sent', LOGIN_FAILED: 'Sign-in failed',
  OTP_FAILED: 'Wrong sign-in code', ACCOUNT_LOCKED: 'Account locked', LOGOUT: 'Signed out',
  SUBMIT: 'Application submitted', AUTO_APPROVE: 'Auto-approved', VIEW: 'Viewed', REVIEW: 'Started review',
  APPROVE: 'Approved', APPROVE_FAILED: 'Approval failed', REJECT: 'Rejected', RETURN: 'Returned',
  ESCALATE: 'Escalated', ACCESS_DENIED: 'Access denied', CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted',
  RESTORE: 'Restored', IMPORT: 'Imported', EXPORT: 'Exported', STATUS_CHANGE: 'Status changed',
  BULK_UPDATE: 'Bulk update', BULK_DELETE: 'Bulk delete', ACTIVATE: 'User activated', DEACTIVATE: 'User deactivated',
  LOCK: 'User locked', UNLOCK: 'User unlocked', PASSWORD_RESET: 'Password reset',
  SERVICES_COMPLETED: 'Services set up', SCREENING_CHECK: 'Screening check', SCREENING_MATCH: 'Screening match',
  SCREENING_CLEAR: 'Screening clear',
  INVITE: 'Verification link sent', VERIFY: 'Verified with Fayda', DOCUMENT_REVIEW: 'Document checked',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', kyc: 'KYC Officer', senior_approver: 'Senior Approver', branch: 'Branch',
  personal_banker: 'Personal Banker', marketing: 'Marketing', sanction_uploader: 'Sanctions Uploader',
  applicant: 'Applicant', system: 'System',
};

const MODULE_LABELS: Record<string, string> = {
  AUTH: 'Sign-in', APPLICATION: 'Application', CUSTOMER: 'Customer', CORPORATE: 'Corporate account', SERVICES: 'Services', USER: 'Users',
  SETTINGS: 'Settings', REFERRAL: 'Referral', SANCTIONS: 'Sanctions', PEP: 'PEP', SCREENING: 'Screening',
  AUDIT: 'Audit log', SYSTEM: 'System',
};

function actionColor(action: string, status?: string): string {
  if (status === 'DENIED') return 'bg-purple-100 text-purple-700';
  if (status === 'FAILURE' || ['LOGIN_FAILED', 'OTP_FAILED', 'ACCOUNT_LOCKED', 'APPROVE_FAILED'].includes(action)) return 'bg-red-100 text-red-700';
  if (['APPROVE', 'AUTO_APPROVE', 'SERVICES_COMPLETED', 'ACTIVATE', 'UNLOCK'].includes(action)) return 'bg-green-100 text-green-700';
  if (['REJECT', 'DELETE', 'DEACTIVATE', 'LOCK', 'BULK_DELETE'].includes(action)) return 'bg-rose-100 text-rose-700';
  if (['RETURN', 'ESCALATE', 'PASSWORD_RESET'].includes(action)) return 'bg-amber-100 text-amber-700';
  if (['LOGIN', 'LOGOUT', 'LOGIN_OTP_SENT'].includes(action)) return 'bg-sky-100 text-sky-700';
  if (action === 'VIEW' || action === 'EXPORT') return 'bg-gray-100 text-gray-700';
  return 'bg-blue-100 text-blue-700';
}

const dateInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const show = (v: any) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    from: dateInput(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
    to: dateInput(new Date()),
    module: '', action: '', role: '', status: '', user: '', entity: '',
  });
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const queryString = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', new Date(`${filters.from}T00:00:00`).toISOString());
    if (filters.to) params.set('to', new Date(`${filters.to}T23:59:59.999`).toISOString());
    (['module', 'action', 'role', 'status', 'user', 'entity'] as const).forEach(k => { if (filters[k]) params.set(k, filters[k]); });
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params.toString();
  };

  useEffect(() => {
    // Debounce so typing in the search boxes doesn't fire a request per keystroke
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/audit-logs?${queryString({ page: String(page), limit: '50' })}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load the audit log');
        setLogs(data.data);
        setSummary(data.summary);
        setPagination(data.pagination);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const statusCount = (s: string) => summary?.byStatus.find(x => x._id === s)?.count || 0;
  const first = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-gray-500" /> Audit Log
          </h1>
          <p className="text-gray-500 mt-1">
            Every sign-in, application decision, user, settings and sanctions change — who did it, in which role,
            from where, and exactly what changed.
          </p>
        </div>
        <a
          href={`/api/audit-logs?${queryString({ format: 'csv' })}`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Summary: outcomes, roles, action types (click to filter) */}
      {summary && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-24">Outcome</span>
            {[
              { key: 'SUCCESS', label: 'Success', icon: CheckCircle2, cls: 'bg-green-50 text-green-700 border-green-200' },
              { key: 'FAILURE', label: 'Failed', icon: XCircle, cls: 'bg-red-50 text-red-700 border-red-200' },
              { key: 'DENIED', label: 'Denied', icon: Ban, cls: 'bg-purple-50 text-purple-700 border-purple-200' },
            ].map(({ key, label, icon: Icon, cls }) => (
              <button
                key={key}
                onClick={() => setFilter('status', filters.status === key ? '' : key)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm ${cls} ${filters.status === key ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
              >
                <Icon className="w-4 h-4" /> {label} <strong>{statusCount(key)}</strong>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-24">By role</span>
            {summary.byRole.length === 0 && <span className="text-sm text-gray-400">No activity</span>}
            {summary.byRole.map(r => (
              <button
                key={r._id || 'none'}
                onClick={() => r._id && setFilter('role', filters.role === r._id ? '' : r._id)}
                className={`px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 ${filters.role === r._id ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
              >
                {ROLE_LABELS[r._id || ''] || r._id || 'Unknown'} <strong>{r.count}</strong>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-24">By action</span>
            {summary.byAction.map(a => (
              <button
                key={a._id}
                onClick={() => setFilter('action', filters.action === a._id ? '' : a._id)}
                className={`px-3 py-1 rounded-full text-sm ${actionColor(a._id)} ${filters.action === a._id ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
              >
                {ACTION_LABELS[a._id] || a._id} <strong>{a.count}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} title="From"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} title="To"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filters.module} onChange={e => setFilter('module', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All modules</option>
          {AUDIT_MODULES.map(m => <option key={m} value={m}>{MODULE_LABELS[m] || m}</option>)}
        </select>
        <select value={filters.action} onChange={e => setFilter('action', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All action types</option>
          {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
        </select>
        <select value={filters.role} onChange={e => setFilter('role', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All roles</option>
          {AUDIT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All outcomes</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILURE">Failed</option>
          <option value="DENIED">Denied</option>
        </select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={filters.user} onChange={e => setFilter('user', e.target.value)} placeholder="User name / email"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={filters.entity} onChange={e => setFilter('entity', e.target.value)} placeholder="Target (ID / name)"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Log */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-12 text-red-600"><AlertTriangle className="w-5 h-5" /> {error}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            No activity matches these filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="w-8"></th>
                  <th className="px-3 py-3 font-medium">Time</th>
                  <th className="px-3 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                  <th className="px-3 py-3 font-medium">Target</th>
                  <th className="px-3 py-3 font-medium">Details</th>
                  <th className="px-3 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const isOpen = expanded === log._id;
                  const status = log.status || 'SUCCESS';
                  return (
                    <Fragment key={log._id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : log._id)}
                        className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${isOpen ? 'bg-gray-50' : ''}`}
                      >
                        <td className="pl-3 text-gray-400">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-900">{log.performedByName || log.performedBy}</p>
                          {log.performedByEmail && <p className="text-xs text-gray-500">{log.performedByEmail}</p>}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">{ROLE_LABELS[log.performedByRole || ''] || log.performedByRole || '—'}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${actionColor(log.action, status)}`}>
                            {status === 'DENIED' && <Ban className="w-3 h-3" />}
                            {status === 'FAILURE' && <XCircle className="w-3 h-3" />}
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                          <p className="text-[11px] text-gray-400 mt-0.5">{MODULE_LABELS[log.module] || log.module}</p>
                        </td>
                        <td className="px-3 py-3">
                          {log.entityType === 'Customer' && log.entityId ? (
                            <Link href={`/customers/${log.entityId}`} onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline">
                              {log.entityName || log.entityId}
                            </Link>
                          ) : (
                            <span className="text-gray-800">{log.entityName || log.entityId}</span>
                          )}
                          <p className="text-[11px] text-gray-400 font-mono">{log.entityType} · {log.entityId}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-700 max-w-md">{log.description}</td>
                        <td className="px-3 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{log.ipAddress || '—'}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td></td>
                          <td colSpan={7} className="px-3 pb-4">
                            {(log.changes || []).length > 0 && (
                              <table className="w-full max-w-3xl text-xs mb-3 border border-gray-200 bg-white rounded">
                                <thead>
                                  <tr className="text-left text-gray-500 bg-gray-100">
                                    <th className="px-2 py-1.5 font-medium">Field</th>
                                    <th className="px-2 py-1.5 font-medium">Before</th>
                                    <th className="px-2 py-1.5 font-medium">After</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {log.changes!.map(c => (
                                    <tr key={c.field} className="border-t border-gray-100">
                                      <td className="px-2 py-1.5 font-mono text-gray-700">{c.field}</td>
                                      <td className="px-2 py-1.5 text-red-700 break-all">{show(c.oldValue)}</td>
                                      <td className="px-2 py-1.5 text-green-700 break-all">{show(c.newValue)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {(log.previousData || log.newData) && (
                              <pre className="max-w-3xl max-h-60 overflow-auto text-[11px] bg-white border border-gray-200 rounded p-2 mb-3">
                                {JSON.stringify(log.newData || log.previousData, null, 2)}
                              </pre>
                            )}
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <p>Outcome: <strong>{status}</strong> · Audit ID <span className="font-mono">{log.auditId}</span></p>
                              {log.userAgent && <p className="break-all">Browser: {log.userAgent}</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <span>Showing {first}–{last} of {pagination.total.toLocaleString()}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <span className="px-2 py-1.5">Page {pagination.page} of {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
