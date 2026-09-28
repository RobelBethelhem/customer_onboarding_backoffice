import mongoose, { Schema, Document } from 'mongoose';

// Sanction types
export type SanctionType = 'SANCTIONS' | 'PEP' | 'WATCHLIST' | 'ADVERSE_MEDIA' | 'OTHER';
export type SanctionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'UNDER_REVIEW';
export type MatchStrength = 'EXACT' | 'STRONG' | 'MEDIUM' | 'WEAK';

// Name alias interface
export interface INameAlias {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
  script?: string; // 'LATIN', 'AMHARIC', 'ARABIC', etc.
}

// Identifier interface (passport, national ID, etc.)
export interface IIdentifier {
  type: string; // 'PASSPORT', 'NATIONAL_ID', 'TAX_ID', 'UIN', etc.
  value: string;
  country?: string;
  issuedDate?: Date;
  expiryDate?: Date;
}

// Address interface
export interface IAddress {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
}

// Main Sanction Entry interface
export interface ISanctionEntry extends Document {
  // Primary identifiers
  entryId: string; // Unique ID for this entry
  sourceId: string; // Reference to the source list
  sourceEntryId?: string; // Original ID from the source

  // Name fields - primary
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  fullNameAmharic?: string;

  // Name aliases (for matching)
  aliases: INameAlias[];

  // Personal info
  dateOfBirth?: Date;
  placeOfBirth?: string;
  nationality?: string;
  gender?: 'male' | 'female' | 'unknown';

  // Identifiers
  identifiers: IIdentifier[];

  // Addresses
  addresses: IAddress[];

  // Sanction details
  sanctionType: SanctionType;
  status: SanctionStatus;

  // Reason and details
  reason?: string;
  programs?: string[]; // e.g., ['SDGT', 'IRAN', 'SYRIA']
  remarks?: string;

  // Dates
  listedDate?: Date;
  expiryDate?: Date;
  lastUpdated: Date;

  // PEP-specific fields
  pepPosition?: string;
  pepCountry?: string;
  pepStartDate?: Date;
  pepEndDate?: Date;

  // Risk scoring
  riskScore?: number; // 0-100

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;

  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

// Schema for name aliases
const NameAliasSchema = new Schema<INameAlias>({
  firstName: { type: String },
  middleName: { type: String },
  lastName: { type: String },
  fullName: { type: String },
  script: { type: String, default: 'LATIN' },
}, { _id: false });

// Schema for identifiers
const IdentifierSchema = new Schema<IIdentifier>({
  type: { type: String, required: true },
  value: { type: String, required: true },
  country: { type: String },
  issuedDate: { type: Date },
  expiryDate: { type: Date },
}, { _id: false });

// Schema for addresses
const AddressSchema = new Schema<IAddress>({
  street: { type: String },
  city: { type: String },
  region: { type: String },
  country: { type: String },
  postalCode: { type: String },
}, { _id: false });

// Main schema
const SanctionEntrySchema = new Schema<ISanctionEntry>({
  entryId: { type: String, required: true, unique: true },
  sourceId: { type: String, required: true },
  sourceEntryId: { type: String },

  firstName: { type: String, required: true, index: true },
  middleName: { type: String, index: true },
  lastName: { type: String, required: true, index: true },
  fullName: { type: String, required: true, index: true },
  fullNameAmharic: { type: String, index: true },

  aliases: [NameAliasSchema],

  dateOfBirth: { type: Date },
  placeOfBirth: { type: String },
  nationality: { type: String },
  gender: { type: String, enum: ['male', 'female', 'unknown'] },

  identifiers: [IdentifierSchema],
  addresses: [AddressSchema],

  sanctionType: {
    type: String,
    enum: ['SANCTIONS', 'PEP', 'WATCHLIST', 'ADVERSE_MEDIA', 'OTHER'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'EXPIRED', 'UNDER_REVIEW'],
    default: 'ACTIVE',
    index: true
  },

  reason: { type: String },
  programs: [{ type: String }],
  remarks: { type: String },

  listedDate: { type: Date },
  expiryDate: { type: Date },
  lastUpdated: { type: Date, default: Date.now },

  pepPosition: { type: String },
  pepCountry: { type: String },
  pepStartDate: { type: Date },
  pepEndDate: { type: Date },

  riskScore: { type: Number, min: 0, max: 100 },

  createdBy: { type: String },
  updatedBy: { type: String },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: String },
}, {
  timestamps: true,
});

// Text index for full-text search
SanctionEntrySchema.index({
  firstName: 'text',
  middleName: 'text',
  lastName: 'text',
  fullName: 'text',
  fullNameAmharic: 'text',
  'aliases.firstName': 'text',
  'aliases.lastName': 'text',
  'aliases.fullName': 'text',
});

// Compound indexes for common queries
SanctionEntrySchema.index({ status: 1, sanctionType: 1 });
SanctionEntrySchema.index({ isDeleted: 1, status: 1 });
SanctionEntrySchema.index({ sourceId: 1, sourceEntryId: 1 });

// Generate entry ID before saving (if not already set)
SanctionEntrySchema.pre('save', async function() {
  if (!this.entryId) {
    const count = await mongoose.models.SanctionEntry?.countDocuments() || 0;
    this.entryId = `SAN-${String(count + 1).padStart(6, '0')}`;
  }
});

export default mongoose.models.SanctionEntry || mongoose.model<ISanctionEntry>('SanctionEntry', SanctionEntrySchema);
