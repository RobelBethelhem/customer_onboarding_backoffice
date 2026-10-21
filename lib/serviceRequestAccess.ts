import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import { requireRole } from '@/lib/apiAuth';
import { branchCodesFor } from '@/lib/ifbBranches';
import { ServiceRequestCustomer } from '@/lib/serviceRequestForm';

// What the Personal Banker sees of a customer who asked for services: contact and identity details,
// address and the account — never the photos, KYC documents, face check, income or risk data
const FIELDS = 'customerId fullName fullNameAmharic email phone gender dateOfBirth nationality idType fcn ' +
  'region zone woreda kebele houseNumber branch branchCode accountNumber cifNumber customerNumber existingCif isExistingCustomer ' +
  'accountType accountTypeName accountClassCode accountClassName tierName currency status approvedAt ' +
  'requestedServices requestedServiceDetails servicesStatus completedServices serviceNotifications';

/**
 * The service request of one customer (an opened account with requested services) for admin, or for
 * the Personal Banker of the customer's branch (and its IFB branch) — else the response to send.
 */
export async function findServiceRequest(
  request: NextRequest, customerId: string
): Promise<{ customer: ServiceRequestCustomer } | { error: NextResponse }> {
  const denied = requireRole(request, ['admin', 'personal_banker']);
  if (denied) return { error: denied };

  await connectToDatabase();
  const customer = await Customer.findOne({
    customerId,
    status: { $in: ['approved', 'auto_approved'] },
    'requestedServices.0': { $exists: true },
  }).select(FIELDS).lean<ServiceRequestCustomer>();
  if (!customer) {
    return { error: NextResponse.json({ success: false, error: 'Service request not found' }, { status: 404 }) };
  }

  if (request.headers.get('x-user-role') === 'personal_banker') {
    const branch = request.headers.get('x-user-branch') || '';
    if (!branch) {
      return { error: NextResponse.json({ success: false, error: 'No branch is assigned to your user' }, { status: 403 }) };
    }
    if (!(await branchCodesFor(branch)).includes(customer.branchCode || '')) {
      return { error: NextResponse.json({ success: false, error: 'This customer belongs to another branch' }, { status: 403 }) };
    }
  }
  return { customer };
}

/** Who printed or downloaded the request: the user's name, else their email */
export function requestUserName(request: NextRequest): string {
  return request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'Zemen Bank';
}
