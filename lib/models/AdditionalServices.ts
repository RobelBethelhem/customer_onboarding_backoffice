import mongoose, { Schema, Document } from 'mongoose';

// A service customers can ask for with their new account (e.g. Mobile Banking). After the account
// is opened, the branch Personal Banker sets it up and notifies the customer by SMS.
export interface IAdditionalService {
  id: string;                  // stable key the web app sends and the application stores, e.g. 'mobile_banking'
  name: string;
  summary: string;             // one line under the name
  details: string[];           // "What does this mean?" points
  icon: string;                // SERVICE_ICON_KEYS (lib/serviceIcons.ts)
  termsTitle: string;
  termsText: string;           // '' = no terms; otherwise the customer must accept them to choose the service
  termsVersion: number;        // goes up by one each time the terms text changes
  termsUpdatedAt: Date | null;
  active: boolean;
}

// Single document (_id 'default'): the whole catalog, services in display order
export interface IAdditionalServiceSettings extends Omit<Document, '_id'> {
  _id: string;
  services: IAdditionalService[];
  updatedBy?: string;
  updatedAt: Date;
}

const AdditionalServiceSchema = new Schema<IAdditionalService>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  summary: { type: String, default: '' },
  details: { type: [String], default: [] },
  icon: { type: String, default: 'star' },
  termsTitle: { type: String, default: '' },
  termsText: { type: String, default: '' },
  termsVersion: { type: Number, default: 0 },
  termsUpdatedAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
}, { _id: false });

const AdditionalServiceSettingsSchema = new Schema<IAdditionalServiceSettings>({
  _id: { type: String, default: 'default' },
  services: { type: [AdditionalServiceSchema], default: [] },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.AdditionalServiceSettings ||
  mongoose.model<IAdditionalServiceSettings>('AdditionalServiceSettings', AdditionalServiceSettingsSchema);
