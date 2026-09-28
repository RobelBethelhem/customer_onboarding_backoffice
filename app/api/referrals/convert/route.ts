import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ReferralConfig, { defaultReferralConfig } from '@/lib/models/ReferralConfig';
import RewardTransaction, { getPointsBalance } from '@/lib/models/RewardTransaction';

// CORS headers for web app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/referrals/convert
 *
 * Convert points to ETB.
 *
 * Body: { customerNumber: string, points: number }
 *
 * Rules:
 * - points must be >= minRedeemablePoints (from config)
 * - points must be <= current balance
 * - Creates a negative RewardTransaction (redeem_etb)
 */
export async function POST(_request: NextRequest) {
  // ──────────────────────────────────────────────────────────────────────────
  // ON HOLD (UAT): Points → Birr/ETB conversion is temporarily disabled.
  // The rest of the referral program (link generation, code validation, reward
  // earning, and balance display) stays fully active — only redemption to Birr
  // is paused. To re-enable, delete this short-circuit handler and uncomment the
  // original implementation preserved in the block below.
  // ──────────────────────────────────────────────────────────────────────────
  return NextResponse.json({
    success: false,
    error: 'Points to Birr conversion is temporarily unavailable.',
  }, { status: 503, headers: corsHeaders });
}

/* ── ON HOLD: original points→ETB conversion implementation (do not delete) ──
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { customerNumber, points } = body;

    if (!customerNumber || !points || points <= 0) {
      return NextResponse.json({
        success: false,
        error: 'customerNumber and points (> 0) are required',
      }, { status: 400, headers: corsHeaders });
    }

    // Load config
    let config = await ReferralConfig.findById('default');
    if (!config) {
      config = await ReferralConfig.create(defaultReferralConfig);
    }

    if (!config.enabled) {
      return NextResponse.json({
        success: false,
        error: 'Referral program is currently disabled',
      }, { status: 400, headers: corsHeaders });
    }

    // Check minimum redeemable points
    if (points < config.minRedeemablePoints) {
      return NextResponse.json({
        success: false,
        error: `Minimum redeemable points is ${config.minRedeemablePoints}`,
      }, { status: 400, headers: corsHeaders });
    }

    // Check current balance
    const currentBalance = await getPointsBalance(customerNumber);
    if (points > currentBalance) {
      return NextResponse.json({
        success: false,
        error: `Insufficient balance. Current balance: ${currentBalance} points`,
      }, { status: 400, headers: corsHeaders });
    }

    // Calculate ETB amount
    const conversionRate = config.pointsToEtbRate || 1.0;
    const etbAmount = points * conversionRate;

    // Create redemption transaction
    const transaction = await RewardTransaction.create({
      customerNumber,
      type: 'redeem_etb',
      points: -points, // Negative for redemption
      balanceAfter: currentBalance - points,
      description: `Converted ${points} points to ${etbAmount.toFixed(2)} ETB (rate: ${conversionRate})`,
      etbAmount,
      conversionRate,
      performedBy: 'customer',
    });

    console.log(`[Referral Convert] ${customerNumber}: ${points} points -> ${etbAmount.toFixed(2)} ETB`);

    return NextResponse.json({
      success: true,
      data: {
        transactionId: transaction.transactionId,
        pointsRedeemed: points,
        etbAmount,
        conversionRate,
        newBalance: currentBalance - points,
      },
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Referral Convert] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to convert points',
    }, { status: 500, headers: corsHeaders });
  }
}
*/
