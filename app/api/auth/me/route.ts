import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  const email = request.headers.get('x-user-email');
  const name = request.headers.get('x-user-name');
  const branchCode = request.headers.get('x-user-branch') || '';
  const tokenVersion = parseInt(request.headers.get('x-user-token-version') || '0', 10);

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  // F2: reject tokens invalidated by logout, and accounts that were deactivated/locked
  try {
    await connectToDatabase();
    const user = await User.findById(userId).select('tokenVersion isActive isLocked').lean() as any;
    if (!user || user.isActive === false || user.isLocked === true || (user.tokenVersion || 0) !== tokenVersion) {
      return NextResponse.json({ success: false, error: 'Session expired' }, { status: 401 });
    }
  } catch (e) {
    console.error('[Auth] me check failed:', e);
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: { id: userId, email, name, role, branchCode },
  });
}
