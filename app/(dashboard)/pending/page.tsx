'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, Search, Filter, Eye, Camera, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { fetchCustomers, Customer, getStatusColor, getStatusLabel, formatDate } from '@/lib/api';
import { ensureDataUri } from '@/lib/imageUtils';

// Mirror of the server-side review-lock TTL — a lock older than this is stale and ignored.
const LOCK_TTL_MS = 2 * 60 * 1000;
function lockedReviewer(c: Customer): string | null {
  if (!c.lockedById || !c.lockedAt) return null;
  if (Date.now() - new Date(c.lockedAt).getTime() >= LOCK_TTL_MS) return null;
  return c.lockedBy || 'another officer';
}

export default function PendingReviewPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'in_review'>('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const response = await fetchCustomers({ status: 'pending_all' });
      if (response.success) {
        setCustomers(response.data);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customerId.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && customer.status === statusFilter;
  });

  const today = new Date();
  const urgentCount = customers.filter((c) => {
    const daysWaiting = Math.floor(
      (today.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysWaiting >= 3;
  }).length;

  const pendingCount = customers.filter((c) => c.status === 'pending').length;
  const verifiedCount = customers.filter((c) => c.status === 'verified').length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Review</h1>
          <p className="text-gray-500 mt-1">Applications awaiting KYC verification and approval</p>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-amber-600 font-medium">Total Pending</p>
            <p className="text-2xl font-bold text-amber-900">{customers.length}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Verified (Ready)</p>
            <p className="text-2xl font-bold text-blue-900">{verifiedCount}</p>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-purple-600 font-medium">Awaiting Review</p>
            <p className="text-2xl font-bold text-purple-900">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-red-600 font-medium">Urgent (3+ days)</p>
            <p className="text-2xl font-bold text-red-900">{urgentCount}</p>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {urgentCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-800">
            <span className="font-semibold">{urgentCount} applications</span> have been waiting for more than 3 days. Please prioritize these reviews.
          </p>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Camera className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900">Manual Review Required</p>
          <p className="text-sm text-blue-700 mt-1">
            Click on any application to review the customer&apos;s identity verification.
          </p>
          <div className="mt-2 space-y-1">
            <p className="text-sm text-blue-700">
              <span className="font-medium">📱 Mobile App:</span> Compare the Fayda ID photo alongside the 5 liveness verification photos (Face Center, Eye Blink, Head Left, Head Right, Smile).
            </p>
            <p className="text-sm text-blue-700">
              <span className="font-medium">🌐 Web / WhatsApp / Telegram / SuperApp:</span> Review the recorded face video and selfie snapshot alongside the Fayda ID photo. These channels always require manual approval.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Pending</option>
            <option value="pending">Waiting for Review</option>
            <option value="in_review">In Review</option>
            <option value="verified">Verified</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Channel</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Account Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Branch</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Face Match</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Submitted</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Waiting</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const daysWaiting = Math.floor(
                  (today.getTime() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                const isUrgent = daysWaiting >= 3;

                return (
                  <tr
                    key={customer._id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${isUrgent ? 'bg-red-50/50' : ''}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={ensureDataUri(customer.faydaPhoto)}
                            alt={customer.fullName}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                            onError={(e) => {
                              // Fallback to placeholder on error
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjwvdGV4dD48L3N2Zz4=';
                            }}
                          />
                          {isUrgent && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                              <AlertTriangle className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{customer.fullName}</p>
                          <p className="text-sm text-gray-500">
                            {customer.customerId}
                            {customer.isExistingCustomer && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px] font-semibold">
                                Existing CIF {customer.existingCif}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        customer.channel === 'mobile_app' ? 'bg-green-100 text-green-700' :
                        customer.channel === 'web' ? 'bg-blue-100 text-blue-700' :
                        customer.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' :
                        customer.channel === 'telegram' ? 'bg-sky-100 text-sky-700' :
                        customer.channel === 'superapp' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {customer.channel === 'mobile_app' ? 'Mobile App' :
                         customer.channel === 'web' ? 'Web' :
                         customer.channel === 'whatsapp' ? 'WhatsApp' :
                         customer.channel === 'telegram' ? 'Telegram' :
                         customer.channel === 'superapp' ? 'SuperApp' :
                         customer.channel || 'Mobile App'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{customer.accountType}</td>
                    <td className="px-4 py-4 text-gray-600">{customer.branch}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          customer.faceMatchScore >= 85 ? 'bg-green-500' :
                          customer.faceMatchScore >= 70 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`} />
                        <span className={`font-medium ${
                          customer.faceMatchScore >= 85 ? 'text-green-600' :
                          customer.faceMatchScore >= 70 ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {customer.faceMatchScore}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-medium ${isUrgent ? 'text-red-600' : 'text-gray-600'}`}>
                        {daysWaiting === 0 ? 'Today' : `${daysWaiting} day${daysWaiting > 1 ? 's' : ''}`}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                        {getStatusLabel(customer.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {lockedReviewer(customer) && (
                        <span
                          className="flex items-center gap-1 text-amber-600 text-xs font-medium mb-1"
                          title={`Currently being reviewed by ${lockedReviewer(customer)}`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          In review
                        </span>
                      )}
                      <Link
                        href={`/customers/${customer.customerId}`}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No pending applications</p>
          </div>
        )}
      </div>
    </div>
  );
}
