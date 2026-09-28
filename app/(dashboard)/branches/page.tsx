'use client';

import { Building2, Users, TrendingUp, MapPin } from 'lucide-react';
import { customers } from '@/lib/data';

export default function BranchesPage() {
  // Calculate branch statistics
  const branchStats = customers.reduce((acc, c) => {
    if (!acc[c.branch]) {
      acc[c.branch] = {
        total: 0,
        pending: 0,
        approved: 0,
        totalDeposits: 0,
      };
    }
    acc[c.branch].total += 1;
    if (c.status === 'pending') acc[c.branch].pending += 1;
    if (c.status === 'approved') acc[c.branch].approved += 1;
    acc[c.branch].totalDeposits += c.initialDeposit;
    return acc;
  }, {} as Record<string, { total: number; pending: number; approved: number; totalDeposits: number }>);

  const branchList = Object.entries(branchStats)
    .map(([name, stats]) => ({
      name,
      ...stats,
      approvalRate: Math.round((stats.approved / stats.total) * 100),
      avgDeposit: Math.round(stats.totalDeposits / stats.total),
    }))
    .sort((a, b) => b.total - a.total);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
        <p className="text-gray-500 mt-1">Performance overview of all bank branches</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="dashboard-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Branches</p>
              <p className="text-xl font-bold text-gray-900">{branchList.length}</p>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg. per Branch</p>
              <p className="text-xl font-bold text-gray-900">{Math.round(customers.length / branchList.length)}</p>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Top Branch</p>
              <p className="text-xl font-bold text-gray-900 truncate">{branchList[0]?.name.split(' - ')[0]}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branchList.map((branch, index) => (
          <div key={branch.name} className="dashboard-card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                  <p className="text-sm text-gray-500">Branch #{index + 1}</p>
                </div>
              </div>
              {index < 3 && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                  Top {index + 1}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Customers</p>
                <p className="text-lg font-bold text-gray-900">{branch.total}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Approval Rate</p>
                <p className="text-lg font-bold text-green-600">{branch.approvalRate}%</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Pending Review</span>
                <span className="font-medium text-amber-600">{branch.pending}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Total Deposits</span>
                <span className="font-medium text-gray-900">{formatCurrency(branch.totalDeposits)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Avg. Deposit</span>
                <span className="font-medium text-gray-900">{formatCurrency(branch.avgDeposit)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
