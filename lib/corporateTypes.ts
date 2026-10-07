// Business account applications as the dashboard pages see them (no mongoose, so client
// components can import it).
import type { FaceVerificationResult } from '@/lib/api';

export type CorporateStatus =
  | 'awaiting_verification' | 'pending' | 'in_review' | 'returned' | 'escalated' | 'approving' | 'approved' | 'rejected';
export type CorporateRole = 'signatory' | 'director';
export type ReviewStatus = 'pending' | 'accepted' | 'rejected';

export interface CorporateReview { status: ReviewStatus; note?: string; by?: string; at?: string }
export interface CorporateFileRef { fileId: string; fileName: string; mimeType: string; size: number; uploadedAt: string }
export interface CorporateAddress { city: string; subCity: string; woreda: string; houseNumber: string }

export interface ScreeningSummary {
  status: 'MATCHED' | 'CLEAR' | 'ERROR';
  riskLevel: string;
  hasPEP: boolean;
  blocked: boolean;
  matches: { fullName: string; sanctionType: string; sourceId: string; matchScore: number; matchStrength: string; reason?: string }[];
  checkedAt?: string;
  error?: string;
}

export interface CorporatePerson {
  id: string;
  fullName: string;
  phone: string;
  roles: CorporateRole[];
  isApplicant: boolean;
  invite?: { sentAt?: string; sentCount?: number; expiresAt?: string; smsSent?: boolean };
  verification: {
    status: 'pending' | 'verified';
    verifiedAt?: string;
    fan?: string; uin?: string; fullName?: string; fullNameAmharic?: string; dateOfBirth?: string; gender?: string;
    phone?: string; email?: string; region?: string; zone?: string; woreda?: string;
    photo?: string; selfie?: string;
    faceVerification?: FaceVerificationResult;
    livenessFrames?: { action: string; label: string; image: string }[];
    nameMatchScore?: number;
    screening?: ScreeningSummary;
  };
  signature?: CorporateFileRef & { review: CorporateReview; previous?: CorporateFileRef[] };
}

export interface CorporateDocument {
  docId: string;
  name: string;
  required: boolean;
  file?: CorporateFileRef;
  previousFiles: CorporateFileRef[];
  review: CorporateReview;
}

export interface CorporateApplication {
  applicationId: string;
  status: CorporateStatus;
  organization: {
    name: string; categoryId: string; categoryName: string; subtypeId: string; subtypeName: string;
    registrationNumber: string; registrationIssuedBy: string; establishmentDate: string; tradeLicenseNumber: string;
    tin: string; vatNumber: string; industry: string; otherIndustry: string; sourceOfFunds: string; otherSourceOfFunds: string;
    annualIncome: number; phone: string; mobile: string; fax: string; email: string; poBox: string;
    registeredAddress: CorporateAddress; sameCorrespondenceAddress: boolean; correspondenceAddress: CorporateAddress;
  };
  branch: string; branchCode: string; conventionalBranchCode?: string;
  accountTypeId: string; accountTypeName: string; accountClassCode: string; accountClassName: string; tierId: string; isIFB: boolean;
  signingRule: string; signingRuleOther: string; signingRuleText: string;
  people: CorporatePerson[];
  documents: CorporateDocument[];
  screening: { organization?: ScreeningSummary };
  complianceHold: boolean;
  history: { at: string; by: string; action: string; note?: string }[];
  submittedAt: string; verifiedAt?: string;
  reviewedBy?: string; returnReason?: string; returnedBy?: string; returnedAt?: string;
  rejectionReason?: string; rejectedBy?: string; rejectedAt?: string;
  escalationReason?: string; escalatedBy?: string; escalatedAt?: string;
  approvedBy?: string; approvedAt?: string; approvalStartedAt?: string;
  cifNumber?: string; accountNumber?: string; flexcubeMessage?: string;
  resubmissionCount: number;
  blockers: string[];
  approvalStale: boolean;
  rules: { maxPeople: number; maxFileMb: number; signatureRequired: boolean; inviteValidDays: number };
}

export interface CorporateListItem {
  applicationId: string;
  status: CorporateStatus;
  organizationName: string;
  categoryName: string;
  subtypeName: string;
  tin: string;
  branch: string;
  branchCode: string;
  accountTypeName: string;
  accountClassName: string;
  isIFB: boolean;
  complianceHold: boolean;
  applicantName: string;
  people: { verified: number; total: number };
  submittedAt: string;
  verifiedAt?: string;
  cifNumber?: string;
  accountNumber?: string;
  resubmissionCount: number;
}

export const CORPORATE_STATUS: Record<CorporateStatus, { label: string; color: string }> = {
  awaiting_verification: { label: 'Waiting for people to verify', color: 'bg-sky-100 text-sky-800' },
  pending: { label: 'Pending review', color: 'bg-amber-100 text-amber-800' },
  in_review: { label: 'In review', color: 'bg-indigo-100 text-indigo-800' },
  returned: { label: 'Returned to applicant', color: 'bg-orange-100 text-orange-800' },
  escalated: { label: 'Escalated', color: 'bg-purple-100 text-purple-800' },
  approving: { label: 'Opening account…', color: 'bg-teal-100 text-teal-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
};

export const roleLabel = (roles: CorporateRole[]) =>
  roles.includes('signatory') && roles.includes('director') ? 'Signatory & director'
    : roles.includes('signatory') ? 'Signatory' : roles.includes('director') ? 'Director' : 'Representative';

export const fileUrl = (fileId: string, download = false) => `/api/corporate/files/${encodeURIComponent(fileId)}${download ? '?download=1' : ''}`;

// FlexCube list-of-values codes the web app sends (same lists as for individual accounts)
export const INDUSTRY_LABELS: Record<string, string> = {
  BN: 'Banking', CONS: 'Construction', AFF: 'Agriculture, Forestry & Fishing', FM: 'Food Manufacturing',
  ES: 'Educational Services', HS: 'Health Services', INS: 'Insurance', CS: 'Computer Systems & IT',
  SOFT: 'Software Publishers', TELE: 'Telecommunications', HO: 'Hotels & Accommodations', FSD: 'Food Services & Restaurants',
  WHL: 'Wholesale Trade', AD: 'Automobile Dealers', AT: 'Air Transportation', TRUCK: 'Truck Transportation & Warehousing',
  MIN: 'Mining', OG: 'Oil & Gas', UTI: 'Utilities', SEC: 'Securities & Investments', CM: 'Chemical Manufacturing',
  PM: 'Pharmaceutical Manufacturing', AM: 'Apparel Manufacturing', SM: 'Steel Manufacturing', MM: 'Machinery Manufacturing',
  CEP: 'Computer & Electronic Products', APM: 'Aerospace & Parts Manufacturing', MVP: 'Motor Vehicle & Parts Manufacturing',
  TEX: 'Textile Mills & Products', GS: 'Grocery Stores', CAGM: 'Clothing & General Merchandise',
  APR: 'Advertising & Public Relations', MST: 'Management & Technical Consulting', SR: 'Scientific Research',
  EMPS: 'Employment Services', AER: 'Arts, Entertainment & Recreation', BRD: 'Broadcasting', PUB: 'Publishing',
  PRN: 'Printing', MPV: 'Motion Picture & Video', INTRT: 'Internet & Data Processing', CD: 'Child Day Care Services',
  SAE: 'Social Assistance', AGC: 'Advocacy & Civic Organizations', FG: 'Federal Government', SLG: 'State & Local Government',
  NA: 'Not Applicable', O: 'Other',
};

export const FUNDS_LABELS: Record<string, string> = {
  SB: 'Business income', INV: 'Investment / dividend income', SOA: 'Sale of assets', LP: 'Loan proceeds',
  D: 'Donations', GF: 'Grants / gifts', T: 'Trust', PS: 'Savings', O: 'Other',
};
