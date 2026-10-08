// API client for fetching data from the backend

const API_BASE = '/api';

export interface Customer {
  _id: string;
  customerId: string;
  fullName: string;
  fullNameAmharic: string;
  email: string;
  phone: string;
  accountType: string;
  accountTypeId: string;
  accountTypeName?: string;
  tierId?: string;
  tierName?: string;
  tierInterestRate?: number;
  accountClassCode?: string;
  accountClassName?: string;
  isIFB?: boolean;
  status: 'pending' | 'verified' | 'approved' | 'rejected' | 'auto_approved' | 'escalated' | 'returned' | 'in_review';
  channel?: 'mobile_app' | 'web' | 'whatsapp' | 'telegram' | 'superapp' | 'other';
  faceVideoId?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  branch: string;
  branchCode: string;
  conventionalBranchCode?: string; // set when an IFB account was moved to the IFB branch code
  uin: string;
  fcn: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  region: string;
  zone: string;
  woreda: string;
  kebele?: string;
  houseNumber?: string;
  occupation: string;
  otherOccupation?: string;
  industry: string;
  otherIndustry?: string;
  wealthSource: string;
  otherWealthSource?: string;
  annualIncome: number;
  initialDeposit: number;
  motherMaidenName: string;
  maritalStatus: string;
  marriageCertificatePhoto?: string;
  faydaPhoto: string;
  selfiePhoto?: string;
  verificationPhotos: {
    faceCenter: string;
    eyeBlink: string;
    headLeft: string;
    headRight: string;
    smile: string;
  };
  faceMatchScore: number;
  customerNumber?: string;
  cifNumber?: string;
  accountNumber?: string;
  noDebit?: { status: 'set' | 'not_required' | 'failed'; at?: string; error?: string }; // FlexCube No-Debit after opening
  rejectionReason?: string;
  approvedBy?: string;
  rejectedBy?: string;
  returnReason?: string;
  returnedAt?: string;
  returnedBy?: string;
  escalationReason?: string;
  escalatedAt?: string;
  escalatedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  resubmissionCount?: number;
  lockedBy?: string;
  lockedById?: string;
  lockedAt?: string;
  // CIF creation fields
  promotionType?: string;
  customerRiskRating?: string;
  customerSegmentation?: string;
  maintFeeWaived?: string;
  slaEnable?: string;
  leadRm?: string;
  currencyRedemptionPurpose?: string;
  sanctionListStatus?: string;
  taxIdentity?: string;
  politicallyExposedPerson?: string;
  customerType?: string;
  idType?: string;
  nationality?: string;
  // Existing customer — approval opens a new account under this CIF (no new CIF)
  isExistingCustomer?: boolean;
  existingCif?: string;
  existingAccountNumber?: string;
  existingCifCheck?: {
    verified: boolean;
    fullName?: string;
    phone?: string;
    branch?: string;
    nameMatchScore?: number;
    phoneMatch?: boolean;
    message?: string;
    checkedAt?: string;
  };
  // Additional services — set up by the branch Personal Banker after the account is opened
  requestedServices?: string[];
  servicesStatus?: 'none' | 'pending' | 'completed';
  completedServices?: { service: string; completedAt: string; completedBy: string }[];
  serviceNotifications?: { services: string[]; message: string; smsSent: boolean; sentAt: string; sentBy: string }[];
  requestedServiceDetails?: {
    id: string; name: string; icon?: string; termsRequired?: boolean; termsTitle?: string;
    termsVersion?: number; termsAcceptedVersion?: number; termsAcceptedAt?: string;
  }[];
  // Web app face check by the Fayda backend (see FaceVerificationResult)
  faceVerification?: FaceVerificationResult;
  livenessFrames?: { action: string; label: string; image: string }[];
}

export interface FaceVerificationResult {
  verifiedBy?: 'server' | string;
  method?: string;                   // 'web-liveness-v1' | 'compare-at-submission'
  checkedAt?: string;
  match?: { similarity: number; distance: number; threshold: number; matched: boolean; engine?: string } | null;
  matchError?: string;
  liveness?: {
    performed: boolean;
    passed: boolean;
    actions?: string[];
    reason?: string;
    checks?: { name: string; passed: boolean; detail?: string }[];
    antiSpoof?: { score: number | null; threshold: number; enforced: boolean; model?: string } | null;
  };
}

export interface CustomerResponse {
  success: boolean;
  data: Customer[];
  total: number;
  counts: {
    total: number;
    pending: number;
    verified: number;
    approved: number;
    auto_approved: number;
    rejected: number;
  };
}

export interface StatsResponse {
  success: boolean;
  data: {
    counts: {
      total: number;
      pending: number;
      verified: number;
      approved: number;
      auto_approved: number;
      rejected: number;
    };
    todayCounts: {
      total: number;
      pending: number;
      approved: number;
      auto_approved: number;
      rejected: number;
    };
    dailyStats: Array<{
      date: string;
      newAccounts: number;
      pendingReview: number;
      approved: number;
      autoApproved: number;
      rejected: number;
    }>;
    accountTypeStats: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
  };
}

// Fetch all customers with optional filters
export async function fetchCustomers(options?: {
  status?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<CustomerResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.search) params.set('search', options.search);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.skip) params.set('skip', options.skip.toString());

  const response = await fetch(`${API_BASE}/customers?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch customers');
  }
  return response.json();
}

// Fetch single customer by ID
export async function fetchCustomer(id: string): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch customer');
  }
  return response.json();
}

// Approve customer
export async function approveCustomer(id: string, approvedBy?: string): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve', approvedBy }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to approve customer');
  }
  return data;
}

// Reject customer
export async function rejectCustomer(
  id: string,
  rejectionReason: string,
  rejectedBy?: string
): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reject', rejectionReason, rejectedBy }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to reject customer');
  }
  return data;
}

// Return customer to applicant for amendment (approver action)
export async function returnCustomer(
  id: string,
  returnReason: string,
  returnedBy?: string
): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'return', returnReason, returnedBy }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to return customer');
  }
  return data;
}

// Mark an application as "in review" (an approver has picked it up)
export async function reviewCustomer(
  id: string,
  reviewedBy?: string
): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'review', reviewedBy }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to mark customer in review');
  }
  return data;
}

// Escalate customer to second-level (senior) approver — used for PEP cases
export async function escalateCustomer(
  id: string,
  escalationReason: string,
  escalatedBy?: string
): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'escalate', escalationReason, escalatedBy }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to escalate customer');
  }
  return data;
}

// Review lock — prevents two officers from opening/processing the same request concurrently
export interface LockResult {
  success: boolean;
  locked?: boolean;
  lockedBy?: string;
  lockedAt?: string;
  error?: string;
}

export async function acquireLock(id: string): Promise<LockResult> {
  const response = await fetch(`${API_BASE}/customers/${id}/lock`, { method: 'POST' });
  return response.json();
}

export async function releaseLock(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/customers/${id}/lock`, { method: 'DELETE', keepalive: true });
  } catch {
    /* best-effort release */
  }
}

// Fetch stats
export async function fetchStats(): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return response.json();
}

// Helper functions
export function getStatusColor(status: Customer['status']): string {
  const colors: Record<Customer['status'], string> = {
    pending: 'bg-amber-100 text-amber-800',
    verified: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    auto_approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    escalated: 'bg-purple-100 text-purple-800',
    returned: 'bg-orange-100 text-orange-800',
    in_review: 'bg-indigo-100 text-indigo-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status: Customer['status']): string {
  const labels: Record<Customer['status'], string> = {
    pending: 'Waiting for Review',
    verified: 'Verified',
    approved: 'Approved',
    auto_approved: 'Auto Approved',
    rejected: 'Rejected',
    escalated: 'Escalated (PEP)',
    returned: 'Returned to Applicant',
    in_review: 'In Review',
  };
  return labels[status] || status;
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  } catch {
    return '-';
  }
}
