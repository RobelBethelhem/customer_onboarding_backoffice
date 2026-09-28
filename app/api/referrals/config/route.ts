import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ReferralConfig, { defaultReferralConfig } from '@/lib/models/ReferralConfig';
import { audit, fieldChanges } from '@/lib/audit';

// Always run on request: otherwise `next build` pre-renders this route, which freezes its data and makes saving (PUT) fail with 405
export const dynamic = 'force-dynamic';

// F5: referral links may only point to trusted Zemen Bank domains (anti open-redirect/phishing)
function isTrustedBaseUrl(value: string): boolean {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return host === 'zemenbank.com' || host.endsWith('.zemenbank.com') || host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * GET /api/referrals/config
 * Fetch the current referral configuration.
 */
export async function GET() {
  try {
    await connectToDatabase();

    let config = await ReferralConfig.findById('default');
    if (!config) {
      config = await ReferralConfig.create(defaultReferralConfig);
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error('[Referral Config] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch referral config',
    }, { status: 500 });
  }
}

/**
 * PUT /api/referrals/config
 * Update the referral configuration.
 *
 * Body can include any config fields:
 * - enabled, maxLevels, levelRewards, pointsToEtbRate,
 *   minRedeemablePoints, referralExpiryDays, maxReferralsPerCustomer, webAppBaseUrl
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();

    // Validate levelRewards if provided
    if (body.levelRewards) {
      if (!Array.isArray(body.levelRewards)) {
        return NextResponse.json({
          success: false,
          error: 'levelRewards must be an array',
        }, { status: 400 });
      }

      for (const reward of body.levelRewards) {
        if (typeof reward.level !== 'number' || reward.level < 1) {
          return NextResponse.json({
            success: false,
            error: 'Each level reward must have a valid level number (>= 1)',
          }, { status: 400 });
        }
        if (typeof reward.points !== 'number' || reward.points < 0) {
          return NextResponse.json({
            success: false,
            error: 'Each level reward must have a valid points number (>= 0)',
          }, { status: 400 });
        }
      }
    }

    // Validate maxLevels
    if (body.maxLevels !== undefined) {
      if (body.maxLevels < 1 || body.maxLevels > 10) {
        return NextResponse.json({
          success: false,
          error: 'maxLevels must be between 1 and 10',
        }, { status: 400 });
      }
    }

    // Build update object — only include allowed fields
    // Validate refereePoints if provided
    if (body.refereePoints !== undefined && (typeof body.refereePoints !== 'number' || body.refereePoints < 0)) {
      return NextResponse.json({
        success: false,
        error: 'refereePoints must be a number >= 0',
      }, { status: 400 });
    }

    const allowedFields = [
      'enabled', 'maxLevels', 'levelRewards', 'pointsToEtbRate',
      'minRedeemablePoints', 'referralExpiryDays', 'maxReferralsPerCustomer',
      'refereePointsEnabled', 'refereePoints',
      'webAppBaseUrl',
    ];

    const update: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    // F5: reject untrusted referral-link domains
    if (update.webAppBaseUrl !== undefined && !isTrustedBaseUrl(update.webAppBaseUrl)) {
      return NextResponse.json({
        success: false,
        error: 'webAppBaseUrl must be a trusted Zemen Bank domain (e.g. https://onboard.zemenbank.com)',
      }, { status: 400 });
    }

    // F9: updatedBy from the authenticated session, not the client payload
    update.updatedBy = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'admin';

    const before = (await ReferralConfig.findById('default').lean()) || {};

    // Upsert config
    const config = await ReferralConfig.findByIdAndUpdate(
      'default',
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    console.log(`[Referral Config] Updated by ${update.updatedBy}:`, JSON.stringify(update, null, 2));

    const changes = fieldChanges(before, config?.toObject() || {}, Object.keys(update).filter(k => k !== 'updatedBy'));
    if (changes.length) {
      await audit(request, {
        module: 'REFERRAL', action: 'UPDATE', entityType: 'ReferralConfig', entityId: 'default',
        entityName: 'Referral programme settings', changes,
        description: `Changed ${changes.map(c => c.field).join(', ')}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error('[Referral Config] PUT error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update referral config',
    }, { status: 500 });
  }
}
