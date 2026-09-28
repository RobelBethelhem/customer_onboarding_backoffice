import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

// Public endpoint — applicants check their application status by Application ID + phone.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const digits = (s: string) => String(s || '').replace(/\D/g, '');

const STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting for Review',
  verified: 'Verified',
  in_review: 'In Review',
  approved: 'Approved',
  auto_approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned for Amendment',
  escalated: 'Under Senior Review',
};

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const appId = (searchParams.get('appId') || '').trim();
    const phone = digits(searchParams.get('phone') || '');

    if (!appId || phone.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Application ID and phone number are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const customer = await Customer.findOne({ customerId: appId }).lean() as any;
    if (!customer) {
      return NextResponse.json(
        { success: false, found: false, error: 'No application found for that ID' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify ownership: provided phone digits must match the tail of the stored phone
    const storedPhone = digits(customer.phone);
    if (!storedPhone || !storedPhone.endsWith(phone)) {
      return NextResponse.json(
        { success: false, found: false, error: 'Phone number does not match this application' },
        { status: 403, headers: corsHeaders }
      );
    }

    const canAmend = customer.status === 'returned' || customer.status === 'rejected';

    return NextResponse.json(
      {
        success: true,
        found: true,
        data: {
          applicationId: customer.customerId,
          fullName: customer.fullName,
          status: customer.status,
          statusLabel: STATUS_LABELS[customer.status] || customer.status,
          reason: customer.returnReason || customer.rejectionReason || '',
          canAmend,
          customerNumber: customer.customerNumber || customer.cifNumber || null,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Application status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch application status' },
      { status: 500, headers: corsHeaders }
    );
  }
}
