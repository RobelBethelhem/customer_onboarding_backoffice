import mongoose, { Schema, Document } from 'mongoose';

// Account opening for an organization, submitted from the web app by its representative.
// Every signatory and director verifies with Fayda (the representative in the wizard, the others
// through an SMS link); KYC then checks the documents and approves.
export type CorporateStatus =
  | 'awaiting_verification' // waiting for people to verify with Fayda
  | 'pending'               // everyone verified — waiting for KYC
  | 'in_review'
  | 'returned'              // sent back to the applicant to replace documents
  | 'escalated'             // screening match — Senior Approver decides
  | 'approving'             // FlexCube calls in progress
  | 'approved'
  | 'rejected';

export type CorporateRole = 'signatory' | 'director';
export type SigningRule = 'single' | 'any_two' | 'all' | 'other';

export interface ICorporateAddress {
  city: string;
  subCity: string;
  woreda: string;
  houseNumber: string;
}

export interface ICorporateOrganization {
  name: string;
  categoryId: string;
  categoryName: string;
  subtypeId: string;
  subtypeName: string;
  registrationNumber: string;
  registrationIssuedBy: string;
  establishmentDate: string;
  tradeLicenseNumber: string;
  tin: string;
  vatNumber: string;
  industry: string;
  otherIndustry: string;
  sourceOfFunds: string;
  otherSourceOfFunds: string;
  annualIncome: number;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  poBox: string;
  registeredAddress: ICorporateAddress;
  sameCorrespondenceAddress: boolean;
  correspondenceAddress: ICorporateAddress;
}

export interface IReview {
  status: 'pending' | 'accepted' | 'rejected';
  note?: string;
  by?: string;
  at?: Date;
}

export interface ICorporateFileRef {
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

// Identity as verified with Fayda — taken from the Fayda backend's signed eKYC result, never from
// what the browser says
export interface IPersonVerification {
  status: 'pending' | 'verified';
  verifiedAt?: Date;
  fan?: string;
  uin?: string;
  fullName?: string;
  fullNameAmharic?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  region?: string;
  zone?: string;
  woreda?: string;
  photo?: string;
  selfie?: string;
  faceVerification?: Record<string, any>;
  livenessFrames?: { action: string; label: string; image: string }[];
  faceVideoId?: string;
  nameMatchScore?: number;      // name the representative entered vs the Fayda name
  screening?: Record<string, any>;
}

// How a person other than the applicant verified: on the applicant's phone, with them, or on
// their own phone from the SMS link
export type VerifiedVia = 'with_applicant' | 'link';

export interface ICorporateInvite { tokenHash: string; sentAt: Date; sentCount: number; expiresAt: Date; smsSent: boolean }

export interface ICorporatePerson {
  id: string;
  fullName: string;             // as entered by the representative (the Fayda name once verified with them)
  phone: string;
  roles: CorporateRole[];
  isApplicant: boolean;
  verifiedVia?: VerifiedVia;
  invite?: ICorporateInvite;
  verification: IPersonVerification;
  signature?: ICorporateFileRef & { review: IReview; previous?: ICorporateFileRef[] };
}

export interface ICorporateDocument {
  docId: string;
  name: string;
  required: boolean;
  file?: ICorporateFileRef;
  previousFiles: ICorporateFileRef[];
  review: IReview;
}

export interface ICorporateApplication extends Document {
  applicationId: string;
  status: CorporateStatus;
  accessKey: string;            // the representative's key for the status page (not returned to staff)
  organization: ICorporateOrganization;
  branch: string;
  branchCode: string;
  conventionalBranchCode?: string;
  accountTypeId: string;
  accountTypeName: string;
  accountClassCode: string;
  accountClassName: string;
  tierId: string;
  isIFB: boolean;
  signingRule: SigningRule;
  signingRuleOther: string;
  promotionType: string;
  people: ICorporatePerson[];
  documents: ICorporateDocument[];
  screening: Record<string, any>;
  complianceHold: boolean;
  history: { at: Date; by: string; action: string; note?: string }[];
  submittedAt: Date;
  verifiedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  returnReason?: string;
  returnedAt?: Date;
  returnedBy?: string;
  rejectionReason?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  escalationReason?: string;
  escalatedAt?: Date;
  escalatedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  approvalStartedAt?: Date;     // FlexCube calls started (status 'approving')
  approvalFrom?: CorporateStatus; // status to go back to if they fail
  cifNumber?: string;
  accountNumber?: string;
  flexcubeMessage?: string;
  resubmissionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<ICorporateAddress>({
  city: { type: String, default: '' },
  subCity: { type: String, default: '' },
  woreda: { type: String, default: '' },
  houseNumber: { type: String, default: '' },
}, { _id: false });

const ReviewSchema = new Schema<IReview>({
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  note: { type: String, default: '' },
  by: { type: String, default: '' },
  at: { type: Date },
}, { _id: false });

const FileRefSchema = new Schema<ICorporateFileRef>({
  fileId: { type: String, required: true },
  fileName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const SignatureSchema = new Schema({
  fileId: { type: String, required: true },
  fileName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
  review: { type: ReviewSchema, default: () => ({ status: 'pending' }) },
  previous: { type: [FileRefSchema], default: [] },
}, { _id: false });

export const VerificationSchema = new Schema<IPersonVerification>({
  status: { type: String, enum: ['pending', 'verified'], default: 'pending' },
  verifiedAt: { type: Date },
  fan: { type: String },
  uin: { type: String },
  fullName: { type: String },
  fullNameAmharic: { type: String },
  dateOfBirth: { type: String },
  gender: { type: String },
  phone: { type: String },
  email: { type: String },
  region: { type: String },
  zone: { type: String },
  woreda: { type: String },
  photo: { type: String },
  selfie: { type: String },
  faceVerification: { type: Schema.Types.Mixed },
  livenessFrames: { type: [{ action: String, label: String, image: String, _id: false }], default: [] },
  faceVideoId: { type: String },
  nameMatchScore: { type: Number },
  screening: { type: Schema.Types.Mixed },
}, { _id: false });

export const InviteSchema = new Schema<ICorporateInvite>({
  tokenHash: { type: String, default: '' },
  sentAt: { type: Date },
  sentCount: { type: Number, default: 0 },
  expiresAt: { type: Date },
  smsSent: { type: Boolean, default: false },
}, { _id: false });

const PersonSchema = new Schema<ICorporatePerson>({
  id: { type: String, required: true },
  fullName: { type: String, required: true },
  phone: { type: String, default: '' },
  roles: { type: [String], enum: ['signatory', 'director'], default: [] },
  isApplicant: { type: Boolean, default: false },
  verifiedVia: { type: String, enum: ['with_applicant', 'link', ''], default: '' },
  invite: { type: InviteSchema },
  verification: { type: VerificationSchema, default: () => ({ status: 'pending' }) },
  signature: { type: SignatureSchema },
}, { _id: false });

const DocumentSchema = new Schema<ICorporateDocument>({
  docId: { type: String, required: true },
  name: { type: String, required: true },
  required: { type: Boolean, default: true },
  file: { type: FileRefSchema },
  previousFiles: { type: [FileRefSchema], default: [] },
  review: { type: ReviewSchema, default: () => ({ status: 'pending' }) },
}, { _id: false });

const OrganizationSchema = new Schema<ICorporateOrganization>({
  name: { type: String, required: true },
  categoryId: { type: String, required: true },
  categoryName: { type: String, default: '' },
  subtypeId: { type: String, default: '' },
  subtypeName: { type: String, default: '' },
  registrationNumber: { type: String, default: '' },
  registrationIssuedBy: { type: String, default: '' },
  establishmentDate: { type: String, default: '' },
  tradeLicenseNumber: { type: String, default: '' },
  tin: { type: String, default: '' },
  vatNumber: { type: String, default: '' },
  industry: { type: String, default: '' },
  otherIndustry: { type: String, default: '' },
  sourceOfFunds: { type: String, default: '' },
  otherSourceOfFunds: { type: String, default: '' },
  annualIncome: { type: Number, default: 0 },
  phone: { type: String, default: '' },
  mobile: { type: String, default: '' },
  fax: { type: String, default: '' },
  email: { type: String, default: '' },
  poBox: { type: String, default: '' },
  registeredAddress: { type: AddressSchema, default: () => ({}) },
  sameCorrespondenceAddress: { type: Boolean, default: true },
  correspondenceAddress: { type: AddressSchema, default: () => ({}) },
}, { _id: false });

const CorporateApplicationSchema = new Schema<ICorporateApplication>({
  applicationId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['awaiting_verification', 'pending', 'in_review', 'returned', 'escalated', 'approving', 'approved', 'rejected'],
    default: 'awaiting_verification',
  },
  accessKey: { type: String, required: true, select: false },
  organization: { type: OrganizationSchema, required: true },
  branch: { type: String, default: '' },
  branchCode: { type: String, default: '' },
  conventionalBranchCode: { type: String, default: '' },
  accountTypeId: { type: String, default: '' },
  accountTypeName: { type: String, default: '' },
  accountClassCode: { type: String, default: '' },
  accountClassName: { type: String, default: '' },
  tierId: { type: String, default: '' },
  isIFB: { type: Boolean, default: false },
  signingRule: { type: String, enum: ['single', 'any_two', 'all', 'other'], default: 'single' },
  signingRuleOther: { type: String, default: '' },
  promotionType: { type: String, default: 'Walk in customer' },
  people: { type: [PersonSchema], default: [] },
  documents: { type: [DocumentSchema], default: [] },
  screening: { type: Schema.Types.Mixed, default: () => ({}) },
  complianceHold: { type: Boolean, default: false },
  history: { type: [{ at: Date, by: String, action: String, note: String, _id: false }], default: [] },
  submittedAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  returnReason: { type: String },
  returnedAt: { type: Date },
  returnedBy: { type: String },
  rejectionReason: { type: String },
  rejectedAt: { type: Date },
  rejectedBy: { type: String },
  escalationReason: { type: String },
  escalatedAt: { type: Date },
  escalatedBy: { type: String },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  approvalStartedAt: { type: Date },
  approvalFrom: { type: String },
  cifNumber: { type: String },
  accountNumber: { type: String },
  flexcubeMessage: { type: String },
  resubmissionCount: { type: Number, default: 0 },
}, { timestamps: true });

CorporateApplicationSchema.index({ status: 1, createdAt: -1 });
CorporateApplicationSchema.index({ 'people.invite.tokenHash': 1 });

export default mongoose.models.CorporateApplication ||
  mongoose.model<ICorporateApplication>('CorporateApplication', CorporateApplicationSchema);
