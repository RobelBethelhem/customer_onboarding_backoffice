import mongoose, { Schema, Document } from 'mongoose';

export interface IIfbBranchMapping {
  conventionalCode: string;  // branch code customers and staff use, e.g. '164'
  ifbCode: string;           // FlexCube branch for interest-free accounts, e.g. '664'
  branchName?: string;
}

// Single document (_id 'default') holding the whole conventional → IFB branch table
export interface IIfbBranchSettings extends Omit<Document, '_id'> {
  _id: string;
  mappings: IIfbBranchMapping[];
  updatedBy?: string;
  updatedAt: Date;
}

const MappingSchema = new Schema<IIfbBranchMapping>({
  conventionalCode: { type: String, required: true },
  ifbCode: { type: String, required: true },
  branchName: { type: String, default: '' },
}, { _id: false });

const IfbBranchSettingsSchema = new Schema<IIfbBranchSettings>({
  _id: { type: String, default: 'default' },
  mappings: { type: [MappingSchema], default: [] },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.IfbBranchSettings ||
  mongoose.model<IIfbBranchSettings>('IfbBranchSettings', IfbBranchSettingsSchema);
