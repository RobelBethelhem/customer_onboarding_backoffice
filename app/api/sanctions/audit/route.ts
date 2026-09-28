import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';

// GET - Get audit logs
export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const module = searchParams.get('module') || '';
    const action = searchParams.get('action') || '';
    const entityId = searchParams.get('entityId') || '';
    const performedBy = searchParams.get('performedBy') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // Build query
    const query: any = {};

    if (module) query.module = module;
    if (action) query.action = action;
    if (entityId) query.entityId = entityId;
    if (performedBy) query.performedBy = { $regex: performedBy, $options: 'i' };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Get total count
    const total = await AuditLog.countDocuments(query);

    // Get logs
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch audit logs',
    }, { status: 500 });
  }
}
