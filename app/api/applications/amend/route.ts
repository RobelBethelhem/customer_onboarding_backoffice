import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import { readEkycToken } from '@/lib/faydaTokens';

export const dynamic = 'force-dynamic';

/**
 * POST /api/applications/amend — public (web app). A customer whose application was returned (or
 * rejected) opens it again on another device to amend it: they verify with Fayda first, and get
 * back what they filled in only if the application is theirs (same Fayda ID number).
 * Body: { applicationId, ekycToken }   →  { form } (no photos, no screening, no staff notes but the reason)
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const applicationId = String(body.applicationId || '').trim().slice(0, 30);
    if (!applicationId) return NextResponse.json({ success: false, error: 'Application ID is required' }, { status: 400 });

    const me = await readEkycToken(String(body.ekycToken || ''));
    if (me.status !== 'valid') {
      return NextResponse.json({
        success: false,
        error: me.status === 'unavailable' ? 'We could not check your Fayda verification right now. Please try again.' : 'Please verify with Fayda again.',
      }, { status: me.status === 'unavailable' ? 503 : 401 });
    }

    const c = await Customer.findOne({ customerId: applicationId })
      .select('customerId status uin fcn returnReason rejectionReason branchCode conventionalBranchCode accountTypeId accountClassCode tierName currency '
        + 'email taxIdentity annualIncome occupation otherOccupation industry otherIndustry wealthSource otherWealthSource '
        + 'motherMaidenName maritalStatus promotionType isExistingCustomer existingCif existingAccountNumber requestedServices requestedServiceDetails foreignDocuments')
      .lean() as any;
    // Same answer whether the ID is unknown or someone else's
    const ids = [me.ekyc.fan, me.ekyc.uin].filter(Boolean).map(String);
    if (!c || !ids.some(id => id === String(c.uin || '') || id === String(c.fcn || ''))) {
      return NextResponse.json({ success: false, error: 'No application with this ID was found for your Fayda ID.' }, { status: 404 });
    }
    if (!['returned', 'rejected'].includes(c.status)) {
      return NextResponse.json({ success: false, error: 'This application is not waiting for changes.' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      data: {
        applicationId: c.customerId,
        status: c.status,
        reason: c.returnReason || c.rejectionReason || '',
        form: {
          branchCode: c.conventionalBranchCode || c.branchCode || '',
          accountTypeId: c.accountTypeId || '',
          accountClassCode: c.accountClassCode || c.tierName || '',
          currency: c.currency || 'ETB',
          email: c.email || '',
          taxIdentity: c.taxIdentity || '',
          monthlyIncome: c.annualIncome ? Math.round(Number(c.annualIncome) / 12) : 0, // stored per year
          occupation: c.occupation || '', otherOccupation: c.otherOccupation || '',
          industry: c.industry || '', otherIndustry: c.otherIndustry || '',
          wealthSource: c.wealthSource || '', otherWealthSource: c.otherWealthSource || '',
          motherMaidenName: c.motherMaidenName || '',
          maritalStatus: c.maritalStatus || '',
          promotionType: c.promotionType || '',
          isExistingCustomer: !!c.isExistingCustomer,
          existingCif: c.existingCif || '',
          existingAccountNumber: c.existingAccountNumber || '',
          requestedServices: c.requestedServices || [],
          serviceTermsAccepted: (c.requestedServiceDetails || [])
            .filter((s: any) => s.termsAcceptedVersion > 0)
            .map((s: any) => ({ id: s.id, version: s.termsAcceptedVersion, acceptedAt: s.termsAcceptedAt })),
          // Foreign national's passport and work permit / Origin ID the application already holds:
          // sent again without a key, they stay; new uploads replace them
          foreignDocuments: (c.foreignDocuments || []).map((d: any) => ({
            type: d.type, fileId: d.fileId, fileName: d.fileName, mimeType: d.mimeType, size: d.size,
          })),
        },
      },
    });
  } catch (error) {
    console.error('[Amend] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to open the application' }, { status: 500 });
  }
}
