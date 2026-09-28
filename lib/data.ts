// Mock data for the admin dashboard

export type WorkflowMode = 'auto' | 'manual';

export interface VerificationPhotos {
  faceCenter: string;
  eyeBlink: string;
  headLeft: string;
  headRight: string;
  smile: string;
}

export interface Customer {
  id: string;
  fullName: string;
  fullNameAmharic: string;
  email: string;
  phone: string;
  accountType: string;
  accountTypeId: string;
  status: 'pending' | 'verified' | 'approved' | 'rejected' | 'auto_approved';
  createdAt: string;
  approvedAt?: string;
  branch: string;
  branchCode: string;
  uin: string;
  fcn: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  region: string;
  zone: string;
  woreda: string;
  occupation: string;
  industry: string;
  wealthSource: string;
  annualIncome: number;
  initialDeposit: number;
  motherMaidenName: string;
  maritalStatus: string;
  faydaPhoto: string;
  verificationPhotos: VerificationPhotos;
  faceMatchScore: number;
  customerNumber?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface DailyStats {
  date: string;
  newAccounts: number;
  pendingReview: number;
  approved: number;
  autoApproved: number;
  rejected: number;
}

export interface AccountTypeStats {
  type: string;
  count: number;
  percentage: number;
}

export interface WorkflowSettings {
  mode: WorkflowMode;
  autoApprovalEnabled: boolean;
  minFaceMatchScore: number;
  requireManualReviewAbove: number;
  notifyOnAutoApproval: boolean;
  notifyOnManualRequired: boolean;
}

export const defaultWorkflowSettings: WorkflowSettings = {
  mode: 'manual',
  autoApprovalEnabled: false,
  minFaceMatchScore: 85,
  requireManualReviewAbove: 100000,
  notifyOnAutoApproval: true,
  notifyOnManualRequired: true,
};

// Seeded random number generator for deterministic data
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const ethiopianFirstNames = [
  'Abebe', 'Kebede', 'Tadesse', 'Mulugeta', 'Girma', 'Tesfaye', 'Dawit', 'Solomon',
  'Mekdes', 'Tigist', 'Hiwot', 'Sara', 'Bethlehem', 'Rahel', 'Meron', 'Selam',
  'Yohannes', 'Amanuel', 'Bereket', 'Henok', 'Kaleb', 'Nahom', 'Eyob', 'Mikael'
];

const ethiopianLastNames = [
  'Bekele', 'Haile', 'Gebre', 'Tadesse', 'Wolde', 'Desta', 'Mengistu', 'Assefa',
  'Tekle', 'Alemu', 'Negash', 'Abera', 'Tesfaye', 'Getachew', 'Mekonnen', 'Kebede'
];

const accountTypes = [
  { id: 'ZCLUB_SPECIAL', name: 'Z-Club Special Saving' },
  { id: 'EXECUTIVE', name: 'Executive Saving' },
  { id: 'ZCLUB_CHILDREN', name: 'Z-Club Children Saving' },
  { id: 'YOUTH_SPECIAL', name: 'Youth Special Saving' },
];

const branches = [
  { name: 'Main Branch - Lideta', code: '001' },
  { name: 'Bole Branch', code: '002' },
  { name: 'Megenagna Branch', code: '003' },
  { name: 'Piassa Branch', code: '004' },
  { name: 'Mexico Branch', code: '005' },
  { name: 'Kazanchis Branch', code: '006' },
  { name: 'CMC Branch', code: '007' },
  { name: 'Ayat Branch', code: '008' },
  { name: 'Summit Branch', code: '009' },
];

const regions = ['Addis Ababa', 'Oromia', 'Amhara', 'SNNPR', 'Tigray'];
const occupations = ['PSE', 'GSE', 'SE', 'STUD', 'RET', 'HW', 'DIP', 'NGOE', 'ROE', 'UNEMP', 'O'];
const industries = ['BN', 'CONS', 'AFF', 'FM', 'ES', 'HS', 'INS', 'CS', 'SOFT', 'TELE', 'HO', 'WHL', 'NA', 'O'];
const wealthSources = ['SAL', 'SB', 'PS', 'INV', 'INH', 'PW', 'RET', 'SOA', 'GF', 'O'];
const maritalStatuses = ['S', 'M', 'D', 'W'];

const statuses: Customer['status'][] = ['pending', 'verified', 'approved', 'rejected', 'auto_approved'];

const placeholderPhoto = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NDc0OGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5GYXlkYSBQaG90bzwvdGV4dD48L3N2Zz4=';

const verificationPhotoLabels = ['Face Center', 'Eye Blink', 'Head Left', 'Head Right', 'Smile'];
const verificationPhotos: Record<string, string> = {};
verificationPhotoLabels.forEach(label => {
  const svg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f1f5f9"/><circle cx="100" cy="80" r="50" fill="#cbd5e1"/><ellipse cx="100" cy="180" rx="60" ry="40" fill="#cbd5e1"/><text x="50%" y="95%" font-family="Arial" font-size="12" fill="#64748b" text-anchor="middle">${label}</text></svg>`;
  verificationPhotos[label] = `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(svg) : Buffer.from(svg).toString('base64')}`;
});

const rejectionReasons = [
  'Face match score below threshold',
  'Invalid document detected',
  'Liveness check failed',
  'Photo quality insufficient',
  'Suspicious activity detected',
  'Multiple failed verification attempts',
];

// Generate deterministic customer data
function generateCustomer(index: number, rand: () => number): Customer {
  const firstName = ethiopianFirstNames[Math.floor(rand() * ethiopianFirstNames.length)];
  const lastName = ethiopianLastNames[Math.floor(rand() * ethiopianLastNames.length)];
  const gender = rand() > 0.5 ? 'male' : 'female';
  const statusIndex = Math.floor(rand() * statuses.length);
  const status = statuses[statusIndex];
  const accountType = accountTypes[Math.floor(rand() * accountTypes.length)];
  const branch = branches[Math.floor(rand() * branches.length)];

  const daysAgo = Math.floor(rand() * 30);
  const birthYear = 1960 + Math.floor(rand() * 47);
  const birthMonth = Math.floor(rand() * 12) + 1;
  const birthDay = Math.floor(rand() * 28) + 1;

  let faceMatchScore = 70 + Math.floor(rand() * 30);

  const customer: Customer = {
    id: `ZB${String(10000 + index).padStart(6, '0')}`,
    fullName: `${firstName} ${lastName}`,
    fullNameAmharic: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
    phone: `+2519${String(Math.floor(10000000 + rand() * 90000000))}`,
    accountType: accountType.name,
    accountTypeId: accountType.id,
    status,
    createdAt: `2025-01-${String(20 - daysAgo).padStart(2, '0')}T10:00:00.000Z`,
    branch: branch.name,
    branchCode: branch.code,
    uin: `ETH${String(Math.floor(1000000000 + rand() * 9000000000))}`,
    fcn: `${String(Math.floor(1000000000000000 + rand() * 9000000000000000))}`,
    gender,
    dateOfBirth: `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`,
    region: regions[Math.floor(rand() * regions.length)],
    zone: 'Zone ' + (Math.floor(rand() * 10) + 1),
    woreda: 'Woreda ' + (Math.floor(rand() * 15) + 1),
    occupation: occupations[Math.floor(rand() * occupations.length)],
    industry: industries[Math.floor(rand() * industries.length)],
    wealthSource: wealthSources[Math.floor(rand() * wealthSources.length)],
    annualIncome: Math.floor(50000 + rand() * 500000),
    initialDeposit: Math.floor(5000 + rand() * 200000),
    motherMaidenName: ethiopianLastNames[Math.floor(rand() * ethiopianLastNames.length)],
    maritalStatus: maritalStatuses[Math.floor(rand() * maritalStatuses.length)],
    faydaPhoto: placeholderPhoto,
    verificationPhotos: {
      faceCenter: verificationPhotos['Face Center'],
      eyeBlink: verificationPhotos['Eye Blink'],
      headLeft: verificationPhotos['Head Left'],
      headRight: verificationPhotos['Head Right'],
      smile: verificationPhotos['Smile'],
    },
    faceMatchScore,
  };

  if (status === 'approved' || status === 'auto_approved') {
    customer.approvedAt = `2025-01-${String(21 - daysAgo).padStart(2, '0')}T14:00:00.000Z`;
    customer.customerNumber = `CIF${String(100000 + index).padStart(7, '0')}`;
  }

  if (status === 'rejected') {
    customer.rejectedAt = `2025-01-${String(21 - daysAgo).padStart(2, '0')}T12:00:00.000Z`;
    customer.rejectionReason = rejectionReasons[Math.floor(rand() * rejectionReasons.length)];
    customer.faceMatchScore = 40 + Math.floor(rand() * 30);
  }

  return customer;
}

// Generate 100 customers with seeded random
const rand = seededRandom(12345);
export const customers: Customer[] = Array.from({ length: 100 }, (_, i) => generateCustomer(i, rand));

// Static daily stats
export const dailyStats: DailyStats[] = [
  { date: '2025-01-07', newAccounts: 12, pendingReview: 3, approved: 5, autoApproved: 3, rejected: 1 },
  { date: '2025-01-08', newAccounts: 15, pendingReview: 4, approved: 6, autoApproved: 4, rejected: 1 },
  { date: '2025-01-09', newAccounts: 10, pendingReview: 2, approved: 4, autoApproved: 3, rejected: 1 },
  { date: '2025-01-10', newAccounts: 18, pendingReview: 5, approved: 7, autoApproved: 5, rejected: 1 },
  { date: '2025-01-11', newAccounts: 8, pendingReview: 2, approved: 3, autoApproved: 2, rejected: 1 },
  { date: '2025-01-12', newAccounts: 14, pendingReview: 4, approved: 5, autoApproved: 4, rejected: 1 },
  { date: '2025-01-13', newAccounts: 16, pendingReview: 4, approved: 6, autoApproved: 5, rejected: 1 },
  { date: '2025-01-14', newAccounts: 11, pendingReview: 3, approved: 4, autoApproved: 3, rejected: 1 },
  { date: '2025-01-15', newAccounts: 13, pendingReview: 3, approved: 5, autoApproved: 4, rejected: 1 },
  { date: '2025-01-16', newAccounts: 17, pendingReview: 5, approved: 6, autoApproved: 5, rejected: 1 },
  { date: '2025-01-17', newAccounts: 9, pendingReview: 2, approved: 4, autoApproved: 2, rejected: 1 },
  { date: '2025-01-18', newAccounts: 14, pendingReview: 4, approved: 5, autoApproved: 4, rejected: 1 },
  { date: '2025-01-19', newAccounts: 12, pendingReview: 3, approved: 5, autoApproved: 3, rejected: 1 },
  { date: '2025-01-20', newAccounts: 15, pendingReview: 4, approved: 6, autoApproved: 4, rejected: 1 },
];

export const accountTypeStats: AccountTypeStats[] = [
  { type: 'Z-Club Special Saving', count: 35, percentage: 35 },
  { type: 'Executive Saving', count: 25, percentage: 25 },
  { type: 'Youth Special Saving', count: 20, percentage: 20 },
  { type: 'Z-Club Children Saving', count: 20, percentage: 20 },
];

// Computed stats from actual data
const pendingCount = customers.filter(c => c.status === 'pending' || c.status === 'verified').length;
const totalDeposits = customers.reduce((sum, c) => sum + c.initialDeposit, 0);

export const summaryStats = {
  totalCustomers: customers.length,
  pendingReview: pendingCount,
  approvedToday: 8,
  autoApprovedToday: 4,
  totalDeposits: totalDeposits,
  weeklyGrowth: 12.5,
  monthlyGrowth: 23.8,
};

// Helper functions
export function getOccupationLabel(code: string): string {
  const labels: Record<string, string> = {
    'PSE': 'Private Sector Employed',
    'GSE': 'Government Sector Employed',
    'SE': 'Self-Employed',
    'STUD': 'Student',
    'RET': 'Retired',
    'HW': 'Housewife',
    'DIP': 'Diplomat',
    'NGOE': 'NGO Employed',
    'ROE': 'Religious Org Employed',
    'UNEMP': 'Unemployed',
    'O': 'Other',
    // Legacy codes
    'EMP': 'Employed',
    'SELF': 'Self-Employed',
    'GOV': 'Government Employee',
    'STU': 'Student',
  };
  return labels[code] || code;
}

export function getIndustryLabel(code: string): string {
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
  return labels[code] || code;
}

export function getWealthSourceLabel(code: string): string {
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
  return labels[code] || code;
}

export function getMaritalStatusLabel(code: string): string {
  const labels: Record<string, string> = {
    'S': 'Single',
    'M': 'Married',
    'D': 'Divorced',
    'W': 'Widowed',
  };
  return labels[code] || code;
}

export function getStatusColor(status: Customer['status']): string {
  const colors: Record<Customer['status'], string> = {
    pending: 'bg-amber-100 text-amber-800',
    verified: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    auto_approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return colors[status];
}

export function getStatusLabel(status: Customer['status']): string {
  const labels: Record<Customer['status'], string> = {
    pending: 'Pending Review',
    verified: 'Verified',
    approved: 'Approved',
    auto_approved: 'Auto Approved',
    rejected: 'Rejected',
  };
  return labels[status];
}
