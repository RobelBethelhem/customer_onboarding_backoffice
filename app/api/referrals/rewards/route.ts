import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Referral from '@/lib/models/Referral';
import RewardTransaction, { getPointsBalance } from '@/lib/models/RewardTransaction';

// CORS headers for web app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/referrals/rewards?customerNumber=0015678
 *
 * Get points balance, transaction history, and referral stats for a customer.
 * Called by the web app rewards dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const customerNumber = searchParams.get('customerNumber');

    if (!customerNumber) {
      return NextResponse.json({
        success: false,
        error: 'customerNumber is required',
      }, { status: 400, headers: corsHeaders });
    }

    // Get current balance
    const balance = await getPointsBalance(customerNumber);

    // Get transaction history (last 50)
    const transactions = await RewardTransaction.find({ customerNumber })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Get referral stats
    const totalReferrals = await Referral.countDocuments({
      referrerCustomerNumber: customerNumber,
    });
    const completedReferrals = await Referral.countDocuments({
      referrerCustomerNumber: customerNumber,
      status: { $in: ['completed', 'rewarded'] },
    });
    const pendingReferrals = await Referral.countDocuments({
      referrerCustomerNumber: customerNumber,
      status: 'pending',
    });

    // Total points earned and redeemed
    const earnedResult = await RewardTransaction.aggregate([
      { $match: { customerNumber, points: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]);
    const totalEarned = earnedResult.length > 0 ? earnedResult[0].total : 0;

    const redeemedResult = await RewardTransaction.aggregate([
      { $match: { customerNumber, type: 'redeem_etb' } },
      { $group: { _id: null, total: { $sum: { $abs: '$points' } }, totalEtb: { $sum: '$etbAmount' } } },
    ]);
    const totalRedeemed = redeemedResult.length > 0 ? redeemedResult[0].total : 0;
    const totalEtbConverted = redeemedResult.length > 0 ? redeemedResult[0].totalEtb : 0;

    return NextResponse.json({
      success: true,
      data: {
        customerNumber,
        balance,
        totalEarned,
        totalRedeemed,
        totalEtbConverted,
        stats: {
          totalReferrals,
          completedReferrals,
          pendingReferrals,
        },
        transactions,
      },
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Referral Rewards] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch rewards',
    }, { status: 500, headers: corsHeaders });
  }
}
