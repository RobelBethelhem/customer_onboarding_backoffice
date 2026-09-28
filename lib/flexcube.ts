/**
 * FlexCube SOAP Web Service Client
 *
 * Integrates with Oracle FlexCube Universal Banking System (FCUBS)
 * for CIF (Customer Information File) creation and Account creation.
 *
 * Flow:
 *   1. CreateCustomer (FCUBSCustomerService) → returns CUSTNO (CIF number)
 *   2. CreateCustAcc  (FCUBSAccService)       → returns ACC (account number)
 *
 * Both calls use the same SOAP envelope structure with FCUBS_HEADER + FCUBS_BODY.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlexCubeConfig {
  /** SOAP endpoint URL for FCUBSCustomerService (CIF creation) */
  customerServiceUrl: string;
  /** SOAP endpoint URL for FCUBSAccService (Account creation) */
  accountServiceUrl: string;
  /** FlexCube user ID (e.g., 'FYDA_USR') */
  userId: string;
  /** FlexCube source identifier (e.g., 'EXTFYDA' or 'EXTIB') */
  source: string;
  /** Default branch code (e.g., '103') */
  defaultBranch: string;
  /** Timeout in ms for SOAP calls */
  timeout: number;
}

export interface CreateCIFRequest {
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;       // YYYY-MM-DD
  gender: string;            // 'M' or 'F'
  phone: string;
  email: string;
  motherMaidenName: string;
  maritalStatus: string;     // 'S', 'M', 'D', 'W'
  nationality: string;       // e.g., 'ET'
  uin: string;               // Fayda UIN (used as SSN)
  // Address
  region: string;
  zone: string;
  woreda: string;
  kebele?: string;
  houseNumber?: string;
  // Employment
  occupation: string;
  otherOccupation?: string;
  industry: string;
  otherIndustry?: string;
  wealthSource: string;
  otherWealthSource?: string;
  annualIncome: number;
  // Account opening details
  branchCode: string;
  accountTypeId?: string;
  promotionType?: string;
  customerSegmentation?: string;
  // Maker / Checker
  maker?: string;
  checker?: string;
}

export interface CreateCIFResult {
  success: boolean;
  cifNumber?: string;       // CUSTNO from FlexCube (e.g., '1154264')
  message: string;
  rawResponse?: string;
}

export interface CreateAccountRequest {
  cifNumber: string;         // CIF from step 1
  customerName: string;
  branchCode: string;
  accountClass: string;      // FlexCube account class (e.g., 'SPRI', 'ZCLUB')
  tierId: string;
  currency: string;          // 'ETB'
}

export interface CreateAccountResult {
  success: boolean;
  accountNumber?: string;    // ACC from FlexCube (e.g., '1031110039039171')
  cifNumber?: string;
  message: string;
  rawResponse?: string;
}

// ─── Default Configuration ────────────────────────────────────────────────────

export const defaultFlexCubeConfig: FlexCubeConfig = {
  customerServiceUrl: 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService',
  accountServiceUrl: 'http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService',
  userId: 'FYDA_USR',
  source: 'EXTFYDA',
  defaultBranch: '103',
  timeout: 30000,
};

// ─── Account Class Mapping ────────────────────────────────────────────────────

/**
 * Maps application account type IDs to FlexCube ACCLS (Account Class) codes.
 * This is configured per bank — adjust values to match your FlexCube setup.
 */
const ACCOUNT_CLASS_MAP: Record<string, string> = {
  // Z-Club Special Saving tiers
  '021':  'SPRI',
  '141':    'SPRI',
  '151':    'SPRI',
  '161':    'SPRI',
  // 'ZCLUB_S_PLT':    'SPRI',
  // Z-Club Children Saving
  // 'ZCLUB_CHILDREN': 'SPRI',
  // Youth Special Saving tiers
  '341':  'SPRI',
  '140':      'SPRI',
  '111':      'SPRI',
  '101':      'SPRI',
  '110':      'SPRI',
};

export function getAccountClass(tierId: string): string {
  return ACCOUNT_CLASS_MAP[tierId] || 'SPRI';
}

// ─── FlexCube LOV (List of Values) Mappings ──────────────────────────────────
// App dropdown values now match FlexCube LOV directly (from FCUBSPRD.UDTM_LOV).
// These maps handle: (1) direct pass-through for matching values,
// (2) backward compatibility for old data with legacy codes (EMP, IT, etc.),
// (3) safe defaults for any unrecognized values.

/**
 * Map occupation code → FlexCube EMPSTAT field
 * EMPSTAT is a separate field from UDF OCCUPATION — it goes in Custprof.
 */
const FLEXCUBE_EMPSTAT_MAP: Record<string, string> = {
  'PSE': 'U',    // Private Sector → Employed (U=Unknown/General)
  'GSE': 'U',    // Government Sector → Employed
  'SE': 'S',     // Self-Employed → S
  'STUD': 'U',   // Student → U
  'RET': 'R',    // Retired → R
  'HW': 'U',     // Housewife → U
  'DIP': 'U',    // Diplomat → U
  'NGOE': 'U',   // NGO Employed → U
  'ROE': 'U',    // Religious Org → U
  'UNEMP': 'U',  // Unemployed → U
  'O': 'U',      // Other → U
  // Legacy codes (backward compatibility for old mobile app data)
  'EMP': 'U',
  'SELF': 'S',
  'GOV': 'U',
  'STU': 'U',
};

/**
 * Map occupation code → FlexCube UDF OCCUPATION LOV
 * Values: DIP, GSE, HW, NGOE, O, PSE, RET, ROE, SE, STUD, UNEMP
 */
const FLEXCUBE_OCCUPATION_MAP: Record<string, string> = {
  // Direct FlexCube LOV values (pass-through)
  'PSE': 'PSE', 'GSE': 'GSE', 'SE': 'SE', 'STUD': 'STUD', 'RET': 'RET',
  'HW': 'HW', 'DIP': 'DIP', 'NGOE': 'NGOE', 'ROE': 'ROE', 'UNEMP': 'UNEMP', 'O': 'O',
  // Legacy codes → closest FlexCube match
  'EMP': 'PSE', 'SELF': 'SE', 'GOV': 'GSE', 'STU': 'STUD',
};

/**
 * Map industry code → FlexCube UDF INDUSTRY LOV
 * 48 values from FlexCube LOV — app dropdown now uses these directly.
 */
const FLEXCUBE_INDUSTRY_MAP: Record<string, string> = {
  // Direct FlexCube LOV values (pass-through) — all 48
  'AD': 'AD', 'AER': 'AER', 'AFF': 'AFF', 'AGC': 'AGC', 'AM': 'AM',
  'APM': 'APM', 'APR': 'APR', 'AT': 'AT', 'BN': 'BN', 'BRD': 'BRD',
  'CAGM': 'CAGM', 'CD': 'CD', 'CEP': 'CEP', 'CM': 'CM', 'CONS': 'CONS',
  'CS': 'CS', 'EMPS': 'EMPS', 'ES': 'ES', 'FG': 'FG', 'FM': 'FM',
  'FSD': 'FSD', 'GS': 'GS', 'HO': 'HO', 'HS': 'HS', 'INS': 'INS',
  'INTRT': 'INTRT', 'MIN': 'MIN', 'MM': 'MM', 'MPV': 'MPV', 'MST': 'MST',
  'MVP': 'MVP', 'NA': 'NA', 'O': 'O', 'OG': 'OG', 'PM': 'PM',
  'PRN': 'PRN', 'PUB': 'PUB', 'SAE': 'SAE', 'SEC': 'SEC', 'SLG': 'SLG',
  'SM': 'SM', 'SOFT': 'SOFT', 'SR': 'SR', 'TELE': 'TELE', 'TEX': 'TEX',
  'TRUCK': 'TRUCK', 'UTI': 'UTI', 'WHL': 'WHL',
  // Legacy codes → closest FlexCube match
  'AGR': 'AFF', 'MAN': 'FM', 'TRD': 'WHL', 'SER': 'O', 'IT': 'CS',
  'FIN': 'BN', 'HLT': 'HS', 'EDU': 'ES',
};

/**
 * Map promotion type → FlexCube UDF PROMOTION_TYPE LOV
 * Values from FlexCube: Walk in customer, FACEBOOK, RADIO, TVAD, MAGAZINE,
 * Borrower, Payroll Account, Provident Fund Accounts, Share holder,
 * Zemen bank Staff account, Amendments on existing
 */
const FLEXCUBE_PROMOTION_MAP: Record<string, string> = {
  // Direct FlexCube LOV values (pass-through)
  'Walk in customer': 'Walk in customer',
  'FACEBOOK': 'FACEBOOK',
  'RADIO': 'RADIO',
  'TVAD': 'TVAD',
  'MAGAZINE': 'MAGAZINE',
  'Borrower': 'Borrower',
  'Payroll Account': 'Payroll Account',
  'Provident Fund Accounts': 'Provident Fund Accounts',
  'Share holder': 'Share holder',
  'Zemen bank Staff account': 'Zemen bank Staff account',
  'Amendments on existing': 'Amendments on existing',
  'CUSTOMER_REFERAL': 'CUSTOMER_REFERAL',
  // Legacy/channel codes
  'MAPP': 'Walk in customer',
  'WEB': 'Walk in customer',
  'WHATSAPP': 'Walk in customer',
};

/**
 * Format DOB for FlexCube — expects YYYY-MM-DD format
 * Input may be: "2000/09/11", "2000-09-11", "09/11/2000", etc.
 * FlexCube error: "Date of Birth cannot be blank"
 */
function formatDOB(dob: string): string {
  if (!dob) return '';

  // Already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;

  // YYYY/MM/DD → YYYY-MM-DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(dob)) return dob.replace(/\//g, '-');

  // MM/DD/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
    const parts = dob.split('/');
    return `${parts[2]}-${parts[0]}-${parts[1]}`;
  }

  // DD-MM-YYYY → YYYY-MM-DD
  if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
    const parts = dob.split('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // Try parsing as Date object
  const d = new Date(dob);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Return as-is if can't parse
  return dob;
}

/**
 * Format Fayda UIN for FlexCube SSN field
 *
 * FlexCube SSN validation requires pattern: ann-an-naaa
 *   a = alphabetic letter
 *   n = numeric digit
 *   Format: Letter Digit Digit - Letter Digit - Digit Letter Letter Letter
 *
 * Fayda UIN is 16 digits (e.g., "4621302843750872").
 * We derive the SSN from the UIN by converting digit→letter where 'a' positions require it.
 * Mapping: 0→A, 1→B, 2→C, 3→D, 4→E, 5→F, 6→G, 7→H, 8→I, 9→J
 *
 * Example: UIN "4621302843750872"
 *   digits used (offset 7): 8,4,3,7,5,0,8,7,2
 *   pattern:                 a,n,n,-,a,n,-,n,a,a,a
 *   result:                  I43-H5-0IHC
 */
function formatSSN(uin: string): string {
  if (!uin) return '';

  // Already in ann-an-naaa format? Return as-is
  if (/^[A-Za-z]\d{2}-[A-Za-z]\d-\d[A-Za-z]{3}$/.test(uin.trim())) {
    return uin.trim().toUpperCase();
  }

  // Extract only digits from UIN
  const digits = uin.replace(/\D/g, '');
  if (digits.length < 10) {
    // Pad if too short
    const padded = digits.padEnd(10, '0');
    return formatSSNFromDigits(padded);
  }

  return formatSSNFromDigits(digits);
}

function formatSSNFromDigits(digits: string): string {
  // Digit-to-letter mapping for 'a' positions
  const digitToLetter = (d: string): string => {
    const map: Record<string, string> = {
      '0': 'A', '1': 'B', '2': 'C', '3': 'D', '4': 'E',
      '5': 'F', '6': 'G', '7': 'H', '8': 'I', '9': 'J',
    };
    return map[d] || 'A';
  };

  // Use digits from later part of UIN for better uniqueness
  // For 16-digit Fayda UIN, use digits 7-15 (the last 9 digits)
  // This avoids collisions from previous attempts that used digits 0-8
  const offset = digits.length >= 16 ? 7 : 0;

  // Pattern: ann-an-naaa  (a=letter, n=digit)
  const a1 = digitToLetter(digits[offset + 0]);  // a
  const n1 = digits[offset + 1];                  // n
  const n2 = digits[offset + 2];                  // n
  const a2 = digitToLetter(digits[offset + 3]);  // a
  const n3 = digits[offset + 4];                  // n
  const n4 = digits[offset + 5];                  // n
  const a3 = digitToLetter(digits[offset + 6]);  // a
  const a4 = digitToLetter(digits[offset + 7]);  // a
  const a5 = digitToLetter(digits[offset + 8]);  // a

  // Result: ann-an-naaa
  return `${a1}${n1}${n2}-${a2}${n3}-${n4}${a3}${a4}${a5}`;
}

// ─── SOAP Envelope Builders ───────────────────────────────────────────────────

function generateMsgId(): string {
  return Date.now().toString();
}

function generateCorrelId(): string {
  return `${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
}

function escapeXml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build SOAP envelope for CreateCustomer (CIF creation)
 * Aligned with working Fayda integration XML structure
 */
function buildCreateCustomerEnvelope(data: CreateCIFRequest, config: FlexCubeConfig): string {
  const msgId = generateMsgId();
  // UUID-style correlId matching working Fayda format
  const correlId = `${msgId.substring(0, 8)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 14)}`;
  const branch = data.branchCode || config.defaultBranch;

  // Short name: last name + msgId for uniqueness (matching Fayda format: DEBISA17713960656140080)
  const shortName = `${data.lastName.substring(0, 6).toUpperCase()}${msgId}`;

  // Map app values → FlexCube LOV values
  const fcOccupation = FLEXCUBE_OCCUPATION_MAP[data.occupation] || 'O';
  const fcIndustry = FLEXCUBE_INDUSTRY_MAP[data.industry] || 'O';
  const fcPromotion = FLEXCUBE_PROMOTION_MAP[data.promotionType || 'Walk in customer'] || 'Walk in customer';

  // Format DOB to YYYY-MM-DD
  const dob = formatDOB(data.dateOfBirth);

  // Annual income as decimal
  data.annualIncome = data.annualIncome / 12;
  const annualIncome = (data.annualIncome || 0).toFixed(2);

  // Passport dates — matching working Fayda XML: today + 101 years
  // FlexCube server is in 2025, so use 2025-based dates
  const pptIssDt = '2025-02-18';
  const pptExpDt = '2126-02-18';

  // NATIONID — use actual UIN, but add random suffix to avoid duplicates from previous attempts
  // const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  // const nationId = data.uin ? `${data.uin}${randomSuffix}` : msgId;

  //const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const nationId = data.uin;

  // Phone number — ensure +251 prefix (matching working Fayda XML format)
  let phoneFormatted = data.phone || '';
  if (phoneFormatted.startsWith('0')) {
    phoneFormatted = `+251${phoneFormatted.substring(1)}`;
  } else if (!phoneFormatted.startsWith('+')) {
    phoneFormatted = `+251${phoneFormatted}`;
  }

  // TITLE removed — ATO/MR/W/RO all rejected on branch 164 (works on branch 349 only)

  console.log(`[FlexCube] Field mappings:`);
  console.log(`  DOB: "${data.dateOfBirth}" → "${dob}"`);
  console.log(`  NATIONID: "${data.uin}" → "${nationId}"`);
  console.log(`  PHONE: "${data.phone}" → "${phoneFormatted}"`);
  console.log(`  OCCUPATION UDF: "${data.occupation}" → "${fcOccupation}"`);
  console.log(`  INDUSTRY UDF: "${data.industry}" → "${fcIndustry}"`);
  console.log(`  PROMOTION_TYPE UDF: "${data.promotionType}" → "${fcPromotion}"`);
  console.log(`  ANNUAL_INCOME UDF: ${annualIncome} ETB`);

  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:fcub="http://fcubs.ofss.com/service/FCUBSCustomerService">
   <soapenv:Header/>
   <soapenv:Body>
      <fcub:CREATECUSTOMER_FSFS_REQ>
         <fcub:FCUBS_HEADER>
            <fcub:SOURCE>${escapeXml(config.source)}</fcub:SOURCE>
            <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
            <fcub:MSGID>${msgId}</fcub:MSGID>
            <fcub:CORRELID>${correlId}</fcub:CORRELID>
            <fcub:USERID>${escapeXml(config.userId)}</fcub:USERID>
            <fcub:BRANCH>${escapeXml(branch)}</fcub:BRANCH>
            <fcub:SERVICE>FCUBSCustomerService</fcub:SERVICE>
            <fcub:OPERATION>CreateCustomer</fcub:OPERATION>
            <fcub:ACTION>NEW</fcub:ACTION>
         </fcub:FCUBS_HEADER>
         <fcub:FCUBS_BODY>
            <fcub:Customer-Full>
                    <fcub:CTYPE>I</fcub:CTYPE>
                    <fcub:NAME>${escapeXml(data.fullName.toUpperCase())}</fcub:NAME>
                    <fcub:ADDRLN1>${escapeXml(data.region) || 'ADDIS ABABA'}</fcub:ADDRLN1>
                    <fcub:ADDRLN3>${escapeXml(data.woreda)}</fcub:ADDRLN3>
                    <fcub:ADDRLN2>${escapeXml(data.zone)}</fcub:ADDRLN2>
                    <fcub:ADDRLN4>${escapeXml(data.houseNumber || 'NO')}</fcub:ADDRLN4>
                    <fcub:COUNTRY>ET</fcub:COUNTRY>
                    <fcub:SNAME>${escapeXml(shortName.substring(0, 25))}</fcub:SNAME>
                    <fcub:NLTY>ET</fcub:NLTY>
                    <fcub:CCATEG>INDI</fcub:CCATEG>
                    <fcub:FULLNAME>${escapeXml(data.fullName.toUpperCase())}</fcub:FULLNAME>
                    <fcub:MEDIA>MAIL</fcub:MEDIA>
                    <fcub:LOC>CIF</fcub:LOC>
                    <fcub:TAXIDENTITY/>
                    <fcub:AUTHSTAT>A</fcub:AUTHSTAT>
                    <fcub:Custpersonal>
                        <fcub:FSTNAME>${escapeXml(data.firstName.toUpperCase())}</fcub:FSTNAME>
                        <fcub:MIDNAME>${escapeXml(data.middleName.toUpperCase())}</fcub:MIDNAME>
                        <fcub:LSTNAME>${escapeXml(data.lastName.toUpperCase())}</fcub:LSTNAME>
                        <fcub:DOB>${escapeXml(dob)}</fcub:DOB>
                        <fcub:GENDR>${data.gender === 'F' ? 'F' : 'M'}</fcub:GENDR>
                        <fcub:NATIONID>${escapeXml(nationId)}</fcub:NATIONID>
                        <fcub:PPTNO>0000000000</fcub:PPTNO>
                        <fcub:PPTISSDT>${pptIssDt}</fcub:PPTISSDT>
                        <fcub:PPTEXPDT>${pptExpDt}</fcub:PPTEXPDT>
                        <fcub:EMAILID>${escapeXml((data.email || '').toLowerCase())}</fcub:EMAILID>
                        <fcub:MOBNUM>${escapeXml(phoneFormatted)}</fcub:MOBNUM>
                        <fcub:LANG>ENG</fcub:LANG>
                        <fcub:MINOR>N</fcub:MINOR>
                        <fcub:SAME_CORR_ADDR>Y</fcub:SAME_CORR_ADDR>
                        <fcub:PAISSUED>N</fcub:PAISSUED>
                        <fcub:MOTHERMAIDN_NAME>${escapeXml((data.motherMaidenName || '').toUpperCase())}</fcub:MOTHERMAIDN_NAME>
                      <fcub:Custdomestic>
                        <fcub:MARITALSTAT>${escapeXml((data.maritalStatus || '').toUpperCase())}</fcub:MARITALSTAT>
                      </fcub:Custdomestic>
                    </fcub:Custpersonal>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>MAINT_FEE_WAIVED</fcub:FLDNAM>
                        <fcub:FLDVAL>Y</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>CUSTOMER_SEGMENTATION</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.customerSegmentation || 'RETAIL CUSTOMER')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>PROMOTION_TYPE</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(fcPromotion)}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>WEALTH_SOURCE</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.wealthSource || 'SAL')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>OCCUPATION</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(fcOccupation)}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>INDUSTRY</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(fcIndustry)}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>ANNUAL_INCOME</fcub:FLDNAM>
                        <fcub:FLDVAL>${annualIncome}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>CURRENCY_REDEMPTION_PURPOSE</fcub:FLDNAM>
                        <fcub:FLDVAL>N</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>IS_THE_CUSTOMER_IN_SANCTION_LIST</fcub:FLDNAM>
                        <fcub:FLDVAL>N</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>CUSTOMER_RISK_RATING</fcub:FLDNAM>
                        <fcub:FLDVAL>HIGH</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>CB_RM_GROUP</fcub:FLDNAM>
                        <fcub:FLDVAL>NA</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>LEAD_RM</fcub:FLDNAM>
                        <fcub:FLDVAL>NA</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>AGENTS_NATIONAL_ID_NUMBER</fcub:FLDNAM>
                        <fcub:FLDVAL/>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>VAT_NO</fcub:FLDNAM>
                        <fcub:FLDVAL/>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>PLTCS_EX_PERSON</fcub:FLDNAM>
                        <fcub:FLDVAL>NO</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>OTHER_WEALTH_SOURCE</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.otherWealthSource || '')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>OTHER_OCCUPATION</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.otherOccupation || fcOccupation)}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>OTHER_INDUSTRY</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.otherIndustry || '')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>MAKER</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml((data.maker || 'FYDA_USR').toUpperCase())}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>CHECKER</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml((data.checker || 'FYDA_USR').toUpperCase())}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>FAYDA_PHONE_NUMBER</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(phoneFormatted)}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>FAYDA_EMAIL</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.email || '')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
            </fcub:Customer-Full>
         </fcub:FCUBS_BODY>
      </fcub:CREATECUSTOMER_FSFS_REQ>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Build SOAP envelope for CreateCustAcc (Account creation)
 */
function buildCreateAccountEnvelope(data: CreateAccountRequest, config: FlexCubeConfig): string {
  const correlId = generateCorrelId();
  const branch = data.branchCode || config.defaultBranch;
  const accountClass = data.accountClass || "SPRI";
  // const accountClass = '1111';

  // Account number template: BRN + 111 + XXXXXXXXXX (FlexCube will generate the full number)
  const accTemplate = `${branch}${data.tierId}XXXXXXXXXX`;
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:fcub="http://fcubs.ofss.com/service/FCUBSAccService">
   <soapenv:Header/>
   <soapenv:Body>
      <fcub:CREATECUSTACC_FSFS_REQ>
         <fcub:FCUBS_HEADER>
                <fcub:SOURCE>${escapeXml(config.source)}</fcub:SOURCE>
                <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
                <fcub:CORRELID>${correlId}</fcub:CORRELID>
                <fcub:BRANCH>${escapeXml(branch)}</fcub:BRANCH>
                <fcub:USERID>${escapeXml(config.userId)}</fcub:USERID>
                <fcub:MODULEID>ST</fcub:MODULEID>
                <fcub:SERVICE>FCUBSAccService</fcub:SERVICE>
                <fcub:OPERATION>CreateCustAcc</fcub:OPERATION>
                <fcub:ACTION>NEW</fcub:ACTION>
                <fcub:MSGSTAT>SUCCESS</fcub:MSGSTAT>
         </fcub:FCUBS_HEADER>
         <fcub:FCUBS_BODY>
            <fcub:Cust-Account-Full>
                    <fcub:BRN>${escapeXml(branch)}</fcub:BRN>
                    <fcub:ACC>${escapeXml(accTemplate)}</fcub:ACC>
                    <fcub:CUSTNAME>${escapeXml(data.customerName.toUpperCase())}</fcub:CUSTNAME>
                    <fcub:CUSTNO>${escapeXml(data.cifNumber)}</fcub:CUSTNO>
                    <fcub:ACCLS>${escapeXml(data.accountClass)}</fcub:ACCLS>
                    <fcub:CCY>${escapeXml(data.currency || 'ETB')}</fcub:CCY>
                    <fcub:LOC>CIF</fcub:LOC>
                    <fcub:MEDIA>MAIL</fcub:MEDIA>
                    <fcub:CustAcc>
                    <fcub:ACSTATNODR>Y</fcub:ACSTATNODR>
                    <fcub:Misdetails>
                       <fcub:POOLCD>ACT_OPEN</fcub:POOLCD>
                    </fcub:Misdetails>
                    </fcub:CustAcc>
            </fcub:Cust-Account-Full>
         </fcub:FCUBS_BODY>
      </fcub:CREATECUSTACC_FSFS_REQ>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Build SOAP envelope for QueryCustomer (check existing CIF by SSN/UIN)
 */
function buildQueryCustomerBySSNEnvelope(uin: string, config: FlexCubeConfig): string {
  const msgId = generateMsgId();
  const correlId = generateCorrelId();

  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:fcub="http://fcubs.ofss.com/service/FCUBSCustomerService">
   <soapenv:Header/>
   <soapenv:Body>
      <fcub:QUERYCUSTOMER_IOFS_REQ>
         <fcub:FCUBS_HEADER>
            <fcub:SOURCE>${escapeXml(config.source)}</fcub:SOURCE>
            <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
            <fcub:MSGID>${msgId}</fcub:MSGID>
            <fcub:CORRELID>${correlId}</fcub:CORRELID>
            <fcub:USERID>${escapeXml(config.userId)}</fcub:USERID>
            <fcub:BRANCH>${escapeXml(config.defaultBranch)}</fcub:BRANCH>
            <fcub:SERVICE>FCUBSCustomerService</fcub:SERVICE>
            <fcub:OPERATION>QueryCustomer</fcub:OPERATION>
            <fcub:SOURCE_OPERATION>QueryCustomer</fcub:SOURCE_OPERATION>
            <fcub:MSGSTAT>SUCCESS</fcub:MSGSTAT>
         </fcub:FCUBS_HEADER>
         <fcub:FCUBS_BODY>
            <fcub:Customer-IO>
               <fcub:SSN>${escapeXml(uin)}</fcub:SSN>
            </fcub:Customer-IO>
         </fcub:FCUBS_BODY>
      </fcub:QUERYCUSTOMER_IOFS_REQ>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Build SOAP envelope for QueryCustomer by CustNo (for referral verification)
 * Uses IB_SER/EXTIB credentials as per working FlexCube QueryCustomer request
 */
function buildQueryCustomerByCustNoEnvelope(custNo: string): string {
  const msgId = generateMsgId();
  const correlId = generateCorrelId();

  // Pad customer number to 7 digits
  const paddedCustNo = custNo.padStart(7, '0');

  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:fcub="http://fcubs.ofss.com/service/FCUBSCustomerService">
   <soapenv:Header/>
   <soapenv:Body>
      <fcub:QUERYCUSTOMER_IOFS_REQ>
         <fcub:FCUBS_HEADER>
            <fcub:SOURCE>EXTIB</fcub:SOURCE>
            <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
            <fcub:MSGID>${msgId}</fcub:MSGID>
            <fcub:CORRELID>${correlId}</fcub:CORRELID>
            <fcub:USERID>IB_SER</fcub:USERID>
            <fcub:BRANCH>103</fcub:BRANCH>
            <fcub:SERVICE>FCUBSCustomerService</fcub:SERVICE>
            <fcub:OPERATION>QueryCustomer</fcub:OPERATION>
            <fcub:SOURCE_OPERATION>QueryCustomer</fcub:SOURCE_OPERATION>
            <fcub:MSGSTAT>SUCCESS</fcub:MSGSTAT>
         </fcub:FCUBS_HEADER>
         <fcub:FCUBS_BODY>
            <fcub:Customer-IO>
               <fcub:CUSTNO>${escapeXml(paddedCustNo)}</fcub:CUSTNO>
            </fcub:Customer-IO>
         </fcub:FCUBS_BODY>
      </fcub:QUERYCUSTOMER_IOFS_REQ>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// ─── SOAP Response Parsers ────────────────────────────────────────────────────

/**
 * Extract a tag value from XML response (simple regex-based parser)
 * Works for FlexCube SOAP responses without requiring a full XML parser
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  // Match both namespaced and non-namespaced tags
  const patterns = [
    new RegExp(`<(?:[a-zA-Z]+:)?${tagName}>([^<]*)<\/(?:[a-zA-Z]+:)?${tagName}>`, 'i'),
    new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i'),
  ];
  for (const regex of patterns) {
    const match = xml.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Check if the SOAP response indicates success
 */
function isSuccessResponse(xml: string): boolean {
  const msgStat = extractXmlValue(xml, 'MSGSTAT');
  return msgStat?.toUpperCase() === 'SUCCESS';
}

/**
 * Extract error details from failed SOAP response
 */
function extractErrorFromResponse(xml: string): string {
  const ecode = extractXmlValue(xml, 'ECODE');
  const edesc = extractXmlValue(xml, 'EDESC');
  if (ecode && edesc) {
    return `${ecode}: ${edesc}`;
  }
  if (edesc) return edesc;

  // Check for WCODE/WDESC (warnings that may contain error info)
  const wcode = extractXmlValue(xml, 'WCODE');
  const wdesc = extractXmlValue(xml, 'WDESC');
  if (wcode && wdesc) return `${wcode}: ${wdesc}`;

  return 'Unknown FlexCube error';
}

// ─── SOAP HTTP Caller ─────────────────────────────────────────────────────────

async function callSoapService(url: string, soapEnvelope: string, timeout: number): Promise<string> {
  // Strip ?WSDL suffix — WSDL is for service definition, not SOAP POST calls
  const cleanUrl = url.replace(/\?WSDL$/i, '');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const timestamp = new Date().toISOString();

  try {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[FlexCube SOAP] ▶ REQUEST  — ${timestamp}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`[FlexCube SOAP] URL: ${cleanUrl}${cleanUrl !== url ? ` (stripped ?WSDL from: ${url})` : ''}`);
    console.log(`[FlexCube SOAP] Method: POST`);
    console.log(`[FlexCube SOAP] Content-Type: text/xml;charset=UTF-8`);
    console.log(`[FlexCube SOAP] Timeout: ${timeout}ms`);
    console.log(`[FlexCube SOAP] Request Length: ${soapEnvelope.length} chars`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`[FlexCube SOAP] REQUEST XML:`);
    console.log(`${'─'.repeat(80)}`);
    console.log(soapEnvelope);
    console.log(`${'─'.repeat(80)}`);

    const startTime = Date.now();

    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '',
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    const elapsed = Date.now() - startTime;

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[FlexCube SOAP] ◀ RESPONSE — ${new Date().toISOString()} (${elapsed}ms)`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`[FlexCube SOAP] HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`[FlexCube SOAP] Response Length: ${responseText.length} chars`);
    console.log(`[FlexCube SOAP] MSGSTAT: ${extractXmlValue(responseText, 'MSGSTAT') || 'N/A'}`);

    // Extract key response values for quick debugging
    const custNo = extractXmlValue(responseText, 'CUSTNO');
    const accNo = extractXmlValue(responseText, 'ACC');
    const ecode = extractXmlValue(responseText, 'ECODE');
    const edesc = extractXmlValue(responseText, 'EDESC');

    if (custNo) console.log(`[FlexCube SOAP] CUSTNO (CIF): ${custNo}`);
    if (accNo) console.log(`[FlexCube SOAP] ACC (Account): ${accNo}`);
    if (ecode) console.log(`[FlexCube SOAP] ERROR CODE: ${ecode}`);
    if (edesc) console.log(`[FlexCube SOAP] ERROR DESC: ${edesc}`);

    console.log(`${'─'.repeat(80)}`);
    console.log(`[FlexCube SOAP] RESPONSE XML:`);
    console.log(`${'─'.repeat(80)}`);
    console.log(responseText);
    console.log(`${'═'.repeat(80)}\n`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 500)}`);
    }

    return responseText;
  } catch (error: any) {
    clearTimeout(timeoutId);

    const elapsed = Date.now() - new Date(timestamp).getTime();
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[FlexCube SOAP] ✖ ERROR — ${new Date().toISOString()} (${elapsed}ms)`);
    console.log(`${'─'.repeat(80)}`);

    if (error.name === 'AbortError') {
      console.log(`[FlexCube SOAP] TIMEOUT: Request aborted after ${timeout}ms`);
      console.log(`[FlexCube SOAP] URL: ${cleanUrl}`);
      console.log(`${'═'.repeat(80)}\n`);
      throw new Error(`FlexCube SOAP timeout after ${timeout}ms`);
    }

    console.log(`[FlexCube SOAP] Error Type: ${error.name || 'Unknown'}`);
    console.log(`[FlexCube SOAP] Error Message: ${error.message}`);
    console.log(`[FlexCube SOAP] URL: ${cleanUrl}`);
    if (error.cause) console.log(`[FlexCube SOAP] Cause: ${error.cause}`);
    console.log(`${'═'.repeat(80)}\n`);

    throw error;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Query FlexCube to check if a customer already exists by Fayda UIN (SSN).
 * Returns the CIF number if found, null otherwise.
 */
export async function queryCustomerByUIN(
  uin: string,
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<string | null> {
  try {
    if (!uin) return null;

    const envelope = buildQueryCustomerBySSNEnvelope(uin, config);
    const response = await callSoapService(config.customerServiceUrl, envelope, config.timeout);

    if (isSuccessResponse(response)) {
      const custNo = extractXmlValue(response, 'CUSTNO');
      if (custNo && custNo !== 'null') {
        console.log(`[FlexCube] Found existing CIF by UIN ${uin}: ${custNo}`);
        return custNo;
      }
    }

    return null;
  } catch (error) {
    console.log(`[FlexCube] QueryCustomer by UIN failed (customer may not exist): ${error}`);
    return null;
  }
}

/**
 * Query FlexCube to look up a customer by CIF/Customer Number.
 * Used for referral program — verifying that an existing customer is valid.
 *
 * Uses IB_SER/EXTIB credentials (separate from FYDA_USR used for CIF creation).
 * Returns customer details (name, phone, email) or null if not found.
 */
export interface QueryCustomerResult {
  success: boolean;
  customerNumber: string;
  fullName?: string;
  phone?: string;
  email?: string;
  branch?: string;
  message: string;
}

export async function queryCustomerByCustNo(
  custNo: string,
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<QueryCustomerResult> {
  try {
    if (!custNo) {
      return { success: false, customerNumber: '', message: 'Customer number is required' };
    }

    const paddedCustNo = custNo.padStart(7, '0');
    console.log(`[FlexCube] QueryCustomer by CustNo: ${paddedCustNo}`);

    const envelope = buildQueryCustomerByCustNoEnvelope(paddedCustNo);
    const response = await callSoapService(config.customerServiceUrl, envelope, config.timeout);

    if (isSuccessResponse(response)) {
      const customerNumber = extractXmlValue(response, 'CUSTNO');
      const fullName = extractXmlValue(response, 'FULLNAME') || extractXmlValue(response, 'NAME');
      const phone = extractXmlValue(response, 'MOBNUM');
      const email = extractXmlValue(response, 'EMAILID');
      const branch = extractXmlValue(response, 'LBRN');

      if (customerNumber && customerNumber !== 'null') {
        console.log(`[FlexCube] Found customer: ${fullName} (${customerNumber})`);
        return {
          success: true,
          customerNumber,
          fullName: fullName || '',
          phone: phone || '',
          email: email || '',
          branch: branch || '',
          message: 'Customer found',
        };
      }
    }

    const errorMsg = extractErrorFromResponse(response);
    console.log(`[FlexCube] QueryCustomer by CustNo failed: ${errorMsg}`);
    return { success: false, customerNumber: paddedCustNo, message: errorMsg };

  } catch (error: any) {
    console.error(`[FlexCube] QueryCustomer by CustNo error:`, error.message);
    return {
      success: false,
      customerNumber: custNo,
      message: `FlexCube connection error: ${error.message}`,
    };
  }
}

/**
 * Step 1: Create CIF (Customer Information File) in FlexCube
 * Calls FCUBSCustomerService → CreateCustomer
 */
export async function createCIF(
  data: CreateCIFRequest,
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<CreateCIFResult> {
  try {
    console.log(`\n========== FLEXCUBE: CREATE CIF ==========`);
    console.log(`Customer: ${data.fullName}`);
    console.log(`Branch: ${data.branchCode}`);
    console.log(`UIN: ${data.uin}`);

    // Build and send CIF creation SOAP request (skip QueryCustomer — go straight to create)
    const envelope = buildCreateCustomerEnvelope(data, config);
    const response = await callSoapService(config.customerServiceUrl, envelope, config.timeout);

    if (isSuccessResponse(response)) {
      const custNo = extractXmlValue(response, 'CUSTNO');
      if (custNo) {
        console.log(`[FlexCube] CIF created successfully: ${custNo}`);
        console.log(`==========================================\n`);
        return {
          success: true,
          cifNumber: custNo,
          message: `CIF ${custNo} created successfully in FlexCube`,
          rawResponse: response,
        };
      }
    }

    // Parse error
    const errorMsg = extractErrorFromResponse(response);
    console.error(`[FlexCube] CIF creation failed: ${errorMsg}`);
    console.log(`==========================================\n`);
    return {
      success: false,
      message: `FlexCube CIF creation failed: ${errorMsg}`,
      rawResponse: response,
    };

  } catch (error: any) {
    console.error(`[FlexCube] CIF creation error:`, error.message);
    return {
      success: false,
      message: `FlexCube connection error: ${error.message}`,
    };
  }
}

/**
 * Step 2: Create Account in FlexCube using the CIF from step 1
 * Calls FCUBSAccService → CreateCustAcc
 */
export async function createAccount(
  data: CreateAccountRequest,
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<CreateAccountResult> {
  try {
    console.log(`\n========== FLEXCUBE: CREATE ACCOUNT ==========`);

    console.log(`66666666666666666666665555555555555555555555555555555555555555555555555555: ${data}`);


    console.log(`CIF: ${data.cifNumber}`);
    console.log(`Customer: ${data.customerName}`);
    console.log(`Branch: ${data.branchCode}`);
    console.log(`Account Class: ${data.accountClass}`);

    const envelope = buildCreateAccountEnvelope(data, config);
    const response = await callSoapService(config.accountServiceUrl, envelope, config.timeout);

    if (isSuccessResponse(response)) {
      const accNo = extractXmlValue(response, 'ACC');
      const custNo = extractXmlValue(response, 'CUSTNO');
      if (accNo && !accNo.includes('XXXXXXXXXX')) {
        console.log(`[FlexCube] Account created successfully: ${accNo}`);
        console.log(`=============================================\n`);
        return {
          success: true,
          accountNumber: accNo,
          cifNumber: custNo || data.cifNumber,
          message: `Account ${accNo} created successfully in FlexCube`,
          rawResponse: response,
        };
      }
    }

    // Parse error
    const errorMsg = extractErrorFromResponse(response);
    console.error(`[FlexCube] Account creation failed: ${errorMsg}`);
    console.log(`=============================================\n`);
    return {
      success: false,
      message: `FlexCube account creation failed: ${errorMsg}`,
      rawResponse: response,
    };

  } catch (error: any) {
    console.error(`[FlexCube] Account creation error:`, error.message);
    return {
      success: false,
      message: `FlexCube connection error: ${error.message}`,
    };
  }
}

/**
 * Full flow: Create CIF + Create Account in FlexCube
 * This is the main function called during approval.
 *
 * Returns both CIF number and Account number on success.
 */
export async function createCustomerAndAccount(
  customerData: {
    fullName: string;
    firstName: string;
    middleName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phone: string;
    email: string;
    motherMaidenName: string;
    maritalStatus: string;
    uin: string;
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
    branchCode: string;
    tierId: string;
    accountTypeId: string;
    promotionType?: string;
    customerSegmentation?: string;
    maker?: string;
    checker?: string;
  },
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<{
  success: boolean;
  cifNumber?: string;
  accountNumber?: string;
  message: string;
}> {
  // ── Step 1: Create CIF ──
  const cifResult = await createCIF({
    ...customerData,
    nationality: 'ET',
  }, config);

  if (!cifResult.success || !cifResult.cifNumber) {
    return {
      success: false,
      message: `CIF creation failed: ${cifResult.message}`,
    };
  }

  // ── Step 2: Create Account using CIF ──
  // FYDA_USR doesn't have CreateCustAcc rights (GW-ROUT0008), so use IB_SER for account creation
  const accountConfig: FlexCubeConfig = {
    ...config,
    userId: 'IB_SER',
    source: 'EXTFYDA',
  };
  console.log(`[FlexCube] Switching to IB_SER for account creation (FYDA_USR lacks CreateCustAcc rights)`);
  const accountClass = getAccountClass(customerData.accountTypeId);
  const accountResult = await createAccount({
    cifNumber: cifResult.cifNumber,
    customerName: customerData.fullName,
    branchCode: customerData.branchCode || config.defaultBranch,
    accountClass: getAccountClass(customerData.tierId),
    tierId: customerData.tierId,
    currency: 'ETB',
  }, accountConfig);

  if (!accountResult.success || !accountResult.accountNumber) {
    return {
      success: false,
      cifNumber: cifResult.cifNumber,
      message: `CIF ${cifResult.cifNumber} created but account creation failed: ${accountResult.message}`,
    };
  }

  return {
    success: true,
    cifNumber: cifResult.cifNumber,
    accountNumber: accountResult.accountNumber,
    message: `Customer created in FlexCube — CIF: ${cifResult.cifNumber}, Account: ${accountResult.accountNumber}`,
  };
}
