'use client';

import { useState, useEffect } from 'react';
import { XCircle, Search, Filter, Eye, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { fetchCustomers, Customer, getStatusColor, getStatusLabel, formatDate } from '@/lib/api';

export default function RejectedPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const response = await fetchCustomers({ status: 'rejected' });
      if (response.success) {
        setCustomers(response.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customerId.toLowerCase().includes(searchTerm.toLowerCase());

    if (dateFilter === 'all') return matchesSearch;

    const rejectedDate = new Date(customer.rejectedAt || customer.createdAt);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - rejectedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (dateFilter === 'today') return matchesSearch && diffDays === 0;
    if (dateFilter === 'week') return matchesSearch && diffDays <= 7;
    if (dateFilter === 'month') return matchesSearch && diffDays <= 30;

    return matchesSearch;
  });

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rejected Applications</h1>
        <p className="text-gray-500 mt-1">Applications that did not pass KYC verification</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
            <span className="text-white/80 text-sm">Total Rejected</span>
          </div>
          <p className="text-3xl font-bold">{customers.length}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-gray-500 text-sm">Low Face Match</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {customers.filter(c => c.faceMatchScore < 70).length}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-gray-500 text-sm">This Week</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {customers.filter(c => {
              const rejectedDate = new Date(c.rejectedAt || c.createdAt);
              const today = new Date();
              const diffDays = Math.floor((today.getTime() - rejectedDate.getTime()) / (1000 * 60 * 60 * 24));
              return diffDays <= 7;
            }).length}
          </p>
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
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Account Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Face Match</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Rejection Reason</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Rejected At</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={customer.faydaPhoto}
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
                  <td className="px-4 py-4">
                    <span className="text-red-600 text-sm">{customer.rejectionReason || 'Not specified'}</span>
                  </td>
                  <td className="px-4 py-4 text-gray-600">
                    {formatDate(customer.rejectedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/customers/${customer.customerId}`}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <XCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No rejected applications found</p>
          </div>
        )}
      </div>
    </div>
  );
}
