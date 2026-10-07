import mongoose, { Schema, Document } from 'mongoose';

// An account class customers can open (e.g. "Basic Saving — Digital", code DBSV)
export interface IAccountClass {
  code: string;                 // proposed FlexCube account class code, e.g. 'DBSV'
  name: string;
  interestRate: number | null;  // % per year; null = no interest (IFB) or not stated
  minBalance: number | null;    // ETB
  maxBalance: number | null;    // ETB, for classes defined by a balance band
  remarks: string;
  productNumber: string;        // number the web app has always sent as tierId (used in the FlexCube account template)
  active: boolean;
}

// A product group shown as the first choice in the web app (e.g. "Saving Account")
export interface IAccountProduct {
  id: string;                   // stable id sent by the web app as accountTypeId
  name: string;
  description: string;
  isIFB: boolean;               // interest-free: green theme, IFB branch codes
  audience?: 'individual' | 'organization' | 'both'; // who can open it (missing = individual)
  active: boolean;
  classes: IAccountClass[];     // in display order
}

// Single document (_id 'default'): the whole catalog, products in display order
export interface IAccountProductSettings extends Omit<Document, '_id'> {
  _id: string;
  products: IAccountProduct[];
  updatedBy?: string;
  updatedAt: Date;
}

const AccountClassSchema = new Schema<IAccountClass>({
  code: { type: String, required: true },
  name: { type: String, required: true },
  interestRate: { type: Number, default: null },
  minBalance: { type: Number, default: null },
  maxBalance: { type: Number, default: null },
  remarks: { type: String, default: '' },
  productNumber: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { _id: false });

const AccountProductSchema = new Schema<IAccountProduct>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  isIFB: { type: Boolean, default: false },
  audience: { type: String, enum: ['individual', 'organization', 'both'], default: 'individual' },
  active: { type: Boolean, default: true },
  classes: { type: [AccountClassSchema], default: [] },
}, { _id: false });

const AccountProductSettingsSchema = new Schema<IAccountProductSettings>({
  _id: { type: String, default: 'default' },
  products: { type: [AccountProductSchema], default: [] },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.AccountProductSettings ||
  mongoose.model<IAccountProductSettings>('AccountProductSettings', AccountProductSettingsSchema);
