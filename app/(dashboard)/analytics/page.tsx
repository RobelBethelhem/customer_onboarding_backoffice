'use client';

import { TrendingUp, Users, Clock, Target } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { DailyApplicationsChart, AccountTypeDistributionChart, StatusBreakdownChart } from '@/components/Charts';
import { customers, dailyStats, accountTypeStats, summaryStats } from '@/lib/data';

export default function AnalyticsPage() {
  // Calculate additional metrics
  const approvedCount = customers.filter((c) => c.status === 'approved').length;
  const rejectedCount = customers.filter((c) => c.status === 'rejected').length;
  const approvalRate = Math.round((approvedCount / customers.length) * 100);

  const avgDeposit = Math.round(
    customers.reduce((sum, c) => sum + c.initialDeposit, 0) / customers.length
  );

  // Branch distribution
  const branchStats = customers.reduce((acc, c) => {
    acc[c.branch] = (acc[c.branch] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topBranches = Object.entries(branchStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Detailed insights and performance metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Approval Rate"
          value={`${approvalRate}%`}
          subtitle="Of all applications"
          icon={Target}
          color="green"
        />
        <StatCard
          title="Avg. Initial Deposit"
          value={`ETB ${avgDeposit.toLocaleString()}`}
          subtitle="Per customer"
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="Total Approved"
          value={approvedCount}
          subtitle="Verified accounts"
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Processing Time"
          value="2.3 days"
          subtitle="Average approval time"
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyApplicationsChart data={dailyStats} />
        <StatusBreakdownChart data={dailyStats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountTypeDistributionChart data={accountTypeStats} />

        {/* Branch Performance */}
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Branches by Registrations</h3>
          <div className="space-y-4">
            {topBranches.map(([branch, count], index) => {
              const percentage = Math.round((count / customers.length) * 100);
              return (
                <div key={branch}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{branch}</span>
                    <span className="text-sm font-medium text-gray-900">{count} customers</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Growth Indicators */}
      <div className="dashboard-card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-3xl font-bold text-green-600">+{summaryStats.weeklyGrowth}%</p>
            <p className="text-sm text-green-700 mt-1">Weekly Growth</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-3xl font-bold text-blue-600">+{summaryStats.monthlyGrowth}%</p>
            <p className="text-sm text-blue-700 mt-1">Monthly Growth</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <p className="text-3xl font-bold text-purple-600">{customers.length}</p>
            <p className="text-sm text-purple-700 mt-1">Total Registrations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
