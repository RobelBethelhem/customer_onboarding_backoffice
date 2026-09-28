import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function POST(request: NextRequest) {
  // F2: invalidate all tokens issued to this user by bumping their tokenVersion server-side
  const userId = request.headers.get('x-user-id');
  if (userId) {
    try {
      await connectToDatabase();
      await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
    } catch (e) {
      console.error('[Auth] Logout tokenVersion bump failed:', e);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
