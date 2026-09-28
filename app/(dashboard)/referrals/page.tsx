'use client';

import { useState, useEffect } from 'react';
import {
  Gift, Users, TrendingUp, ArrowRightLeft, Award,
  Loader2, RefreshCw, ChevronRight
} from 'lucide-react';

interface ReferralStats {
  overview: {
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    expiredReferrals: number;
    totalPointsDistributed: number;
    totalEtbConverted: number;
    totalRedemptions: number;
    totalEarnings: number;
  };
  topReferrers: Array<{
    customerNumber: string;
    name: string;
    referralCount: number;
    totalPoints: number;
  }>;
  recentActivity: Array<{
    _id: string;
    referrerCustomerNumber: string;
    referrerName: string;
    refereeCustomerNumber?: string;
    refereeName?: string;
    referralCode: string;
    status: string;
    level: number;
    completedAt?: string;
    createdAt: string;
    rewards?: Array<{
      customerNumber: string;
      level: number;
      points: number;
    }>;
  }>;
}

export default function ReferralDashboardPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/referrals/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error || 'Failed to load stats');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load referral stats');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading referral data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referral Program</h1>
          <p className="text-gray-500 mt-1">Track referral activity, rewards, and top performers</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Referrals</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.overview.totalReferrals}</p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-green-600">{stats.overview.completedReferrals} completed</span>
            <span className="text-amber-600">{stats.overview.pendingReferrals} pending</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Points Distributed</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.overview.totalPointsDistributed.toLocaleString()}</p>
          <p className="mt-2 text-xs text-gray-500">{stats.overview.totalEarnings} reward transactions</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">ETB Converted</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.overview.totalEtbConverted.toLocaleString()} <span className="text-lg font-normal text-gray-500">ETB</span></p>
          <p className="mt-2 text-xs text-gray-500">{stats.overview.totalRedemptions} conversions</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Completion Rate</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {stats.overview.totalReferrals > 0
              ? Math.round((stats.overview.completedReferrals / stats.overview.totalReferrals) * 100)
              : 0}%
          </p>
          <p className="mt-2 text-xs text-gray-500">of referrals completed onboarding</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Referrers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Top Referrers</h2>
          </div>

          {stats.topReferrers.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No referrals yet</p>
          ) : (
            <div className="space-y-3">
              {stats.topReferrers.map((referrer, index) => (
                <div key={referrer.customerNumber} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-amber-400 text-white'
                    : index === 1 ? 'bg-gray-400 text-white'
                    : index === 2 ? 'bg-amber-700 text-white'
                    : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{referrer.name}</p>
                    <p className="text-xs text-gray-500">CIF: {referrer.customerNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-600 text-sm">{referrer.totalPoints} pts</p>
                    <p className="text-xs text-gray-500">{referrer.referralCount} refs</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>

          {stats.recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No referral activity yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Referrer</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Referee</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium">Level</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium">Status</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Points</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map((activity) => {
                    const totalRewardPoints = activity.rewards?.reduce((sum, r) => sum + r.points, 0) || 0;
                    const date = activity.completedAt || activity.createdAt;

                    return (
                      <tr key={activity._id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-gray-900 truncate max-w-[140px]">{activity.referrerName}</p>
                          <p className="text-xs text-gray-400">{activity.referrerCustomerNumber}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-gray-700 truncate max-w-[140px]">{activity.refereeName || '—'}</p>
                          <p className="text-xs text-gray-400">{activity.refereeCustomerNumber || ''}</p>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            {activity.level}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            activity.status === 'rewarded' ? 'bg-green-100 text-green-700'
                            : activity.status === 'completed' ? 'bg-blue-100 text-blue-700'
                            : activity.status === 'pending' ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                            {activity.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-amber-600">
                          {totalRewardPoints > 0 ? `+${totalRewardPoints}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-500 text-xs">
                          {new Date(date).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
