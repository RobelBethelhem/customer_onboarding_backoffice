import mongoose, { Schema, Document } from 'mongoose';
import {
  VerificationSchema, InviteSchema, CorporateRole, ICorporateInvite, IPersonVerification, VerifiedVia,
} from '@/lib/models/CorporateApplication';

// A signatory or director verifying while the representative is still filling in the business
// account application: on the representative's phone (with them), or on their own phone from an
// SMS link sent right away — the representative sees the tick live. On submission the application
// takes these records over (a link not used yet keeps working) and they are deleted.
export interface ICorporateVerification extends Document {
  verificationId: string;
  keyHash: string;              // the representative's key for this record (status, resend, cancel, submit)
  groupId: string;              // one application being filled in (chosen by the web app)
  mode: VerifiedVia;
  roles: CorporateRole[];
  phone: string;
  enteredName: string;          // link: the name the representative gave (for the SMS), may be empty
  applicantName: string;        // the representative, as verified with Fayda
  applicantUin: string;         // nobody verifies with the representative's own Fayda ID
  organizationName: string;
  categoryName: string;
  invite?: ICorporateInvite;
  verification: IPersonVerification;
  applicationId: string;        // set while an application takes the record over
  cancelled: boolean;           // the representative removed the person (the link stops working)
  expiresAt?: Date | null;      // records no application took are deleted (TTL)
  createdAt: Date;
  updatedAt: Date;
}

const CorporateVerificationSchema = new Schema<ICorporateVerification>({
  verificationId: { type: String, required: true, unique: true },
  keyHash: { type: String, required: true },
  groupId: { type: String, required: true, index: true },
  mode: { type: String, enum: ['with_applicant', 'link'], required: true },
  roles: { type: [String], enum: ['signatory', 'director'], default: [] },
  phone: { type: String, default: '' },
  enteredName: { type: String, default: '' },
  applicantName: { type: String, default: '' },
  applicantUin: { type: String, default: '' },
  organizationName: { type: String, default: '' },
  categoryName: { type: String, default: '' },
  invite: { type: InviteSchema },
  verification: { type: VerificationSchema, default: () => ({ status: 'pending' }) },
  applicationId: { type: String, default: '' },
  cancelled: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

CorporateVerificationSchema.index({ 'invite.tokenHash': 1 });
CorporateVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.CorporateVerification
  || mongoose.model<ICorporateVerification>('CorporateVerification', CorporateVerificationSchema);
