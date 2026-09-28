import mongoose, { Schema, Document } from 'mongoose';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR';
export type ScreeningStatus = 'PENDING' | 'CLEAR' | 'MATCHED' | 'FALSE_POSITIVE' | 'CONFIRMED';

export interface IMatchDetail {
  sanctionEntryId: string;
  entryId: string;
  fullName: string;
  sanctionType: string;
  sourceId: string;
  matchScore: number;
  matchStrength: 'EXACT' | 'STRONG' | 'MEDIUM' | 'WEAK';
  matchedFields: string[]; // Which fields matched
  reason?: string;
}

export interface IScreeningResult extends Document {
  // Screening ID
  screeningId: string;

  // Customer being screened
  customerId?: string; // May not exist yet during onboarding
  customerName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  uin?: string; // Fayda UIN

  // Screening context
  screeningType: 'ONBOARDING' | 'PERIODIC' | 'TRANSACTION' | 'MANUAL';
  triggeredBy: string; // User or 'SYSTEM'

  // Results
  status: ScreeningStatus;
  riskLevel: RiskLevel;
  totalMatches: number;
  matches: IMatchDetail[];

  // Override (if false positive)
  overrideReason?: string;
  overrideBy?: string;
  overrideDate?: Date;

  // Metadata
  screenedAt: Date;
  completedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

const MatchDetailSchema = new Schema<IMatchDetail>({
  sanctionEntryId: { type: String, required: true },
  entryId: { type: String, required: true },
  fullName: { type: String, required: true },
  sanctionType: { type: String, required: true },
  sourceId: { type: String, required: true },
  matchScore: { type: Number, required: true },
  matchStrength: {
    type: String,
    enum: ['EXACT', 'STRONG', 'MEDIUM', 'WEAK'],
    required: true
  },
  matchedFields: [{ type: String }],
  reason: { type: String },
}, { _id: false });

const ScreeningResultSchema = new Schema<IScreeningResult>({
  screeningId: { type: String, required: true, unique: true },

  customerId: { type: String, index: true },
  customerName: { type: String, required: true },
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  dateOfBirth: { type: String },
  uin: { type: String, index: true },

  screeningType: {
    type: String,
    enum: ['ONBOARDING', 'PERIODIC', 'TRANSACTION', 'MANUAL'],
    required: true
  },
  triggeredBy: { type: String, required: true },

  status: {
    type: String,
    enum: ['PENDING', 'CLEAR', 'MATCHED', 'FALSE_POSITIVE', 'CONFIRMED'],
    default: 'PENDING',
    index: true
  },
  riskLevel: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW', 'CLEAR'],
    required: true,
    index: true
  },
  totalMatches: { type: Number, default: 0 },
  matches: [MatchDetailSchema],

  overrideReason: { type: String },
  overrideBy: { type: String },
  overrideDate: { type: Date },

  screenedAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  reviewNotes: { type: String },
}, {
  timestamps: true,
});

// Indexes
ScreeningResultSchema.index({ screenedAt: -1 });
ScreeningResultSchema.index({ status: 1, screenedAt: -1 });
ScreeningResultSchema.index({ riskLevel: 1, status: 1 });

// Generate screening ID before saving
ScreeningResultSchema.pre('save', async function() {
  if (!this.screeningId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.models.ScreeningResult?.countDocuments({
      screenedAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    }) || 0;
    this.screeningId = `SCR-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
});

export default mongoose.models.ScreeningResult || mongoose.model<IScreeningResult>('ScreeningResult', ScreeningResultSchema);
