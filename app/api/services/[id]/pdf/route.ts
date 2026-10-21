import { NextRequest, NextResponse } from 'next/server';
import { findServiceRequest, requestUserName } from '@/lib/serviceRequestAccess';
import { serviceRequestPdf } from '@/lib/serviceRequestPdf';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services/[customerId]/pdf
 * The Additional Services Request form as a PDF download — for the Personal Banker of the
 * customer's branch, or admin.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const found = await findServiceRequest(request, params.id);
    if ('error' in found) return found.error;
    const { customer } = found;

    const pdf = serviceRequestPdf(customer, { printedBy: requestUserName(request) });
    await audit(request, {
      module: 'SERVICES', action: 'EXPORT', entityType: 'Customer',
      entityId: customer.customerId, entityName: customer.fullName, description: 'Downloaded the service request (PDF)',
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="service-request-${customer.customerId.replace(/[^\w-]/g, '')}.pdf"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Services] PDF error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create the PDF' }, { status: 500 });
  }
}
