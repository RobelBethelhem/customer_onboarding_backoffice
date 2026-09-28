// import { NextRequest, NextResponse } from 'next/server';
// import { connectToDatabase } from '@/lib/mongodb';
// import User from '@/lib/models/User';
// import { hashPassword, validatePasswordStrength } from '@/lib/auth';
// import { requireRole } from '@/lib/apiAuth';

// // GET /api/users - List all users (admin only)
// export async function GET(request: NextRequest) {
//   const denied = requireRole(request, ['admin']);
//   if (denied) return denied;

//   try {
//     await connectToDatabase();

//     const users = await User.find({})
//       .select('-passwordHash')
//       .sort({ createdAt: -1 })
//       .lean();

//     return NextResponse.json({ success: true, users });
//   } catch (error: any) {
//     console.error('[Users] List error:', error);
//     return NextResponse.json({ success: false, error: error.message }, { status: 500 });
//   }
// }

// // POST /api/users - Create new user (admin only)
// export async function POST(request: NextRequest) {
//   const denied = requireRole(request, ['admin']);
//   if (denied) return denied;

//   try {
//     await connectToDatabase();

//     const { email, password, name, phone, role, branchCode } = await request.json();

//     if (!email || !password || !name || !role || !phone) {
//       return NextResponse.json(
//         { success: false, error: 'Email, password, name, phone, and role are required' },
//         { status: 400 }
//       );
//     }

//     if (!['admin', 'kyc', 'marketing', 'branch', 'senior_approver', 'sanction_uploader'].includes(role)) {
//       return NextResponse.json(
//         { success: false, error: 'Invalid role' },
//         { status: 400 }
//       );
//     }

//     if (role === 'branch' && !branchCode) {
//       return NextResponse.json(
//         { success: false, error: 'Branch code is required for branch role' },
//         { status: 400 }
//       );
//     }

//     // F3: strong password policy
//     const pwCheck = validatePasswordStrength(password);
//     if (!pwCheck.valid) {
//       return NextResponse.json(
//         { success: false, error: pwCheck.error },
//         { status: 400 }
//       );
//     }

//     // Check duplicate email
//     const existing = await User.findOne({ email: email.toLowerCase() });
//     if (existing) {
//       return NextResponse.json(
//         { success: false, error: 'A user with this email already exists' },
//         { status: 400 }
//       );
//     }

//     const passwordHash = await hashPassword(password);
//     const user = await User.create({
//       email: email.toLowerCase(),
//       passwordHash,
//       name,
//       phone,
//       role,
//       branchCode: role === 'branch' ? branchCode : '',
//       isActive: true,
//     });

//     return NextResponse.json({
//       success: true,
//       user: {
//         _id: user._id,
//         email: user.email,
//         name: user.name,
//         role: user.role,
//         isActive: user.isActive,
//         createdAt: user.createdAt,
//       },
//     });
//   } catch (error: any) {
//     console.error('[Users] Create error:', error);
//     return NextResponse.json({ success: false, error: error.message }, { status: 500 });
//   }
// }






import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
import { requireRole } from '@/lib/apiAuth';

// Roles tied to one branch — they must be given a branch code
const BRANCH_ROLES = ['branch', 'personal_banker'];

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  // Server-side authorization
  // Only users with the "admin" role can access the user list.
  const denied = requireRole(request, ['admin']);
  if (denied) {
    return denied;
  }

  try {
    await connectToDatabase();

    /*
     * Security:
     * Do NOT return the complete User document.
     *
     * We explicitly select only the fields required by the UI.
     * This prevents sensitive fields such as:
     *
     * - passwordHash
     * - loginOtpHash
     * - loginOtpExpires
     *
     * from being serialized in the API response.
     *
     * If your UI needs additional NON-SENSITIVE fields, add them
     * explicitly to this list.
     */
    const users = await User.find({})
      .select('_id email name phone role branchCode isActive createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error('[Users] List error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve users',
      },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  // Server-side authorization
  // Only admins can create users.
  const denied = requireRole(request, ['admin']);
  if (denied) {
    return denied;
  }

  try {
    await connectToDatabase();

    const {
      email,
      password,
      name,
      phone,
      role,
      branchCode,
    } = await request.json();

    // Validate required fields
    if (!email || !password || !name || !role || !phone) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email, password, name, phone, and role are required',
        },
        { status: 400 }
      );
    }

    // Validate role
    const allowedRoles = [
      'admin',
      'kyc',
      'marketing',
      'branch',
      'senior_approver',
      'sanction_uploader',
      'personal_banker',
    ];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid role',
        },
        { status: 400 }
      );
    }

    // Branch users and Personal Bankers must have a branch code
    if (BRANCH_ROLES.includes(role) && !branchCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Branch code is required for branch and personal banker roles',
        },
        { status: 400 }
      );
    }

    // Strong password policy
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: pwCheck.error,
        },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existing = await User.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'A user with this email already exists',
        },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      phone: phone.trim(),
      role,
      branchCode: BRANCH_ROLES.includes(role) ? branchCode : '',
      isActive: true,
    });

    /*
     * Security:
     * Never return the complete Mongoose user document here.
     *
     * Explicitly return only fields required by the frontend.
     *
     * This guarantees that passwordHash, loginOtpHash,
     * loginOtpExpires, and any future sensitive fields are not
     * accidentally exposed.
     */
    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        branchCode: user.branchCode,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[Users] Create error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create user',
      },
      { status: 500 }
    );
  }
}
