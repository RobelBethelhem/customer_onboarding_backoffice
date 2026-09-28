import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type ReferralStatus = 'pending' | 'completed' | 'expired' | 'rewarded';

export interface IReferral extends Document {
  // The referrer (existing customer who shared the link)
  referrerCustomerNumber: string;   // 7-digit CIF number (e.g., '0015678')
  referrerAccountNumber?: string;   // 16-digit account number (optional — not available for web referrals)
  referrerName: string;             // Full name from FlexCube QueryCustomer
  referrerPhone?: string;
  referrerEmail?: string;

  // The referee (new customer who used the referral link)
  refereeCustomerId?: string;       // ZMN-XXXXX from onboarding Customer model
  refereeName?: string;
  refereeCustomerNumber?: string;   // CIF number once created
  refereeAccountNumber?: string;    // Account number once created

  // Referral metadata
  referralCode: string;             // REF-0015678
  referralLink: string;             // Full URL with ?ref= param
  status: ReferralStatus;

  // Multi-level hierarchy
  level: number;                    // 1 = direct referral, 2 = referral of referral, etc.
  parentReferralId?: Types.ObjectId;  // The referral that referred the referrer
  ancestorChain: string[];          // Array of customerNumbers from root to direct parent
                                    // Enables O(1) multi-level lookup without recursive queries
                                    // e.g., A→B→C→D: D's ancestorChain = ['A_custno', 'B_custno']

  // Reward tracking
  rewardsDistributed: boolean;
  rewardsDistributedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;               // When referee completed onboarding
  expiresAt?: Date;                 // Optional expiry for referral links
}

const ReferralSchema = new Schema<IReferral>({
  // Referrer
  referrerCustomerNumber: { type: String, required: true, index: true },
  referrerAccountNumber: { type: String, default: '' },
  referrerName: { type: String, required: true },
  referrerPhone: { type: String },
  referrerEmail: { type: String },

  // Referee
  refereeCustomerId: { type: String, index: true },
  refereeName: { type: String },
  refereeCustomerNumber: { type: String },
  refereeAccountNumber: { type: String },

  // Referral metadata
  referralCode: { type: String, required: true, index: true },
  referralLink: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired', 'rewarded'],
    default: 'pending',
    index: true,
  },

  // Multi-level hierarchy
  level: { type: Number, default: 1 },
  parentReferralId: { type: Schema.Types.ObjectId, ref: 'Referral' },
  ancestorChain: { type: [String], default: [] },

  // Reward tracking
  rewardsDistributed: { type: Boolean, default: false },
  rewardsDistributedAt: { type: Date },

  // Timestamps
  completedAt: { type: Date },
  expiresAt: { type: Date },
}, {
  timestamps: true,
});

// Compound unique index: same referee can't use same referral code twice
ReferralSchema.index({ referralCode: 1, refereeCustomerId: 1 }, { unique: true });
// Compound index for finding all referrals by a referrer
ReferralSchema.index({ referrerCustomerNumber: 1, status: 1 });
// Index for ancestor chain multi-level queries
ReferralSchema.index({ ancestorChain: 1 });

let Referral: Model<IReferral>;

try {
  Referral = mongoose.model<IReferral>('Referral');
} catch {
  Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
}

// Migration: drop old indexes that conflict with current schema.
// Mongoose won't auto-remove old indexes — we must do it manually.
// Safe to call multiple times (ignores if not found).
async function migrateReferralIndexes() {
  try {
    const collection = Referral.collection;
    const indexes = await collection.indexes();

    // Drop the old unique index on referralCode alone (was: unique: true)
    const oldUniqueIndex = indexes.find(
      (idx) => idx.name === 'referralCode_1' && idx.unique === true
    );
    if (oldUniqueIndex) {
      await collection.dropIndex('referralCode_1');
      console.log('[Migration] Dropped old unique index referralCode_1');
    }

    // Sync indexes to ensure new compound indexes are created
    await Referral.syncIndexes();
    console.log('[Migration] Referral indexes synced successfully');
  } catch (err: any) {
    // Ignore if collection doesn't exist yet
    if (!err.message?.includes('ns not found')) {
      console.log('[Migration] Referral index migration note:', err.message);
    }
  }
}

// Export so it can be called after DB connection is ready
export { migrateReferralIndexes };

export default Referral;
