import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Referral from '@/lib/models/Referral';
import RewardTransaction from '@/lib/models/RewardTransaction';

/**
 * GET /api/referrals/stats
 *
 * Admin stats for the referral dashboard:
 * - Total referrals, completed, pending, expired
 * - Total points distributed, ETB converted
 * - Top referrers leaderboard
 * - Recent activity
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Overall counts
    const [totalReferrals, completedReferrals, pendingReferrals, rewardedReferrals, expiredReferrals] =
      await Promise.all([
        Referral.countDocuments(),
        Referral.countDocuments({ status: 'completed' }),
        Referral.countDocuments({ status: 'pending' }),
        Referral.countDocuments({ status: 'rewarded' }),
        Referral.countDocuments({ status: 'expired' }),
      ]);

    // Points stats
    const pointsStats = await RewardTransaction.aggregate([
      {
        $group: {
          _id: '$type',
          totalPoints: { $sum: '$points' },
          count: { $sum: 1 },
          totalEtb: { $sum: { $ifNull: ['$etbAmount', 0] } },
        },
      },
    ]);

    let totalPointsDistributed = 0;
    let totalEtbConverted = 0;
    let totalRedemptions = 0;
    let totalEarnings = 0;

    for (const stat of pointsStats) {
      if (stat._id === 'earn_referral' || stat._id === 'earn_bonus') {
        totalPointsDistributed += stat.totalPoints;
        totalEarnings += stat.count;
      }
      if (stat._id === 'redeem_etb') {
        totalEtbConverted += stat.totalEtb;
        totalRedemptions += stat.count;
      }
    }

    // Top referrers (by number of referrals — all statuses except expired)
    const topReferrers = await Referral.aggregate([
      { $match: { status: { $in: ['pending', 'completed', 'rewarded'] } } },
      {
        $group: {
          _id: '$referrerCustomerNumber',
          name: { $first: '$referrerName' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Enrich top referrers with their points balance
    const topReferrersWithPoints = await Promise.all(
      topReferrers.map(async (referrer) => {
        const balanceResult = await RewardTransaction.aggregate([
          { $match: { customerNumber: referrer._id } },
          { $group: { _id: null, total: { $sum: '$points' } } },
        ]);
        return {
          customerNumber: referrer._id,
          name: referrer.name,
          referralCount: referrer.count,
          totalPoints: balanceResult.length > 0 ? balanceResult[0].total : 0,
        };
      })
    );

    // Recent activity (last 20 referrals — all statuses)
    const recentActivity = await Referral.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .select('referrerCustomerNumber referrerName refereeCustomerNumber refereeName referralCode status level completedAt createdAt')
      .lean();

    // Enrich with reward points
    const recentActivityWithRewards = await Promise.all(
      recentActivity.map(async (activity) => {
        const rewards = await RewardTransaction.find({
          referralId: activity._id,
        })
          .select('customerNumber level points')
          .lean();

        return {
          ...activity,
          rewards,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalReferrals,
          completedReferrals: completedReferrals + rewardedReferrals,
          pendingReferrals,
          expiredReferrals,
          totalPointsDistributed,
          totalEtbConverted,
          totalRedemptions,
          totalEarnings,
        },
        topReferrers: topReferrersWithPoints,
        recentActivity: recentActivityWithRewards,
      },
    });

  } catch (error: any) {
    console.error('[Referral Stats] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch referral stats',
    }, { status: 500 });
  }
}
