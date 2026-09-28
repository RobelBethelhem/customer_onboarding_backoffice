import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

// Concurrent-review lock.
// Prevents two officers from opening / processing the SAME onboarding request at the same
// time (which could otherwise lead to a duplicate account being created in FlexCube).
//
// The lock is advisory + self-expiring:
//   - POST   acquires or renews the lock (heartbeat). Atomic via findOneAndUpdate.
//   - DELETE releases the lock (only the holder can release it).
//   - A lock older than LOCK_TTL_MS is considered stale and can be taken over — this covers
//     the case where an officer closed the tab / lost connection without releasing.
//
// NOTE: this is a coordination lock only. The authoritative protection against a double
// approval lives in PATCH /api/customers/[id] (status + lock guards). This route never
// touches FlexCube, the proxy, SMS, or any CIF/account creation data.

const LOCK_TTL_MS = 2 * 60 * 1000; // 2 minutes — heartbeat renews every 45s on the client

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const myId = request.headers.get('x-user-id') || '';
    const myName =
      request.headers.get('x-user-name') ||
      request.headers.get('x-user-email') ||
      'An officer';

    if (!myId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    await connectToDatabase();

    const now = new Date();
    const staleThreshold = new Date(now.getTime() - LOCK_TTL_MS);

    // Atomic acquire/renew: only succeeds if the lock is free, already mine, or stale.
    const filter: any = {
      customerId: params.id,
      $or: [
        { lockedById: { $in: [null, '', myId] } },
        { lockedById: { $exists: false } },
        { lockedAt: { $lt: staleThreshold } },
        { lockedAt: { $exists: false } },
      ],
    };

    const updated = await Customer.findOneAndUpdate(
      filter,
      { $set: { lockedById: myId, lockedBy: myName, lockedAt: now } },
      { new: true }
    ).select('customerId lockedBy lockedById lockedAt');

    if (updated) {
      return NextResponse.json({
        success: true,
        locked: true,
        lockedBy: myName,
        lockedAt: now.toISOString(),
      });
    }

    // We didn't get the lock — either the customer doesn't exist, or someone else holds a
    // fresh lock. Report the current holder so the UI can show who's reviewing it.
    const holder: any = await Customer.findOne({ customerId: params.id })
      .select('customerId lockedBy lockedById lockedAt')
      .lean();

    if (!holder) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      locked: true,
      lockedBy: holder.lockedBy || 'another officer',
      lockedAt: holder.lockedAt ? new Date(holder.lockedAt).toISOString() : undefined,
    });
  } catch (error) {
    console.error('Error acquiring review lock:', error);
    // Fail open: if the lock service errors, don't block review. The PATCH guards still
    // prevent a duplicate decision.
    return NextResponse.json({ success: false, error: 'Failed to acquire lock' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const myId = request.headers.get('x-user-id') || '';
    if (!myId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    await connectToDatabase();

    // Only the holder can release the lock.
    await Customer.findOneAndUpdate(
      { customerId: params.id, lockedById: myId },
      { $set: { lockedById: '', lockedBy: '', lockedAt: null } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error releasing review lock:', error);
    return NextResponse.json({ success: false, error: 'Failed to release lock' }, { status: 500 });
  }
}
