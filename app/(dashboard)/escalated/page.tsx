'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, Search, Eye, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { fetchCustomers, Customer, getStatusColor, getStatusLabel, formatDate } from '@/lib/api';
import { ensureDataUri } from '@/lib/imageUtils';

export default function EscalatedPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const response = await fetchCustomers({ status: 'escalated' });
      if (response.success) {
        setCustomers(response.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter((customer) =>
    customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customerId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escalated for Second-Level Approval</h1>
          <p className="text-gray-500 mt-1">PEP and other escalated applications awaiting a Senior Approver decision</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-purple-600 font-medium">Awaiting Second-Level Approval</p>
            <p className="text-2xl font-bold text-purple-900">{customers.length}</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-purple-600 mt-0.5" />
        <div>
          <p className="font-medium text-purple-900">Senior Approval Required</p>
          <p className="text-sm text-purple-700 mt-1">
            These applications were escalated (e.g. Politically Exposed Persons) and must be reviewed by a Senior Approver.
            Open an application to approve and create the account, or reject with a reason.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Account Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Branch</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Reason</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Escalated</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={ensureDataUri(customer.faydaPhoto)}
                        alt={customer.fullName}
                        className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{customer.fullName}</p>
                        <p className="text-sm text-gray-500">{customer.customerId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600">{customer.accountType}</td>
                  <td className="px-4 py-4 text-gray-600">{customer.branch}</td>
                  <td className="px-4 py-4 text-gray-600 max-w-xs truncate">{customer.escalationReason || '-'}</td>
                  <td className="px-4 py-4 text-gray-600">{formatDate(customer.escalatedAt)}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                      {getStatusLabel(customer.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/customers/${customer.customerId}`}
                      className="flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No escalated applications</p>
          </div>
        )}
      </div>
    </div>
  );
}
