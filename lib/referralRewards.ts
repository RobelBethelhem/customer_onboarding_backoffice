import Referral, { IReferral } from './models/Referral';
import ReferralConfig, { defaultReferralConfig, IReferralConfig } from './models/ReferralConfig';
import RewardTransaction, { getPointsBalance } from './models/RewardTransaction';
import { connectToDatabase } from './mongodb';

/**
 * Load the referral config (singleton). Creates default if not found.
 */
export async function getReferralConfig(): Promise<IReferralConfig> {
  await connectToDatabase();
  let config = await ReferralConfig.findById('default');
  if (!config) {
    config = await ReferralConfig.create(defaultReferralConfig);
  }
  return config;
}

/**
 * Distribute referral rewards after a referee completes onboarding.
 *
 * This is the core reward engine:
 * 1. Find the pending Referral for this referee
 * 2. Mark it as completed
 * 3. Award points to the direct referrer (level 1)
 * 4. Walk the ancestorChain backward, awarding points at each level up to maxLevels
 * 5. Create RewardTransaction records for each award
 *
 * @param refereeCustomerId  - The ZMN-XXXXX ID of the new customer
 * @param refereeCustomerNumber - The 7-digit CIF number of the new customer (once created)
 * @param refereeName - Full name of the new customer
 * @param refereeAccountNumber - Account number of the new customer (optional)
 */
export async function distributeReferralRewards(
  refereeCustomerId: string,
  refereeCustomerNumber?: string,
  refereeName?: string,
  refereeAccountNumber?: string,
): Promise<{
  success: boolean;
  message: string;
  rewardsDistributed: number;
  details: Array<{ customerNumber: string; level: number; points: number }>;
}> {
  try {
    await connectToDatabase();

    // 1. Load referral config
    const config = await getReferralConfig();

    if (!config.enabled) {
      return {
        success: true,
        message: 'Referral program is disabled',
        rewardsDistributed: 0,
        details: [],
      };
    }

    // 2. Find the pending referral for this referee
    console.log(`[Referral] Looking for pending referral for referee: ${refereeCustomerId}`);
    let referral = await Referral.findOne({
      refereeCustomerId,
      status: 'pending',
    });

    // Fallback: try finding by refereeCustomerId regardless of status (may have been manually created)
    if (!referral) {
      referral = await Referral.findOne({
        refereeCustomerId,
        status: { $in: ['pending', 'completed'] },
      });
      if (referral && referral.status === 'completed') {
        console.log(`[Referral] Found completed referral for ${refereeCustomerId} — already rewarded`);
        return {
          success: true,
          message: 'Referral already completed',
          rewardsDistributed: 0,
          details: [],
        };
      }
    }

    if (!referral) {
      // No referral found — this is an organic customer (not referred)
      console.log(`[Referral] No pending referral found for ${refereeCustomerId} — organic customer`);
      return {
        success: true,
        message: 'No referral found (organic customer)',
        rewardsDistributed: 0,
        details: [],
      };
    }

    // 3. Update the referral to completed
    referral.status = 'completed';
    referral.completedAt = new Date();
    if (refereeCustomerNumber) referral.refereeCustomerNumber = refereeCustomerNumber;
    if (refereeName) referral.refereeName = refereeName;
    if (refereeAccountNumber) referral.refereeAccountNumber = refereeAccountNumber;
    await referral.save();

    console.log(`[Referral] Referral completed: ${referral.referralCode} — ${referral.referrerName} referred ${refereeName || refereeCustomerId}`);

    // 4. Distribute rewards
    const details: Array<{ customerNumber: string; level: number; points: number }> = [];
    const maxLevels = config.maxLevels || 1;
    const levelRewards = config.levelRewards || [{ level: 1, points: 100 }];

    // Helper to get points for a given level
    const getPointsForLevel = (level: number): number => {
      const reward = levelRewards.find(r => r.level === level);
      return reward ? reward.points : 0;
    };

    // Level 1: Direct referrer
    const level1Points = getPointsForLevel(1);
    if (level1Points > 0) {
      const currentBalance = await getPointsBalance(referral.referrerCustomerNumber);
      await RewardTransaction.create({
        customerNumber: referral.referrerCustomerNumber,
        type: 'earn_referral',
        points: level1Points,
        balanceAfter: currentBalance + level1Points,
        description: `Referral reward: ${refereeName || refereeCustomerId} completed onboarding (Level 1 - Direct)`,
        referralId: referral._id,
        refereeCustomerNumber: refereeCustomerNumber || '',
        level: 1,
        performedBy: 'system',
      });

      details.push({
        customerNumber: referral.referrerCustomerNumber,
        level: 1,
        points: level1Points,
      });

      console.log(`[Referral] Level 1 reward: ${level1Points} points → ${referral.referrerCustomerNumber} (${referral.referrerName})`);
    }

    // Referee reward: award points to the new customer if configured
    const refereePointsEnabled = (config as any).refereePointsEnabled;
    const refereePointsAmount = (config as any).refereePoints || 0;
    if (refereePointsEnabled && refereePointsAmount > 0 && refereeCustomerNumber) {
      const refereeBalance = await getPointsBalance(refereeCustomerNumber);
      await RewardTransaction.create({
        customerNumber: refereeCustomerNumber,
        type: 'earn_referral',
        points: refereePointsAmount,
        balanceAfter: refereeBalance + refereePointsAmount,
        description: `Welcome bonus: Referred by ${referral.referrerName} (Referee reward)`,
        referralId: referral._id,
        refereeCustomerNumber: refereeCustomerNumber,
        level: 0,
        performedBy: 'system',
      });

      details.push({
        customerNumber: refereeCustomerNumber,
        level: 0,
        points: refereePointsAmount,
      });

      console.log(`[Referral] Referee reward: ${refereePointsAmount} points → ${refereeCustomerNumber} (${refereeName || refereeCustomerId})`);
    }

    // Levels 2+: Walk the ancestorChain backward
    // ancestorChain = ['grandparent_custno', 'parent_custno'] (root → direct parent)
    // We need to walk backward: parent_custno gets level 2, grandparent gets level 3, etc.
    if (maxLevels > 1 && referral.ancestorChain && referral.ancestorChain.length > 0) {
      const ancestors = [...referral.ancestorChain].reverse(); // Now: [parent, grandparent, ...]

      for (let i = 0; i < ancestors.length && i < (maxLevels - 1); i++) {
        const ancestorCustNo = ancestors[i];
        const level = i + 2; // Level 2 for parent, 3 for grandparent, etc.
        const levelPoints = getPointsForLevel(level);

        if (levelPoints <= 0) continue;

        const ancestorBalance = await getPointsBalance(ancestorCustNo);
        await RewardTransaction.create({
          customerNumber: ancestorCustNo,
          type: 'earn_referral',
          points: levelPoints,
          balanceAfter: ancestorBalance + levelPoints,
          description: `Referral reward: ${refereeName || refereeCustomerId} completed onboarding (Level ${level} - Indirect)`,
          referralId: referral._id,
          refereeCustomerNumber: refereeCustomerNumber || '',
          level,
          performedBy: 'system',
        });

        details.push({
          customerNumber: ancestorCustNo,
          level,
          points: levelPoints,
        });

        console.log(`[Referral] Level ${level} reward: ${levelPoints} points → ${ancestorCustNo}`);
      }
    }

    // 5. Mark rewards as distributed
    referral.rewardsDistributed = true;
    referral.rewardsDistributedAt = new Date();
    referral.status = 'rewarded';
    await referral.save();

    const totalPoints = details.reduce((sum, d) => sum + d.points, 0);
    console.log(`[Referral] Total rewards distributed: ${totalPoints} points across ${details.length} recipients`);

    return {
      success: true,
      message: `Rewards distributed: ${totalPoints} total points to ${details.length} recipients`,
      rewardsDistributed: details.length,
      details,
    };
  } catch (error: any) {
    console.error('[Referral] Error distributing rewards:', error);
    return {
      success: false,
      message: `Failed to distribute rewards: ${error.message}`,
      rewardsDistributed: 0,
      details: [],
    };
  }
}
