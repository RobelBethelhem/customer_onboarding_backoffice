import mongoose, { Document, Schema, Model } from 'mongoose';

export type WorkflowMode = 'auto' | 'manual';

export interface IWorkflowSettings extends Omit<Document, '_id'> {
  _id: string;
  mode: WorkflowMode;
  autoApprovalEnabled: boolean;
  minFaceMatchScore: number;
  requireManualReviewAbove: number;
  notifyOnAutoApproval: boolean;
  notifyOnManualRequired: boolean;
  // FlexCube Core Banking SOAP Configuration
  flexcubeEnabled: boolean;
  useProductAccountClass: boolean; // open accounts with the catalog's class code (ZDAC, DBSV…) instead of SPRI
  // Interest-free (IFB) accounts are opened through FCUBSIAService → CreateIACustAcc
  flexcubeIaServiceUrl: string;    // '' = the Account Service URL with FCUBSIAService
  flexcubeIfbAccountClass: string; // IFB account class while useProductAccountClass is off (WCSA)
  flexcubeIfbAccountCode: string;  // its account-number code: ACC template BRN + code + XXXXXXXXXX (126)
  flexcubeCustomerServiceUrl: string;
  flexcubeAccountServiceUrl: string;
  flexcubeUserId: string;
  flexcubeSource: string;
  flexcubeBranch: string;
  flexcubeTimeout: number;
  // Legacy (kept for backward compat)
  flexcubeEndpoint: string;
  updatedAt: Date;
  updatedBy: string;
}

const WorkflowSettingsSchema = new Schema<IWorkflowSettings>({
  _id: { type: String, default: 'default' },
  mode: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'manual',
  },
  autoApprovalEnabled: {
    type: Boolean,
    default: false,
  },
  minFaceMatchScore: {
    type: Number,
    default: 85,
    min: 50,
    max: 100,
  },
  requireManualReviewAbove: {
    type: Number,
    default: 100000,
  },
  notifyOnAutoApproval: {
    type: Boolean,
    default: true,
  },
  notifyOnManualRequired: {
    type: Boolean,
    default: true,
  },
  // FlexCube Core Banking SOAP Configuration
  useProductAccountClass: {
    type: Boolean,
    default: false,
  },
  flexcubeIaServiceUrl: {
    type: String,
    default: '',
  },
  flexcubeIfbAccountClass: {
    type: String,
    default: 'WCSA',
  },
  flexcubeIfbAccountCode: {
    type: String,
    default: '126',
  },
  flexcubeEnabled: {
    type: Boolean,
    default: true,
  },
  flexcubeCustomerServiceUrl: {
    type: String,
    default: 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService',
  },
  flexcubeAccountServiceUrl: {
    type: String,
    default: 'http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService',
  },
  flexcubeUserId: {
    type: String,
    default: 'FYDA_USR',
  },
  flexcubeSource: {
    type: String,
    default: 'EXTFYDA',
  },
  flexcubeBranch: {
    type: String,
    default: '103',
  },
  flexcubeTimeout: {
    type: Number,
    default: 30000,
  },
  // Legacy endpoint (kept for backward compat)
  flexcubeEndpoint: {
    type: String,
    default: 'http://localhost:5000/api/flexcube/create-customer',
  },
  updatedBy: {
    type: String,
    default: 'system',
  },
}, {
  timestamps: true,
  _id: false,
});

// Default settings
export const defaultWorkflowSettings: Partial<IWorkflowSettings> = {
  _id: 'default',
  mode: 'manual',
  autoApprovalEnabled: false,
  minFaceMatchScore: 85,
  requireManualReviewAbove: 100000,
  notifyOnAutoApproval: true,
  notifyOnManualRequired: true,
  flexcubeEnabled: true,
  useProductAccountClass: false,
  flexcubeIaServiceUrl: '',
  flexcubeIfbAccountClass: 'WCSA',
  flexcubeIfbAccountCode: '126',
  flexcubeCustomerServiceUrl: 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService',
  flexcubeAccountServiceUrl: 'http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService',
  flexcubeUserId: 'FYDA_USR',
  flexcubeSource: 'EXTFYDA',
  flexcubeBranch: '103',
  flexcubeTimeout: 30000,
  flexcubeEndpoint: 'http://localhost:5000/api/flexcube/create-customer',
  updatedBy: 'system',
};

let WorkflowSettings: Model<IWorkflowSettings>;

try {
  WorkflowSettings = mongoose.model<IWorkflowSettings>('WorkflowSettings');
} catch {
  WorkflowSettings = mongoose.model<IWorkflowSettings>('WorkflowSettings', WorkflowSettingsSchema);
}

export default WorkflowSettings;
