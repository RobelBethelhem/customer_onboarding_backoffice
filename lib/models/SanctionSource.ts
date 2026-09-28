import mongoose, { Schema, Document } from 'mongoose';

export type SourceType = 'OFAC' | 'UN' | 'EU' | 'LOCAL' | 'PEP' | 'INTERNAL' | 'OTHER';

export interface ISanctionSource extends Document {
  sourceId: string;
  name: string;
  shortName: string;
  type: SourceType;
  description?: string;

  // Source metadata
  country?: string;
  website?: string;
  updateFrequency?: string; // 'DAILY', 'WEEKLY', 'MONTHLY', etc.

  // Status
  isActive: boolean;
  priority: number; // Higher priority sources are checked first

  // Statistics
  totalEntries: number;
  activeEntries: number;
  lastImportDate?: Date;
  lastImportCount?: number;

  // Settings
  autoUpdate: boolean;
  matchingThreshold: number; // 0-100, minimum score to consider a match
  riskScore: number; // 0-100, KYC risk weight applied to a customer when matched on this list

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

const SanctionSourceSchema = new Schema<ISanctionSource>({
  sourceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  type: {
    type: String,
    enum: ['OFAC', 'UN', 'EU', 'LOCAL', 'PEP', 'INTERNAL', 'OTHER'],
    required: true,
  },
  description: { type: String },

  country: { type: String },
  website: { type: String },
  updateFrequency: { type: String },

  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 50 },

  totalEntries: { type: Number, default: 0 },
  activeEntries: { type: Number, default: 0 },
  lastImportDate: { type: Date },
  lastImportCount: { type: Number },

  autoUpdate: { type: Boolean, default: false },
  matchingThreshold: { type: Number, default: 80, min: 0, max: 100 },
  riskScore: { type: Number, default: 50, min: 0, max: 100 },

  createdBy: { type: String },
}, {
  timestamps: true,
});

// Pre-defined sources to seed
export const defaultSources: Partial<ISanctionSource>[] = [
  {
    sourceId: 'OFAC',
    name: 'Office of Foreign Assets Control',
    shortName: 'OFAC',
    type: 'OFAC',
    country: 'USA',
    website: 'https://sanctionssearch.ofac.treas.gov',
    priority: 100,
    matchingThreshold: 85,
    riskScore: 100,
  },
  {
    sourceId: 'UN_SC',
    name: 'United Nations Security Council',
    shortName: 'UN',
    type: 'UN',
    website: 'https://www.un.org/securitycouncil/sanctions',
    priority: 95,
    matchingThreshold: 85,
    riskScore: 100,
  },
  {
    sourceId: 'EU_SANCTIONS',
    name: 'European Union Sanctions',
    shortName: 'EU',
    type: 'EU',
    website: 'https://www.sanctionsmap.eu',
    priority: 90,
    matchingThreshold: 85,
    riskScore: 95,
  },
  {
    sourceId: 'ETH_LOCAL',
    name: 'Ethiopia Local / NBE-Banned List',
    shortName: 'ETH',
    type: 'LOCAL',
    country: 'Ethiopia',
    description: 'NBE-banned and local Ethiopian sanctions list',
    priority: 100,
    matchingThreshold: 80,
    riskScore: 95,
  },
  {
    sourceId: 'PEP_LIST',
    name: 'Politically Exposed Persons',
    shortName: 'PEP',
    type: 'PEP',
    description: 'List of politically exposed persons in Ethiopia and internationally',
    priority: 85,
    matchingThreshold: 75,
    riskScore: 50,
  },
  {
    sourceId: 'INTERNAL',
    name: 'Internal / Terminated-Customer Watchlist',
    shortName: 'INT',
    type: 'INTERNAL',
    description: 'Bank internal watchlist for terminated customers and suspicious activities',
    priority: 100,
    matchingThreshold: 90,
    riskScore: 85,
  },
];

export default mongoose.models.SanctionSource || mongoose.model<ISanctionSource>('SanctionSource', SanctionSourceSchema);
