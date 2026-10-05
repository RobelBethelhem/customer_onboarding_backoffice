'use client';

import { useEffect, useState } from 'react';
import {
  Search, Loader2, CheckCircle2, Clock, Send, X, MessageSquare, AlertTriangle, FileCheck2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { Customer, formatDate } from '@/lib/api';
import { servicesReadySms, serviceNamesFor } from '@/lib/services';
import ServiceIcon from '@/components/ServiceIcon';

type Tab = 'pending' | 'completed';

const MAX_CUSTOM_MESSAGE = 300;

const doneRecord = (c: Customer, service: string) => (c.completedServices || []).find(s => s.service === service);
// The service as requested: name, icon and terms acceptance saved with the application
const detailOf = (c: Customer, service: string) => (c.requestedServiceDetails || []).find(d => d.id === service);
const termsNote = (c: Customer, service: string): { ok: boolean; text: string } | null => {
  const d = detailOf(c, service);
  if (!d?.termsRequired) return null;
  return d.termsAcceptedVersion
    ? { ok: true, text: `Terms accepted (version ${d.termsAcceptedVersion}${d.termsAcceptedAt ? `, ${formatDate(d.termsAcceptedAt)}` : ''})` }
    : { ok: false, text: 'Terms not accepted online — have the customer sign them at the branch' };
};

export default function ServiceRequestsPage() {
  const { user } = useAuth();
  const isBanker = user?.role === 'personal_banker';
  const [tab, setTab] = useState<Tab>('pending');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // Notify dialog
  const [active, setActive] = useState<Customer | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData(tab);
  }, [tab]);

  async function loadData(which: Tab) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/services?status=${which}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data);
      } else {
        setError(data.error || 'Failed to load service requests');
      }
    } catch {
      setError('Failed to load service requests');
    } finally {
      setLoading(false);
    }
  }

  function openNotify(customer: Customer) {
    const requested = customer.requestedServices || [];
    const outstanding = requested.filter(s => !doneRecord(customer, s));
    setActive(customer);
    // Pre-select what is still outstanding (everything, when re-sending)
    setSelected(outstanding.length ? outstanding : requested);
    setCustomMessage('');
  }

  function toggleService(service: string) {
    setSelected(prev => prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]);
  }

  async function handleSend() {
    if (!active || selected.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(`/api/services/${active.customerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: selected, customMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update the service request');
      }
      if (data.smsSent) {
        toast.success(`Marked as created — SMS sent to ${active.phone}`);
      } else {
        toast.warning('Marked as created, but the SMS could not be sent', {
          description: 'Please contact the customer directly.',
        });
      }
      setActive(null);
      loadData(tab);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = customers.filter(c =>
    !q ||
    c.fullName.toLowerCase().includes(q) ||
    c.customerId.toLowerCase().includes(q) ||
    (c.accountNumber || '').includes(q) ||
    (c.phone || '').includes(q)
  );

  const preview = active && selected.length
    ? servicesReadySms(
        active.fullName, active.accountNumber,
        (active.requestedServices || []).filter(s => selected.includes(s)), customMessage, serviceNamesFor(active)
      )
    : '';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
        <p className="text-gray-500 mt-1">
          {isBanker
            ? `Customers of branch ${user?.branchCode || ''} (including its IFB branch) who asked for additional services such as Mobile Banking or a Debit Card. Set the service up, then mark it as created to notify the customer by SMS.`
            : 'Customers who asked for additional services such as Mobile Banking or a Debit Card (all branches, view only). The Personal Banker of each branch sets them up and notifies the customer.'}
        </p>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
          {(['pending', 'completed'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'pending' ? 'Waiting to be set up' : 'Completed'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, application ID, account number or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 justify-center py-12 text-red-600">
            <AlertTriangle className="w-5 h-5" /> {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Customer</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Phone</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Account Number</th>
                  {!isBanker && <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Branch</th>}
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Requested Services</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Account Opened</th>
                  {isBanker && <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.customerId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{customer.fullName}</p>
                      <p className="text-sm text-gray-500">{customer.customerId}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{customer.phone || '-'}</td>
                    <td className="px-4 py-4 font-mono text-sm text-gray-700">{customer.accountNumber || '-'}</td>
                    {!isBanker && <td className="px-4 py-4 text-gray-600">{customer.branch} ({customer.branchCode})</td>}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(customer.requestedServices || []).map(service => {
                          const done = doneRecord(customer, service);
                          const terms = termsNote(customer, service);
                          return (
                            <span
                              key={service}
                              title={(done ? `Created ${formatDate(done.completedAt)} by ${done.completedBy}` : 'Waiting to be set up') + (terms ? ` · ${terms.text}` : '')}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              <ServiceIcon id={service} icon={detailOf(customer, service)?.icon} className="w-3.5 h-3.5" />
                              {serviceNamesFor(customer)[service] || service}
                              {terms && <FileCheck2 className={`w-3.5 h-3.5 ${terms.ok ? '' : 'text-red-600'}`} />}
                              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-sm">{formatDate(customer.approvedAt)}</td>
                    {isBanker && (
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openNotify(customer)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            tab === 'pending'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Send className="w-4 h-4" />
                          {tab === 'pending' ? 'Mark Created & Notify' : 'Resend SMS'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {tab === 'pending' ? 'No service requests waiting' : 'No completed service requests yet'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mark created & notify dialog */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !sending && setActive(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Notify {active.fullName}</h3>
                <p className="text-sm text-gray-500">
                  Account {active.accountNumber || '-'} · {active.phone || 'no phone on file'}
                </p>
              </div>
              <button onClick={() => setActive(null)} disabled={sending} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Which services have you set up?</p>
                <div className="space-y-2">
                  {(active.requestedServices || []).map(service => {
                    const done = doneRecord(active, service);
                    const terms = termsNote(active, service);
                    return (
                      <label
                        key={service}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected.includes(service) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(service)}
                          onChange={() => toggleService(service)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <ServiceIcon id={service} icon={detailOf(active, service)?.icon} className="w-5 h-5 text-gray-500" />
                        <span className="flex-1 min-w-0">
                          <span className="block font-medium text-gray-800">{serviceNamesFor(active)[service] || service}</span>
                          {terms && (
                            <span className={`block text-xs ${terms.ok ? 'text-gray-500' : 'text-red-600 font-medium'}`}>{terms.text}</span>
                          )}
                        </span>
                        {done && (
                          <span className="text-xs text-green-700">
                            Created {formatDate(done.completedAt)} by {done.completedBy}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4" /> Additional message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value.slice(0, MAX_CUSTOM_MESSAGE))}
                  rows={3}
                  placeholder="e.g. Please collect your debit card at the branch with your ID."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-400 text-right">{customMessage.length}/{MAX_CUSTOM_MESSAGE}</p>
              </div>

              {preview && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">SMS preview</p>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{preview}</div>
                </div>
              )}

              {(active.serviceNotifications || []).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Previous notifications</p>
                  <ul className="space-y-1 text-xs text-gray-500">
                    {(active.serviceNotifications || []).map((n, i) => (
                      <li key={i}>
                        {formatDate(n.sentAt)} · {n.sentBy} · {n.services.map(s => serviceNamesFor(active)[s] || s).join(', ')}
                        {n.smsSent ? '' : ' · SMS not delivered'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setActive(null)}
                disabled={sending}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || selected.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Mark as Created &amp; Send SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
