import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Referral from '@/lib/models/Referral';
import ReferralConfig, { defaultReferralConfig } from '@/lib/models/ReferralConfig';
import Customer from '@/lib/models/Customer';
import { queryCustomerByCustNo } from '@/lib/flexcube';

// CORS headers for web app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/referrals/verify
 *
 * Verify an existing customer's account number, query FlexCube, and generate a referral link.
 *
 * Body: { accountNumber: string }  (16-digit account number)
 *
 * Flow:
 * 1. Extract 7-digit customer number from account (positions 3-9, 0-indexed)
 * 2. Query FlexCube to verify customer exists
 * 3. Generate referral code REF-{custNo}
 * 4. Return referral code + link (don't create Referral doc yet — that happens when referee uses it)
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { accountNumber } = body;

    if (!accountNumber || accountNumber.length !== 16) {
      return NextResponse.json({
        success: false,
        error: 'Please provide a valid 16-digit account number',
      }, { status: 400, headers: corsHeaders });
    }

    // Load referral config
    let config = await ReferralConfig.findById('default');
    if (!config) {
      config = await ReferralConfig.create(defaultReferralConfig);
    }

    if (!config.enabled) {
      return NextResponse.json({
        success: false,
        error: 'The referral program is currently disabled',
      }, { status: 400, headers: corsHeaders });
    }

    // Extract 7-digit customer number from 16-digit account
    // Account structure: BRN(3) + 111(3) + CIF(7) + SEQ(3)
    // e.g., 1641111141541017 → positions 6-12 → 1141541
    const customerNumber = accountNumber.substring(6, 13);

    // Verify customer via FlexCube QueryCustomer
    console.log(`[Referral Verify] Account: ${accountNumber} → CustNo: ${customerNumber}`);
    const queryResult = await queryCustomerByCustNo(customerNumber);

    if (!queryResult.success) {
      return NextResponse.json({
        success: false,
        error: `Customer not found: ${queryResult.message}`,
      }, { status: 404, headers: corsHeaders });
    }

    // Check max referrals limit
    if (config.maxReferralsPerCustomer > 0) {
      const existingCount = await Referral.countDocuments({
        referrerCustomerNumber: customerNumber,
      });
      if (existingCount >= config.maxReferralsPerCustomer) {
        return NextResponse.json({
          success: false,
          error: `Maximum referral limit reached (${config.maxReferralsPerCustomer})`,
        }, { status: 400, headers: corsHeaders });
      }
    }

    // Generate referral code and link
    const referralCode = `REF-${customerNumber}`;
    const webAppBaseUrl = config.webAppBaseUrl || 'http://localhost:3000';
    const referralLink = `https://onboard.zemenbank.com/?ref=${referralCode}`;

    // Check if this customer already has a referral entry (reuse the existing code)
    const existingReferral = await Referral.findOne({ referralCode });

    // Build the ancestor chain for this referrer
    // Check if this customer was themselves referred (for multi-level)
    let ancestorChain: string[] = [];
    let referrerAsReferee = await Referral.findOne({
      refereeCustomerNumber: customerNumber,
    });

    // Fallback: look up via Customer model if CIF not found in refereeCustomerNumber
    if (!referrerAsReferee) {
      const referrerCustomer = await Customer.findOne({
        $or: [
          { customerNumber: customerNumber },
          { cifNumber: customerNumber },
        ],
      });
      if (referrerCustomer?.referralCode) {
        referrerAsReferee = await Referral.findOne({
          refereeCustomerId: referrerCustomer.customerId,
        });
      }
    }

    if (referrerAsReferee) {
      // This referrer was referred by someone else — build the chain
      ancestorChain = [...(referrerAsReferee.ancestorChain || []), referrerAsReferee.referrerCustomerNumber];
    }

    return NextResponse.json({
      success: true,
      data: {
        customerNumber,
        fullName: queryResult.fullName,
        phone: queryResult.phone,
        email: queryResult.email,
        referralCode,
        referralLink,
        ancestorChain,
        totalReferrals: existingReferral
          ? await Referral.countDocuments({ referrerCustomerNumber: customerNumber })
          : 0,
      },
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Referral Verify] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to verify account',
    }, { status: 500, headers: corsHeaders });
  }
}
