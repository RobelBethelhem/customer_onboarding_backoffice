import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Referral from '@/lib/models/Referral';
import ReferralConfig, { defaultReferralConfig } from '@/lib/models/ReferralConfig';

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
 * GET /api/referrals/[code]
 *
 * Validate a referral code and return the referrer's name.
 * Called by the web app when it detects a ?ref= URL parameter.
 *
 * Returns: { referrerName, referralCode, valid }
 *
 * This does NOT create the Referral document — that happens when the referee
 * submits their onboarding application (in the onboarding route).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    await connectToDatabase();

    const code = params.code;

    if (!code || !code.startsWith('REF-')) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'Invalid referral code format',
      }, { status: 400, headers: corsHeaders });
    }

    // Load config to check if program is enabled
    let config = await ReferralConfig.findById('default');
    if (!config) {
      config = await ReferralConfig.create(defaultReferralConfig);
    }

    if (!config.enabled) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'Referral program is currently disabled',
      }, { status: 400, headers: corsHeaders });
    }

    // Look for an existing referral with this code to get the referrer info
    const existingReferral = await Referral.findOne({ referralCode: code });

    if (existingReferral) {
      // Check if referral link has expired
      if (existingReferral.expiresAt && new Date() > existingReferral.expiresAt) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: 'This referral link has expired',
        }, { status: 400, headers: corsHeaders });
      }

      return NextResponse.json({
        success: true,
        valid: true,
        data: {
          referralCode: code,
          referrerName: existingReferral.referrerName,
          referrerCustomerNumber: existingReferral.referrerCustomerNumber,
        },
      }, { headers: corsHeaders });
    }

    // No existing referral doc — the code is derived from customer number
    // Extract customer number from code: REF-0015678 → 0015678
    const customerNumber = code.replace('REF-', '');

    if (customerNumber.length !== 7 || !/^\d+$/.test(customerNumber)) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'Invalid referral code',
      }, { status: 400, headers: corsHeaders });
    }

    // We can't look up the name without querying FlexCube, but we can
    // confirm the code format is valid. The verify endpoint would have
    // already created a referral entry if the customer used the generator.
    // If they manually shared the URL, we accept it and will verify later.
    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        referralCode: code,
        referrerName: null, // Will be populated when referral is created
        referrerCustomerNumber: customerNumber,
      },
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Referral Validate] Error:', error);
    return NextResponse.json({
      success: false,
      valid: false,
      error: error.message || 'Failed to validate referral code',
    }, { status: 500, headers: corsHeaders });
  }
}
