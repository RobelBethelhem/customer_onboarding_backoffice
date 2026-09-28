import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import { requireRole } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// Fields the Service Requests page needs — never the photos or KYC documents
const FIELDS = 'customerId fullName phone email branch branchCode accountNumber cifNumber customerNumber ' +
  'accountType accountTypeName status approvedAt requestedServices servicesStatus completedServices serviceNotifications';

/**
 * GET /api/services?status=pending|completed|all
 * Opened accounts (approved / auto-approved) whose customer asked for Mobile Banking, Internet
 * Banking or a Debit Card. A Personal Banker sees their own branch only; admin sees all branches.
 */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, ['admin', 'personal_banker']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const query: Record<string, any> = {
      status: { $in: ['approved', 'auto_approved'] },
      'requestedServices.0': { $exists: true },
    };
    if (status === 'pending' || status === 'completed') query.servicesStatus = status;

    if (request.headers.get('x-user-role') === 'personal_banker') {
      const branch = request.headers.get('x-user-branch') || '';
      if (!branch) {
        return NextResponse.json({ success: false, error: 'No branch is assigned to your user' }, { status: 403 });
      }
      query.branchCode = branch;
    }

    const customers = await Customer.find(query).select(FIELDS).sort({ approvedAt: -1 }).limit(500).lean();

    return NextResponse.json({ success: true, data: customers });
  } catch (error) {
    console.error('[Services] List error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load service requests' }, { status: 500 });
  }
}
