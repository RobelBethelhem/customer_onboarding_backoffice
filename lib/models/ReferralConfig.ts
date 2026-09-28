import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ILevelReward {
  level: number;        // 1 = direct, 2 = indirect, etc.
  points: number;       // Points awarded at this level
}

export interface IReferralConfig extends Omit<Document, '_id'> {
  _id: string;                      // Always 'default' (singleton)

  // Program toggle
  enabled: boolean;                 // Master switch for referral program

  // Multi-level configuration
  maxLevels: number;                // How many levels deep rewards propagate (default: 1)
  levelRewards: ILevelReward[];     // Points per level
                                    // e.g., [{level:1, points:100}, {level:2, points:50}]

  // Points-to-ETB conversion
  pointsToEtbRate: number;          // e.g., 1.0 means 1 point = 1 ETB
  minRedeemablePoints: number;      // Minimum points needed to redeem

  // Referral link expiry
  referralExpiryDays: number;       // Days until referral link expires (0 = never)

  // Limits
  maxReferralsPerCustomer: number;  // Max referrals one customer can make (0 = unlimited)

  // Referee (new customer) rewards
  refereePointsEnabled: boolean;  // Toggle: award points to the referred customer
  refereePoints: number;          // Points awarded to the referee upon completing onboarding

  // Web app base URL for generating referral links
  webAppBaseUrl: string;

  // Metadata
  updatedAt: Date;
  updatedBy: string;
}

const LevelRewardSchema = new Schema<ILevelReward>({
  level: { type: Number, required: true },
  points: { type: Number, required: true },
}, { _id: false });

const ReferralConfigSchema = new Schema<IReferralConfig>({
  _id: { type: String, default: 'default' },

  enabled: { type: Boolean, default: true },

  maxLevels: { type: Number, default: 1, min: 1, max: 10 },
  levelRewards: {
    type: [LevelRewardSchema],
    default: [{ level: 1, points: 100 }],
  },

  pointsToEtbRate: { type: Number, default: 1.0, min: 0.01 },
  minRedeemablePoints: { type: Number, default: 100, min: 1 },

  referralExpiryDays: { type: Number, default: 90, min: 0 },

  maxReferralsPerCustomer: { type: Number, default: 0, min: 0 },

  refereePointsEnabled: { type: Boolean, default: false },
  refereePoints: { type: Number, default: 0, min: 0 },

  webAppBaseUrl: { type: String, default: 'http://localhost:3000' },

  updatedBy: { type: String, default: 'system' },
}, {
  timestamps: true,
  _id: false,
});

// Default settings
export const defaultReferralConfig: Partial<IReferralConfig> = {
  _id: 'default',
  enabled: true,
  maxLevels: 1,
  levelRewards: [{ level: 1, points: 100 }],
  pointsToEtbRate: 1.0,
  minRedeemablePoints: 100,
  referralExpiryDays: 90,
  maxReferralsPerCustomer: 0,
  refereePointsEnabled: false,
  refereePoints: 0,
  webAppBaseUrl: 'http://localhost:3000',
  updatedBy: 'system',
};

let ReferralConfig: Model<IReferralConfig>;

try {
  ReferralConfig = mongoose.model<IReferralConfig>('ReferralConfig');
} catch {
  ReferralConfig = mongoose.model<IReferralConfig>('ReferralConfig', ReferralConfigSchema);
}

export default ReferralConfig;
