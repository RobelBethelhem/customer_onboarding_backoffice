'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Building2, Landmark,
  ArrowUpRight, ArrowDownRight, Calendar, Eye, BarChart3, PieChart,
  Activity, CreditCard, BanknoteIcon, Globe, Loader2, Maximize, ExternalLink, X
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart as RPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

// Realistic sample data for Zemen Bank branches (2024/25)
const SAMPLE_BRANCHES = [
  {
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
  {
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
  {
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
];

// Generate monthly trend data
function generateMonthlyTrend(months: number) {
  const data = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    data.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      kazanchis: SAMPLE_BRANCHES[0].depositVolume * (0.8 + Math.random() * 0.4) / 12,
      headQuarter: SAMPLE_BRANCHES[1].depositVolume * (0.8 + Math.random() * 0.4) / 12,
      bole: SAMPLE_BRANCHES[2].depositVolume * (0.8 + Math.random() * 0.4) / 12,
    });
  }

  return data;
}

export default function ExecutiveReviewPage() {
  const router = useRouter();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '180d' | '1y' | 'custom'>('30d');
  const [loading, setLoading] = useState(false);
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const monthsMap = { '7d': 1, '30d': 3, '90d': 6, '180d': 6, '1y': 12, 'custom': 12 };
  const trendData = generateMonthlyTrend(monthsMap[dateRange] || 12);

  // Aggregate totals
  const totals = SAMPLE_BRANCHES.reduce((acc, branch) => ({
    depositVolume: acc.depositVolume + branch.depositVolume,
    withdrawalVolume: acc.withdrawalVolume + branch.withdrawalVolume,
    accountOpenings: acc.accountOpenings + branch.accountOpenings,
    loansApproved: acc.loansApproved + branch.loansApproved,
    approvedAmount: acc.approvedAmount + branch.approvedAmount,
    ibTransactions: acc.ibTransactions + branch.ibTransactions,
  }), { depositVolume: 0, withdrawalVolume: 0, accountOpenings: 0, loansApproved: 0, approvedAmount: 0, ibTransactions: 0 });

  // Currency breakdown
  const currencyData = [
    { name: 'USD', value: SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.usd.deposit, 0), color: '#10b981' },
    { name: 'EUR', value: SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.eur.deposit, 0), color: '#3b82f6' },
    { name: 'GBP', value: SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.gbp.deposit, 0), color: '#f59e0b' },
    { name: 'SAR', value: SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.sar.deposit, 0), color: '#8b5cf6' },
    { name: 'AED', value: SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.aed.deposit, 0), color: '#ec4899' },
    { name: 'KWD', value: SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.kwd.deposit, 0), color: '#06b6d4' },
    { name: 'CNY', value: SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.cny.deposit, 0), color: '#ef4444' },
  ];

  // Branch comparison data
  const branchComparison = SAMPLE_BRANCHES.map(b => ({
    branch: b.branchName.replace(' Branch', ''),
    deposits: b.depositVolume / 1000000000,
    withdrawals: b.withdrawalVolume / 1000000000,
    netFlow: (b.depositVolume - b.withdrawalVolume) / 1000000000,
  }));

  // Loan performance
  const loanData = SAMPLE_BRANCHES.map(b => ({
    branch: b.branchName.replace(' Branch', ''),
    requested: b.loansRequested,
    approved: b.loansApproved,
    disbursed: b.loansDisbursed,
    approvalRate: ((b.loansApproved / b.loansRequested) * 100).toFixed(1),
  }));

  // Digital Transactions performance
  const digitalData = SAMPLE_BRANCHES.map(b => ({
    branch: b.branchName.replace(' Branch', ''),
    ib: b.ibTransactions,
    mobile: Math.floor(b.depositCount * 0.15),
    pos: Math.floor(b.depositCount * 0.05),
    total: b.ibTransactions + Math.floor(b.depositCount * 0.15) + Math.floor(b.depositCount * 0.05),
  }));

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B ETB`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M ETB`;
    return `${value.toLocaleString()} ETB`;
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString();
  };

  // Handle ESC key to close fullscreen and date picker
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenChart(null);
        setShowCustomDatePicker(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between relative">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
            Executive Branch Performance
          </h1>
          <p className="text-gray-600 mt-2">Real-time insights and analytics for strategic decision making</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-200 p-1">
            {(['7d', '30d', '90d', '180d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  dateRange === range
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {range === '7d' ? '7 Days' :
                 range === '30d' ? '30 Days' :
                 range === '90d' ? '90 Days' :
                 range === '180d' ? '180 Days' :
                 '1 Year'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
            className={`p-3 rounded-xl shadow-sm border transition-all ${
              dateRange === 'custom'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white border-gray-200 hover:shadow-md'
            }`}
          >
            <Calendar className={`w-5 h-5 ${dateRange === 'custom' ? 'text-white' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Custom Date Range Picker */}
        {showCustomDatePicker && (
          <div className="absolute right-6 top-24 bg-white rounded-xl shadow-2xl border border-gray-200 p-6 z-50 w-96">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Custom Date Range</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setDateRange('custom');
                    setShowCustomDatePicker(false);
                  }}
                  className="flex-1 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                >
                  Apply
                </button>
                <button
                  onClick={() => setShowCustomDatePicker(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1 text-red-200 text-sm font-medium">
                <ArrowUpRight className="w-4 h-4" />
                <span>+12.5%</span>
              </div>
            </div>
            <p className="text-blue-100 text-sm font-medium mb-1">Total Deposits</p>
            <p className="text-3xl font-bold">{formatCurrency(totals.depositVolume)}</p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1 text-red-200 text-sm font-medium">
                <ArrowUpRight className="w-4 h-4" />
                <span>+8.3%</span>
              </div>
            </div>
            <p className="text-purple-100 text-sm font-medium mb-1">New Accounts</p>
            <p className="text-3xl font-bold">{formatNumber(totals.accountOpenings)}</p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Landmark className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1 text-red-200 text-sm font-medium">
                <ArrowUpRight className="w-4 h-4" />
                <span>+15.7%</span>
              </div>
            </div>
            <p className="text-emerald-100 text-sm font-medium mb-1">Loans Approved</p>
            <p className="text-3xl font-bold">{formatNumber(totals.loansApproved)}</p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Activity className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1 text-red-200 text-sm font-medium">
                <ArrowUpRight className="w-4 h-4" />
                <span>+23.1%</span>
              </div>
            </div>
            <p className="text-orange-100 text-sm font-medium mb-1">IB Transactions</p>
            <p className="text-3xl font-bold">{formatNumber(totals.ibTransactions)}</p>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Transaction Trend & Branch Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Volume Trend */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Transaction Volume Trend</h3>
                <p className="text-sm text-gray-500">Monthly deposit comparison</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/executive-review/detail/transactions')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="View Details"
              >
                <ExternalLink className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setFullscreenChart('transactions')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorKazanchis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorHeadQuarter" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBole" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `${(value / 1000000000).toFixed(1)}B`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="kazanchis"
                name="Kazanchis"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorKazanchis)"
                strokeWidth={3}
                animationDuration={1500}
                isAnimationActive={true}
              />
              <Area
                type="monotone"
                dataKey="headQuarter"
                name="Head Quarter"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorHeadQuarter)"
                strokeWidth={3}
                animationDuration={1500}
                isAnimationActive={true}
              />
              <Area
                type="monotone"
                dataKey="bole"
                name="Bole"
                stroke="#f59e0b"
                fillOpacity={1}
                fill="url(#colorBole)"
                strokeWidth={3}
                animationDuration={1500}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Branch Comparison */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Branch Comparison</h3>
                <p className="text-sm text-gray-500">Deposits vs Withdrawals</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/executive-review/detail/branches')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="View Details"
              >
                <ExternalLink className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setFullscreenChart('branches')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={branchComparison} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} tickFormatter={(value) => `${value.toFixed(1)}B`} />
              <YAxis dataKey="branch" type="category" stroke="#6b7280" fontSize={14} width={120} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => `${value.toFixed(2)}B ETB`}
              />
              <Legend />
              <Bar
                dataKey="deposits"
                fill="#10b981"
                radius={[0, 8, 8, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
              <Bar
                dataKey="withdrawals"
                fill="#ef4444"
                radius={[0, 8, 8, 0]}
                animationDuration={1200}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Currency Breakdown & Digital Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Foreign Currency Breakdown */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Foreign Currency Deposits</h3>
                <p className="text-sm text-gray-500">Distribution by currency</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/executive-review/detail/currency')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="View Details"
              >
                <ExternalLink className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setFullscreenChart('currency')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <RPieChart>
              <Pie
                data={currencyData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
                isAnimationActive={true}
              >
                {currencyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </RPieChart>
          </ResponsiveContainer>
        </div>

        {/* Digital Transactions Performance */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Digital Transactions</h3>
                <p className="text-sm text-gray-500">IB, Mobile & POS by branch</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/executive-review/detail/digital')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="View Details"
              >
                <ExternalLink className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setFullscreenChart('digital')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={digitalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="branch" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
              />
              <Legend />
              <Bar
                dataKey="ib"
                name="Internet Banking"
                fill="#3b82f6"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
                isAnimationActive={true}
              />
              <Bar
                dataKey="mobile"
                name="Mobile Banking"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
                isAnimationActive={true}
              />
              <Bar
                dataKey="pos"
                name="POS"
                fill="#f59e0b"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3: Loan Performance */}
      <div className="grid grid-cols-1 gap-6">
        {/* Loan Performance - Full Width Column Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Loan Performance by Branch</h3>
                <p className="text-sm text-gray-500">Request, Approval and Disbursement analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/executive-review/detail/loans')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="View Details"
              >
                <ExternalLink className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setFullscreenChart('loans')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={loanData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="branch" stroke="#6b7280" fontSize={14} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
              />
              <Legend />
              <Bar
                dataKey="requested"
                name="Requested"
                fill="#94a3b8"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
                isAnimationActive={true}
              />
              <Bar
                dataKey="approved"
                name="Approved"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
                isAnimationActive={true}
              />
              <Bar
                dataKey="disbursed"
                name="Disbursed"
                fill="#3b82f6"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Branch Details Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {SAMPLE_BRANCHES.map((branch) => (
          <div
            key={branch.branchCode}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            onClick={() => router.push(`/executive-review/${branch.branchCode}`)}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{branch.branchName}</h3>
                <p className="text-sm text-gray-500">Branch Code: {branch.branchCode}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Total Deposits</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(branch.depositVolume)}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Total Withdrawals</span>
                </div>
                <span className="text-lg font-bold text-purple-600">{formatCurrency(branch.withdrawalVolume)}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-gray-700">New Accounts</span>
                </div>
                <span className="text-lg font-bold text-amber-600">{branch.accountOpenings}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-gray-700">Loans Disbursed</span>
                </div>
                <span className="text-lg font-bold text-emerald-600">{branch.loansDisbursed}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-700">Digital Transactions</span>
                </div>
                <span className="text-lg font-bold text-indigo-600">
                  {(branch.ibTransactions + Math.floor(branch.depositCount * 0.15) + Math.floor(branch.depositCount * 0.05)).toLocaleString()}
                </span>
              </div>
            </div>

            <button className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-medium hover:shadow-lg transition-all">
              <Eye className="w-5 h-5" />
              View Detailed Report
            </button>
          </div>
        ))}
      </div>

      {/* Fullscreen Modal */}
      {fullscreenChart && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full h-full bg-white rounded-2xl shadow-2xl flex flex-col">
            {/* Fullscreen Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {fullscreenChart === 'transactions' && 'Transaction Volume Trend'}
                  {fullscreenChart === 'branches' && 'Branch Comparison'}
                  {fullscreenChart === 'currency' && 'Foreign Currency Deposits'}
                  {fullscreenChart === 'digital' && 'Digital Transactions'}
                  {fullscreenChart === 'loans' && 'Loan Performance by Branch'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {fullscreenChart === 'transactions' && 'Monthly deposit comparison across all branches'}
                  {fullscreenChart === 'branches' && 'Deposits vs Withdrawals analysis'}
                  {fullscreenChart === 'currency' && 'Distribution by currency'}
                  {fullscreenChart === 'digital' && 'IB, Mobile & POS by branch'}
                  {fullscreenChart === 'loans' && 'Request, Approval and Disbursement analysis'}
                </p>
              </div>
              <button
                onClick={() => setFullscreenChart(null)}
                className="p-3 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-8 h-8 text-gray-600" />
              </button>
            </div>

            {/* Fullscreen Chart Content */}
            <div className="flex-1 p-6 overflow-auto">
              {fullscreenChart === 'transactions' && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorKazanchis" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorHeadQuarter" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorBole" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#6b7280" fontSize={14} />
                    <YAxis stroke="#6b7280" fontSize={14} tickFormatter={(value) => `${(value / 1000000000).toFixed(1)}B`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: '16px' }} />
                    <Area
                      type="monotone"
                      dataKey="kazanchis"
                      name="Kazanchis"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorKazanchis)"
                      strokeWidth={3}
                      animationDuration={1500}
                      isAnimationActive={true}
                    />
                    <Area
                      type="monotone"
                      dataKey="headQuarter"
                      name="Head Quarter"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorHeadQuarter)"
                      strokeWidth={3}
                      animationDuration={1500}
                      isAnimationActive={true}
                    />
                    <Area
                      type="monotone"
                      dataKey="bole"
                      name="Bole"
                      stroke="#f59e0b"
                      fillOpacity={1}
                      fill="url(#colorBole)"
                      strokeWidth={3}
                      animationDuration={1500}
                      isAnimationActive={true}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {fullscreenChart === 'branches' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchComparison} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" stroke="#6b7280" fontSize={14} tickFormatter={(value) => `${value.toFixed(1)}B`} />
                    <YAxis dataKey="branch" type="category" stroke="#6b7280" fontSize={16} width={150} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                      formatter={(value: number) => `${value.toFixed(2)}B ETB`}
                    />
                    <Legend wrapperStyle={{ fontSize: '16px' }} />
                    <Bar
                      dataKey="deposits"
                      fill="#10b981"
                      radius={[0, 8, 8, 0]}
                      animationDuration={1200}
                      isAnimationActive={true}
                    />
                    <Bar
                      dataKey="withdrawals"
                      fill="#ef4444"
                      radius={[0, 8, 8, 0]}
                      animationDuration={1200}
                      isAnimationActive={true}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {fullscreenChart === 'currency' && (
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie
                      data={currencyData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                      outerRadius={200}
                      fill="#8884d8"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1500}
                      isAnimationActive={true}
                    >
                      {currencyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend wrapperStyle={{ fontSize: '16px' }} />
                  </RPieChart>
                </ResponsiveContainer>
              )}

              {fullscreenChart === 'digital' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={digitalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="branch" stroke="#6b7280" fontSize={14} />
                    <YAxis stroke="#6b7280" fontSize={14} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '16px' }} />
                    <Bar
                      dataKey="ib"
                      name="Internet Banking"
                      fill="#3b82f6"
                      radius={[8, 8, 0, 0]}
                      animationDuration={1000}
                      isAnimationActive={true}
                    />
                    <Bar
                      dataKey="mobile"
                      name="Mobile Banking"
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                      animationDuration={1000}
                      isAnimationActive={true}
                    />
                    <Bar
                      dataKey="pos"
                      name="POS"
                      fill="#f59e0b"
                      radius={[8, 8, 0, 0]}
                      animationDuration={1000}
                      isAnimationActive={true}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {fullscreenChart === 'loans' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={loanData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="branch" stroke="#6b7280" fontSize={14} />
                    <YAxis stroke="#6b7280" fontSize={14} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '16px' }} />
                    <Bar
                      dataKey="requested"
                      name="Requested"
                      fill="#94a3b8"
                      radius={[8, 8, 0, 0]}
                      animationDuration={1000}
                      isAnimationActive={true}
                    />
                    <Bar
                      dataKey="approved"
                      name="Approved"
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                      animationDuration={1000}
                      isAnimationActive={true}
                    />
                    <Bar
                      dataKey="disbursed"
                      name="Disbursed"
                      fill="#3b82f6"
                      radius={[8, 8, 0, 0]}
                      animationDuration={1000}
                      isAnimationActive={true}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Fullscreen Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-600">Press ESC to exit fullscreen</p>
              <button
                onClick={() => setFullscreenChart(null)}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
