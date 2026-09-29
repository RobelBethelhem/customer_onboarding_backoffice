import mongoose, { Schema, Document } from 'mongoose';

// One branch of the directory the admin maintains (Settings → Branches)
export interface IBranch {
  branchName: string;
  conventionalCode: string;  // code customers and staff use, e.g. '164'
  ifbCode: string;           // FlexCube branch for interest-free accounts, e.g. '664' ('' = none yet)
  branchType: 'Branch' | 'Sub-branch';
  category: 'City' | 'Outline';
  latitude: number | null;   // for "nearest branch" in the web app
  longitude: number | null;
  active: boolean;           // shown to applicants in the web app
}

// Kept for code that only needs the code pair
export type IIfbBranchMapping = Pick<IBranch, 'conventionalCode' | 'ifbCode' | 'branchName'>;

// Single document (_id 'default') holding the whole branch directory.
// version 1 = IFB code table only (Sep 2026); version 2 = full directory.
export interface IIfbBranchSettings extends Omit<Document, '_id'> {
  _id: string;
  version: number;
  mappings: IBranch[];
  updatedBy?: string;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>({
  branchName: { type: String, default: '' },
  conventionalCode: { type: String, required: true },
  ifbCode: { type: String, default: '' },
  branchType: { type: String, enum: ['Branch', 'Sub-branch'], default: 'Branch' },
  category: { type: String, enum: ['City', 'Outline'], default: 'City' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  active: { type: Boolean, default: true },
}, { _id: false });

const IfbBranchSettingsSchema = new Schema<IIfbBranchSettings>({
  _id: { type: String, default: 'default' },
  version: { type: Number, default: 1 },
  mappings: { type: [BranchSchema], default: [] },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.IfbBranchSettings ||
  mongoose.model<IIfbBranchSettings>('IfbBranchSettings', IfbBranchSettingsSchema);
