import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import { requireRole } from '@/lib/apiAuth';
import { sendSMS } from '@/lib/sms';
import { normalizeServices, joinServiceLabels, servicesReadySms } from '@/lib/services';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const MAX_CUSTOM_MESSAGE = 300;

/**
 * POST /api/services/[customerId]
 * Body: { services: ['mobile_banking' | 'internet_banking' | 'debit_card', ...], customMessage?: string }
 *
 * The Personal Banker has set these services up (manually, in their own systems): mark them done
 * and SMS the customer "your … are now ready" plus the optional custom message.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Only the Personal Banker of the customer's branch — admin can view the queue but not action it
  const denied = requireRole(request, ['personal_banker']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const services = normalizeServices(body.services);
    const customMessage = typeof body.customMessage === 'string' ? body.customMessage.trim() : '';

    if (services.length === 0) {
      return NextResponse.json({ success: false, error: 'Select at least one service' }, { status: 400 });
    }
    if (customMessage.length > MAX_CUSTOM_MESSAGE) {
      return NextResponse.json(
        { success: false, error: `Custom message must be ${MAX_CUSTOM_MESSAGE} characters or fewer` },
        { status: 400 }
      );
    }

    const customer = await Customer.findOne({ customerId: params.id });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const branch = request.headers.get('x-user-branch') || '';
    if (!branch || customer.branchCode !== branch) {
      return NextResponse.json({ success: false, error: 'This customer belongs to another branch' }, { status: 403 });
    }
    if (!['approved', 'auto_approved'].includes(customer.status)) {
      return NextResponse.json({ success: false, error: 'The account has not been opened yet' }, { status: 409 });
    }

    const requested: string[] = customer.requestedServices || [];
    const notRequested = services.filter(s => !requested.includes(s));
    if (notRequested.length) {
      return NextResponse.json(
        { success: false, error: `The customer did not request ${joinServiceLabels(notRequested)}` },
        { status: 400 }
      );
    }

    const actor = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'Personal Banker';
    const now = new Date();

    // Mark the services done (sending again for an already-done service only re-sends the SMS)
    const done = new Set<string>((customer.completedServices || []).map((c: any) => c.service));
    for (const service of services) {
      if (!done.has(service)) {
        customer.completedServices.push({ service, completedAt: now, completedBy: actor });
        done.add(service);
      }
    }
    customer.servicesStatus = requested.every(s => done.has(s)) ? 'completed' : 'pending';

    const message = servicesReadySms(customer.fullName, customer.accountNumber, services, customMessage);
    const smsSent = customer.phone ? await sendSMS(customer.phone, message) : false;
    customer.serviceNotifications.push({ services, message, smsSent, sentAt: now, sentBy: actor });

    await customer.save();
    console.log(`[Services] ${actor} completed ${services.join(', ')} for ${customer.customerId} (SMS ${smsSent ? 'sent' : 'NOT sent'})`);
    await audit(request, {
      module: 'SERVICES', action: 'SERVICES_COMPLETED', entityType: 'Customer',
      entityId: customer.customerId, entityName: customer.fullName,
      status: smsSent ? 'SUCCESS' : 'FAILURE',
      description: `Set up ${joinServiceLabels(services)}; SMS ${smsSent ? 'sent' : 'NOT delivered'}${customMessage ? ' (with a custom message)' : ''}`,
    });

    return NextResponse.json({
      success: true,
      smsSent,
      data: {
        customerId: customer.customerId,
        servicesStatus: customer.servicesStatus,
        completedServices: customer.completedServices,
        serviceNotifications: customer.serviceNotifications,
      },
    });
  } catch (error) {
    console.error('[Services] Complete error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update the service request' }, { status: 500 });
  }
}
