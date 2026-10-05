import mongoose, { Schema, Document } from 'mongoose';

export interface IVerificationPhotos {
  faceCenter?: string;
  eyeBlink?: string;
  headLeft?: string;
  headRight?: string;
  smile?: string;
}

export type CustomerChannel = 'mobile_app' | 'web' | 'whatsapp' | 'telegram' | 'superapp' | 'other';

// FlexCube lookup of the CIF an existing customer gave us, done at submission
export interface IExistingCifCheck {
  verified: boolean;         // FlexCube returned the CIF
  fullName?: string;         // name on the CIF in FlexCube
  phone?: string;
  branch?: string;
  nameMatchScore?: number;   // 0-100 similarity between the CIF name and the Fayda name
  phoneMatch?: boolean;      // CIF mobile number matches the Fayda phone
  message?: string;
  checkedAt?: Date;
}

// Additional services (Mobile Banking, Internet Banking, Debit Card) set up by the branch Personal Banker
export interface ICompletedService {
  service: string;
  completedAt: Date;
  completedBy: string;
}

// A requested service as it was when the application was submitted (Products & Services catalog):
// its name, and which version of its terms and conditions the customer accepted
export interface IRequestedServiceDetail {
  id: string;
  name: string;
  icon?: string;
  termsRequired: boolean;
  termsTitle?: string;
  termsVersion: number;          // version in force at submission
  termsAcceptedVersion: number;  // version the customer accepted (0 = not accepted)
  termsAcceptedAt?: Date;
}

// Frames from the web app's face check (open mouth, head turn) — shown to KYC with the selfie
export interface ILivenessFrame {
  action: string;   // 'mouth' | 'turn'
  label: string;
  image: string;    // base64 JPEG
}

export interface IServiceNotification {
  services: string[];
  message: string;
  smsSent: boolean;
  sentAt: Date;
  sentBy: string;
}

export interface ICustomer extends Document {
  customerId: string;
  fullName: string;
  fullNameAmharic?: string;
  email?: string;
  phone: string;
  accountType: string;
  accountTypeId?: string;
  accountTypeName?: string;
  tierId?: string;
  tierName?: string;
  tierInterestRate?: number;
  accountClassCode?: string;  // catalog code, e.g. 'DBSV' (Account Products page)
  accountClassName?: string;
  isIFB?: boolean;            // interest-free product
  status: 'pending' | 'verified' | 'approved' | 'rejected' | 'auto_approved' | 'escalated' | 'returned' | 'in_review';
  channel: CustomerChannel;
  faceVideoId?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  branch: string;
  branchCode?: string;
  conventionalBranchCode?: string; // the branch the applicant chose, when an IFB account moved to its IFB code
  uin?: string;
  fcn?: string;
  gender?: 'male' | 'female';
  dateOfBirth?: string;
  region?: string;
  zone?: string;
  woreda?: string;
  kebele?: string;
  houseNumber?: string;
  occupation?: string;
  otherOccupation?: string;
  industry?: string;
  otherIndustry?: string;
  wealthSource?: string;
  otherWealthSource?: string;
  annualIncome?: number;
  initialDeposit?: number;
  motherMaidenName?: string;
  maritalStatus?: string;
  marriageCertificatePhoto?: string; // Marriage certificate image for married customers
  faydaPhoto?: string;
  selfiePhoto?: string;
  verificationPhotos?: IVerificationPhotos;
  faceMatchScore: number;
  customerNumber?: string;
  cifNumber?: string;
  accountNumber?: string;
  rejectionReason?: string;
  approvedBy?: string;
  rejectedBy?: string;
  // Approver workflow — return-to-applicant (UAT) and PEP second-level escalation (UAT)
  returnReason?: string;
  returnedAt?: Date;
  returnedBy?: string;
  escalationReason?: string;
  escalatedAt?: Date;
  escalatedBy?: string;
  reviewedBy?: string;       // Approver who picked up the application (status = in_review)
  reviewedAt?: Date;
  resubmissionCount?: number; // How many times the applicant has amended & resubmitted
  // Concurrency: review lock so two officers can't open/process the same request at once
  lockedBy?: string;         // display name of the officer currently holding the lock
  lockedById?: string;       // user id of the lock holder
  lockedAt?: Date;           // refreshed by heartbeat; goes stale after the TTL
  // CIF creation fields — sent to FlexCube and stored for reference
  promotionType?: string;            // How customer heard about us (e.g., 'Walk in customer', 'FACEBOOK')
  customerRiskRating?: string;       // KYC risk rating (default: 'LOW')
  customerSegmentation?: string;     // Customer segment (default: 'RETAIL CUSTOMER')
  maintFeeWaived?: string;           // Maintenance fee waived (default: 'Y')
  slaEnable?: string;                // SLA enabled (default: 'N')
  leadRm?: string;                   // Lead RM (default: 'NA')
  currencyRedemptionPurpose?: string; // Currency redemption purpose (default: 'Y')
  sanctionListStatus?: string;       // Is in sanction list (default: 'N')
  taxIdentity?: string;              // Tax Identity Number (TIN)
  politicallyExposedPerson?: string; // PEP status (default: 'NO')
  customerType?: string;             // Customer type (default: 'Individual')
  idType?: string;                   // ID type (default: 'National ID')
  nationality?: string;              // Nationality (default: 'ETHIOPIA')
  // Maker / Checker tracking
  maker?: string;                      // Who submitted the application (e.g., 'WEB_USER', 'MOBILE_USER', user email)
  makerTimestamp?: Date;               // When the application was submitted
  // Referral tracking
  referralCode?: string;              // Referral code used by this customer (e.g., REF-0015678)
  // Existing customer — approval opens a new account under this CIF instead of creating a CIF
  isExistingCustomer?: boolean;
  existingCif?: string;               // 7-digit CIF entered by the applicant (or taken from their account number)
  existingAccountNumber?: string;     // 16-digit account number the applicant entered, if any
  existingCifCheck?: IExistingCifCheck;
  // Additional services requested at onboarding ('mobile_banking' | 'internet_banking' | 'debit_card')
  requestedServices?: string[];
  servicesStatus?: 'none' | 'pending' | 'completed'; // 'pending' until every requested service is set up
  completedServices?: ICompletedService[];
  serviceNotifications?: IServiceNotification[];      // SMS sent by the Personal Banker
  requestedServiceDetails?: IRequestedServiceDetail[];
  // Web app face check, done by the Fayda backend: liveness actions, anti-spoof model, face match
  // with the Fayda photo (faceMatchScore holds the similarity)
  faceVerification?: Record<string, any>;
  livenessFrames?: ILivenessFrame[];
}

// Default placeholder photo
const placeholderPhoto = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NDc0OGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBQaG90bzwvdGV4dD48L3N2Zz4=';

const VerificationPhotosSchema = new Schema<IVerificationPhotos>({
  faceCenter: { type: String, default: placeholderPhoto },
  eyeBlink: { type: String, default: placeholderPhoto },
  headLeft: { type: String, default: placeholderPhoto },
  headRight: { type: String, default: placeholderPhoto },
  smile: { type: String, default: placeholderPhoto },
}, { _id: false });

const ExistingCifCheckSchema = new Schema<IExistingCifCheck>({
  verified: { type: Boolean, default: false },
  fullName: { type: String },
  phone: { type: String },
  branch: { type: String },
  nameMatchScore: { type: Number },
  phoneMatch: { type: Boolean },
  message: { type: String },
  checkedAt: { type: Date },
}, { _id: false });

const CompletedServiceSchema = new Schema<ICompletedService>({
  service: { type: String, required: true },
  completedAt: { type: Date, required: true },
  completedBy: { type: String, default: '' },
}, { _id: false });

const ServiceNotificationSchema = new Schema<IServiceNotification>({
  services: { type: [String], default: [] },
  message: { type: String, default: '' },
  smsSent: { type: Boolean, default: false },
  sentAt: { type: Date, required: true },
  sentBy: { type: String, default: '' },
}, { _id: false });

const RequestedServiceDetailSchema = new Schema<IRequestedServiceDetail>({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  icon: { type: String, default: '' },
  termsRequired: { type: Boolean, default: false },
  termsTitle: { type: String, default: '' },
  termsVersion: { type: Number, default: 0 },
  termsAcceptedVersion: { type: Number, default: 0 },
  termsAcceptedAt: { type: Date },
}, { _id: false });

const LivenessFrameSchema = new Schema<ILivenessFrame>({
  action: { type: String, default: '' },
  label: { type: String, default: '' },
  image: { type: String, default: '' },
}, { _id: false });

const CustomerSchema = new Schema<ICustomer>({
  customerId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  fullNameAmharic: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, required: true },
  accountType: { type: String, required: true },
  accountTypeId: { type: String, default: '' },
  accountTypeName: { type: String, default: '' },
  tierId: { type: String, default: '' },
  tierName: { type: String, default: '' },
  tierInterestRate: { type: Number, default: 0 },
  accountClassCode: { type: String, default: '' },
  accountClassName: { type: String, default: '' },
  isIFB: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['pending', 'verified', 'approved', 'rejected', 'auto_approved', 'escalated', 'returned', 'in_review'],
    default: 'pending'
  },
  channel: {
    type: String,
    enum: ['mobile_app', 'web', 'whatsapp', 'telegram', 'superapp', 'other'],
    default: 'mobile_app'
  },
  faceVideoId: { type: String, default: '' },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  branch: { type: String, required: true },
  branchCode: { type: String, default: '' },
  conventionalBranchCode: { type: String, default: '' },
  uin: { type: String, default: '' },
  fcn: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', ''], default: '' },
  dateOfBirth: { type: String, default: '' },
  region: { type: String, default: '' },
  zone: { type: String, default: '' },
  woreda: { type: String, default: '' },
  kebele: { type: String, default: '' },
  houseNumber: { type: String, default: '' },
  occupation: { type: String, default: '' },
  otherOccupation: { type: String, default: '' },
  industry: { type: String, default: '' },
  otherIndustry: { type: String, default: '' },
  wealthSource: { type: String, default: '' },
  otherWealthSource: { type: String, default: '' },
  annualIncome: { type: Number, default: 0 },
  initialDeposit: { type: Number, default: 0 },
  motherMaidenName: { type: String, default: '' },
  maritalStatus: { type: String, default: '' },
  marriageCertificatePhoto: { type: String, default: '' }, // Marriage certificate for married customers
  faydaPhoto: { type: String, default: placeholderPhoto },
  selfiePhoto: { type: String, default: placeholderPhoto },
  verificationPhotos: {
    type: VerificationPhotosSchema,
    default: () => ({
      faceCenter: placeholderPhoto,
      eyeBlink: placeholderPhoto,
      headLeft: placeholderPhoto,
      headRight: placeholderPhoto,
      smile: placeholderPhoto,
    })
  },
  faceMatchScore: { type: Number, default: 0 },
  customerNumber: { type: String },
  cifNumber: { type: String },
  accountNumber: { type: String },
  rejectionReason: { type: String },
  approvedBy: { type: String },
  rejectedBy: { type: String },
  // Approver workflow — return-to-applicant (UAT) and PEP second-level escalation (UAT)
  returnReason: { type: String },
  returnedAt: { type: Date },
  returnedBy: { type: String },
  escalationReason: { type: String },
  escalatedAt: { type: Date },
  escalatedBy: { type: String },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  resubmissionCount: { type: Number, default: 0 },
  lockedBy: { type: String, default: '' },
  lockedById: { type: String, default: '' },
  lockedAt: { type: Date },
  // CIF creation fields — sent to FlexCube and stored for reference
  promotionType: { type: String, default: '' },
  customerRiskRating: { type: String, default: 'LOW' },
  customerSegmentation: { type: String, default: 'RETAIL CUSTOMER' },
  maintFeeWaived: { type: String, default: 'Y' },
  slaEnable: { type: String, default: 'N' },
  leadRm: { type: String, default: 'NA' },
  currencyRedemptionPurpose: { type: String, default: 'Y' },
  sanctionListStatus: { type: String, default: 'N' },
  taxIdentity: { type: String, default: '' },
  politicallyExposedPerson: { type: String, default: 'NO' },
  customerType: { type: String, default: 'Individual' },
  idType: { type: String, default: 'National ID' },
  nationality: { type: String, default: 'ETHIOPIA' },
  // Maker / Checker tracking
  maker: { type: String, default: '' },
  makerTimestamp: { type: Date },
  // Referral tracking
  referralCode: { type: String, default: '' },
  // Existing customer (account opened under their current CIF)
  isExistingCustomer: { type: Boolean, default: false },
  existingCif: { type: String, default: '' },
  existingAccountNumber: { type: String, default: '' },
  existingCifCheck: { type: ExistingCifCheckSchema },
  // Additional services — set up by the branch Personal Banker after the account is opened
  requestedServices: { type: [String], default: [] },
  servicesStatus: { type: String, enum: ['none', 'pending', 'completed'], default: 'none' },
  completedServices: { type: [CompletedServiceSchema], default: [] },
  serviceNotifications: { type: [ServiceNotificationSchema], default: [] },
  requestedServiceDetails: { type: [RequestedServiceDetailSchema], default: [] },
  faceVerification: { type: Schema.Types.Mixed },
  livenessFrames: { type: [LivenessFrameSchema], default: [] },
}, {
  timestamps: true,
});

// Indexes for better query performance
CustomerSchema.index({ status: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ branch: 1 });
CustomerSchema.index({ uin: 1 });
CustomerSchema.index({ channel: 1 });
CustomerSchema.index({ servicesStatus: 1, branchCode: 1 }); // Personal Banker service-request queue

export default mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
