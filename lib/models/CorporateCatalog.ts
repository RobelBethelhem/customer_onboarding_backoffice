import mongoose, { Schema, Document } from 'mongoose';

// A document an organization uploads, e.g. "Trade license". `subtypes` limits it to some
// sub-types of its category (MoA/AoA only for PLC and share companies); empty = every sub-type.
export interface ICorporateDocumentType {
  id: string;
  name: string;
  description: string;
  required: boolean;
  subtypes: string[];
  active: boolean;
}

export interface ICorporateSubtype {
  id: string;
  name: string;
  active: boolean;
}

// An account class (Account Products, for organizations) this kind of organization can open;
// `subtypes` limits it to some sub-types, like documents (empty = every sub-type)
export interface ICorporateAccountRule {
  classCode: string;
  subtypes: string[];
}

// A kind of organization (KYC procedure 2.3.2–2.3.6), e.g. "Business organization"
export interface ICorporateCategory {
  id: string;
  name: string;
  description: string;
  subtypes: ICorporateSubtype[];
  documents: ICorporateDocumentType[];
  // Which accounts it can open: off (missing) = every account for organizations; on = only `accounts`
  accountsLimited?: boolean;
  accounts?: ICorporateAccountRule[];
  active: boolean;
}

export interface ICorporateRules {
  maxPeople: number;          // signatories + directors on one application
  maxFileMb: number;          // per uploaded file
  signatureRequired: boolean; // a specimen signature for each signatory
  inviteValidDays: number;    // how long an SMS verification link works
}

// Single document (_id 'default'): categories in display order, plus the rules
export interface ICorporateCatalogSettings extends Omit<Document, '_id'> {
  _id: string;
  categories: ICorporateCategory[];
  rules: ICorporateRules;
  updatedBy?: string;
  updatedAt: Date;
}

const DocumentTypeSchema = new Schema<ICorporateDocumentType>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  required: { type: Boolean, default: true },
  subtypes: { type: [String], default: [] },
  active: { type: Boolean, default: true },
}, { _id: false });

const SubtypeSchema = new Schema<ICorporateSubtype>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
}, { _id: false });

const AccountRuleSchema = new Schema<ICorporateAccountRule>({
  classCode: { type: String, required: true },
  subtypes: { type: [String], default: [] },
}, { _id: false });

const CategorySchema = new Schema<ICorporateCategory>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  subtypes: { type: [SubtypeSchema], default: [] },
  documents: { type: [DocumentTypeSchema], default: [] },
  accountsLimited: { type: Boolean, default: false },
  accounts: { type: [AccountRuleSchema], default: [] },
  active: { type: Boolean, default: true },
}, { _id: false });

const RulesSchema = new Schema<ICorporateRules>({
  maxPeople: { type: Number, default: 10 },
  maxFileMb: { type: Number, default: 5 },
  signatureRequired: { type: Boolean, default: true },
  inviteValidDays: { type: Number, default: 14 },
}, { _id: false });

const CorporateCatalogSchema = new Schema<ICorporateCatalogSettings>({
  _id: { type: String, default: 'default' },
  categories: { type: [CategorySchema], default: [] },
  rules: { type: RulesSchema, default: () => ({}) },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.CorporateCatalogSettings ||
  mongoose.model<ICorporateCatalogSettings>('CorporateCatalogSettings', CorporateCatalogSchema);
