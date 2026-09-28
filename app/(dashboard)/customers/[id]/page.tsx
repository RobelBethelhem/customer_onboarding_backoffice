'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, MapPin, Briefcase, CreditCard, Calendar,
  Phone, Mail, CheckCircle2, XCircle,
  Camera, Eye, AlertTriangle, Download, Printer, Loader2, FileText, Video,
  Shield, Megaphone, Lock, UserCheck
} from 'lucide-react';
import {
  fetchCustomer, approveCustomer, rejectCustomer, returnCustomer, escalateCustomer, reviewCustomer,
  acquireLock, releaseLock,
  Customer, getStatusColor, getStatusLabel, formatDate
} from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { ensureDataUri, hasValidPhoto } from '@/lib/imageUtils';
import { toast } from 'sonner';

function getOccupationLabel(code: string, otherValue?: string): string {
  const labels: Record<string, string> = {
    'PSE': 'Private Sector Employed', 'GSE': 'Government Sector Employed',
    'SE': 'Self-Employed', 'STUD': 'Student', 'RET': 'Retired',
    'HW': 'Housewife', 'DIP': 'Diplomat', 'NGOE': 'NGO Employed',
    'ROE': 'Religious Org Employed', 'UNEMP': 'Unemployed', 'O': 'Other',
    // Legacy codes
    'EMP': 'Employed', 'SELF': 'Self-Employed', 'GOV': 'Government Employee', 'STU': 'Student',
  };
  if (code === 'O' && otherValue && otherValue.trim()) return otherValue;
  return labels[code] || code;
}

function getIndustryLabel(code: string, otherValue?: string): string {
  const labels: Record<string, string> = {
    'BN': 'Banking', 'CONS': 'Construction', 'AFF': 'Agriculture & Fishing',
    'FM': 'Food Manufacturing', 'ES': 'Educational Services', 'HS': 'Health Services',
    'INS': 'Insurance', 'CS': 'Computer Systems & IT', 'SOFT': 'Software',
    'TELE': 'Telecommunications', 'HO': 'Hotels & Accommodations',
    'FSD': 'Food Services', 'WHL': 'Wholesale Trade', 'AD': 'Automobile Dealers',
    'AT': 'Air Transportation', 'TRUCK': 'Truck Transportation', 'MIN': 'Mining',
    'OG': 'Oil & Gas', 'UTI': 'Utilities', 'SEC': 'Securities & Investments',
    'CM': 'Chemical Manufacturing', 'PM': 'Pharmaceutical', 'AM': 'Apparel Manufacturing',
    'SM': 'Steel Manufacturing', 'MM': 'Machinery Manufacturing',
    'CEP': 'Computer & Electronics', 'APM': 'Aerospace Manufacturing',
    'MVP': 'Motor Vehicle Manufacturing', 'TEX': 'Textile', 'GS': 'Grocery Stores',
    'CAGM': 'Clothing & Merchandise', 'APR': 'Advertising & PR',
    'MST': 'Management Consulting', 'SR': 'Scientific Research',
    'EMPS': 'Employment Services', 'AER': 'Arts & Entertainment',
    'BRD': 'Broadcasting', 'PUB': 'Publishing', 'PRN': 'Printing',
    'MPV': 'Motion Picture & Video', 'INTRT': 'Internet & Data Processing',
    'CD': 'Child Day Care', 'SAE': 'Social Assistance', 'AGC': 'Civic Organizations',
    'FG': 'Federal Government', 'SLG': 'State & Local Government',
    'NA': 'Not Applicable', 'O': 'Others',
    // Legacy codes
    'AGR': 'Agriculture', 'MAN': 'Manufacturing', 'TRD': 'Trade/Commerce',
    'SER': 'Services', 'IT': 'Information Technology', 'FIN': 'Finance',
    'HLT': 'Healthcare', 'EDU': 'Education',
  };
  if (code === 'O' && otherValue && otherValue.trim()) return otherValue;
  return labels[code] || code;
}

function getWealthSourceLabel(code: string, otherValue?: string): string {
  const labels: Record<string, string> = {
    'SAL': 'Salary', 'SB': 'Small Business', 'PS': 'Personal Savings',
    'INV': 'Investment / Dividend', 'INH': 'Inheritance', 'PW': 'Personal Wealth',
    'RET': 'Retirement', 'SOA': 'Sale of Asset', 'GF': 'Gift',
    'LP': 'Loan Proceeds', 'LS': 'Legal Settlement', 'MAT': 'Maturity of Life Policy',
    'D': 'Donation', 'AL': 'Alimony', 'SM': 'Subsistence/Maintenance',
    'SH': 'Shopkeeper', 'T': 'Trust', 'G': 'Gambling', 'L': 'Lottery',
    'NC': 'Not Clear', 'O': 'Others',
    // Legacy codes
    'BUS': 'Business Income', 'REM': 'Remittance',
  };
  if (code === 'O' && otherValue && otherValue.trim()) return otherValue;
  return labels[code] || code;
}

function getMaritalStatusLabel(code: string): string {
  const labels: Record<string, string> = {
    'S': 'Single', 'M': 'Married', 'D': 'Divorced', 'W': 'Widowed',
  };
  return labels[code] || code;
}

function getPromotionTypeLabel(code: string): string {
  const labels: Record<string, string> = {
    'Walk in customer': 'Walk-in Customer',
    'FACEBOOK': 'Facebook',
    'RADIO': 'Radio',
    'TVAD': 'TV Advertisement',
    'MAGAZINE': 'Magazine',
    'Borrower': 'Borrower',
    'Payroll Account': 'Payroll Account',
    'Provident Fund Accounts': 'Provident Fund',
    'Share holder': 'Shareholder',
    'Zemen bank Staff account': 'Staff Account',
    'Amendments on existing': 'Amendment on Existing',
    'MAPP': 'Mobile App',
    'WEB': 'Web',
    'WHATSAPP': 'WhatsApp',
  };
  return labels[code] || code || '-';
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Concurrent-review lock: name of the officer who already has this application open (if any)
  const [lockHolder, setLockHolder] = useState<string | null>(null);

  // Only first/second-level reviewers compete for the lock. Other roles (branch, marketing,
  // admin) just view, so they neither acquire nor are blocked by it.
  const isReviewer = user?.role === 'kyc' || user?.role === 'senior_approver';

  useEffect(() => {
    const id = params.id as string;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let lockedHere = false;

    const release = () => {
      if (lockedHere) {
        lockedHere = false;
        releaseLock(id);
      }
    };

    async function init() {
      setLoading(true);
      setError(null);
      setLockHolder(null);
      try {
        const response = await fetchCustomer(id);
        if (!response.success || !response.data) {
          setError('Failed to load customer data');
          return;
        }
        const cust = response.data;

        // The lock only matters while an application is still actionable. Finished
        // applications (approved/rejected/etc.) are read-only and any number of people may
        // view them at once.
        const actionable = ['pending', 'verified', 'in_review', 'escalated'].includes(cust.status);

        if (isReviewer && actionable) {
          try {
            const lock = await acquireLock(id);
            if (!lock.success) {
              // Someone else is already reviewing it — don't open the application.
              setLockHolder(lock.lockedBy || 'another officer');
              return;
            }
            lockedHere = true;
            // Heartbeat keeps the lock fresh while this tab stays open (TTL is 2 min server-side).
            heartbeat = setInterval(() => { acquireLock(id).catch(() => {}); }, 45000);
          } catch {
            // Lock service unavailable — proceed; the PATCH guards still prevent a double decision.
          }
        }

        setCustomer(cust);
      } catch (err) {
        setError('Failed to load customer data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    init();
    window.addEventListener('beforeunload', release);
    return () => {
      if (heartbeat) clearInterval(heartbeat);
      window.removeEventListener('beforeunload', release);
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleApprove = async () => {
    if (!customer) return;
    setIsApproving(true);
    try {
      const response = await approveCustomer(customer.customerId, user?.name || user?.email || 'KYC Officer');
      if (response.success) {
        const { cifNumber, accountNumber } = response.data;

        // Show success toast
        toast.success('Account Created Successfully!', {
          description: (
            <div className="mt-2 space-y-1">
              <div><strong>Customer:</strong> {response.data.fullName}</div>
              <div><strong>CIF Number:</strong> {cifNumber}</div>
              <div><strong>Account Number:</strong> {accountNumber}</div>
              <div><strong>Phone:</strong> {response.data.phone}</div>
              <div className="mt-2 text-xs text-gray-500">SMS notification sent to customer</div>
            </div>
          ),
          duration: 8000,
        });

        // Redirect after a short delay
        setTimeout(() => {
          router.push('/approved');
        }, 2000);
      }
    } catch (err) {
      toast.error('Could not approve', {
        description: (err as Error)?.message || 'An error occurred while creating the account. Please try again.',
      });
      console.error(err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!customer) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setIsRejecting(true);
    try {
      const response = await rejectCustomer(customer.customerId, rejectReason, 'KYC Officer');
      if (response.success) {
        toast.success('Application rejected', {
          description: `Customer ${customer.fullName} has been rejected.`,
        });
        setTimeout(() => {
          router.push('/rejected');
        }, 1500);
      }
    } catch (err) {
      toast.error('Could not reject', { description: (err as Error)?.message });
      console.error(err);
    } finally {
      setIsRejecting(false);
      setShowRejectModal(false);
    }
  };

  const handleReview = async () => {
    if (!customer) return;
    setIsReviewing(true);
    try {
      const response = await reviewCustomer(customer.customerId, user?.name || user?.email || 'KYC Officer');
      if (response.success) {
        toast.success('Marked as In Review');
        setCustomer(response.data);
      }
    } catch (err) {
      toast.error('Could not update status', { description: (err as Error)?.message });
      console.error(err);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReturn = async () => {
    if (!customer) return;
    if (!returnReason.trim()) {
      toast.error('Please provide a reason to return');
      return;
    }
    setIsReturning(true);
    try {
      const response = await returnCustomer(customer.customerId, returnReason, user?.name || user?.email || 'KYC Officer');
      if (response.success) {
        toast.success('Application returned to applicant', {
          description: `${customer.fullName} can now amend and resubmit.`,
        });
        setTimeout(() => { router.push('/pending'); }, 1500);
      }
    } catch (err) {
      toast.error('Could not return application', { description: (err as Error)?.message });
      console.error(err);
    } finally {
      setIsReturning(false);
      setShowReturnModal(false);
    }
  };

  const handleEscalate = async () => {
    if (!customer) return;
    if (!escalateReason.trim()) {
      toast.error('Please provide an escalation reason');
      return;
    }
    setIsEscalating(true);
    try {
      const response = await escalateCustomer(customer.customerId, escalateReason, user?.name || user?.email || 'KYC Officer');
      if (response.success) {
        toast.success('Escalated for second-level approval', {
          description: `${customer.fullName} has been sent to a Senior Approver.`,
        });
        setTimeout(() => { router.push('/escalated'); }, 1500);
      }
    } catch (err) {
      toast.error('Could not escalate application', { description: (err as Error)?.message });
      console.error(err);
    } finally {
      setIsEscalating(false);
      setShowEscalateModal(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!customer) return;

    // Prepare data for Excel export
    const data = [
      ['Field', 'Value'],
      ['Customer ID', customer.customerId],
      ['Full Name', customer.fullName],
      ['Full Name (Amharic)', customer.fullNameAmharic || '-'],
      ['Email', customer.email || '-'],
      ['Phone', customer.phone],
      ['Gender', customer.gender || '-'],
      ['Date of Birth', customer.dateOfBirth || '-'],
      ['Branch', `${customer.branch} (${customer.branchCode})`],
      ['UIN', customer.uin || '-'],
      ['FCN', customer.fcn || '-'],
      ['Account Type', customer.accountTypeName || customer.accountType],
      ['Status', getStatusLabel(customer.status)],
      ['CIF Number', customer.cifNumber || '-'],
      ['Account Number', customer.accountNumber || '-'],
      ['Face Match Score', `${customer.faceMatchScore}%`],
      ['Region', customer.region || '-'],
      ['Zone', customer.zone || '-'],
      ['Woreda', customer.woreda || '-'],
      ['Kebele', customer.kebele || '-'],
      ['House Number', customer.houseNumber || '-'],
      ['Occupation', getOccupationLabel(customer.occupation || '', customer.otherOccupation)],
      ['Institution', getIndustryLabel(customer.industry || '', customer.otherIndustry)],
      ['Source of Wealth', getWealthSourceLabel(customer.wealthSource || '', customer.otherWealthSource)],
      ['Annual Income', (customer.annualIncome || 0).toLocaleString()],
      ['Initial Deposit', customer.initialDeposit?.toLocaleString() || '-'],
      ['Marital Status', getMaritalStatusLabel(customer.maritalStatus || '')],
      ['Mother Maiden Name', customer.motherMaidenName || '-'],
      ['Promotion Type', getPromotionTypeLabel(customer.promotionType || '')],
      ['Tax Identity (TIN)', customer.taxIdentity || '-'],
      ['Customer Risk Rating', customer.customerRiskRating || 'LOW'],
      ['Customer Segmentation', customer.customerSegmentation || 'RETAIL CUSTOMER'],
      ['Maintenance Fee Waived', customer.maintFeeWaived || 'Y'],
      ['SLA Enabled', customer.slaEnable || 'N'],
      ['Lead RM', customer.leadRm || 'NA'],
      ['Currency Redemption Purpose', customer.currencyRedemptionPurpose || 'Y'],
      ['Sanction List Status', customer.sanctionListStatus || 'N'],
      ['Politically Exposed Person', customer.politicallyExposedPerson || 'NO'],
      ['Customer Type', customer.customerType || 'Individual'],
      ['ID Type', customer.idType || 'National ID'],
      ['Nationality', customer.nationality || 'ETHIOPIA'],
      ['Created At', formatDate(customer.createdAt)],
      ['Approved At', formatDate(customer.approvedAt)],
      ['Approved By', customer.approvedBy || '-'],
    ];

    // Convert to CSV
    const csv = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `customer_${customer.customerId}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Customer data exported', {
      description: 'CSV file has been downloaded.',
    });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Another officer already has this application open — block this one from opening it too,
  // so the same account can't be processed by two officers at the same time.
  if (lockHolder) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application In Use</h2>
          <p className="text-gray-600 mb-6">
            This application is currently being reviewed by <strong>{lockHolder}</strong>. To prevent
            duplicate processing, only one officer can review an application at a time. Please try again
            once they have finished.
          </p>
          <button
            onClick={() => router.push('/pending')}
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Back to Pending
          </button>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">{error || 'Customer not found'}</p>
          <Link href="/pending" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to pending
          </Link>
        </div>
      </div>
    );
  }

  const isPending = customer.status === 'pending' || customer.status === 'verified';
  const isInReview = customer.status === 'in_review';
  const isEscalated = customer.status === 'escalated';
  // Separation of duties (F8): KYC officers handle first-level; Senior Approvers handle
  // escalated (PEP) second-level decisions. Admin is excluded from KYC operational actions.
  const isKyc = user?.role === 'kyc';
  const isSenior = user?.role === 'senior_approver';
  // PEP / sanctions applications cannot be approved by a KYC officer — they must be escalated
  // to a Senior Approver (who approves at the escalated 2nd level).
  const isComplianceHold = customer.politicallyExposedPerson === 'YES' || customer.sanctionListStatus === 'Y';
  const kycCanApprove = isKyc && (isPending || isInReview) && !isComplianceHold;
  // Existing customer: the account is opened under their current CIF. Flag anything that
  // suggests the CIF may not belong to this applicant.
  const cifCheck = customer.existingCifCheck;
  const cifNeedsAttention = !!customer.isExistingCustomer && (
    !cifCheck?.verified || (cifCheck.nameMatchScore ?? 0) < 80 || cifCheck.phoneMatch === false
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.fullName}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-500">ID: {customer.customerId}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                {getStatusLabel(customer.status)}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                customer.channel === 'mobile_app' ? 'bg-blue-100 text-blue-700' :
                customer.channel === 'web' ? 'bg-violet-100 text-violet-700' :
                customer.channel === 'whatsapp' ? 'bg-green-100 text-green-700' :
                customer.channel === 'telegram' ? 'bg-sky-100 text-sky-700' :
                customer.channel === 'superapp' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {customer.channel === 'mobile_app' ? 'Mobile App' :
                 customer.channel === 'web' ? 'Web' :
                 customer.channel === 'whatsapp' ? 'WhatsApp' :
                 customer.channel === 'telegram' ? 'Telegram' :
                 customer.channel === 'superapp' ? 'SuperApp' :
                 customer.channel || 'Mobile App'}
              </span>
              {customer.customerRiskRating && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  customer.customerRiskRating === 'HIGH' ? 'bg-red-100 text-red-700' :
                  customer.customerRiskRating === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  Risk: {customer.customerRiskRating}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          {((isKyc && (isPending || isInReview)) || (isSenior && isEscalated)) && (
            <>
              {isPending && (
                <button
                  onClick={handleReview}
                  disabled={isApproving || isRejecting || isReturning || isEscalating || isReviewing}
                  className="flex items-center gap-2 px-4 py-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  {isReviewing ? 'Starting...' : 'Start Review'}
                </button>
              )}
              {(isPending || isInReview) && (
                <>
                  <button
                    onClick={() => setShowReturnModal(true)}
                    disabled={isApproving || isRejecting || isReturning || isEscalating || isReviewing}
                    className="flex items-center gap-2 px-4 py-2 text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Return
                  </button>
                  <button
                    onClick={() => setShowEscalateModal(true)}
                    disabled={isApproving || isRejecting || isReturning || isEscalating || isReviewing}
                    className="flex items-center gap-2 px-4 py-2 text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                  >
                    <Shield className="w-4 h-4" />
                    Escalate (PEP)
                  </button>
                </>
              )}
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isApproving}
                className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              {((isSenior && isEscalated) || kycCanApprove) && (
                <button
                  onClick={handleApprove}
                  disabled={isApproving || isRejecting}
                  className="flex items-center gap-2 px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {isEscalated ? 'Approve (2nd Level)' : customer.isExistingCustomer ? 'Approve & Open Account on Existing CIF' : 'Approve & Create Account'}
                    </>
                  )}
                </button>
              )}
              {isKyc && (isPending || isInReview) && isComplianceHold && (
                <span className="flex items-center gap-2 px-4 py-2 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium">
                  <Shield className="w-4 h-4" />
                  PEP / sanctions — escalate to a Senior Approver to approve
                </span>
              )}
            </>
          )}
          {isEscalated && !isSenior && (
            <span className="px-4 py-2 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium">
              Awaiting Senior Approver decision
            </span>
          )}
        </div>
      </div>

      {/* PEP / sanctions compliance alert — visible to reviewers; KYC cannot approve these */}
      {isComplianceHold && (isPending || isInReview) && (
        <div className="p-4 rounded-xl flex items-start gap-3 bg-purple-50 border border-purple-200">
          <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-purple-900">
              {customer.politicallyExposedPerson === 'YES'
                ? 'Politically Exposed Person (PEP) match'
                : 'Sanctions / watchlist match'}
            </p>
            <p className="text-sm text-purple-700 mt-1">
              This application matched the screening list, so it cannot be approved at the KYC level.{' '}
              {isKyc
                ? 'Review it, then escalate to a Senior Approver (or reject / return).'
                : 'A Senior Approver must approve it after escalation.'}
            </p>
          </div>
        </div>
      )}

      {/* Existing customer — approval opens a new account under the CIF they already have */}
      {customer.isExistingCustomer && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${cifNeedsAttention ? 'bg-amber-50 border-amber-200' : 'bg-sky-50 border-sky-200'}`}>
          <UserCheck className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cifNeedsAttention ? 'text-amber-600' : 'text-sky-600'}`} />
          <div>
            <p className={`font-medium ${cifNeedsAttention ? 'text-amber-900' : 'text-sky-900'}`}>
              Existing customer — the account is opened under CIF {customer.existingCif}; no new CIF is created
            </p>
            <div className="text-sm text-gray-700 mt-1 space-y-0.5">
              {customer.existingAccountNumber && (
                <p>Account number given by the applicant: <span className="font-mono">{customer.existingAccountNumber}</span></p>
              )}
              {cifCheck?.verified ? (
                <>
                  <p>
                    Name on CIF: <strong>{cifCheck.fullName || '—'}</strong> · matches the Fayda name{' '}
                    <strong>{cifCheck.nameMatchScore ?? 0}%</strong>
                  </p>
                  <p>
                    Phone on CIF: {cifCheck.phone || '—'}
                    {cifCheck.phoneMatch === true && ' · matches the Fayda phone'}
                    {cifCheck.phoneMatch === false && ' · does not match the Fayda phone'}
                    {cifCheck.branch && ` · Home branch ${cifCheck.branch}`}
                  </p>
                </>
              ) : (
                <p>The CIF could not be verified in FlexCube{cifCheck?.message ? ` (${cifCheck.message})` : ''}.</p>
              )}
              {cifNeedsAttention && (isPending || isInReview || isEscalated) && (
                <p className="font-medium text-amber-800">Confirm this CIF belongs to the applicant before approving.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Face Match Score Alert */}
      {isPending && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          customer.faceMatchScore >= 85
            ? 'bg-green-50 border border-green-200'
            : customer.faceMatchScore >= 70
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            customer.faceMatchScore >= 85 ? 'bg-green-500' :
            customer.faceMatchScore >= 70 ? 'bg-amber-500' : 'bg-red-500'
          }`}>
            {customer.faceMatchScore >= 85 ? (
              <CheckCircle2 className="w-5 h-5 text-white" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-medium ${
              customer.faceMatchScore >= 85 ? 'text-green-900' :
              customer.faceMatchScore >= 70 ? 'text-amber-900' : 'text-red-900'
            }`}>
              Face Match Score: {customer.faceMatchScore}%
            </p>
            <p className={`text-sm ${
              customer.faceMatchScore >= 85 ? 'text-green-700' :
              customer.faceMatchScore >= 70 ? 'text-amber-700' : 'text-red-700'
            }`}>
              {customer.faceMatchScore >= 85
                ? 'High confidence - Face matches Fayda photo'
                : customer.faceMatchScore >= 70
                ? 'Medium confidence - Manual verification recommended'
                : 'Low confidence - Please verify manually before approving'
              }
            </p>
          </div>
        </div>
      )}

      {/* Channel & Video Alert for non-mobile channels */}
      {customer.channel && customer.channel !== 'mobile_app' && isPending && (
        <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-violet-900">
              Video Verification Required — {customer.channel === 'web' ? 'Web' : customer.channel === 'whatsapp' ? 'WhatsApp' : customer.channel === 'telegram' ? 'Telegram' : customer.channel === 'superapp' ? 'SuperApp' : customer.channel} Channel
            </p>
            <p className="text-sm text-violet-700">
              This application was submitted via a non-mobile channel. A recorded face video has been submitted for manual KYC verification.
              {customer.faceVideoId ? ` Video ID: ${customer.faceVideoId}` : ' No video ID available.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Photos Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo / Video Verification — channel-aware */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                {(!customer.channel || customer.channel === 'mobile_app') ? (
                  <Camera className="w-5 h-5 text-purple-600" />
                ) : (
                  <Video className="w-5 h-5 text-purple-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {(!customer.channel || customer.channel === 'mobile_app') ? 'Photo Verification' : 'Video & Photo Verification'}
                </h2>
                <p className="text-sm text-gray-500">
                  {(!customer.channel || customer.channel === 'mobile_app')
                    ? 'Compare Fayda photo with liveness verification photos'
                    : 'Review the recorded face video alongside the Fayda ID photo'}
                </p>
              </div>
            </div>

            {/* MOBILE APP CHANNEL: Fayda photo + 5 liveness photos */}
            {(!customer.channel || customer.channel === 'mobile_app') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fayda Photo */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Fayda ID Photo (Reference)</p>
                  <div
                    className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border-2 border-blue-500 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedPhoto(ensureDataUri(customer.faydaPhoto))}
                  >
                    <img src={ensureDataUri(customer.faydaPhoto)} alt="Fayda Photo" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <p className="text-white text-sm font-medium">Fayda ID Photo</p>
                      <p className="text-white/80 text-xs">Official Identity Photo</p>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Eye className="w-5 h-5 text-white drop-shadow-lg" />
                    </div>
                  </div>
                </div>

                {/* Verification Photos Grid */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Liveness Verification Photos</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'faceCenter', label: 'Face Center', icon: '👤' },
                      { key: 'eyeBlink', label: 'Eye Blink', icon: '👁️' },
                      { key: 'headLeft', label: 'Head Left', icon: '⬅️' },
                      { key: 'headRight', label: 'Head Right', icon: '➡️' },
                      { key: 'smile', label: 'Smile', icon: '😊' },
                    ].map((photo, index) => {
                      const photoData = customer.verificationPhotos?.[photo.key as keyof typeof customer.verificationPhotos];
                      const isValid = hasValidPhoto(photoData);
                      return (
                        <div
                          key={photo.key}
                          className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors ${
                            index === 4 ? 'col-span-2' : ''
                          }`}
                          onClick={() => {
                            if (isValid) {
                              setSelectedPhoto(ensureDataUri(photoData));
                            }
                          }}
                        >
                          <img
                            src={ensureDataUri(photoData, isValid ? 'default' : 'not_captured')}
                            alt={photo.label}
                            className="w-full h-full object-cover"
                          />
                          {!isValid && (
                            <div className="absolute top-2 right-2">
                              <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                                Not Captured
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="text-white text-xs font-medium">{photo.icon} {photo.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* NON-MOBILE CHANNELS: Fayda photo + Recorded face video + Selfie snapshot */}
            {customer.channel && customer.channel !== 'mobile_app' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Fayda Photo */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Fayda ID Photo (Reference)</p>
                    <div
                      className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border-2 border-blue-500 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedPhoto(ensureDataUri(customer.faydaPhoto))}
                    >
                      <img src={ensureDataUri(customer.faydaPhoto)} alt="Fayda Photo" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                        <p className="text-white text-sm font-medium">Fayda ID Photo</p>
                        <p className="text-white/80 text-xs">Official Identity Photo</p>
                      </div>
                      <div className="absolute top-3 right-3">
                        <Eye className="w-5 h-5 text-white drop-shadow-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Selfie Snapshot (captured from video) */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Selfie Snapshot (from Video)</p>
                    {hasValidPhoto(customer.selfiePhoto) ? (
                      <div
                        className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border-2 border-violet-500 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedPhoto(ensureDataUri(customer.selfiePhoto))}
                      >
                        <img src={ensureDataUri(customer.selfiePhoto)} alt="Selfie Snapshot" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-sm font-medium">📸 Selfie Snapshot</p>
                          <p className="text-white/80 text-xs">Captured from recorded video</p>
                        </div>
                        <div className="absolute top-3 right-3">
                          <Eye className="w-5 h-5 text-white drop-shadow-lg" />
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-[3/4] bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
                        <Camera className="w-10 h-10 text-gray-300 mb-2" />
                        <p className="text-gray-400 text-sm font-medium">No Selfie Available</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recorded Face Video */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Recorded Face Video</p>
                  {customer.faceVideoId ? (
                    <div className="bg-gray-50 rounded-xl border-2 border-violet-300 p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                          <Video className="w-5 h-5 text-violet-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Face Verification Video</p>
                          <p className="text-sm text-gray-500">Video ID: {customer.faceVideoId}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          customer.channel === 'web' ? 'bg-blue-100 text-blue-700' :
                          customer.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' :
                          customer.channel === 'telegram' ? 'bg-sky-100 text-sky-700' :
                          customer.channel === 'superapp' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {customer.channel === 'web' ? 'Web' :
                           customer.channel === 'whatsapp' ? 'WhatsApp' :
                           customer.channel === 'telegram' ? 'Telegram' :
                           customer.channel === 'superapp' ? 'SuperApp' :
                           customer.channel}
                        </span>
                      </div>
                      {/* Video player — loads from fayda backend */}
                      <video
                        controls
                        className="w-full rounded-lg bg-black"
                        style={{ maxHeight: '400px' }}
                        preload="metadata"
                      >
                        <source src={`/api/face/video/${customer.faceVideoId}`} type="video/webm" />
                        <source src={`/api/face/video/${customer.faceVideoId}`} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                      <div className="mt-3 flex items-start gap-2 p-3 bg-violet-50 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-violet-700">
                          <span className="font-medium">Manual Review Required:</span> Compare the person in the video with the Fayda ID photo above. Ensure the face matches and there are no signs of spoofing (e.g. photo of a photo, screen recording, masks).
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
                      <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No Video Available</p>
                      <p className="text-gray-400 text-sm mt-1">The recorded face video was not submitted or is not accessible.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scanned Documents */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Scanned Documents</h2>
                <p className="text-sm text-gray-500">
                  {customer.maritalStatus === 'M'
                    ? 'Supporting documents (e.g. marriage certificate, ID)'
                    : 'Supporting documents submitted by the customer'}
                </p>
              </div>
            </div>

            {customer.marriageCertificatePhoto && hasValidPhoto(customer.marriageCertificatePhoto) ? (() => {
              // Split by ||| delimiter — multiple documents are joined this way
              const docParts = customer.marriageCertificatePhoto.includes('|||')
                ? customer.marriageCertificatePhoto.split('|||')
                : [customer.marriageCertificatePhoto];
              const validDocs = docParts.filter((part: string) => part && part.length > 100);

              return (
                <div>
                  {validDocs.length > 1 && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="bg-pink-100 text-pink-700 text-sm font-medium px-3 py-1 rounded-full">
                        {validDocs.length} Documents
                      </span>
                      <span className="text-sm text-gray-500">Click any document to view full size</span>
                    </div>
                  )}
                  <div className={`grid gap-4 ${validDocs.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    {validDocs.map((docBase64: string, idx: number) => (
                      <div
                        key={idx}
                        className="relative bg-gray-50 rounded-xl overflow-hidden border-2 border-pink-200 cursor-pointer hover:border-pink-400 hover:shadow-md transition-all"
                        onClick={() => setSelectedPhoto(ensureDataUri(docBase64))}
                      >
                        <img
                          src={ensureDataUri(docBase64)}
                          alt={`Scanned Document ${idx + 1}`}
                          className="w-full object-contain bg-white"
                          style={{ maxHeight: validDocs.length > 1 ? '350px' : '500px' }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-sm font-medium">
                            {validDocs.length > 1 ? `Document ${idx + 1} of ${validDocs.length}` : 'Scanned Document'}
                          </p>
                          <p className="text-white/80 text-xs">Click to view full size</p>
                        </div>
                        {validDocs.length > 1 && (
                          <div className="absolute top-3 left-3">
                            <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow">
                              {idx + 1}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <Eye className="w-5 h-5 text-white drop-shadow-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })() : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No Documents Scanned</p>
                <p className="text-gray-500 text-sm mt-1">
                  Customer did not submit any scanned documents.
                </p>
              </div>
            )}
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoItem label="Full Name (English)" value={customer.fullName} />
              <InfoItem label="Full Name (Amharic)" value={customer.fullNameAmharic || '-'} />
              <InfoItem label="Fayda UIN" value={customer.uin} />
              <InfoItem label="Fayda FCN" value={customer.fcn || '-'} />
              <InfoItem label="Gender" value={customer.gender === 'male' ? 'Male' : 'Female'} />
              <InfoItem label="Date of Birth" value={customer.dateOfBirth} />
              <InfoItem label="Marital Status" value={getMaritalStatusLabel(customer.maritalStatus)} />
              <InfoItem label="Mother's Maiden Name" value={customer.motherMaidenName || '-'} />
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoItem label="Phone Number" value={customer.phone} icon={<Phone className="w-4 h-4" />} />
              <InfoItem label="Email Address" value={customer.email || '-'} icon={<Mail className="w-4 h-4" />} />
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Address Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InfoItem label="Region" value={customer.region || '-'} />
              <InfoItem label="Zone" value={customer.zone || '-'} />
              <InfoItem label="Woreda" value={customer.woreda || '-'} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Account Details</h2>
            </div>

            <div className="space-y-4">
              <InfoItem label="Account Type" value={customer.accountTypeName || customer.accountType} />
              <InfoItem label="Account Type ID" value={customer.accountTypeId} />
              {customer.tierName && (
                <>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Account Tier</p>
                  </div>
                  <InfoItem label="Tier" value={customer.tierName} />
                  <InfoItem label="Tier ID" value={customer.tierId || ''} />
                  <InfoItem label="Interest Rate" value={`${customer.tierInterestRate || 0}% p.a.`} />
                </>
              )}
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Branch Info</p>
              </div>
              <InfoItem label="Branch" value={customer.branch} />
              <InfoItem label="Branch Code" value={customer.branchCode} />
              {customer.isExistingCustomer && (
                <>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Existing Customer</p>
                  </div>
                  <InfoItem label="Existing CIF" value={customer.existingCif || ''} />
                  {customer.existingAccountNumber && (
                    <InfoItem label="Existing Account Number" value={customer.existingAccountNumber} />
                  )}
                </>
              )}

              <InfoItem label="Escalated By" value={customer.escalatedBy || ''} />
              <InfoItem label="Approved By" value={customer.approvedBy || ''} />
             
              <InfoItem label="Initial Deposit" value={`ETB ${customer.initialDeposit?.toLocaleString() || 0}`} />
              {customer.cifNumber && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-1">CIF Number</p>
                  <p className="text-xl font-bold text-green-600">{customer.cifNumber}</p>
                </div>
              )}
              {customer.accountNumber && (
                <div className="pt-3">
                  <p className="text-sm text-gray-500 mb-1">Account Number</p>
                  <p className="text-xl font-bold text-blue-600">{customer.accountNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Employment Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Employment</h2>
            </div>

            <div className="space-y-4">
              <InfoItem label="Occupation" value={getOccupationLabel(customer.occupation, customer.otherOccupation)} />
              <InfoItem label="Institution" value={getIndustryLabel(customer.industry, customer.otherIndustry)} />
              <InfoItem label="Source of Wealth" value={getWealthSourceLabel(customer.wealthSource, customer.otherWealthSource)} />
              <InfoItem label="Annual Income" value={`ETB ${(customer.annualIncome || 0).toLocaleString()}`} />
            </div>
          </div>

          {/* KYC / CIF Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-rose-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">KYC / CIF Details</h2>
            </div>

            <div className="space-y-4">
              <InfoItem label="Promotion Type" value={getPromotionTypeLabel(customer.promotionType || '')} icon={<Megaphone className="w-4 h-4" />} />
              <InfoItem label="Tax Identity (TIN)" value={customer.taxIdentity || '-'} />
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">CIF Default Values</p>
              </div>
              <InfoItem label="Customer Risk Rating" value={customer.customerRiskRating || 'LOW'} />
              <InfoItem label="Customer Segmentation" value={customer.customerSegmentation || 'RETAIL CUSTOMER'} />
              <InfoItem label="Maintenance Fee Waived" value={customer.maintFeeWaived === 'Y' ? 'Yes' : customer.maintFeeWaived === 'N' ? 'No' : (customer.maintFeeWaived || 'Yes')} />
              <InfoItem label="SLA Enabled" value={customer.slaEnable === 'Y' ? 'Yes' : customer.slaEnable === 'N' ? 'No' : (customer.slaEnable || 'No')} />
              <InfoItem label="Lead RM" value={customer.leadRm || 'NA'} />
              <InfoItem label="Currency Redemption Purpose" value={customer.currencyRedemptionPurpose === 'Y' ? 'Yes' : customer.currencyRedemptionPurpose === 'N' ? 'No' : (customer.currencyRedemptionPurpose || 'Yes')} />
              <InfoItem label="Sanction List Status" value={customer.sanctionListStatus === 'N' ? 'Not in Sanction List' : customer.sanctionListStatus === 'Y' ? 'In Sanction List' : (customer.sanctionListStatus || 'Not in Sanction List')} />
              <InfoItem label="Politically Exposed Person" value={customer.politicallyExposedPerson || 'NO'} />
              <InfoItem label="Customer Type" value={customer.customerType || 'Individual'} />
              <InfoItem label="ID Type" value={customer.idType || 'National ID'} />
              <InfoItem label="Nationality" value={customer.nationality || 'ETHIOPIA'} />
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-slate-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Application Submitted</p>
                  <p className="text-xs text-gray-500">{formatDate(customer.createdAt)}</p>
                </div>
              </div>
              {customer.approvedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 bg-green-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {customer.status === 'auto_approved' ? 'Auto Approved' : 'Approved'}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(customer.approvedAt)}</p>
                  </div>
                </div>
              )}
              {customer.rejectedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 bg-red-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Rejected</p>
                    <p className="text-xs text-gray-500">{formatDate(customer.rejectedAt)}</p>
                    {customer.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">{customer.rejectionReason}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[95vh] overflow-auto rounded-lg" onClick={(e) => e.stopPropagation()}>
            <img src={ensureDataUri(selectedPhoto)} alt="Full size photo" className="max-w-full object-contain rounded-lg" />
            <button
              className="fixed top-6 right-6 w-10 h-10 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors z-10"
              onClick={() => setSelectedPhoto(null)}
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Application</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this application. This will be recorded in the audit log.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              rows={4}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isRejecting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Applicant Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Return to Applicant</h3>
            <p className="text-gray-600 mb-4">
              Explain what the applicant needs to amend. The application will be sent back so they can correct and resubmit (instead of a hard rejection).
            </p>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Selfie unclear, please re-record your verification video..."
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows={4}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={isReturning}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {isReturning ? 'Returning...' : 'Return Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate (PEP) Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Escalate for Second-Level Approval</h3>
            <p className="text-gray-600 mb-4">
              Use this for Politically Exposed Persons (PEP) or other cases needing senior sign-off. The application is routed to a Senior Approver for second-level approval instead of being rejected.
            </p>
            <textarea
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="e.g. Applicant is a PEP — requires senior approval and Enhanced Due Diligence..."
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              rows={4}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowEscalateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEscalate}
                disabled={isEscalating}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isEscalating ? 'Escalating...' : 'Escalate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <p className="font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
