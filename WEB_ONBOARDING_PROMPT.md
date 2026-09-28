# PROMPT: Build Web Customer Onboarding — Zemen Bank

Build a **web-based customer onboarding application** for Zemen Bank that replicates the existing Flutter mobile app's onboarding flow. The web app should be a **standalone Next.js page/route** that integrates into the existing Next.js 14 admin dashboard at `D:\Customer_Onboarding\`.

---

## EXISTING INFRASTRUCTURE (DO NOT RECREATE)

The following already exists and the web onboarding MUST integrate with it:

### Backend APIs (Fayda Backend — Express.js on port 5000)
- `POST /api/verify` — Verify FCN (Fayda Customer Number). Request: `{idNumber, captchaValue: ""}`. Response: `{token, message}`
- `POST /api/validateOtp` — Validate OTP. Request: `{otp, uniqueId, token}`. Response: Full customer data JSON (see FaydaCustomerData model below)
- `POST /api/resend` — Resend FCN via phone. Request: `{identifier: phoneNumber}`. Response: `{success: true}`
- `POST /api/flexcube/create-customer` — Create customer (submits to onboarding API). Request: Full customer payload (see below). Response: `{success, customerNumber, customerId, status, message}`
- `POST /api/face/compare` — Compare two face images. Request: `{selfie: base64, idPhoto: base64}`. Response: `{match, similarity, distance}`
- `POST /api/face/detect` — Detect face in image. Request: `{image: base64}`. Response: `{faces: [...], expressions, landmarks}`
- `POST /api/screening/check` — Sanctions screening. Request: `{firstName, middleName, lastName, dateOfBirth, nationality}`. Response: `{success, data: {blocked, riskLevel, matches}}`

### Customer Onboarding API (Next.js on port 3500)
- `POST /api/onboarding` — Submit customer from any client. Checks workflow settings (auto/manual mode). Auto-approves if faceMatchScore >= threshold AND deposit <= limit. Otherwise sends to manual review.
- `GET /api/workflow` — Get workflow settings
- `POST /api/screening/check` — Sanctions screening

### MongoDB Customer Schema (already exists in `lib/models/Customer.ts`)
```
customerId (unique, auto-generated: ZMN-XXXXX)
fullName, fullNameAmharic, email, phone
accountType, accountTypeId, accountTypeName
tierId, tierName, tierInterestRate
status: "pending" | "verified" | "approved" | "rejected" | "auto_approved"
branch, branchCode
uin, fcn, gender, dateOfBirth
region, zone, woreda, kebele, houseNumber
occupation, otherOccupation, industry, otherIndustry
wealthSource, otherWealthSource, annualIncome, initialDeposit
motherMaidenName, maritalStatus
marriageCertificatePhoto (base64 string, multiple docs joined with ||| delimiter)
faydaPhoto (base64), selfiePhoto (base64)
verificationPhotos: { faceCenter, eyeBlink, headLeft, headRight, smile } (all base64)
faceMatchScore (0-100)
customerNumber, cifNumber, accountNumber
rejectionReason, approvedBy, rejectedBy
createdAt, updatedAt, approvedAt, rejectedAt
```

### Existing Tech Stack
- Next.js 14.2.0, React 18, TypeScript
- Tailwind CSS 3.4.1
- Mongoose 9.1.4 (MongoDB)
- Lucide React (icons)
- Sonner (toasts)
- The admin dashboard runs on port 3500

---

## BRAND IDENTITY & DESIGN SYSTEM

### Colors
```
Primary Red:    #D02149  (main brand, buttons, highlights)
Primary Blue:   #1863DC  (secondary accent, links, info boxes)
Light Gray:     #F4F4F4  (page backgrounds)
White:          #FFFFFF  (card backgrounds)
Dark Gray:      #212121  (primary text)
Dark Background:#040708  (dark sections)

Red Gradient:   #D02149 → #B01A3A
Blue Gradient:  #1863DC → #0D4CAA
Dynamic Gradient: #D02149 → #1863DC
```

### Design Principles
- Clean, modern card-based UI with rounded corners (12-16px)
- Light shadows on cards (black 3-5% opacity)
- Red primary buttons with white text
- Outlined secondary buttons
- Gray background, white content cards
- Progress indicator showing current step
- Form labels in gray, values in bold dark text
- Success elements in green, errors in red
- Responsive design (desktop-first, but should work on tablet)

---

## COMPLETE ONBOARDING FLOW — 10 STEPS

The web onboarding should be a **multi-step wizard** at route `/onboarding` (or `/web-onboarding`). Each step is a screen. The user progresses linearly with a progress bar at the top.

### STEP 1: Welcome Screen

**Purpose:** Introduce the onboarding flow

**UI Elements:**
- Zemen Bank logo at top
- Title: **"Open New Account"**
- Subtitle: "Complete your account opening in minutes"
- 3 feature cards with icons:
  1. **Fayda Verification** (shield/verified icon) — "Verify your identity using your Fayda ID"
  2. **Quick Process** (clock/speed icon) — "Complete the process in under 10 minutes"
  3. **Secure Onboarding** (lock icon) — "Bank-grade security for your data"
- Info box (blue-tinted): "You will need your Fayda ID (FCN number) to proceed. This is a 16-digit number from your national Fayda ID card."
- **"Get Started"** button (red, large) → proceeds to Step 2
- "Already have an account? Login" link

---

### STEP 2: Branch Selection

**Purpose:** Select the bank branch for account opening

**Data Source:** Load branches from static JSON or API. The mobile app loads from `assets/data/branches.json`. The web should have the same data.

**Branch Data Structure:**
```json
{
  "id": 1,
  "name": "Main Branch",
  "category": "City",         // "City" or "Outline"
  "type": "Branch",           // "Branch" or "Sub-branch"
  "latitude": 9.0222,
  "longitude": 38.7468,
  "branchCode": "001"
}
```

**UI Elements:**
- Search bar with filter icon — real-time search by branch name
- Optional: "Detect My Location" button (uses browser geolocation API)
  - If location available: show **"Nearest Branch"** recommendation card at top (highlighted, gradient red background, "Recommended" badge, distance shown)
  - Calculate distance using Haversine formula
- Branch list (scrollable cards):
  - Branch name (bold)
  - Category badge: "City" (blue) or "Outline" (orange)
  - Distance from user (if location available): "2.3 km"
  - Selection indicator (radio button or checkmark)
  - Selected branch gets red border highlight
- **"Continue"** button (disabled until branch selected)

**Validation:**
- Must select exactly 1 branch
- Error: "Please select a branch to continue"

**Data Stored:** `selectedBranch: { id, name, category, branchCode, distanceKm }`

---

### STEP 3: Account Type Selection

**Purpose:** Choose account type and interest rate tier

**Account Types (hardcoded data):**

```
1. Z-Club Special Saving (ZCLUB_SPECIAL)
   - Ages: 18-120
   - Min deposit: 500,000 ETB
   - Icon: star
   - Tiers:
     - Standard: 0 - 999,999 ETB → 7.00%
     - Basic: 1,000,000 - 4,999,999 ETB → 7.75%
     - Gold: 5,000,000 - 9,999,999 ETB → 8.50%
     - Platinum: 10,000,000+ ETB → 9.00%

2. Executive Saving (EXECUTIVE)
   - Ages: 18-120
   - Min deposit: 10,000 ETB
   - Requires executive status
   - Icon: briefcase
   - Tiers:
     - Standard: 0 - 99,999 ETB → 7.00%
     - Basic: 100,000 - 499,999 ETB → 7.25%
     - Silver: 500,000 - 999,999 ETB → 7.50%
     - Gold: 1,000,000 - 4,999,999 ETB → 8.00%
     - Platinum: 5,000,000+ ETB → 8.50%

3. Z-Club Children Saving (ZCLUB_CHILDREN)
   - Ages: 0-17
   - Min deposit: 1,000 ETB
   - Icon: child/baby
   - Tiers:
     - Standard: 0 - 49,999 ETB → 7.00%
     - Basic: 50,000 - 249,999 ETB → 7.50%
     - Gold: 250,000 - 999,999 ETB → 8.00%
     - Exclusive: 1,000,000+ ETB → 8.50%

4. Youth Special Saving (YOUTH_SPECIAL)
   - Ages: 18-29
   - Min deposit: 1,000 ETB
   - Icon: graduation cap
   - Tiers:
     - Standard: 0 - 49,999 ETB → 7.00%
     - Basic: 50,000 - 249,999 ETB → 7.50%
     - Gold: 250,000 - 999,999 ETB → 8.00%
     - Exclusive: 1,000,000+ ETB → 8.50%
```

**UI Elements:**
- Account type cards (expandable/collapsible):
  - Icon (colored circle background)
  - Account name + interest rate range (e.g., "7.00% - 9.00%")
  - Short description (2 lines max)
  - Minimum deposit chip
  - "View Tiers" toggle button
  - Selection checkmark
- When expanded: **Tier selection** grid/list:
  - Tier name
  - Balance range
  - Interest rate (green badge)
  - Selection indicator
- Features list (green checkmarks):
  - Each account type has features like "Competitive interest rates", "Free online banking", etc.
- Bottom summary box:
  - Selected account type name
  - Selected tier name + interest rate

**Validation:**
- Must select 1 account type AND 1 tier
- Errors: "Please select an account type" / "Please select a tier"

**Data Stored:** `selectedAccountType: { id, name }`, `selectedTier: { id, name, interestRate }`

---

### STEP 4: Fayda ID Entry

**Purpose:** Enter the 16-digit FCN (Fayda Customer Number) for identity verification

**UI Elements:**
- Icon: badge/ID card icon in red circle
- Title: **"Enter Your Fayda ID"**
- Subtitle: "Enter your 16-digit Fayda Customer Number (FCN)"
- Input field:
  - Large text input, centered, letter-spacing for readability
  - Numeric only (input type="text" with pattern/filter)
  - Max length: 16 characters
  - Placeholder: "0000-0000-0000-0000"
  - Auto-format with dashes every 4 digits (visual only)
- "Don't know your Fayda ID?" link → opens modal:
  - Phone number input
  - "Send Fayda ID" button → calls `POST /api/resend` with `{identifier: phone}`
  - Success/error message
- **"Verify"** button (red, large)
- Loading overlay during API call

**API Call:**
```
POST {faydaApiBaseUrl}/api/verify
Body: { idNumber: "1234567890123456", captchaValue: "" }
Response: { token: "jwt_token_string" }
```

**Error Handling:**
- Network error: "Cannot connect to server. Check your internet connection."
- Invalid FCN: Show error message from API
- Timeout: "Request timed out. Please try again."

**Data Stored:** `fcn`, `token` (from verify response)

---

### STEP 5: OTP Verification

**Purpose:** Verify identity ownership via 6-digit OTP sent to registered phone

**UI Elements:**
- FCN badge: "Fayda ID: XXXX-XXXX-XXXX-XXXX" (red-tinted pill)
- Timer: countdown from **10 minutes** (600 seconds), displayed as MM:SS
  - Timer icon + "Expires in 09:45"
  - Red text when < 1 minute remaining
  - When expired: "OTP Expired" message
- 6 individual input boxes for OTP digits:
  - Auto-focus to next box on input
  - Auto-focus to previous box on backspace
  - Paste support: if user pastes 6 digits, auto-fill all boxes
- "Resend OTP" link (disabled for first 60 seconds, then enabled)
- **"Verify OTP"** button (red)
- Loading overlay: "Verifying identity..."

**API Call:**
```
POST {faydaApiBaseUrl}/api/validateOtp
Body: { otp: "123456", uniqueId: "{fcn}", token: "{token_from_step4}" }
Response: FaydaCustomerData (see model below)
```

**FaydaCustomerData Response:**
```json
{
  "uin": "1234567890",
  "fullName": { "eng": "Abebe Kebede Alemu", "amh": "አበበ ከበደ አለሙ" },
  "dateOfBirth": "1990-05-15",
  "gender": { "eng": "Male", "amh": "ወንድ" },
  "phone": "+251911123456",
  "email": "abebe@example.com",
  "region": { "eng": "Addis Ababa", "amh": "አዲስ አበባ" },
  "zone": { "eng": "Kirkos", "amh": "ቂርቆስ" },
  "woreda": { "eng": "Woreda 08", "amh": "ወረዳ 08" },
  "residenceStatus": { "eng": "Resident", "amh": "ነዋሪ" },
  "photo": "/9j/4AAQSkZJRgAB..."
}
```

**After OTP Success — Sanctions Screening:**
```
POST {faydaApiBaseUrl}/api/screening/check
Body: {
  firstName: "Abebe",
  middleName: "Kebede",
  lastName: "Alemu",
  dateOfBirth: "1990-05-15",
  nationality: "ET"
}
Response: {
  success: true,
  data: {
    blocked: false,
    riskLevel: "CLEAR",  // CLEAR, LOW, MEDIUM, HIGH
    matches: []
  }
}
```

**If Sanctioned (blocked=true or riskLevel=HIGH):**
- Show **"Account Opening Blocked"** dialog
- Message: "We are unable to open an account at this time due to regulatory requirements."
- Reference ID from matches
- "Close" button → goes back to Step 4

**If Clear:** Proceed to Step 6

**Data Stored:** Complete `FaydaCustomerData` object

---

### STEP 6: Customer Data Review

**Purpose:** Display Fayda-verified data for customer review before proceeding

**UI Elements:**
- Green success badge: checkmark icon + **"Identity Verified"**
- **Photo + Name Card:**
  - Customer photo (decoded from base64, rounded, 100x120px)
  - Full name (large, bold, 20px)
  - Amharic name below (16px, gray)
  - UIN badge (blue pill): "UIN: 1234567890"
- **Personal Information section:**
  - Date of Birth: formatted nicely
  - Gender: from `gender.eng`
  - Phone Number: formatted
  - Email: (if present)
- **Address Information section:**
  - Region: from `region.eng`
  - Zone: from `zone.eng`
  - Woreda: from `woreda.eng`
  - Residence Status: from `residenceStatus.eng`
- Info box (blue): "You will need to provide additional information in the next step."
- **"Continue"** button

**Layout:** Two-column on desktop (photo+name on left, info on right), single column on mobile.

**This screen is read-only** — data comes from Fayda and cannot be edited.

---

### STEP 7: Additional Information

**Purpose:** Collect employment, financial, and personal data not available from Fayda

**Form Fields:**

1. **Mother's Maiden Name** (required)
   - Text input
   - Icon: family/people
   - Validation: non-empty

2. **Tax Identity Number (TIN)** (optional)
   - Numeric input
   - Icon: number/hash

3. **Annual Income (ETB)** (required)
   - Numeric input
   - Icon: money/currency
   - Validation: non-empty, must be a number

4. **Occupation** (required, dropdown)
   - Options:
     - EMP → "Employed"
     - SELF → "Self-Employed"
     - GOV → "Government Employee"
     - STU → "Student"
     - RET → "Retired"
     - O → "Other"
   - Default: "Other" (O)
   - **If "Other" selected:** show additional text field "Specify Occupation" (required)

5. **Industry** (required, dropdown)
   - Options:
     - AGR → "Agriculture"
     - MAN → "Manufacturing"
     - TRD → "Trade/Commerce"
     - SER → "Services"
     - IT → "Information Technology"
     - FIN → "Finance"
     - HLT → "Healthcare"
     - EDU → "Education"
     - O → "Other"
   - Default: "Other" (O)
   - **If "Other" selected:** show additional text field "Specify Industry" (optional)

6. **Source of Wealth** (required, dropdown)
   - Options:
     - SAL → "Salary"
     - BUS → "Business Income"
     - INV → "Investments"
     - INH → "Inheritance"
     - REM → "Remittance"
     - O → "Other"
   - Default: "Other" (O)
   - **If "Other" selected:** show additional text field "Specify Wealth Source" (required)

7. **Marital Status** (required, dropdown)
   - Options:
     - S → "Single"
     - M → "Married"
     - D → "Divorced"
     - W → "Widowed"
   - Default: "Single" (S)

**Validation:**
- Mother's maiden name: required
- Annual income: required
- If occupation = "O": "Specify Occupation" is required
- If wealthSource = "O": "Specify Wealth Source" is required

**Data Stored:**
```json
{
  "motherMaidenName": "Jane",
  "taxIdentity": "0123456789",
  "annualIncome": "600000",
  "occupation": "EMP",
  "otherOccupation": "",
  "industry": "IT",
  "otherIndustry": "",
  "wealthSource": "SAL",
  "otherWealthSource": "",
  "maritalStatus": "S"
}
```

---

### STEP 8: Document Scanning

**Purpose:** Upload supporting documents (ID cards, marriage certificates, etc.)

**Web Adaptation:** The mobile app uses a native document scanner with auto edge detection. The web version should use **file upload** with drag-and-drop support.

**UI Elements:**
- Title: **"Upload Documents"**
- Subtitle: "Upload supporting documents (ID card, marriage certificate, etc.). You can upload multiple documents."
- **Upload Area:**
  - Large dashed-border drop zone
  - Drag & drop support
  - "Click to browse" link inside
  - Accepted formats: JPEG, PNG, PDF (images only)
  - Max file size per image: 5MB
- **Uploaded Documents Grid** (2 columns):
  - Thumbnail preview
  - Document label ("Document 1", "Document 2", etc.)
  - File size
  - Delete button (X)
  - Click to preview full size in modal
- **"Add More Documents"** button
- **"Skip"** option — "Continue without documents" link
  - Confirmation dialog: "You can proceed without documents, but may need to provide them later."
- **"Continue"** button

**Image Processing:**
- On upload, compress each image client-side:
  - Use HTML Canvas to resize to max 1200px width
  - Re-encode as JPEG at quality 0.75
  - Convert to base64
- Multiple documents are joined with `|||` delimiter when submitting
- Single document is sent as plain base64

**Data Stored:** `marriageCertificatePhoto: "base64_doc1|||base64_doc2"` (or single base64)

---

### STEP 9: Face Verification (Liveness Check)

**Purpose:** Capture selfie via webcam for face matching against Fayda ID photo

**Web Adaptation:** The mobile app uses the front camera with ML Kit face detection and 5 liveness challenges (detect face, blink, turn left, turn right, smile). For the web version, simplify to:

**Option A — Simple (Recommended for MVP):**
- Show webcam preview using `getUserMedia` API
- Oval face guide overlay (same as mobile: semi-transparent dark with oval cutout)
- Single instruction: "Position your face in the oval and click Capture"
- Capture button takes a snapshot
- Show captured photo for confirmation
- "Retake" or "Continue" buttons
- Send captured selfie + Fayda photo to `POST /api/face/compare` for face matching
- If match score >= 85%: proceed
- If match score < 85%: show warning with option to retry

**Option B — Full Liveness (Advanced):**
- Use WebRTC + a JavaScript face detection library (like face-api.js or MediaPipe Face Mesh)
- Replicate the 5 challenges:
  1. **Detect Face** — position face in oval
  2. **Blink** — close and open eyes (eye aspect ratio < 0.2 then > 0.6)
  3. **Turn Left** — rotate head left (yaw < -25 degrees)
  4. **Turn Right** — rotate head right (yaw > 25 degrees)
  5. **Smile** — smile detection (probability > 0.7)
- Capture a photo for each challenge
- Show progress indicators for each challenge (5 circles: completed=green, active=red, pending=gray)

**For BOTH options, the verification photos to capture:**
```json
{
  "faceCenter": "base64_selfie",
  "eyeBlink": "base64_or_same_as_selfie",
  "headLeft": "base64_or_same_as_selfie",
  "headRight": "base64_or_same_as_selfie",
  "smile": "base64_or_same_as_selfie"
}
```

**Face Match API:**
```
POST {faydaApiBaseUrl}/api/face/compare
Body: { selfie: "base64_captured", idPhoto: "base64_fayda_photo" }
Response: { match: true, similarity: 0.92, distance: 0.08 }
```

**Camera Permissions:**
- Request camera permission via browser API
- If denied: show instructions to enable camera
- Fallback: allow photo upload from file instead

**Data Stored:** `selfiePhoto`, `verificationPhotos`, `faceMatchScore`

---

### STEP 10: Submit & Success

**Purpose:** Submit all collected data to the backend and show result

**On "Submit" (after face verification):**

**API Call:**
```
POST {faydaApiBaseUrl}/api/flexcube/create-customer
Body: {
  // From Fayda data (Step 5)
  firstName: "Abebe",
  middleName: "Kebede",
  lastName: "Alemu",
  fullName: "Abebe Kebede Alemu",
  fullNameAmharic: "አበበ ከበደ አለሙ",
  dateOfBirth: "1990-05-15",
  gender: "M",                    // M or F
  salutation: "ATO",              // ATO for male, W/RO for female
  nationality: "ET",
  faydaId: "1234567890",
  uin: "1234567890",
  mobile: "+251911123456",
  phone: "+251911123456",
  email: "abebe@example.com",

  // Address (from Fayda)
  address1: "Addis Ababa",       // region.eng
  address2: "Kirkos",            // zone.eng
  address3: "Woreda 08",         // woreda.eng
  city: "Kirkos",                // zone.eng
  state: "Addis Ababa",          // region.eng
  region: "Addis Ababa",
  zone: "Kirkos",
  woreda: "Woreda 08",

  // From Additional Info (Step 7)
  motherMaidenName: "Jane",
  tin: "0123456789",
  monthlyIncome: "600000",       // annualIncome value
  maritalStatus: "S",
  occupation: "EMP",
  otherOccupation: "",
  industry: "IT",
  otherIndustry: "",
  wealthSource: "SAL",
  otherWealthSource: "",

  // Classification
  promotionType: "MAPP",
  customerSegmentation: "RETAIL CUSTOMER",

  // Branch (Step 2)
  branch: "Main Branch",
  branchId: 1,
  branchName: "Main Branch",
  branchCode: "001",

  // Account Type (Step 3)
  accountType: "Z-Club Special Saving",
  accountTypeId: "ZCLUB_SPECIAL",
  accountTypeName: "Z-Club Special Saving",
  tierId: "ZCLUB_SPECIAL_GOLD",
  tierName: "Gold",
  tierInterestRate: 8.5,

  // Photos
  faydaPhoto: "base64...",            // From Fayda (Step 5)
  selfiePhoto: "base64...",           // Captured in Step 9
  marriageCertificatePhoto: "base64...",  // From Step 8 (single or ||| delimited)

  // Liveness verification photos
  verificationPhotos: {
    faceCenter: "base64...",
    eyeBlink: "base64...",
    headLeft: "base64...",
    headRight: "base64...",
    smile: "base64..."
  },
  // Also send individually (for backward compatibility)
  faceCenter: "base64...",
  eyeBlink: "base64...",
  headLeft: "base64...",
  headRight: "base64...",
  smile: "base64...",

  // Face match score (0-100 percentage)
  faceMatchScore: 92
}
```

**Response Handling:**

**If `status === "auto_approved"` and `success === true`:**
→ Show **Success Screen**:
- Green checkmark animation (scale + fade in)
- Title: **"Account Created Successfully!"**
- Welcome message: "Welcome to Zemen Bank, {FirstName}!"
- Customer Number card:
  - Large, bold, red text with letter-spacing
  - Copy to clipboard button
  - Note: "Save your customer number for future reference"
- Next steps info box:
  1. "Activate your account online"
  2. "Set up your PIN"
  3. "Start banking"
- "Done" button

**If `status === "pending"` and `success === true`:**
→ Show **Application Submitted Screen**:
- Orange/yellow clock icon
- Title: **"Application Submitted"**
- Message: "Your application has been submitted for review. You will receive a notification when it's approved."
- Application ID card: show customerId (ZMN-XXXXX)
- "Done" button

**If `success === false`:**
→ Show error with retry option

---

## PROGRESS INDICATOR

Show a progress bar/stepper at the top of every step:

```
Step 1: Welcome          (no indicator)
Step 2: Branch           ●○○○○○○○
Step 3: Account Type     ●●○○○○○○
Step 4: Fayda ID         ●●●○○○○○
Step 5: OTP              ●●●●○○○○
Step 6: Review           ●●●●●○○○
Step 7: Additional Info  ●●●●●●○○
Step 8: Documents        ●●●●●●●○
Step 9: Face Verify      ●●●●●●●●
Step 10: Success         (no indicator, full page)
```

Use red filled dots for completed steps, red outlined for current step, gray for pending.

---

## API BASE URL CONFIGURATION

The Fayda backend URL should be configurable. The mobile app uses `ApiConfig` class. For the web app:
- Default: `http://localhost:5000` (development)
- Production: configured via environment variable `NEXT_PUBLIC_FAYDA_API_URL`
- All API calls from the browser go directly to the Fayda backend (CORS is already enabled on the backend)

---

## BRANCH DATA

The branches should be loaded from a JSON file. Here is the structure (include all branches from the mobile app's `assets/data/branches.json`). You can either:
1. Copy the JSON to `public/data/branches.json` and fetch it
2. Or embed it in a TypeScript constant

---

## STATE MANAGEMENT

Use React state (useState/useReducer) or a simple context to hold the onboarding data across steps:

```typescript
interface OnboardingState {
  currentStep: number;  // 1-10

  // Step 2
  selectedBranch: Branch | null;

  // Step 3
  selectedAccountType: AccountType | null;
  selectedTier: AccountTier | null;

  // Step 4
  fcn: string;
  token: string;

  // Step 5-6
  faydaData: FaydaCustomerData | null;

  // Step 7
  additionalInfo: {
    motherMaidenName: string;
    taxIdentity: string;
    annualIncome: string;
    occupation: string;
    industry: string;
    wealthSource: string;
    otherOccupation: string;
    otherIndustry: string;
    otherWealthSource: string;
    maritalStatus: string;
  };

  // Step 8
  documents: Array<{ base64: string; label: string; }>;

  // Step 9
  selfiePhoto: string;
  verificationPhotos: Record<string, string>;
  faceMatchScore: number;

  // Step 10
  result: { success: boolean; customerNumber?: string; customerId?: string; status?: string; } | null;
}
```

---

## FILE STRUCTURE (Suggested)

```
app/
  onboarding/
    page.tsx                    # Main onboarding wizard container
    components/
      ProgressBar.tsx           # Step progress indicator
      WelcomeStep.tsx          # Step 1
      BranchSelectionStep.tsx  # Step 2
      AccountTypeStep.tsx      # Step 3
      FaydaIdStep.tsx          # Step 4
      OtpVerificationStep.tsx  # Step 5
      DataReviewStep.tsx       # Step 6
      AdditionalInfoStep.tsx   # Step 7
      DocumentUploadStep.tsx   # Step 8
      FaceVerificationStep.tsx # Step 9
      SuccessStep.tsx          # Step 10
    hooks/
      useOnboarding.ts         # State management hook
    types.ts                   # TypeScript interfaces
    constants.ts               # Account types, branches, dropdown options
```

---

## IMPORTANT IMPLEMENTATION NOTES

1. **All API calls go to the Fayda backend** (port 5000), NOT directly to the Next.js onboarding API. The Fayda backend acts as a proxy and handles the forwarding.

2. **Photos must be base64 encoded** without the `data:image/...;base64,` prefix. Strip the prefix before sending to APIs.

3. **Face comparison** uses the Fayda backend's face-api.js service. The selfie captured via webcam is compared against the Fayda ID photo.

4. **Sanctions screening** happens after OTP validation (Step 5), BEFORE showing customer data review (Step 6).

5. **Document photos joined with `|||`** — the web dashboard (customer detail page) already handles splitting and displaying these separately.

6. **The web onboarding should NOT require authentication** — it's a public-facing form for new customers (same as the mobile app).

7. **Progress should NOT be persisted** — if the user refreshes, they start over (same as mobile app behavior).

8. **The salutation field** is derived from gender: "ATO" for Male, "W/RO" for Female.

9. **fullName parsing:** Split by spaces — first word = firstName, second = middleName, rest = lastName.

10. **faceMatchScore** sent to backend should be 0-100 (percentage), not 0-1 (ratio).
