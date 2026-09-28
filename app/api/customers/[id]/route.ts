import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import WorkflowSettings, { defaultWorkflowSettings } from '@/lib/models/WorkflowSettings';
import { createCustomerAndAccount, createAccountForCIF, FlexCubeConfig, queryCustomerByCustNo } from '@/lib/flexcube';
import { distributeReferralRewards } from '@/lib/referralRewards';
import Referral from '@/lib/models/Referral';
import ReferralConfig, { defaultReferralConfig } from '@/lib/models/ReferralConfig';
import { sendSMS } from '@/lib/sms';
import { servicesInProgressSmsLine } from '@/lib/services';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const customer = await Customer.findOne({ customerId: params.id }).lean();

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { action, rejectionReason, returnReason, escalationReason } = body;

    // F9: the audit actor is taken from the authenticated session (headers set by middleware),
    // never from the client payload — clients can no longer forge approvedBy/rejectedBy/etc.
    const role = request.headers.get('x-user-role') || '';
    const actor = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'system';
    const myId = request.headers.get('x-user-id') || '';
    const approvedBy = actor; // used for the FlexCube "checker" field and customer.approvedBy

    const customer = await Customer.findOne({ customerId: params.id });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // F8: Separation of duties — only KYC officers (first level) and Senior Approvers
    // (escalated/PEP second level) may action onboarding decisions. Admin is restricted to
    // system management and cannot approve/reject/return/escalate customer applications.
    const kycActions = ['approve', 'auto_approve', 'reject', 'review', 'return', 'escalate'];
    if (kycActions.includes(action)) {
      const isEscalatedDecision = customer.status === 'escalated' && (action === 'approve' || action === 'reject');
      if (isEscalatedDecision) {
        if (role !== 'senior_approver') {
          return NextResponse.json({ success: false, error: 'Only a Senior Approver can action escalated (PEP) applications' }, { status: 403 });
        }
      } else if (role !== 'kyc') {
        return NextResponse.json({ success: false, error: 'Only a KYC officer can perform this action' }, { status: 403 });
      }

      // Idempotency guard — a request that already reached a terminal outcome cannot be
      // actioned again. This is the authoritative defence against two officers approving the
      // same application (and creating a duplicate FlexCube account) at nearly the same time.
      if (['approved', 'auto_approved', 'rejected'].includes(customer.status)) {
        return NextResponse.json(
          { success: false, error: 'This application has already been processed and can no longer be changed.' },
          { status: 409 }
        );
      }

      // Concurrency guard — if another officer is actively holding the review lock, reject
      // the decision. A stale lock (older than the TTL) is ignored so a crashed/closed session
      // can't block the request forever.
      const LOCK_TTL_MS = 2 * 60 * 1000;
      const lockFresh =
        !!customer.lockedAt && Date.now() - new Date(customer.lockedAt).getTime() < LOCK_TTL_MS;
      if (lockFresh && customer.lockedById && customer.lockedById !== myId) {
        return NextResponse.json(
          { success: false, error: `This application is currently being reviewed by ${customer.lockedBy || 'another officer'}.` },
          { status: 423 }
        );
      }
    }

    // UAT: PEP / sanctions applications cannot be approved at the KYC (first) level — the KYC
    // officer must escalate them to a Senior Approver, who approves at the escalated (2nd) level
    // and triggers CIF / account creation. (role === 'kyc' only; a Senior Approver acting on an
    // escalated case is unaffected.)
    if ((action === 'approve' || action === 'auto_approve') && role === 'kyc') {
      const complianceHold = customer.politicallyExposedPerson === 'YES' || customer.sanctionListStatus === 'Y';
      if (complianceHold) {
        return NextResponse.json(
          { success: false, error: 'PEP / sanctions applications cannot be approved by a KYC officer. Please escalate to a Senior Approver.' },
          { status: 403 }
        );
      }
    }

    if (action === 'approve' || action === 'auto_approve') {
      // ========== LOAD FLEXCUBE SETTINGS ==========
      let settings = await WorkflowSettings.findById('default');
      if (!settings) {
        settings = await WorkflowSettings.create(defaultWorkflowSettings);
      }

      const flexcubeEnabled = settings.flexcubeEnabled !== false;
      const flexcubeConfig = getFlexCubeConfig(settings);
      // Existing customer: their CIF already exists, so only a new account is opened under it
      const existingCif = customer.isExistingCustomer ? (customer.existingCif || '') : '';

      // Parse name parts
      const nameParts = customer.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
      const lastName = nameParts[nameParts.length - 1] || '';

      let cifNumber: string | undefined;
      let accountNumber: string | undefined;
      let flexcubeMessage: string = '';

      if (flexcubeEnabled) {
        // ========== REAL FLEXCUBE INTEGRATION ==========
        // Call FlexCube SOAP webservice to create CIF + Account (existing customer: account only)
        console.log(`\n[FlexCube] Starting ${action} for customer: ${customer.fullName} (${customer.customerId})${existingCif ? ` — existing CIF ${existingCif}, account only` : ''}`);

        const result = existingCif
          ? await createAccountForCIF({
              cifNumber: existingCif,
              customerName: customer.existingCifCheck?.fullName || customer.fullName,
              branchCode: customer.branchCode || flexcubeConfig.defaultBranch,
              tierId: customer.tierId || '111',
            }, flexcubeConfig)
          : await createCustomerAndAccount({
              fullName: customer.fullName,
              firstName,
              middleName,
              lastName,
              dateOfBirth: customer.dateOfBirth || '',
              gender: customer.gender === 'female' ? 'F' : 'M',
              phone: customer.phone || '',
              email: customer.email || '',
              motherMaidenName: customer.motherMaidenName || '',
              maritalStatus: customer.maritalStatus || 'S',
              uin: customer.uin || '',
              region: customer.region || '',
              zone: customer.zone || '',
              woreda: customer.woreda || '',
              kebele: customer.kebele || '',
              houseNumber: customer.houseNumber || '',
              occupation: customer.occupation || 'O',
              otherOccupation: customer.otherOccupation || '',
              industry: customer.industry || 'O',
              otherIndustry: customer.otherIndustry || '',
              wealthSource: customer.wealthSource || 'SAL',
              otherWealthSource: customer.otherWealthSource || '',
              annualIncome: customer.annualIncome || 0,
              branchCode: customer.branchCode || flexcubeConfig.defaultBranch,
              tierId: customer.tierId || '111',
              accountTypeId: customer.accountTypeId || 'SPRI',
              promotionType: customer.promotionType || 'Walk in customer',
              customerSegmentation: customer.customerSegmentation || 'RETAIL CUSTOMER',
              maker: customer.maker || 'WEB_USER',
              checker: (approvedBy || 'KYC_OFFICER').toUpperCase().replace(/\s+/g, '_'),
            }, flexcubeConfig);

        if (result.success) {
          cifNumber = result.cifNumber;
          accountNumber = result.accountNumber;
          flexcubeMessage = result.message;
          console.log(`[FlexCube] SUCCESS — CIF: ${cifNumber}, Account: ${accountNumber}`);
        } else {
          // FlexCube failed — return error, do NOT approve without real CIF
          console.error(`[FlexCube] FAILED — ${result.message}`);

          // If CIF was created but account failed, still save the CIF
          if (result.cifNumber) {
            customer.cifNumber = result.cifNumber;
            customer.customerNumber = result.cifNumber;
            await customer.save();
          }

          return NextResponse.json({
            success: false,
            error: `FlexCube integration failed: ${result.message}`,
            cifNumber: result.cifNumber || undefined,
          }, { status: 502 });
        }
      } else {
        // ========== FLEXCUBE DISABLED — FALLBACK LOCAL GENERATION ==========
        console.log(`[FlexCube] DISABLED — using local CIF/Account generation`);

        // Check if customer with same name already exists (reuse CIF) — existing customers keep their own CIF
        const existingCustomer = existingCif ? null : await Customer.findOne({
          $or: [
            { fullName: customer.fullName },
            {
              $and: [
                { fullName: { $regex: new RegExp(firstName, 'i') } },
                { fullName: { $regex: new RegExp(lastName, 'i') } }
              ]
            },
          ],
          cifNumber: { $exists: true, $nin: [null, ''] },
          _id: { $ne: customer._id }
        }).select('cifNumber fullName');

        if (existingCif) {
          cifNumber = existingCif;
          console.log(`[Local] Existing customer — using CIF ${cifNumber}`);
        } else if (existingCustomer?.cifNumber) {
          cifNumber = existingCustomer.cifNumber;
          console.log(`[Local] Reusing CIF ${cifNumber} from: ${existingCustomer.fullName}`);
        } else {
          const lastCustomerWithCif = await Customer.findOne({
            cifNumber: { $exists: true, $nin: [null, ''] }
          }).sort({ cifNumber: -1 });

          let nextCifNumber = 1;
          if (lastCustomerWithCif?.cifNumber) {
            const lastCif = parseInt(lastCustomerWithCif.cifNumber, 10);
            nextCifNumber = isNaN(lastCif) ? 1 : lastCif + 1;
          }
          cifNumber = String(nextCifNumber).padStart(7, '0');
          console.log(`[Local] Generated CIF: ${cifNumber}`);
        }

        // Generate account number locally
        const branchCode = customer.branchCode || '016';
        const random2 = String(Math.floor(Math.random() * 100)).padStart(2, '0');
        const random3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        accountNumber = `${branchCode}${random2}1${cifNumber}${random3}`;
        flexcubeMessage = `Local generation (FlexCube disabled) — CIF: ${cifNumber}, Account: ${accountNumber}`;
      }

      // ========== UPDATE CUSTOMER ==========
      customer.status = action === 'auto_approve' ? 'auto_approved' : 'approved';
      customer.approvedAt = new Date();
      customer.customerNumber = cifNumber;
      customer.cifNumber = cifNumber;
      customer.accountNumber = accountNumber;
      customer.approvedBy = actor;

      // ========== LOG ==========
      console.log(`\n========== ACCOUNT CREATED ==========`);
      console.log(`Customer: ${customer.fullName} (${customer.customerId})`);
      console.log(`CIF Number: ${cifNumber}`);
      console.log(`Account Number: ${accountNumber}`);
      console.log(`Branch: ${customer.branch} (${customer.branchCode})`);
      console.log(`Mode: ${action === 'auto_approve' ? 'Auto-Approved' : 'Manual Approval'}`);
      console.log(`FlexCube: ${flexcubeEnabled ? 'ENABLED (real CBS)' : 'DISABLED (local)'}`);
      console.log(`Message: ${flexcubeMessage}`);
      console.log(`====================================\n`);

      // ========== SMS NOTIFICATION: ACCOUNT APPROVED ==========
      if (customer.phone) {
        // Requested Mobile Banking / Internet Banking / Debit Card are set up later by the branch Personal Banker
        const servicesLine = servicesInProgressSmsLine(customer.requestedServices || []);
        sendSMS(
          customer.phone,
          `Dear ${customer.fullName},\n\nYour Zemen Bank account has been approved and created successfully!\n\nCIF Number: ${cifNumber}\nAccount Number: ${accountNumber}\nBranch: ${customer.branch}\n\n${servicesLine ? `${servicesLine}\n\n` : ''}Thank you for banking with Zemen Bank!`
        ); // fire-and-forget — don't await
      }

      // ========== SAVE CUSTOMER PHOTO TO FLEXCUBE ORACLE DB ==========
      // Skipped for existing customers — their CIF already carries its photo/signature records
      if (cifNumber && customer.faydaPhoto && flexcubeEnabled && !existingCif) {
        const FAYDA_BACKEND_URL = process.env.FAYDA_BACKEND_URL || 'http://localhost:5000';
        try {
          const photoRes = await fetch(`${FAYDA_BACKEND_URL}/api/flexcube/save-customer-photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerNo: cifNumber,
              branchCode: customer.branchCode || '103',
              fullName: customer.fullName,
              photo: customer.faydaPhoto,
              maker: customer.maker || 'WEB_USER',
              makerTimestamp: (customer.makerTimestamp || customer.createdAt || new Date()).toISOString(),
              checker: (approvedBy || 'KYC_OFFICER').toUpperCase().replace(/\s+/g, '_'),
            }),
          });
          const photoData = await photoRes.json();
          if (photoData.success) {
            console.log(`[Photo] Customer photo saved to FlexCube DB for CIF: ${cifNumber}`);
          } else {
            console.error(`[Photo] Failed to save photo: ${photoData.error}`);
          }
        } catch (err: any) {
          console.error(`[Photo] Error saving customer photo to FlexCube DB:`, err.message);
          // Non-blocking — CIF/Account already created successfully
        }
      }


      //flagged AC_STAT_NO_DR = 'Y' in STTM_CUST_ACCOUNT so no debit can occur

      if( accountNumber && flexcubeEnabled){
        const FAYDA_BACKEND_URL = process.env.FAYDA_BACKEND_URL || 'http://localhost:5000';
        try{
          const noDebitRes = await fetch(`${FAYDA_BACKEND_URL}/api/flexcube/set-no-debit`,{
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({accountNumber}),
          })

          const noDebitData = await noDebitRes.json();

          if(noDebitData.success){
            console.log(`[NoDebit] Account ${accountNumber} flagged as No-Debit`);

          }
          else{
            console.error(`[NoDebit] failed to set No-Debit: ${noDebitData.error}`)
          }
        }
        catch (err: any){
          console.error(`[NoDebit] Error calling Fayda backend : `, err.message)
        }
      }

      // ========== REFERRAL REWARD DISTRIBUTION ==========
      // If this customer was referred, distribute rewards to the referrer chain
      if (customer.referralCode && customer.referralCode.startsWith('REF-')) {
        try {
          const referralCode = customer.referralCode;
          const referrerCustNo = referralCode.replace('REF-', '');
          console.log(`[Referral] Manual approval — checking referral for ${customer.customerId} (code: ${referralCode})`);

          // Self-healing: if Referral doc was never created (silent error in onboarding), create it now
          let existingReferral = await Referral.findOne({
            referralCode: referralCode,
            refereeCustomerId: customer.customerId,
          });

          if (!existingReferral) {
            console.log(`[Referral] No Referral document found — creating one now (self-healing)`);

            // Look up referrer info from FlexCube
            let referrerName = `Customer ${referrerCustNo}`;
            let referrerPhone = '';
            let referrerEmail = '';
            try {
              const queryResult = await queryCustomerByCustNo(referrerCustNo);
              if (queryResult.success) {
                referrerName = queryResult.fullName || referrerName;
                referrerPhone = queryResult.phone || '';
                referrerEmail = queryResult.email || '';
              }
            } catch (e) {
              console.log(`[Referral] Could not query FlexCube for referrer: ${e}`);
            }

            // Load referral config
            let refConfig = await ReferralConfig.findById('default');
            if (!refConfig) {
              refConfig = await ReferralConfig.create(defaultReferralConfig);
            }

            // Build ancestor chain for multi-level tracking
            let ancestorChain: string[] = [];
            let level = 1;
            let parentReferralId;

            // Check if the referrer was themselves referred
            let referrerAsReferee = await Referral.findOne({
              refereeCustomerNumber: referrerCustNo,
            });
            if (!referrerAsReferee) {
              const referrerCustomer = await Customer.findOne({
                $or: [
                  { customerNumber: referrerCustNo },
                  { cifNumber: referrerCustNo },
                ],
              });
              if (referrerCustomer?.referralCode) {
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

            existingReferral = await Referral.create({
              referrerCustomerNumber: referrerCustNo,
              referrerName,
              referrerPhone,
              referrerEmail,
              refereeCustomerId: customer.customerId,
              refereeName: customer.fullName,
              referralCode: referralCode,
              referralLink: `https://onboard.zemenbank.com/?ref=${referralCode}`,
              status: 'pending',
              level,
              parentReferralId,
              ancestorChain,
            });
            console.log(`[Referral] Created Referral document: ${existingReferral.referralCode}`);
          }

          // Now distribute rewards (Referral doc guaranteed to exist)
          const rewardResult = await distributeReferralRewards(
            customer.customerId,
            cifNumber,
            customer.fullName,
            accountNumber,
          );
          console.log(`[Referral] Manual approval rewards: ${rewardResult.message}`);
        } catch (refError: any) {
          // Don't fail the approval if referral processing fails
          console.error(`[Referral] ❌ Error distributing rewards:`, refError.message);
          console.error(`[Referral] Error details:`, JSON.stringify({
            referralCode: customer.referralCode,
            customerId: customer.customerId,
            errorName: refError.name,
            errorCode: refError.code,
          }));
        }
      }

    } else if (action === 'reject') {
      customer.status = 'rejected';
      customer.rejectedAt = new Date();
      customer.rejectionReason = rejectionReason || 'No reason provided';
      customer.rejectedBy = actor;

      if(customer.phone) {
        sendSMS(
          customer.phone,
          `Dear ${customer.fullName}, \n\nWe regret to inform you that your Zemen Bank account opening request could not be approved at this time.\n\nReason: ${customer.rejectionReason}\n\n For Further Clarification, Please Visit Your nearest Zemen Bank branch \n\nThank you for your interest in Zemen Bank
          `
        )
      }

    } else if (action === 'review') {
      // UAT: Approver picked up the application — mark it as "in review"
      customer.status = 'in_review';
      customer.reviewedAt = new Date();
      customer.reviewedBy = actor;

      if (customer.phone) {
        sendSMS(
          customer.phone,
          `Dear ${customer.fullName},\n\nYour Zemen Bank account application (Ref: ${customer.customerId}) is now under review by our team. We will notify you of the outcome.\n\nThank you for choosing Zemen Bank!`
        );
      }

    } else if (action === 'return') {
      // UAT: Return the application to the applicant for amendment (instead of a hard reject)
      customer.status = 'returned';
      customer.returnedAt = new Date();
      customer.returnReason = returnReason || 'Additional information required';
      customer.returnedBy = actor;

      if (customer.phone) {
        sendSMS(
          customer.phone,
          `Dear ${customer.fullName},\n\nYour Zemen Bank account application (Ref: ${customer.customerId}) needs an update before it can be approved.\n\nReason: ${customer.returnReason}\n\nPlease continue and resubmit using your Application ID ${customer.customerId} on the onboarding portal.\n\nThank you for choosing Zemen Bank!`
        );
      }

    } else if (action === 'escalate') {
      // UAT: Escalate to a second-level (senior) approver — used for PEP cases instead of auto-rejecting
      customer.status = 'escalated';
      customer.escalatedAt = new Date();
      customer.escalationReason = escalationReason || 'Escalated for second-level approval';
      customer.escalatedBy = actor;

      if (customer.phone) {
        sendSMS(
          customer.phone,
          `Dear ${customer.fullName},\n\nYour Zemen Bank account application (Ref: ${customer.customerId}) requires additional verification and senior approval. We will contact you with the outcome.\n\nThank you for choosing Zemen Bank!`
        );
      }

    } else {
      // General update — strip decision/audit/identity fields to prevent client mass-assignment (F9)
      const blocked = [
        'status', 'approvedBy', 'rejectedBy', 'returnedBy', 'escalatedBy', 'reviewedBy',
        'approvedAt', 'rejectedAt', 'returnedAt', 'escalatedAt', 'reviewedAt',
        'cifNumber', 'accountNumber', 'customerNumber', 'customerId', '_id',
        // the CIF an existing customer's account is opened under, and its FlexCube check
        'isExistingCustomer', 'existingCif', 'existingAccountNumber', 'existingCifCheck',
        // what the customer asked for, and the Personal Banker's record of setting it up
        'requestedServices', 'servicesStatus', 'completedServices', 'serviceNotifications',
      ];
      for (const k of blocked) delete body[k];
      Object.assign(customer, body);
    }

    // Release the review lock once the application leaves this officer's hands. (Not on
    // 'review' — the officer is still actively working it after picking it up.)
    if (['approve', 'auto_approve', 'reject', 'return', 'escalate'].includes(action)) {
      customer.lockedById = '';
      customer.lockedBy = '';
      customer.lockedAt = undefined;
    }

    await customer.save();

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const customer = await Customer.findOneAndDelete({ customerId: params.id });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
