import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import WorkflowSettings, { defaultWorkflowSettings } from '@/lib/models/WorkflowSettings';
import { createCustomerAndAccount, FlexCubeConfig, queryCustomerByCustNo } from '@/lib/flexcube';
import Referral, { migrateReferralIndexes } from '@/lib/models/Referral';
import ReferralConfig, { defaultReferralConfig } from '@/lib/models/ReferralConfig';
import { distributeReferralRewards } from '@/lib/referralRewards';
import { sendSMS } from '@/lib/sms';
import { screenCustomer, calculateSimilarity } from '@/lib/sanctionsScreening';
import { normalizeServices, servicesInProgressSmsLine } from '@/lib/services';

// Run referral index migration once on first request
let referralIndexesMigrated = false;

// Increase body size limit — mobile app sends photos as base64 (can be 10MB+)
export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';

// Generate unique customer ID
async function generateCustomerId(): Promise<string> {
  const lastCustomer = await Customer.findOne().sort({ createdAt: -1 });
  let nextNum = 1;

  if (lastCustomer && lastCustomer.customerId) {
    const match = lastCustomer.customerId.match(/ZMN-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `ZMN-${String(nextNum).padStart(5, '0')}`;
}

/**
 * Build FlexCube config from workflow settings
 */
function getFlexCubeConfig(settings: any): FlexCubeConfig {
  return {
    customerServiceUrl: settings?.flexcubeCustomerServiceUrl || 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService',
    accountServiceUrl: settings?.flexcubeAccountServiceUrl || 'http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService',
    userId: settings?.flexcubeUserId || 'FYDA_USR',
    source: settings?.flexcubeSource || 'EXTFYDA',
    defaultBranch: settings?.flexcubeBranch || '103',
    timeout: settings?.flexcubeTimeout || 30000,
  };
}

/**
 * Call FlexCube SOAP webservice to create CIF + Account
 * Used during auto-approval flow
 */
async function callFlexCubeService(customerData: any, settings: any): Promise<{
  success: boolean;
  cifNumber?: string;
  accountNumber?: string;
  error?: string;
}> {
  try {
    const config = getFlexCubeConfig(settings);
    const nameParts = (customerData.fullName || '').trim().split(/\s+/);

    const result = await createCustomerAndAccount({
      fullName: customerData.fullName || '',
      firstName: nameParts[0] || '',
      middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '',
      lastName: nameParts[nameParts.length - 1] || '',
      dateOfBirth: customerData.dateOfBirth || '',
      gender: customerData.gender === 'F' ? 'F' : 'M',
      phone: customerData.phone || '',
      email: customerData.email || '',
      motherMaidenName: customerData.motherMaidenName || '',
      maritalStatus: customerData.maritalStatus || 'S',
      uin: customerData.uin || '',
      region: customerData.region || customerData.address1 || '',
      zone: customerData.zone || customerData.address2 || '',
      woreda: customerData.woreda || customerData.address3 || '',
      occupation: customerData.occupation || 'O',
      otherOccupation: customerData.otherOccupation || '',
      industry: customerData.industry || 'O',
      otherIndustry: customerData.otherIndustry || '',
      wealthSource: customerData.wealthSource || 'SAL',
      otherWealthSource: customerData.otherWealthSource || '',
      annualIncome: customerData.annualIncome || customerData.monthlyIncome || 0,
      branchCode: customerData.branchCode || config.defaultBranch,
      tierId: customerData.tierId || '111',
      accountTypeId: customerData.accountTypeId || 'SPRI',
      promotionType: customerData.promotionType || 'Walk in customer',
      customerSegmentation: customerData.customerSegmentation || 'RETAIL CUSTOMER',
    }, config);

    return {
      success: result.success,
      cifNumber: result.cifNumber,
      accountNumber: result.accountNumber,
      error: result.success ? undefined : result.message,
    };
  } catch (error: any) {
    console.error('FlexCube service error:', error);
    return {
      success: false,
      error: error.message || 'FlexCube connection failed',
    };
  }
}

// POST - Main endpoint for mobile app to submit customer data
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    // Run referral index migration once (drops old unique index, syncs new compound indexes)
    if (!referralIndexesMigrated) {
      await migrateReferralIndexes();
      referralIndexesMigrated = true;
    }

    const body = await request.json();
    console.log('bodyyy',body)

    // Validate required fields
    const requiredFields = ['fullName', 'phone', 'accountType', 'branch', 'faceMatchScore'];
    const missingFields = requiredFields.filter(field => !body[field] && body[field] !== 0);

    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      }, { status: 400 });
    }

    // Existing customer: the applicant already has a CIF — given directly, or taken from their
    // 16-digit account number (BRN(3) + product(3) + CIF(7) + SEQ(3)). On approval only a new
    // account is opened under that CIF; no new CIF is created.
    const existingAccountNumber = String(body.existingAccountNumber || '').replace(/\D/g, '');
    let existingCif = String(body.existingCif || '').replace(/\D/g, '');
    if (!existingCif && existingAccountNumber.length === 16) {
      existingCif = existingAccountNumber.substring(6, 13);
    }
    const isExistingCustomer = !!(body.existingCustomer || existingCif || existingAccountNumber);

    // Mobile Banking / Internet Banking / Debit Card the applicant asked for — set up by the
    // branch Personal Banker once the account is opened
    const requestedServices = normalizeServices(body.requestedServices);

    if (isExistingCustomer) {
      if (existingAccountNumber && existingAccountNumber.length !== 16) {
        return NextResponse.json({ success: false, error: 'Account number must be 16 digits' }, { status: 400 });
      }
      if (!/^\d{7}$/.test(existingCif)) {
        return NextResponse.json({
          success: false,
          error: 'A 7-digit CIF number or 16-digit account number is required for existing customers',
        }, { status: 400 });
      }
      if (existingAccountNumber && existingAccountNumber.substring(6, 13) !== existingCif) {
        return NextResponse.json({ success: false, error: 'The CIF number does not match the account number' }, { status: 400 });
      }
    }

    // Get workflow settings
    let settings = await WorkflowSettings.findById('default');
    if (!settings) {
      settings = await WorkflowSettings.create(defaultWorkflowSettings);
    }

    // Look the CIF up in FlexCube so the KYC officer can compare it with the Fayda identity.
    // Not found → reject now so the applicant can correct it. FlexCube unreachable → accept,
    // flagged as unverified for the KYC officer.
    let existingCifCheck: Record<string, any> | undefined;
    if (isExistingCustomer) {
      if (settings.flexcubeEnabled === false) {
        existingCifCheck = { verified: false, message: 'FlexCube integration disabled — CIF not verified', checkedAt: new Date() };
      } else {
        const lookup = await queryCustomerByCustNo(existingCif, getFlexCubeConfig(settings));
        if (lookup.success) {
          const last9 = (p?: string) => String(p || '').replace(/\D/g, '').slice(-9);
          const cifPhone = last9(lookup.phone);
          existingCifCheck = {
            verified: true,
            fullName: lookup.fullName || '',
            phone: lookup.phone || '',
            branch: lookup.branch || '',
            nameMatchScore: calculateSimilarity(lookup.fullName || '', body.fullName || ''),
            phoneMatch: cifPhone.length === 9 ? cifPhone === last9(body.phone) : undefined,
            message: lookup.message,
            checkedAt: new Date(),
          };
        } else if (lookup.connectionError) {
          existingCifCheck = { verified: false, message: lookup.message, checkedAt: new Date() };
        } else {
          console.log(`[Onboarding] Existing CIF ${existingCif} not found in FlexCube: ${lookup.message}`);
          return NextResponse.json({
            success: false,
            error: `We could not find CIF ${existingCif} in our records. Please check the account number or CIF you entered and try again.`,
          }, { status: 400 });
        }
      }
      console.log(`[Onboarding] Existing customer — CIF ${existingCif}, FlexCube check:`, existingCifCheck);
    }

    // UAT: If the applicant is resubmitting a RETURNED/REJECTED application (same Fayda UIN),
    // amend the existing record in place (keeping the same Application ID) instead of
    // creating a duplicate — so the dashboard shows an updated status for re-approval.
    const existingApp = body.uin
      ? await Customer.findOne({ uin: body.uin, status: { $in: ['returned', 'rejected'] } }).sort({ createdAt: -1 })
      : null;

    // Generate customer ID (reuse the existing one when amending a returned/rejected application)
    const customerId = existingApp ? existingApp.customerId : await generateCustomerId();

    // Determine channel — defaults to 'mobile_app' for backward compatibility
    const validChannels = ['mobile_app', 'web', 'whatsapp', 'telegram', 'superapp', 'other'];
    const channel: string = validChannels.includes(body.channel) ? body.channel : 'mobile_app';
    const isMobileApp = channel === 'mobile_app';

    // UAT: Digital onboarding channels default to a HIGH KYC risk rating
    // (digitally onboarded customers are subject to Enhanced Due Diligence).
    const digitalChannels = ['mobile_app', 'web', 'whatsapp', 'telegram', 'superapp'];
    const defaultRiskRating = digitalChannels.includes(channel) ? 'HIGH' : 'LOW';

    // Determine status based on workflow settings + channel
    // RULE: Only mobile_app channel can use auto-approval (depends on settings).
    //        All other channels (web, whatsapp, telegram, superapp, other) ALWAYS go
    //        to manual review because they submit a recorded video instead of live
    //        liveness verification — KYC must manually verify the video.
    let status: 'pending' | 'auto_approved' | 'escalated' = 'pending';
    let customerNumber: string | undefined;
    let cifNumber: string | undefined;
    let accountNumber: string | undefined;
    let approvedAt: Date | undefined;
    let workflowDecision: string;

    const faceMatchScore = body.faceMatchScore || 0;
    const initialDeposit = body.initialDeposit || 0;

    // UAT: Server-side PEP/sanctions screening at submission. A PEP (or any sanctions /
    // NBE-banned / terminated match) is sent to first-level KYC manual review (never
    // auto-approved). The KYC officer cannot approve it and must escalate it to a Senior
    // Approver. Independent of, and authoritative over, the OTP screening.
    let screenHasPEP = false;
    let screenBlocked = false;
    try {
      const screen = await screenCustomer({
        firstName: body.firstName,
        middleName: body.middleName,
        lastName: body.lastName,
        fullName: body.fullName,
        dateOfBirth: body.dateOfBirth,
      });
      screenHasPEP = screen.hasPEP;
      screenBlocked = screen.blocked;
      if (screenHasPEP || screenBlocked) {
        console.log(`[Onboarding] Screening match (PEP=${screen.hasPEP}, sanctionsBlocked=${screen.blocked}) → manual KYC review for ${customerId}`);
      }
    } catch (e) {
      console.log('[Onboarding] Screening check failed (non-fatal):', e);
    }

    // UAT change: a PEP / sanctions match is NO LONGER auto-escalated. It is routed to the KYC
    // officer's manual-review queue (pending). The KYC officer can SEE the flag but CANNOT
    // approve it — they must escalate to a Senior Approver (or reject / return). Only after a
    // manual escalation can the Senior Approver approve and create the CIF / account.
    const complianceHold = screenHasPEP || screenBlocked;

    if (complianceHold) {
      // Never auto-approve, never auto-escalate — send to first-level KYC manual review.
      status = 'pending';
      workflowDecision = screenHasPEP
        ? 'Sent to manual review: potential PEP match — KYC must escalate to a Senior Approver for approval'
        : 'Sent to manual review: potential sanctions match — KYC must escalate to a Senior Approver for approval';
    } else if (isExistingCustomer) {
      // Existing customers never auto-approve: KYC must confirm the CIF belongs to the applicant.
      status = 'pending';
      workflowDecision = `Sent to manual review: existing customer (CIF ${existingCif}) — KYC must confirm the CIF belongs to the applicant before the account is opened`;
    } else if (!isMobileApp) {
      // NON-MOBILE CHANNELS: Always manual review regardless of workflow settings
      status = 'pending';
      workflowDecision = `Sent to manual review: Channel "${channel}" requires manual KYC verification (video review required)`;
      console.log(`[CHANNEL] ${channel} → forced manual review (face video ID: ${body.faceVideoId || 'none'})`);
    } else if (settings.mode === 'auto' && settings.autoApprovalEnabled) {
      // MOBILE APP: Auto-approval depends on workflow settings
      const meetsScoreThreshold = faceMatchScore >= settings.minFaceMatchScore;
      const belowDepositLimit = initialDeposit <= settings.requireManualReviewAbove;

      if (meetsScoreThreshold && belowDepositLimit) {
        // Auto approve - call FlexCube SOAP service (CIF + Account creation)
        if (settings.flexcubeEnabled) {
          const flexcubeResult = await callFlexCubeService(body, settings);

          if (flexcubeResult.success && flexcubeResult.cifNumber) {
            status = 'auto_approved';
            customerNumber = flexcubeResult.cifNumber;
            cifNumber = flexcubeResult.cifNumber;
            accountNumber = flexcubeResult.accountNumber;
            approvedAt = new Date();
            workflowDecision = `Auto-approved (mobile_app): Face match ${faceMatchScore}% >= ${settings.minFaceMatchScore}%, Deposit ${initialDeposit} ETB <= ${settings.requireManualReviewAbove} ETB. FlexCube CIF: ${flexcubeResult.cifNumber}, Account: ${flexcubeResult.accountNumber || 'pending'}`;
          } else {
            // FlexCube failed, send to manual review
            status = 'pending';
            workflowDecision = `Sent to manual review: FlexCube service failed - ${flexcubeResult.error}`;
          }
        } else {
          // FlexCube disabled, just auto approve without CIF
          status = 'auto_approved';
          approvedAt = new Date();
          workflowDecision = `Auto-approved (FlexCube disabled): Face match ${faceMatchScore}% >= ${settings.minFaceMatchScore}%`;
        }
      } else {
        // Does not meet criteria, send to pending
        status = 'pending';
        if (!meetsScoreThreshold) {
          workflowDecision = `Sent to manual review: Face match ${faceMatchScore}% < ${settings.minFaceMatchScore}% threshold`;
        } else {
          workflowDecision = `Sent to manual review: Initial deposit ${initialDeposit} ETB > ${settings.requireManualReviewAbove} ETB limit`;
        }
      }
    } else {
      // Manual mode - all customers go to pending
      status = 'pending';
      workflowDecision = 'Sent to manual review: Workflow mode is set to Manual Approval';
    }

    // Create customer record - save ALL fields from mobile app
    const customerData: Record<string, any> = {
      customerId,
      fullName: body.fullName,
      fullNameAmharic: body.fullNameAmharic,
      email: body.email,
      phone: body.phone,
      accountType: body.accountType,
      status,
      channel,
      faceVideoId: body.faceVideoId || '',
      branch: body.branch,
      branchCode: body.branchCode,
      // Account type and tier information
      accountTypeId: body.accountTypeId,
      accountTypeName: body.accountTypeName,
      tierId: body.tierId,
      tierName: body.tierName,
      tierInterestRate: body.tierInterestRate,
      uin: body.uin,
      fcn: body.fcn,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth,
      // Address fields
      region: body.region,
      zone: body.zone,
      woreda: body.woreda,
      kebele: body.kebele,
      houseNumber: body.houseNumber,
      // Employment/Financial fields
      occupation: body.occupation,
      otherOccupation: body.otherOccupation,
      industry: body.industry,
      otherIndustry: body.otherIndustry,
      wealthSource: body.wealthSource,
      otherWealthSource: body.otherWealthSource,
      annualIncome: body.annualIncome || body.monthlyIncome || 0,
      initialDeposit: body.initialDeposit,
      motherMaidenName: body.motherMaidenName,
      maritalStatus: body.maritalStatus,
      // CIF creation fields — user-entered + system defaults
      promotionType: body.promotionType || 'Walk in customer',
      customerRiskRating: body.customerRiskRating || defaultRiskRating,
      customerSegmentation: body.customerSegmentation || 'RETAIL CUSTOMER',
      maintFeeWaived: body.maintFeeWaived || 'Y',
      slaEnable: body.slaEnable || 'N',
      leadRm: body.leadRm || 'NA',
      currencyRedemptionPurpose: body.currencyRedemptionPurpose || 'Y',
      sanctionListStatus: body.sanctionListStatus || 'N',
      taxIdentity: body.taxIdentity || body.tin || '',
      politicallyExposedPerson: body.politicallyExposedPerson || 'NO',
      customerType: body.customerType || 'Individual',
      idType: body.idType || 'National ID',
      nationality: body.nationality || 'ETHIOPIA',
      // Maker / Checker tracking — maker = who submitted the application
      maker: body.channel === 'web' ? 'WEB_USER' : body.channel === 'mobile_app' ? 'MOBILE_USER' : (body.channel || 'UNKNOWN').toUpperCase(),
      makerTimestamp: new Date(),
      // Referral tracking
      referralCode: body.referralCode || '',
      // Existing customer — approval opens only a new account under this CIF
      isExistingCustomer,
      existingCif: isExistingCustomer ? existingCif : '',
      existingAccountNumber: isExistingCustomer ? existingAccountNumber : '',
      existingCifCheck,
      // Additional services for the branch Personal Banker
      requestedServices,
      servicesStatus: requestedServices.length ? 'pending' : 'none',
      // Marriage certificate photo (only for married customers)
      marriageCertificatePhoto: body.marriageCertificatePhoto,
      // Photos - Fayda ID photo and selfie
      faydaPhoto: body.faydaPhoto,
      selfiePhoto: body.selfiePhoto,
      // Liveness verification photos
      verificationPhotos: body.verificationPhotos || {
        faceCenter: body.faceCenter || body.selfiePhoto,
        eyeBlink: body.eyeBlink,
        headLeft: body.headLeft,
        headRight: body.headRight,
        smile: body.smile,
      },
      // Face match score
      faceMatchScore,
      // FlexCube numbers (only populated on auto-approval with FlexCube enabled)
      customerNumber,
      cifNumber,
      accountNumber,
      approvedAt,
      approvedBy: status === 'auto_approved' ? 'system' : undefined,
    };

    // Flag the screening match for the reviewing KYC officer — but do NOT auto-escalate.
    // These flags are stored locally only; they are not forwarded to FlexCube CIF/account creation.
    if (complianceHold) {
      if (screenHasPEP) customerData.politicallyExposedPerson = 'YES';
      if (screenBlocked) customerData.sanctionListStatus = 'Y';
    }

    // Enhanced logging for debugging liveness photo submission
    console.log('=== CUSTOMER ONBOARDING API DEBUG ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Customer Name:', body.fullName || 'Unknown');
    console.log('Customer ID:', customerId);
    console.log('Channel:', channel);
    console.log('Face Video ID:', body.faceVideoId || 'None');

    // Log verification photos in detail
    console.log('Verification Photos Analysis:');
    const vp = body.verificationPhotos;
    if (vp) {
      console.log('  verificationPhotos object: Present');
      console.log('    - faceCenter:', vp.faceCenter ? `${vp.faceCenter.length} chars` : 'EMPTY');
      console.log('    - eyeBlink:', vp.eyeBlink ? `${vp.eyeBlink.length} chars` : 'EMPTY');
      console.log('    - headLeft:', vp.headLeft ? `${vp.headLeft.length} chars` : 'EMPTY');
      console.log('    - headRight:', vp.headRight ? `${vp.headRight.length} chars` : 'EMPTY');
      console.log('    - smile:', vp.smile ? `${vp.smile.length} chars` : 'EMPTY');
    } else {
      console.log('  verificationPhotos object: MISSING - checking root fields');
      console.log('    - faceCenter (root):', body.faceCenter ? `${body.faceCenter.length} chars` : 'EMPTY');
      console.log('    - eyeBlink (root):', body.eyeBlink ? `${body.eyeBlink.length} chars` : 'EMPTY');
      console.log('    - headLeft (root):', body.headLeft ? `${body.headLeft.length} chars` : 'EMPTY');
      console.log('    - headRight (root):', body.headRight ? `${body.headRight.length} chars` : 'EMPTY');
      console.log('    - smile (root):', body.smile ? `${body.smile.length} chars` : 'EMPTY');
    }

    console.log('Other Photos:');
    console.log('  - faydaPhoto:', body.faydaPhoto ? `${body.faydaPhoto.length} chars` : 'EMPTY');
    console.log('  - selfiePhoto:', body.selfiePhoto ? `${body.selfiePhoto.length} chars` : 'EMPTY');
    console.log('  - faceMatchScore:', body.faceMatchScore);
    console.log('Marriage Info:');
    console.log('  - maritalStatus:', body.maritalStatus || 'EMPTY');
    console.log('  - marriageCertificatePhoto:', body.marriageCertificatePhoto ? `${body.marriageCertificatePhoto.length} chars` : 'EMPTY');

    console.log('Address:', {
      region: body.region || 'EMPTY',
      zone: body.zone || 'EMPTY',
      woreda: body.woreda || 'EMPTY',
      kebele: body.kebele || 'EMPTY',
      houseNumber: body.houseNumber || 'EMPTY'
    });

    // Safety: estimate total BSON document size and cap large photos if needed
    // MongoDB BSON limit is 16MB (~16,793,600 bytes). Base64 chars ≈ 75% of that in bytes.
    const MAX_SINGLE_PHOTO_CHARS = 2_000_000; // ~1.5MB per single photo
    const MAX_MULTI_DOC_CHARS = 6_000_000;    // ~4.5MB for multi-document field (|||)

    // Handle marriageCertificatePhoto — may contain ||| delimited multiple docs
    if (customerData.marriageCertificatePhoto && typeof customerData.marriageCertificatePhoto === 'string') {
      const mcPhoto = customerData.marriageCertificatePhoto;
      if (mcPhoto.includes('|||')) {
        // Multiple documents — compress each individually if too large
        const parts = mcPhoto.split('|||');
        console.log(`📄 marriageCertificatePhoto: ${parts.length} documents (total ${mcPhoto.length} chars)`);
        const compressed = parts.map((part: string, i: number) => {
          if (part.length > MAX_SINGLE_PHOTO_CHARS) {
            console.log(`⚠️ Document ${i + 1} too large (${part.length} chars), will be kept but total capped`);
          }
          return part;
        });
        const joined = compressed.join('|||');
        if (joined.length > MAX_MULTI_DOC_CHARS) {
          console.log(`⚠️ Total multi-doc field too large (${joined.length} chars), keeping first documents only`);
          // Keep adding documents until we hit the limit
          let result = '';
          for (const part of compressed) {
            const next = result ? result + '|||' + part : part;
            if (next.length > MAX_MULTI_DOC_CHARS) break;
            result = next;
          }
          customerData.marriageCertificatePhoto = result;
        }
      } else if (mcPhoto.length > MAX_SINGLE_PHOTO_CHARS) {
        console.log(`⚠️ marriageCertificatePhoto too large (${mcPhoto.length} chars), truncating`);
        customerData.marriageCertificatePhoto = mcPhoto.substring(0, MAX_SINGLE_PHOTO_CHARS);
      }
    }

    // Cap other photo fields
    for (const field of ['faydaPhoto', 'selfiePhoto'] as const) {
      if (customerData[field] && typeof customerData[field] === 'string' && customerData[field].length > MAX_SINGLE_PHOTO_CHARS) {
        console.log(`⚠️ ${field} too large (${customerData[field].length} chars), truncating to ${MAX_SINGLE_PHOTO_CHARS} chars`);
        customerData[field] = customerData[field].substring(0, MAX_SINGLE_PHOTO_CHARS);
      }
    }
    // Also check verification photo fields
    if (customerData.verificationPhotos && typeof customerData.verificationPhotos === 'object') {
      for (const key of Object.keys(customerData.verificationPhotos)) {
        const val = customerData.verificationPhotos[key];
        if (val && typeof val === 'string' && val.length > MAX_SINGLE_PHOTO_CHARS) {
          console.log(`⚠️ verificationPhotos.${key} too large (${val.length} chars), truncating to ${MAX_SINGLE_PHOTO_CHARS} chars`);
          customerData.verificationPhotos[key] = val.substring(0, MAX_SINGLE_PHOTO_CHARS);
        }
      }
    }

    // Log estimated total size
    const estimatedSize = JSON.stringify(customerData).length;
    console.log(`Estimated document size: ${(estimatedSize / 1_000_000).toFixed(2)} MB`);
    if (estimatedSize > 15_000_000) {
      console.log('⚠️ WARNING: Document near MongoDB 16MB limit!');
    }
    console.log('=== END DEBUG ===');

    let customer;
    if (existingApp) {
      // Amend the returned/rejected application in place, reset for re-approval
      Object.assign(existingApp, customerData);
      existingApp.status = status;            // recomputed above (web → pending / waiting for review)
      existingApp.returnReason = undefined;
      existingApp.returnedAt = undefined;
      existingApp.returnedBy = undefined;
      existingApp.rejectionReason = undefined;
      existingApp.rejectedAt = undefined;
      existingApp.rejectedBy = undefined;
      existingApp.resubmissionCount = (existingApp.resubmissionCount || 0) + 1;
      customer = await existingApp.save();
      console.log(`[Resubmit] Amended existing application ${customerId} (resubmission #${existingApp.resubmissionCount})`);
    } else {
      customer = await Customer.create(customerData);
    }

    // ========== SMS: APPLICATION SUBMITTED (status-aware + Application ID for tracking) ==========
    if (customer.phone) {
      let statusMsg = `Your account opening request has been submitted (Application ID: ${customer.customerId}). Our team will review it and reach out to you soon.`;
      if (status === 'auto_approved') {
        statusMsg = `Your Zemen Bank account has been opened successfully (Application ID: ${customer.customerId}).`;
        if (requestedServices.length) statusMsg += `\n\n${servicesInProgressSmsLine(requestedServices)}`;
      } else if (complianceHold) {
        statusMsg = `Your account opening request (Application ID: ${customer.customerId}) has been submitted and requires additional verification. We will reach out to you soon.`;
      }
      sendSMS(
        customer.phone,
        `Dear ${customer.fullName},\n\n${statusMsg}\n\nYou can check your application status anytime using your Application ID.\n\nThank you for choosing Zemen Bank!`
      ); // fire-and-forget — don't await
    }

    // ========== REFERRAL LINKING ==========
    // If the customer was referred, create/link the Referral document
    let referralResult: any = null;
    if (body.referralCode && body.referralCode.startsWith('REF-')) {
      try {
        const referrerCustNo = body.referralCode.replace('REF-', '');
        console.log(`[Referral] Linking referral code ${body.referralCode} for customer ${customerId}`);

        // Check if a Referral already exists for this referee
        let referral = await Referral.findOne({
          referralCode: body.referralCode,
          refereeCustomerId: customerId,
        });

        if (!referral) {
          // Look up the referrer info (may already exist from verify endpoint)
          const existingReferral = await Referral.findOne({ referralCode: body.referralCode });

          // Build ancestor chain for multi-level tracking
          let ancestorChain: string[] = [];
          let level = 1;
          let parentReferralId;

          // Check if the referrer was themselves referred (for multi-level rewards)
          // Search by refereeCustomerNumber (CIF) OR by looking up the referrer's Customer doc
          let referrerAsReferee = await Referral.findOne({
            refereeCustomerNumber: referrerCustNo,
          });

          // If not found by CIF, try finding via Customer model (the referrer might have a referralCode)
          if (!referrerAsReferee) {
            const referrerCustomer = await Customer.findOne({
              $or: [
                { customerNumber: referrerCustNo },
                { cifNumber: referrerCustNo },
              ],
            });
            if (referrerCustomer?.referralCode) {
              // The referrer was referred — find their Referral doc
              referrerAsReferee = await Referral.findOne({
                refereeCustomerId: referrerCustomer.customerId,
              });
            }
          }

          if (referrerAsReferee) {
            ancestorChain = [...(referrerAsReferee.ancestorChain || []), referrerAsReferee.referrerCustomerNumber];
            level = (referrerAsReferee.level || 1) + 1;
            parentReferralId = referrerAsReferee._id;
            console.log(`[Referral] Multi-level: referrer ${referrerCustNo} was referred at level ${referrerAsReferee.level}. New level: ${level}, ancestors: [${ancestorChain.join(', ')}]`);
          }

          // Load referral config to get the web app base URL
          let refConfig = await ReferralConfig.findById('default');
          if (!refConfig) {
            refConfig = await ReferralConfig.create(defaultReferralConfig);
          }

          // Try to get referrer name from existing referral or FlexCube
          let referrerName = existingReferral?.referrerName || '';
          let referrerAccountNumber = existingReferral?.referrerAccountNumber || '';
          let referrerPhone = existingReferral?.referrerPhone;
          let referrerEmail = existingReferral?.referrerEmail;

          if (!referrerName) {
            // Try FlexCube lookup
            try {
              const queryResult = await queryCustomerByCustNo(referrerCustNo);
              if (queryResult.success) {
                referrerName = queryResult.fullName || '';
                referrerPhone = queryResult.phone;
                referrerEmail = queryResult.email;
              }
            } catch (e) {
              console.log(`[Referral] Could not query FlexCube for referrer: ${e}`);
            }
          }

          referral = await Referral.create({
            referrerCustomerNumber: referrerCustNo,
            referrerAccountNumber: referrerAccountNumber,
            referrerName: referrerName || `Customer ${referrerCustNo}`,
            referrerPhone,
            referrerEmail,
            refereeCustomerId: customerId,
            refereeName: body.fullName,
            referralCode: body.referralCode,
            referralLink: `https://onboard.zemenbank.com/?ref=${body.referralCode}`,
            status: 'pending',
            level,
            parentReferralId,
            ancestorChain,
          });

          console.log(`[Referral] Created referral: ${referral.referralCode} (level ${level})`);
        }

        // If auto-approved, distribute rewards immediately
        if (status === 'auto_approved' && cifNumber) {
          referralResult = await distributeReferralRewards(
            customerId,
            cifNumber,
            body.fullName,
            accountNumber,
          );
          console.log(`[Referral] Auto-approval rewards: ${referralResult.message}`);
        }
      } catch (refError: any) {
        // Don't fail the whole onboarding if referral processing fails
        console.error(`[Referral] ❌ Error processing referral:`, refError.message);
        console.error(`[Referral] Error details:`, JSON.stringify({
          referralCode: body.referralCode,
          customerId,
          errorName: refError.name,
          errorCode: refError.code,
          stack: refError.stack?.split('\n').slice(0, 3).join(' | '),
        }));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        customerId: customer.customerId,
        status: customer.status,
        channel,
        customerNumber: customer.customerNumber,
        workflowDecision,
        workflowMode: settings.mode,
        referral: referralResult ? {
          rewardsDistributed: referralResult.rewardsDistributed,
          message: referralResult.message,
        } : undefined,
        message: status === 'auto_approved'
          ? 'Customer account created successfully via auto-approval'
          : 'Application submitted for KYC officer review',
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process onboarding request',
    }, { status: 500 });
  }
}

// GET - Get workflow status for mobile app
export async function GET() {
  try {
    await connectToDatabase();

    let settings = await WorkflowSettings.findById('default');
    if (!settings) {
      settings = await WorkflowSettings.create(defaultWorkflowSettings);
    }

    return NextResponse.json({
      success: true,
      data: {
        mode: settings.mode,
        autoApprovalEnabled: settings.autoApprovalEnabled,
        minFaceMatchScore: settings.minFaceMatchScore,
        message: settings.mode === 'auto'
          ? `Auto-approval enabled. Minimum face match score: ${settings.minFaceMatchScore}%`
          : 'Manual approval mode. All applications will be reviewed by KYC officers.',
      },
    });
  } catch (error) {
    console.error('Error fetching workflow status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch workflow status',
    }, { status: 500 });
  }
}
