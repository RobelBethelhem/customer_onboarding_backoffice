// import { NextResponse } from 'next/server';
// import { connectToDatabase } from '@/lib/mongodb';
// import User from '@/lib/models/User';
// import { comparePassword, hashPassword, generateOtp, hashOtp } from '@/lib/auth';
// import { sendSMS } from '@/lib/sms';

// const MAX_ATTEMPTS = 3;          // F4: lock after 3 failed attempts (password OR OTP)
// const OTP_TTL_MS = 5 * 60 * 1000;

// // Step 1 of login: verify email + password, then send an OTP (MFA). No session is issued here.
// export async function POST(request: Request) {
//   try {
//     await connectToDatabase();
//     const { email, password } = await request.json();

//     if (!email || !password) {
//       return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
//     }

//     // Auto-seed: if no users exist, create default admin
//     const userCount = await User.countDocuments();
//     if (userCount === 0) {
//       const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD || 'ChangeMe@2026!');
//       await User.create({
//         email: 'admin@zemenbank.com',
//         passwordHash,
//         name: 'System Admin',
//         role: 'admin',
//         phone: process.env.ADMIN_PHONE || '',
//         isActive: true,
//       });
//       console.log('[Auth] Auto-seeded default admin: admin@zemenbank.com (set ADMIN_PHONE to receive OTP)');
//     }

//     const user = await User.findOne({ email: email.toLowerCase() });
//     if (!user) {
//       return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
//     }
//     if (user.isLocked) {
//       return NextResponse.json({ success: false, error: 'Account locked due to failed attempts. Contact your administrator.' }, { status: 403 });
//     }
//     if (!user.isActive) {
//       return NextResponse.json({ success: false, error: 'Account is inactive. Contact your administrator.' }, { status: 403 });
//     }

//     const valid = await comparePassword(password, user.passwordHash);
//     if (!valid) {
//       user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
//       let locked = false;
//       if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
//         user.isLocked = true;
//         user.lockedAt = new Date();
//         locked = true;
//       }
//       await user.save();
//       return NextResponse.json({
//         success: false,
//         error: locked
//           ? 'Account locked after 3 failed attempts. Contact your administrator.'
//           : 'Invalid credentials',
//       }, { status: locked ? 403 : 401 });
//     }

//     // Password OK → issue a one-time OTP. Do NOT reset failedLoginAttempts yet:
//     // password and OTP share the same 3-strike budget.
//     const otp = generateOtp();
//     user.loginOtpHash = await hashOtp(otp);
//     user.loginOtpExpires = new Date(Date.now() + OTP_TTL_MS);
//     await user.save();

//     const message = `Your Zemen Bank login code is ${otp}. It expires in 5 minutes. Do not share it.`;
//     if (user.phone) {
//       sendSMS(user.phone, message); // fire-and-forget (reuses the configured SMS gateway)
//     } else {
//       console.warn(`[Auth] User ${user.email} has no phone on file — cannot deliver login OTP.`);
//     }
//     if (process.env.NODE_ENV !== 'production') {
//       // Dev convenience so the OTP flow is testable without a live handset
//       console.log(`[Auth][DEV] Login OTP for ${user.email}: ${otp}`);
//     }

//     return NextResponse.json({ success: true, otpRequired: true, email: user.email });
//   } catch (error: any) {
//     console.error('[Auth] Login error:', error);
//     return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
//   }
// }




import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { comparePassword, hashPassword, generateOtp, hashOtp } from '@/lib/auth';
import { sendSMS } from '@/lib/sms';

const MAX_ATTEMPTS = 3;          // F4: lock after 3 failed attempts (password OR OTP)
const OTP_TTL_MS = 5 * 60 * 1000;

// Step 1 of login: verify email + password, then send an OTP (MFA). No session is issued here.
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const { email, password } = await request.json();

    // Prevent NoSQL injection:
    // email and password must be primitive strings.
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Auto-seed: if no users exist, create default admin
    const userCount = await User.countDocuments();

    if (userCount === 0) {
      const passwordHash = await hashPassword(
        process.env.ADMIN_PASSWORD || 'ChangeMe@2026!'
      );

      await User.create({
        email: 'admin@zemenbank.com',
        passwordHash,
        name: 'System Admin',
        role: 'admin',
        phone: process.env.ADMIN_PHONE || '',
        isActive: true,
      });

      console.log(
        '[Auth] Auto-seeded default admin: admin@zemenbank.com (set ADMIN_PHONE to receive OTP)'
      );
    }

    // Use $eq to ensure the email is matched as an exact value
    // and cannot be interpreted as a MongoDB query operator.
    const user = await User.findOne({
      email: { $eq: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (user.isLocked) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Account locked due to failed attempts. Contact your administrator.',
        },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Account is inactive. Contact your administrator.',
        },
        { status: 403 }
      );
    }

    // Compare password against the stored hash.
    // Password is NOT used directly in the MongoDB query.
    const valid = await comparePassword(
      password,
      user.passwordHash
    );

    if (!valid) {
      user.failedLoginAttempts =
        (user.failedLoginAttempts || 0) + 1;

      let locked = false;

      if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
        user.isLocked = true;
        user.lockedAt = new Date();
        locked = true;
      }

      await user.save();

      return NextResponse.json(
        {
          success: false,
          error: locked
            ? 'Account locked after 3 failed attempts. Contact your administrator.'
            : 'Invalid credentials',
        },
        { status: locked ? 403 : 401 }
      );
    }

    // Password OK → issue a one-time OTP.
    // Do NOT reset failedLoginAttempts yet:
    // password and OTP share the same 3-strike budget.
    const otp = generateOtp();

    user.loginOtpHash = await hashOtp(otp);
    user.loginOtpExpires = new Date(
      Date.now() + OTP_TTL_MS
    );

    await user.save();

    const message =
      `Your Zemen Bank login code is ${otp}. ` +
      `It expires in 5 minutes. Do not share it.`;

    if (user.phone) {
      sendSMS(user.phone, message); // fire-and-forget
    } else {
      console.warn(
        `[Auth] User ${user.email} has no phone on file — cannot deliver login OTP.`
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      // Dev convenience so the OTP flow is testable without a live handset
      console.log(
        `[Auth][DEV] Login OTP for ${user.email}: ${otp}`
      );
    }

    return NextResponse.json({
      success: true,
      otpRequired: true,
      email: user.email,
    });
  } catch (error: any) {
    // Log technical details on the server only.
    // Do not expose internal database/server errors to the client.
    console.error('[Auth] Login error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Login failed',
      },
      { status: 500 }
    );
  }
}
