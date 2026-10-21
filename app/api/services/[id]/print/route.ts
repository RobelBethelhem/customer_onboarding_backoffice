import { NextRequest, NextResponse } from 'next/server';
import { findServiceRequest } from '@/lib/serviceRequestAccess';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/services/[customerId]/print
 * The request page is about to be printed: recorded in the Audit Log like a download.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const found = await findServiceRequest(request, params.id);
    if ('error' in found) return found.error;
    const { customer } = found;
    await audit(request, {
      module: 'SERVICES', action: 'PRINT', entityType: 'Customer',
      entityId: customer.customerId, entityName: customer.fullName, description: 'Printed the service request',
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Services] Print error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record the print' }, { status: 500 });
  }
}
