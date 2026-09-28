'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Download, Printer, TrendingUp, TrendingDown, Activity,
  Building2, DollarSign, Users, Landmark, Globe, CreditCard, BarChart3
} from 'lucide-react';

// Same data from main page
const SAMPLE_BRANCHES = [
  {
    branchCode: '103',
    branchName: 'Kazanchis Branch',
    depositVolume: 8750000000,
    withdrawalVolume: 7230000000,
    depositCount: 4567,
    withdrawalCount: 3892,
    accountOpenings: 87,
    dormantCount: 23,
    dormantBalance: 45600000,
    loansRequested: 34,
    requestedAmount: 650000000,
    loansApproved: 28,
    approvedAmount: 520000000,
    loansDisbursed: 24,
    disbursedAmount: 480000000,
    ibTransactions: 1876,
    voat: 1250000000,
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
    depositVolume: 15600000000,
    withdrawalVolume: 13200000000,
    depositCount: 8934,
    withdrawalCount: 7456,
    accountOpenings: 156,
    dormantCount: 42,
    dormantBalance: 89000000,
    loansRequested: 67,
    requestedAmount: 1240000000,
    loansApproved: 54,
    approvedAmount: 1050000000,
    loansDisbursed: 48,
    disbursedAmount: 920000000,
    ibTransactions: 3456,
    voat: 2340000000,
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
    depositVolume: 11200000000,
    withdrawalVolume: 9800000000,
    depositCount: 6234,
    withdrawalCount: 5123,
    accountOpenings: 123,
    dormantCount: 34,
    dormantBalance: 67000000,
    loansRequested: 45,
    requestedAmount: 890000000,
    loansApproved: 38,
    approvedAmount: 760000000,
    loansDisbursed: 32,
    disbursedAmount: 680000000,
    ibTransactions: 2567,
    voat: 1780000000,
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

export default function DetailPage() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as string;

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B ETB`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M ETB`;
    return `${value.toLocaleString()} ETB`;
  };

  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const getTitle = () => {
    switch (type) {
      case 'loans': return 'Loan Performance Details';
      case 'digital': return 'Digital Transactions Details';
      case 'currency': return 'Foreign Currency Details';
      case 'transactions': return 'Transaction Volume Details';
      case 'branches': return 'Branch Comparison Details';
      default: return 'Performance Details';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'loans': return <CreditCard className="w-6 h-6" />;
      case 'digital': return <Activity className="w-6 h-6" />;
      case 'currency': return <Globe className="w-6 h-6" />;
      case 'transactions': return <BarChart3 className="w-6 h-6" />;
      case 'branches': return <Building2 className="w-6 h-6" />;
      default: return <BarChart3 className="w-6 h-6" />;
    }
  };

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
              {getTitle()}
            </h1>
            <p className="text-gray-600 mt-1">Comprehensive analysis across all branches</p>
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

      {/* Loan Performance Table */}
      {type === 'loans' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center text-white">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Loan Portfolio Analysis</h2>
                <p className="text-gray-600 mt-1">Request, Approval, and Disbursement metrics by branch</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Branch</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Requested</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Requested Amount</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Approved</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Approved Amount</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Approval Rate</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Disbursed</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Disbursed Amount</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Disbursement Rate</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_BRANCHES.map((branch, index) => (
                  <tr key={branch.branchCode} className={`border-t border-gray-100 hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-gray-900">{branch.branchName}</p>
                        <p className="text-sm text-gray-500">Code: {branch.branchCode}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">{branch.loansRequested}</td>
                    <td className="px-6 py-4 text-right font-semibold text-blue-600">{formatCurrency(branch.requestedAmount)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">{branch.loansApproved}</td>
                    <td className="px-6 py-4 text-right font-semibold text-green-600">{formatCurrency(branch.approvedAmount)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                        {formatPercentage((branch.loansApproved / branch.loansRequested) * 100)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">{branch.loansDisbursed}</td>
                    <td className="px-6 py-4 text-right font-semibold text-indigo-600">{formatCurrency(branch.disbursedAmount)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                        {formatPercentage((branch.loansDisbursed / branch.loansApproved) * 100)}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-bold border-t-2 border-gray-300">
                  <td className="px-6 py-4 text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    {SAMPLE_BRANCHES.reduce((sum, b) => sum + b.loansRequested, 0)}
                  </td>
                  <td className="px-6 py-4 text-right text-blue-700">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.requestedAmount, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    {SAMPLE_BRANCHES.reduce((sum, b) => sum + b.loansApproved, 0)}
                  </td>
                  <td className="px-6 py-4 text-right text-green-700">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.approvedAmount, 0))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-3 py-1 rounded-full bg-green-200 text-green-800 text-sm">
                      {formatPercentage((SAMPLE_BRANCHES.reduce((sum, b) => sum + b.loansApproved, 0) /
                        SAMPLE_BRANCHES.reduce((sum, b) => sum + b.loansRequested, 0)) * 100)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    {SAMPLE_BRANCHES.reduce((sum, b) => sum + b.loansDisbursed, 0)}
                  </td>
                  <td className="px-6 py-4 text-right text-indigo-700">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.disbursedAmount, 0))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-3 py-1 rounded-full bg-indigo-200 text-indigo-800 text-sm">
                      {formatPercentage((SAMPLE_BRANCHES.reduce((sum, b) => sum + b.loansDisbursed, 0) /
                        SAMPLE_BRANCHES.reduce((sum, b) => sum + b.loansApproved, 0)) * 100)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Digital Transactions Table */}
      {type === 'digital' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Digital Banking Channels</h2>
                <p className="text-gray-600 mt-1">Internet Banking, Mobile Banking, and POS transactions</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Branch</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Internet Banking</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Mobile Banking</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">POS</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Total Digital</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">% of Total Txns</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_BRANCHES.map((branch, index) => {
                  const mobile = Math.floor(branch.depositCount * 0.15);
                  const pos = Math.floor(branch.depositCount * 0.05);
                  const total = branch.ibTransactions + mobile + pos;
                  const totalTxns = branch.depositCount + branch.withdrawalCount;
                  const percentage = (total / totalTxns) * 100;

                  return (
                    <tr key={branch.branchCode} className={`border-t border-gray-100 hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-gray-900">{branch.branchName}</p>
                          <p className="text-sm text-gray-500">Code: {branch.branchCode}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-blue-600">{formatNumber(branch.ibTransactions)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-green-600">{formatNumber(mobile)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-orange-600">{formatNumber(pos)}</td>
                      <td className="px-6 py-4 text-right font-bold text-indigo-700 text-lg">{formatNumber(total)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                          {formatPercentage(percentage)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-bold border-t-2 border-gray-300">
                  <td className="px-6 py-4 text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-right text-blue-700">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.ibTransactions, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-green-700">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) => sum + Math.floor(b.depositCount * 0.15), 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-orange-700">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) => sum + Math.floor(b.depositCount * 0.05), 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-indigo-800 text-lg">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) =>
                      sum + b.ibTransactions + Math.floor(b.depositCount * 0.15) + Math.floor(b.depositCount * 0.05), 0))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-3 py-1 rounded-full bg-indigo-200 text-indigo-800 text-sm">
                      {formatPercentage((SAMPLE_BRANCHES.reduce((sum, b) =>
                        sum + b.ibTransactions + Math.floor(b.depositCount * 0.15) + Math.floor(b.depositCount * 0.05), 0) /
                        SAMPLE_BRANCHES.reduce((sum, b) => sum + b.depositCount + b.withdrawalCount, 0)) * 100)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Currency Details Table */}
      {type === 'currency' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Foreign Currency Operations</h2>
                <p className="text-gray-600 mt-1">Deposits and Withdrawals in major currencies</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Branch</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">USD</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">EUR</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">GBP</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">SAR</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">AED</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">KWD</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">CNY</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_BRANCHES.map((branch, index) => {
                  const total = Object.values(branch.currencies).reduce((sum, curr: any) => sum + curr.deposit, 0);
                  return (
                    <tr key={branch.branchCode} className={`border-t border-gray-100 hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-gray-900">{branch.branchName}</p>
                          <p className="text-sm text-gray-500">Code: {branch.branchCode}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatCurrency(branch.currencies.usd.deposit)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatCurrency(branch.currencies.eur.deposit)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatCurrency(branch.currencies.gbp.deposit)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatCurrency(branch.currencies.sar.deposit)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatCurrency(branch.currencies.aed.deposit)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatCurrency(branch.currencies.kwd.deposit)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatCurrency(branch.currencies.cny.deposit)}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-700 text-lg">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gradient-to-r from-emerald-100 to-teal-100 font-bold border-t-2 border-gray-300">
                  <td className="px-6 py-4 text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.usd.deposit, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.eur.deposit, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.gbp.deposit, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.sar.deposit, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.aed.deposit, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.kwd.deposit, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.currencies.cny.deposit, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-800 text-lg">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) =>
                      sum + Object.values(b.currencies).reduce((s, c: any) => s + c.deposit, 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Volume Table */}
      {type === 'transactions' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-white">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Transaction Volume Analysis</h2>
                <p className="text-gray-600 mt-1">Deposits and Withdrawals by branch</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Branch</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Deposit Volume</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Deposit Count</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Withdrawal Volume</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Withdrawal Count</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Net Flow</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Total Volume</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_BRANCHES.map((branch, index) => {
                  const netFlow = branch.depositVolume - branch.withdrawalVolume;
                  const totalVolume = branch.depositVolume + branch.withdrawalVolume;
                  return (
                    <tr key={branch.branchCode} className={`border-t border-gray-100 hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-gray-900">{branch.branchName}</p>
                          <p className="text-sm text-gray-500">Code: {branch.branchCode}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-green-600">{formatCurrency(branch.depositVolume)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatNumber(branch.depositCount)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-red-600">{formatCurrency(branch.withdrawalVolume)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">{formatNumber(branch.withdrawalCount)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold ${netFlow > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {netFlow > 0 ? '+' : ''}{formatCurrency(netFlow)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-blue-700 text-lg">{formatCurrency(totalVolume)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gradient-to-r from-blue-100 to-cyan-100 font-bold border-t-2 border-gray-300">
                  <td className="px-6 py-4 text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-right text-green-700">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.depositVolume, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.depositCount, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-red-700">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.withdrawalVolume, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.withdrawalCount, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-green-800">
                    +{formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + (b.depositVolume - b.withdrawalVolume), 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-blue-800 text-lg">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.depositVolume + b.withdrawalVolume, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Branch Comparison Table */}
      {type === 'branches' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-white">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Comprehensive Branch Comparison</h2>
                <p className="text-gray-600 mt-1">All key metrics across branches</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Branch</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Deposits</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Withdrawals</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">New Accounts</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Loans Disbursed</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">Digital Txns</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-700">VOAT</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_BRANCHES.map((branch, index) => {
                  const digitalTxns = branch.ibTransactions + Math.floor(branch.depositCount * 0.15) + Math.floor(branch.depositCount * 0.05);
                  return (
                    <tr key={branch.branchCode} className={`border-t border-gray-100 hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-gray-900">{branch.branchName}</p>
                          <p className="text-sm text-gray-500">Code: {branch.branchCode}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-green-600">{formatCurrency(branch.depositVolume)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-red-600">{formatCurrency(branch.withdrawalVolume)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-orange-600">{formatNumber(branch.accountOpenings)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-blue-600">{formatNumber(branch.loansDisbursed)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-indigo-600">{formatNumber(digitalTxns)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-purple-600">{formatCurrency(branch.voat)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gradient-to-r from-purple-100 to-pink-100 font-bold border-t-2 border-gray-300">
                  <td className="px-6 py-4 text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-right text-green-700">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.depositVolume, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-red-700">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.withdrawalVolume, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-orange-700">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.accountOpenings, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-blue-700">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.loansDisbursed, 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-indigo-700">
                    {formatNumber(SAMPLE_BRANCHES.reduce((sum, b) =>
                      sum + b.ibTransactions + Math.floor(b.depositCount * 0.15) + Math.floor(b.depositCount * 0.05), 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-purple-700">
                    {formatCurrency(SAMPLE_BRANCHES.reduce((sum, b) => sum + b.voat, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
