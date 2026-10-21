import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import { audit } from '@/lib/audit';
import { branchCodesFor } from '@/lib/ifbBranches';
import { escapeRegex } from '@/lib/regex';

// Lists never carry the large images (selfie, check photos, live-check frames, scans) — the
// application page loads them. The small Fayda photo stays for the thumbnails.
const LIST_EXCLUDE = '-livenessFrames -selfiePhoto -verificationPhotos -marriageCertificatePhoto -faceVerification';
// Dashboard charts (fields=stats): only what they count
const STATS_FIELDS = 'customerId status accountType accountTypeName branch createdAt faceMatchScore';
const STATUSES = ['pending', 'verified', 'approved', 'auto_approved', 'rejected', 'escalated', 'returned', 'in_review'] as const;

/**
 * GET /api/customers?status=&search=&limit=&skip=
 *   &countOnly=1  → only { total } (sidebar badges); limit=0 means the same
 *   &counts=1     → also the number of applications in each status (dashboard)
 *   &fields=stats → only the fields the dashboard charts use
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = (searchParams.get('search') || '').trim().slice(0, 100);
    const rawLimit = searchParams.get('limit');
    const countOnly = searchParams.get('countOnly') === '1' || rawLimit === '0';
    const limit = Math.min(1000, Math.max(1, parseInt(rawLimit || '100', 10) || 100));
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

    // Branch role: force filter to approved customers of their branch only
    const userRole = request.headers.get('x-user-role');
    const userBranch = request.headers.get('x-user-branch');

    let query: any = {};

    if (userRole === 'branch' && userBranch) {
      // Branch users can ONLY see approved/auto_approved customers from their branch
      query.status = { $in: ['approved', 'auto_approved'] };
      query.branchCode = { $in: await branchCodesFor(userBranch) }; // e.g. 164 and its IFB branch 664
    } else {
      // Filter by status (normal behavior for admin/kyc)
      if (status && status !== 'all') {
        if (status === 'pending_all') {
          query.status = { $in: ['pending', 'verified', 'in_review'] };
        } else {
          query.status = status;
        }
      }
    }

    // Search by name or ID (typed text, not a pattern)
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { fullName: pattern },
        { customerId: pattern },
        { customerNumber: pattern },
      ];
    }

    const total = await Customer.countDocuments(query);
    if (countOnly) return NextResponse.json({ success: true, data: [], total });

    const customers = await Customer.find(query)
      .select(searchParams.get('fields') === 'stats' ? STATS_FIELDS : LIST_EXCLUDE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (searchParams.get('counts') !== '1') {
      return NextResponse.json({ success: true, data: customers, total });
    }

    // Applications per status, each counted from the status index (no full scan)
    const counts = await Promise.all(STATUSES.map(async s => ({ _id: s, count: await Customer.countDocuments({ status: s }) })));

    const statusCounts = {
      total: 0,
      pending: 0,
      verified: 0,
      approved: 0,
      auto_approved: 0,
      rejected: 0,
      escalated: 0,
      returned: 0,
      in_review: 0,
    };

    counts.forEach((c: { _id: string; count: number }) => {
      statusCounts[c._id as keyof typeof statusCounts] = c.count;
      statusCounts.total += c.count;
    });

    return NextResponse.json({
      success: true,
      data: customers,
      total,
      counts: statusCounts,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();

    // Generate customer ID
    const lastCustomer = await Customer.findOne().sort({ createdAt: -1 });
    let nextId = 10001;
    if (lastCustomer && lastCustomer.customerId) {
      const lastNum = parseInt(lastCustomer.customerId.replace('ZB', ''));
      nextId = lastNum + 1;
    }

    const customer = new Customer({
      ...body,
      customerId: `ZB${String(nextId).padStart(6, '0')}`,
    });

    await customer.save();

    await audit(request, {
      module: 'CUSTOMER', action: 'CREATE', entityType: 'Customer',
      entityId: customer.customerId, entityName: customer.fullName, description: 'Created a customer record manually',
    });

    return NextResponse.json({
      success: true,
      data: customer,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
