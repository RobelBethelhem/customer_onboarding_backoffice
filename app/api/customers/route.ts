import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');

    // Branch role: force filter to approved customers of their branch only
    const userRole = request.headers.get('x-user-role');
    const userBranch = request.headers.get('x-user-branch');

    let query: any = {};

    if (userRole === 'branch' && userBranch) {
      // Branch users can ONLY see approved/auto_approved customers from their branch
      query.status = { $in: ['approved', 'auto_approved'] };
      query.branchCode = userBranch;
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

    // Search by name or ID
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
        { customerNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Customer.countDocuments(query);

    // Get counts by status
    const counts = await Customer.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

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
