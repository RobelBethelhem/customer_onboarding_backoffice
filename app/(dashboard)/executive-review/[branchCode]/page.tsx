'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, Building2, Landmark,
  Activity, CreditCard, Globe, Calendar, Download, Printer, BarChart3,
  PieChart, AlertCircle, CheckCircle, XCircle, Clock
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart as RPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart
} from 'recharts';

// Realistic sample data for Zemen Bank branches (2024/25)
const BRANCH_DATA: Record<string, any> = {
  '103': {
    branchCode: '103',
    branchName: 'Kazanchis Branch',
    depositVolume: 8750000000, // 8.75B ETB
    withdrawalVolume: 7230000000, // 7.23B ETB
    depositCount: 4567,
    withdrawalCount: 3892,
    accountOpenings: 87,
    dormantCount: 23,
    dormantBalance: 45600000, // 45.6M ETB
    loansRequested: 34,
    requestedAmount: 650000000, // 650M ETB
    loansApproved: 28,
    approvedAmount: 520000000, // 520M ETB
    loansDisbursed: 24,
    disbursedAmount: 480000000, // 480M ETB
    ibTransactions: 1876,
    voat: 1250000000, // 1.25B ETB
    noat: 892,
    currencies: {
      usd: { deposit: 245000000, withdrawal: 198000000 },
      eur: { deposit: 87000000, withdrawal: 67000000 },
      gbp: { deposit: 45000000, withdrawal: 34000000 },
      sar: { deposit: 98000000, withdrawal: 76000000 },
      aed: { deposit: 76000000, withdrawal: 54000000 },
      kwd: { deposit: 34000000, withdrawal: 28000000 },
      cny: { deposit: 56000000, withdrawal: 42000000 },
    }
  },
  '164': {
    branchCode: '164',
    branchName: 'Head Quarter Branch',
    depositVolume: 15600000000, // 15.6B ETB
    withdrawalVolume: 13200000000, // 13.2B ETB
    depositCount: 8934,
    withdrawalCount: 7456,
    accountOpenings: 156,
    dormantCount: 42,
    dormantBalance: 89000000, // 89M ETB
    loansRequested: 67,
    requestedAmount: 1240000000, // 1.24B ETB
    loansApproved: 54,
    approvedAmount: 1050000000, // 1.05B ETB
    loansDisbursed: 48,
    disbursedAmount: 920000000, // 920M ETB
    ibTransactions: 3456,
    voat: 2340000000, // 2.34B ETB
    noat: 1567,
    currencies: {
      usd: { deposit: 456000000, withdrawal: 378000000 },
      eur: { deposit: 167000000, withdrawal: 134000000 },
      gbp: { deposit: 89000000, withdrawal: 67000000 },
      sar: { deposit: 178000000, withdrawal: 145000000 },
      aed: { deposit: 134000000, withdrawal: 98000000 },
      kwd: { deposit: 67000000, withdrawal: 54000000 },
      cny: { deposit: 98000000, withdrawal: 76000000 },
    }
  },
  '109': {
    branchCode: '109',
    branchName: 'Bole Medhaniyalem Branch',
    depositVolume: 11200000000, // 11.2B ETB
    withdrawalVolume: 9800000000, // 9.8B ETB
    depositCount: 6234,
    withdrawalCount: 5123,
    accountOpenings: 123,
    dormantCount: 34,
    dormantBalance: 67000000, // 67M ETB
    loansRequested: 45,
    requestedAmount: 890000000, // 890M ETB
    loansApproved: 38,
    approvedAmount: 760000000, // 760M ETB
    loansDisbursed: 32,
    disbursedAmount: 680000000, // 680M ETB
    ibTransactions: 2567,
    voat: 1780000000, // 1.78B ETB
    noat: 1234,
    currencies: {
      usd: { deposit: 334000000, withdrawal: 276000000 },
      eur: { deposit: 123000000, withdrawal: 98000000 },
      gbp: { deposit: 67000000, withdrawal: 54000000 },
      sar: { deposit: 134000000, withdrawal: 109000000 },
      aed: { deposit: 109000000, withdrawal: 87000000 },
      kwd: { deposit: 54000000, withdrawal: 43000000 },
      cny: { deposit: 76000000, withdrawal: 61000000 },
    }
  }
};

// Generate daily data for last 30 days
function generateDailyData(branch: any) {
  const data = [];
  const dailyDeposit = branch.depositVolume / 30;
  const dailyWithdrawal = branch.withdrawalVolume / 30;

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const variance = 0.7 + Math.random() * 0.6; // ±30% variance

    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      deposits: dailyDeposit * variance,
      withdrawals: dailyWithdrawal * variance,
      netFlow: (dailyDeposit - dailyWithdrawal) * variance,
    });
  }

  return data;
}

// Channel distribution data
function getChannelData(branch: any) {
  return [
    { channel: 'Branch Counter', transactions: Math.floor(branch.depositCount * 0.35), percentage: 35 },
    { channel: 'ATM', transactions: Math.floor(branch.depositCount * 0.25), percentage: 25 },
    { channel: 'Internet Banking', transactions: branch.ibTransactions, percentage: 20 },
    { channel: 'Mobile Banking', transactions: Math.floor(branch.depositCount * 0.15), percentage: 15 },
    { channel: 'POS', transactions: Math.floor(branch.depositCount * 0.05), percentage: 5 },
  ];
}

export default function BranchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const branchCode = params.branchCode as string;
  const branch = BRANCH_DATA[branchCode];

  if (!branch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h2>
          <p className="text-gray-600 mb-6">The branch code "{branchCode}" does not exist.</p>
          <button
            onClick={() => router.push('/executive-review')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
          >
            Back to Overview
          </button>
        </div>
      </div>
    );
  }

  const dailyData = generateDailyData(branch);
  const channelData = getChannelData(branch);

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B ETB`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M ETB`;
    return `${value.toLocaleString()} ETB`;
  };

  const formatNumber = (value: number) => value.toLocaleString();

  const currencyData = Object.entries(branch.currencies).map(([code, values]: [string, any], index) => ({
    currency: code.toUpperCase(),
    deposit: values.deposit,
    withdrawal: values.withdrawal,
    netFlow: values.deposit - values.withdrawal,
  }));

  const loanMetrics = [
    { metric: 'Approval Rate', value: ((branch.loansApproved / branch.loansRequested) * 100).toFixed(1), max: 100 },
    { metric: 'Disbursement Rate', value: ((branch.loansDisbursed / branch.loansApproved) * 100).toFixed(1), max: 100 },
    { metric: 'Request Volume', value: ((branch.loansRequested / 100) * 100).toFixed(1), max: 100 },
    { metric: 'Processing Efficiency', value: '85.0', max: 100 },
  ];

  const netFlow = branch.depositVolume - branch.withdrawalVolume;
  const flowPercentage = ((netFlow / branch.depositVolume) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/executive-review')}
            className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {branch.branchName}
            </h1>
            <p className="text-gray-600 mt-1">Branch Code: {branch.branchCode} • Detailed Performance Report</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all">
            <Download className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-700">Export</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all">
            <Printer className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-700">Print</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            <TrendingUp className="w-6 h-6 text-green-200" />
          </div>
          <p className="text-blue-100 text-sm font-medium mb-1">Total Deposits</p>
          <p className="text-3xl font-bold mb-1">{formatCurrency(branch.depositVolume)}</p>
          <p className="text-sm text-blue-200">{formatNumber(branch.depositCount)} transactions</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <TrendingDown className="w-6 h-6" />
            </div>
            <TrendingDown className="w-6 h-6 text-orange-200" />
          </div>
          <p className="text-purple-100 text-sm font-medium mb-1">Total Withdrawals</p>
          <p className="text-3xl font-bold mb-1">{formatCurrency(branch.withdrawalVolume)}</p>
          <p className="text-sm text-purple-200">{formatNumber(branch.withdrawalCount)} transactions</p>
        </div>

        <div className={`bg-gradient-to-br ${netFlow > 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} rounded-2xl shadow-xl p-6 text-white`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Activity className="w-6 h-6" />
            </div>
            {netFlow > 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
          </div>
          <p className={`${netFlow > 0 ? 'text-emerald-100' : 'text-red-100'} text-sm font-medium mb-1`}>Net Cash Flow</p>
          <p className="text-3xl font-bold mb-1">{formatCurrency(Math.abs(netFlow))}</p>
          <p className={`text-sm ${netFlow > 0 ? 'text-emerald-200' : 'text-red-200'}`}>{flowPercentage}% of deposits</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Users className="w-6 h-6" />
            </div>
            <TrendingUp className="w-6 h-6 text-green-200" />
          </div>
          <p className="text-orange-100 text-sm font-medium mb-1">New Accounts</p>
          <p className="text-3xl font-bold mb-1">{formatNumber(branch.accountOpenings)}</p>
          <p className="text-sm text-orange-200">This period</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Activity className="w-6 h-6" />
            </div>
            <TrendingUp className="w-6 h-6 text-green-200" />
          </div>
          <p className="text-indigo-100 text-sm font-medium mb-1">Digital Transactions</p>
          <p className="text-3xl font-bold mb-1">{formatNumber(branch.ibTransactions + Math.floor(branch.depositCount * 0.15) + Math.floor(branch.depositCount * 0.05))}</p>
          <p className="text-sm text-indigo-200">IB + Mobile + POS</p>
        </div>
      </div>

      {/* Charts Row 1: Daily Trend & Currency Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Transaction Trend */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Daily Transaction Flow</h3>
              <p className="text-sm text-gray-500">Last 30 days performance</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={dailyData}>
              <defs>
                <linearGradient id="colorDeposit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWithdrawal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="deposits"
                name="Deposits"
                stroke="#10b981"
                fill="url(#colorDeposit)"
                strokeWidth={2}
                animationDuration={1500}
                isAnimationActive={true}
              />
              <Area
                type="monotone"
                dataKey="withdrawals"
                name="Withdrawals"
                stroke="#ef4444"
                fill="url(#colorWithdrawal)"
                strokeWidth={2}
                animationDuration={1500}
                isAnimationActive={true}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Currency Distribution */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Foreign Currency Performance</h3>
              <p className="text-sm text-gray-500">Deposit vs Withdrawal by currency</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={currencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="currency" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Bar
                dataKey="deposit"
                name="Deposits"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
              <Bar
                dataKey="withdrawal"
                name="Withdrawals"
                fill="#ef4444"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Channel Distribution & Loan Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Distribution */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
              <PieChart className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Transaction Channels</h3>
              <p className="text-sm text-gray-500">Distribution by service channel</p>
            </div>
          </div>
          <div className="space-y-4">
            {channelData.map((channel, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{channel.channel}</span>
                  <span className="text-sm font-bold text-gray-900">{formatNumber(channel.transactions)} ({channel.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000"
                    style={{ width: `${channel.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loan Performance Radar */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Loan Performance Metrics</h3>
              <p className="text-sm text-gray-500">Multi-dimensional analysis</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={loanMetrics}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" stroke="#6b7280" fontSize={12} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#6b7280" fontSize={12} />
              <Radar
                name="Performance"
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                animationDuration={1500}
                isAnimationActive={true}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3: Loan Funnel & VOAT Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loan Funnel Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center">
              <Landmark className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Loan Processing Funnel</h3>
              <p className="text-sm text-gray-500">Request to Disbursement flow</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={[
                { stage: 'Requested', count: branch.loansRequested, amount: branch.requestedAmount, color: '#94a3b8' },
                { stage: 'Approved', count: branch.loansApproved, amount: branch.approvedAmount, color: '#10b981' },
                { stage: 'Disbursed', count: branch.loansDisbursed, amount: branch.disbursedAmount, color: '#3b82f6' }
              ]}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis dataKey="stage" type="category" stroke="#6b7280" fontSize={14} width={100} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number, name: string) => {
                  if (name === 'amount') return [formatCurrency(value), 'Amount'];
                  return [value, 'Count'];
                }}
              />
              <Legend />
              <Bar
                dataKey="count"
                name="Loan Count"
                radius={[0, 8, 8, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              >
                {[
                  { stage: 'Requested', count: branch.loansRequested, amount: branch.requestedAmount },
                  { stage: 'Approved', count: branch.loansApproved, amount: branch.approvedAmount },
                  { stage: 'Disbursed', count: branch.loansDisbursed, amount: branch.disbursedAmount }
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#94a3b8', '#10b981', '#3b82f6'][index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* VOAT vs NOAT Trend */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-100 to-rose-200 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Transaction Analytics</h3>
              <p className="text-sm text-gray-500">Volume vs Value comparison</p>
            </div>
          </div>
          <div className="space-y-6">
            {/* VOAT - Value of All Transactions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">Value of All Transactions (VOAT)</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(branch.voat)}</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>

            {/* NOAT - Number of All Transactions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">Number of All Transactions (NOAT)</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{formatNumber(branch.noat)}</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                  style={{ width: `${(branch.noat / 2000) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Average Transaction Value */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600">Average Transaction Value</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(branch.voat / branch.noat)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 4: Account Health & Currency Net Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Activity Health */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-teal-200 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Account Health Dashboard</h3>
              <p className="text-sm text-gray-500">Active vs Dormant analysis</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <RPieChart>
              <Pie
                data={[
                  { name: 'Active Accounts', value: branch.accountOpenings - branch.dormantCount, color: '#10b981' },
                  { name: 'Dormant Accounts', value: branch.dormantCount, color: '#f59e0b' }
                ]}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
                isAnimationActive={true}
              >
                <Cell fill="#10b981" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip formatter={(value: number) => formatNumber(value)} />
            </RPieChart>
          </ResponsiveContainer>
        </div>

        {/* Currency Net Flow */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Currency Net Flow</h3>
              <p className="text-sm text-gray-500">Inflow vs Outflow by currency</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={currencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="currency" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Bar
                dataKey="netFlow"
                name="Net Flow"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              >
                {currencyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.netFlow > 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 5: Loan Amount Comparison & Transaction Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loan Amount Distribution */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-violet-200 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Loan Amount Analysis</h3>
              <p className="text-sm text-gray-500">Requested vs Approved vs Disbursed</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={[
                {
                  stage: 'Loan Amounts',
                  requested: branch.requestedAmount / 1000000,
                  approved: branch.approvedAmount / 1000000,
                  disbursed: branch.disbursedAmount / 1000000
                }
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="stage" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} label={{ value: 'Amount (M ETB)', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => `${value.toFixed(2)}M ETB`}
              />
              <Legend />
              <Bar
                dataKey="requested"
                name="Requested"
                fill="#94a3b8"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
              <Bar
                dataKey="approved"
                name="Approved"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
              <Bar
                dataKey="disbursed"
                name="Disbursed"
                fill="#3b82f6"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Volume Breakdown */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-100 to-fuchsia-200 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-fuchsia-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Transaction Volume Breakdown</h3>
              <p className="text-sm text-gray-500">Deposits vs Withdrawals count</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={[
                { type: 'Deposits', count: branch.depositCount, amount: branch.depositVolume / 1000000000 },
                { type: 'Withdrawals', count: branch.withdrawalCount, amount: branch.withdrawalVolume / 1000000000 }
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="type" stroke="#6b7280" fontSize={12} />
              <YAxis
                yAxisId="left"
                stroke="#6b7280"
                fontSize={12}
                label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#6b7280"
                fontSize={12}
                label={{ value: 'Amount (B ETB)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number, name: string) => {
                  if (name === 'amount') return [`${value.toFixed(2)}B ETB`, 'Amount'];
                  return [formatNumber(value), 'Count'];
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="count"
                name="Transaction Count"
                fill="#8b5cf6"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
              <Bar
                yAxisId="right"
                dataKey="amount"
                name="Amount (B ETB)"
                fill="#06b6d4"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Landmark className="w-5 h-5 text-blue-600" />
            </div>
            <h4 className="font-bold text-gray-900">Loan Portfolio</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Requested</span>
              <span className="font-bold text-gray-900">{branch.loansRequested}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Approved</span>
              <span className="font-bold text-green-600">{branch.loansApproved}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Disbursed</span>
              <span className="font-bold text-blue-600">{branch.loansDisbursed}</span>
            </div>
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Amount</span>
                <span className="font-bold text-indigo-600">{formatCurrency(branch.disbursedAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <h4 className="font-bold text-gray-900">Digital Banking</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">IB Transactions</span>
              <span className="font-bold text-gray-900">{formatNumber(branch.ibTransactions)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">VOAT</span>
              <span className="font-bold text-blue-600">{formatCurrency(branch.voat)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">NOAT</span>
              <span className="font-bold text-purple-600">{formatNumber(branch.noat)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <h4 className="font-bold text-gray-900">Dormant Accounts</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Count</span>
              <span className="font-bold text-orange-600">{formatNumber(branch.dormantCount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Balance</span>
              <span className="font-bold text-gray-900">{formatCurrency(branch.dormantBalance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg per Account</span>
              <span className="font-bold text-blue-600">{formatCurrency(branch.dormantBalance / branch.dormantCount)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <h4 className="font-bold text-gray-900">Performance Ratio</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Approval Rate</span>
              <span className="font-bold text-green-600">{((branch.loansApproved / branch.loansRequested) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Disbursement Rate</span>
              <span className="font-bold text-blue-600">{((branch.loansDisbursed / branch.loansApproved) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Deposit Growth</span>
              <span className="font-bold text-green-600">+12.3%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
