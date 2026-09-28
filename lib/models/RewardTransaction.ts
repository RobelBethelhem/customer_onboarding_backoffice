import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type RewardTransactionType = 'earn_referral' | 'earn_bonus' | 'redeem_etb' | 'admin_adjustment' | 'expire';

export interface IRewardTransaction extends Document {
  transactionId: string;               // Auto-generated: RWD-{timestamp}-{random}
  customerNumber: string;              // 7-digit CIF number (the account holder)
  type: RewardTransactionType;
  points: number;                      // Positive for earn, negative for redeem/expire
  balanceAfter: number;                // Running balance after this transaction

  // Context
  description: string;                 // Human-readable description
  referralId?: Types.ObjectId;         // Link to Referral document (for earn_referral)
  refereeCustomerNumber?: string;      // Who was referred (for earn_referral)
  level?: number;                      // At what level this reward was earned

  // For redeem_etb
  etbAmount?: number;                  // ETB equivalent (points * rate at time of conversion)
  conversionRate?: number;             // Rate used at conversion time

  // Audit
  performedBy: string;                 // 'system' or admin email

  createdAt: Date;
}

const RewardTransactionSchema = new Schema<IRewardTransaction>({
  transactionId: {
    type: String,
    unique: true,
    default: () => `RWD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  },
  customerNumber: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['earn_referral', 'earn_bonus', 'redeem_etb', 'admin_adjustment', 'expire'],
    required: true,
  },
  points: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },

  description: { type: String, required: true },
  referralId: { type: Schema.Types.ObjectId, ref: 'Referral' },
  refereeCustomerNumber: { type: String },
  level: { type: Number },

  etbAmount: { type: Number },
  conversionRate: { type: Number },

  performedBy: { type: String, default: 'system' },
}, {
  timestamps: true,
});

// Primary query: transaction history and balance for a customer
RewardTransactionSchema.index({ customerNumber: 1, createdAt: -1 });
// For linking back to referrals
RewardTransactionSchema.index({ referralId: 1 });
// For filtering by type
RewardTransactionSchema.index({ type: 1 });

/**
 * Get current points balance for a customer by summing all transactions.
 * This is the canonical source of truth for balance.
 */
export async function getPointsBalance(customerNumber: string): Promise<number> {
  const RewardTx = mongoose.model<IRewardTransaction>('RewardTransaction');
  const result = await RewardTx.aggregate([
    { $match: { customerNumber } },
    { $group: { _id: null, total: { $sum: '$points' } } },
  ]);
  return result.length > 0 ? result[0].total : 0;
}

let RewardTransaction: Model<IRewardTransaction>;

try {
  RewardTransaction = mongoose.model<IRewardTransaction>('RewardTransaction');
} catch {
  RewardTransaction = mongoose.model<IRewardTransaction>('RewardTransaction', RewardTransactionSchema);
}

export default RewardTransaction;
