import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { compareOtp, signToken } from '@/lib/auth';

const MAX_ATTEMPTS = 3;

// Step 2 of login: verify the OTP and issue the session.
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ success: false, error: 'Email and OTP are required' }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }
    if (user.isLocked) {
      return NextResponse.json({ success: false, error: 'Account locked. Contact your administrator.' }, { status: 403 });
    }
    if (!user.loginOtpHash || !user.loginOtpExpires || user.loginOtpExpires.getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: 'OTP expired or not requested. Please log in again.' }, { status: 400 });
    }

    const ok = await compareOtp(String(otp), user.loginOtpHash);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      let locked = false;
      if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
        user.isLocked = true;
        user.lockedAt = new Date();
        locked = true;
      }
      await user.save();
      return NextResponse.json({
        success: false,
        error: locked ? 'Account locked after 3 failed attempts. Contact your administrator.' : 'Invalid OTP',
      }, { status: locked ? 403 : 401 });
    }

    // Success — clear OTP + reset attempts, issue a fresh session
    user.failedLoginAttempts = 0;
    user.loginOtpHash = undefined;
    user.loginOtpExpires = undefined;
    user.lastLogin = new Date();
    await user.save();

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      branchCode: user.branchCode || '',
      tokenVersion: user.tokenVersion || 0,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user._id, email: user.email, name: user.name, role: user.role, branchCode: user.branchCode || '' },
    });
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes idle (F2: short-lived session, refreshed on activity by middleware)
    });
    return response;
  } catch (error: any) {
    console.error('[Auth] OTP verify error:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
