'use client';

import { useState, useEffect } from 'react';
import { Clock, Zap, CheckCircle2, XCircle, Users, Loader2, TrendingUp, PieChart, BarChart3, Activity } from 'lucide-react';
import Link from 'next/link';
import { fetchCustomers, fetchStats, Customer, getStatusColor, getStatusLabel, formatDate } from '@/lib/api';
import { ensureDataUri } from '@/lib/imageUtils';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function Dashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    approved: 0,
    auto_approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [customersRes, allCustomersRes, statsRes] = await Promise.all([
        fetchCustomers({ limit: 5 }),
        fetchCustomers({ limit: 1000 }), // Get all for analytics
        fetchStats(),
      ]);

      if (customersRes.success) {
        setCustomers(customersRes.data);
        setCounts(customersRes.counts);
      }
      if (allCustomersRes.success) {
        setAllCustomers(allCustomersRes.data);
      }
    } catch (err) {
      setError('Failed to load data. Make sure MongoDB is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const pendingCount = counts.pending + counts.verified;

  // Prepare daily applications data
  const dailyData = prepareDailyApplicationsData(allCustomers);

  // Prepare status distribution
  const statusData = [
    { name: 'Pending', value: pendingCount, color: '#f59e0b' },
    { name: 'Auto Approved', value: counts.auto_approved, color: '#10b981' },
    { name: 'Manually Approved', value: counts.approved, color: '#3b82f6' },
    { name: 'Rejected', value: counts.rejected, color: '#ef4444' },
  ].filter(item => item.value > 0);

  // Prepare account type distribution
  const accountTypeData = prepareAccountTypeData(allCustomers);

  // Prepare face match score distribution
  const faceMatchData = prepareFaceMatchData(allCustomers);

  // Prepare branch performance
  const branchData = prepareBranchData(allCustomers);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Onboarding Dashboard</h1>
        <p className="text-gray-500 mt-1">Comprehensive analytics and overview of all customer onboarding applications</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <span className="text-gray-500 text-sm">Total</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{counts.total}</p>
        </div>

        <Link href="/pending" className="bg-amber-50 rounded-xl border border-amber-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <span className="text-amber-600 text-sm">Pending Review</span>
          </div>
          <p className="text-3xl font-bold text-amber-900">{pendingCount}</p>
        </Link>

        <Link href="/auto-approved" className="bg-emerald-50 rounded-xl border border-emerald-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-emerald-600 text-sm">Auto Approved</span>
          </div>
          <p className="text-3xl font-bold text-emerald-900">{counts.auto_approved}</p>
        </Link>

        <Link href="/approved" className="bg-blue-50 rounded-xl border border-blue-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-blue-600 text-sm">Manually Approved</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">{counts.approved}</p>
        </Link>

        <Link href="/rejected" className="bg-red-50 rounded-xl border border-red-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-red-600 text-sm">Rejected</span>
          </div>
          <p className="text-3xl font-bold text-red-900">{counts.rejected}</p>
        </Link>
      </div>

      {/* Charts Row 1: Daily Trend & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Applications Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Applications Trend</h3>
              <p className="text-sm text-gray-500">Last 7 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="applications"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorApplications)"
                strokeWidth={2}
                animationDuration={1500}
                animationEasing="ease-out"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <PieChart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Status Distribution</h3>
              <p className="text-sm text-gray-500">Current breakdown</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RPieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={1200}
                animationEasing="ease-out"
                isAnimationActive={true}
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RPieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Account Types & Face Match Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Type Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Account Types</h3>
              <p className="text-sm text-gray-500">Distribution by type</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={accountTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="type" stroke="#6b7280" fontSize={12} angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Bar
                dataKey="count"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
                animationEasing="ease-out"
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Face Match Score Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Face Match Scores</h3>
              <p className="text-sm text-gray-500">Distribution ranges</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={faceMatchData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Bar
                dataKey="count"
                fill="#f59e0b"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
                animationEasing="ease-out"
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3: Branch Performance */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Branch Performance</h3>
            <p className="text-sm text-gray-500">Applications by branch</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={branchData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" stroke="#6b7280" fontSize={12} />
            <YAxis dataKey="branch" type="category" stroke="#6b7280" fontSize={12} width={150} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend />
            <Bar
              dataKey="approved"
              stackId="a"
              fill="#10b981"
              radius={[0, 4, 4, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
              isAnimationActive={true}
            />
            <Bar
              dataKey="pending"
              stackId="a"
              fill="#f59e0b"
              radius={[0, 4, 4, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
              isAnimationActive={true}
            />
            <Bar
              dataKey="rejected"
              stackId="a"
              fill="#ef4444"
              radius={[0, 4, 4, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
              isAnimationActive={true}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Applications Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
          <Link href="/pending" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Customer</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Account Type</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Face Match</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No applications yet
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-gray-600">{customer.accountType}</td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${
                        customer.faceMatchScore >= 85 ? 'text-green-600' :
                        customer.faceMatchScore >= 70 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {customer.faceMatchScore}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(customer.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                        {getStatusLabel(customer.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper functions to prepare chart data
function prepareDailyApplicationsData(customers: Customer[]) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  return last7Days.map(date => {
    const count = customers.filter(c =>
      new Date(c.createdAt).toISOString().split('T')[0] === date
    ).length;

    return {
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      applications: count
    };
  });
}

function prepareAccountTypeData(customers: Customer[]) {
  const typeCounts: Record<string, number> = {};

  customers.forEach(c => {
    const type = c.accountTypeName || c.accountType || 'Unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  return Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 account types
}

function prepareFaceMatchData(customers: Customer[]) {
  const ranges = [
    { range: '0-50%', min: 0, max: 50 },
    { range: '51-70%', min: 51, max: 70 },
    { range: '71-85%', min: 71, max: 85 },
    { range: '86-100%', min: 86, max: 100 },
  ];

  return ranges.map(({ range, min, max }) => ({
    range,
    count: customers.filter(c => c.faceMatchScore >= min && c.faceMatchScore <= max).length
  }));
}

function prepareBranchData(customers: Customer[]) {
  const branchStats: Record<string, { approved: number; pending: number; rejected: number }> = {};

  customers.forEach(c => {
    const branch = c.branch || 'Unknown';
    if (!branchStats[branch]) {
      branchStats[branch] = { approved: 0, pending: 0, rejected: 0 };
    }

    if (c.status === 'approved' || c.status === 'auto_approved') {
      branchStats[branch].approved++;
    } else if (c.status === 'pending' || c.status === 'verified') {
      branchStats[branch].pending++;
    } else if (c.status === 'rejected') {
      branchStats[branch].rejected++;
    }
  });

  return Object.entries(branchStats)
    .map(([branch, stats]) => ({ branch, ...stats }))
    .sort((a, b) => (b.approved + b.pending + b.rejected) - (a.approved + a.pending + a.rejected))
    .slice(0, 10); // Top 10 branches
}
