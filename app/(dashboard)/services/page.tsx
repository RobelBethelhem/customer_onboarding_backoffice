'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, CheckCircle2, Clock, Send, AlertTriangle, FileCheck2, FileText,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Customer, formatDate } from '@/lib/api';
import { serviceNamesFor } from '@/lib/services';
import { formatFormDate } from '@/lib/serviceRequestForm';
import ServiceIcon from '@/components/ServiceIcon';
import ServiceNotifyDialog, { doneRecord, detailOf, termsNote } from '@/components/ServiceNotifyDialog';

type Tab = 'pending' | 'completed';

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

  const q = search.trim().toLowerCase();
  const filtered = customers.filter(c =>
    !q ||
    c.fullName.toLowerCase().includes(q) ||
    c.customerId.toLowerCase().includes(q) ||
    (c.accountNumber || '').includes(q) ||
    (c.phone || '').includes(q) ||
    (c.email || '').toLowerCase().includes(q)
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
        <p className="text-gray-500 mt-1">
          {isBanker
            ? `Customers of branch ${user?.branchCode || ''} (including its IFB branch) who asked for additional services such as Mobile Banking or a Debit Card. Open a request to see the customer's details, print it or download it as PDF. Set the service up, then mark it as created to notify the customer by SMS.`
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
            placeholder="Search by name, application ID, account number, phone or email..."
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Account Number</th>
                  {!isBanker && <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Branch</th>}
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Requested Services</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Account Opened</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.customerId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <Link href={`/services/${customer.customerId}`} className="font-medium text-gray-900 hover:text-blue-600 hover:underline">
                        {customer.fullName}
                      </Link>
                      <p className="text-sm text-gray-500">{customer.customerId}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{customer.phone || '-'}</td>
                    <td className="px-4 py-4 text-gray-600 text-sm break-words">{customer.email || '-'}</td>
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
                              title={(done ? `Created ${formatFormDate(done.completedAt)} by ${done.completedBy}` : 'Waiting to be set up') + (terms ? ` · ${terms.text}` : '')}
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
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/services/${customer.customerId}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          View
                        </Link>
                        {isBanker && (
                          <button
                            onClick={() => setActive(customer)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              tab === 'pending'
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Send className="w-4 h-4" />
                            {tab === 'pending' ? 'Mark Created & Notify' : 'Resend SMS'}
                          </button>
                        )}
                      </div>
                    </td>
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
        <ServiceNotifyDialog
          customer={active}
          onClose={() => setActive(null)}
          onDone={() => { setActive(null); loadData(tab); }}
        />
      )}
    </div>
  );
}
