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
import { audit } from '@/lib/audit';
import { escapeRegex } from '@/lib/regex';

// Roles tied to one branch — they must be given a branch code
const BRANCH_ROLES = ['branch', 'personal_banker'];

const ROLES = ['admin', 'kyc', 'marketing', 'branch', 'senior_approver', 'sanction_uploader', 'personal_banker', 'auditor'];

/**
 * GET /api/users?page=1&limit=20&search=&status=all|active|inactive|locked&role= — one page of
 * users (admin only), newest first, with the number of users in each status for the filters.
 * Only the fields the page shows: never the password hash or sign-in codes.
 */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(params.get('limit') || '20', 10) || 20));
    const search = (params.get('search') || '').trim().slice(0, 100);
    const status = params.get('status') || 'all';
    const role = params.get('role') || '';

    const query: Record<string, any> = {};
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { branchCode: pattern }];
    }
    if (status === 'active') { query.isActive = { $ne: false }; query.isLocked = { $ne: true }; }
    else if (status === 'inactive') query.isActive = false;
    else if (status === 'locked') query.isLocked = true;
    if (ROLES.includes(role)) query.role = role;

    const [users, total, counts] = await Promise.all([
      User.find(query)
        .select('_id email name phone role branchCode isActive isLocked lastLogin createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
      User.aggregate([{
        $group: {
          _id: null,
          all: { $sum: 1 },
          active: { $sum: { $cond: [{ $and: [{ $ne: ['$isActive', false] }, { $ne: ['$isLocked', true] }] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
          locked: { $sum: { $cond: [{ $eq: ['$isLocked', true] }, 1, 0] } },
        },
      }]),
    ]);
    const { _id, ...statusCounts } = counts[0] || { _id: null, all: 0, active: 0, inactive: 0, locked: 0 };

    return NextResponse.json({
      success: true,
      users,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: statusCounts,
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
      'auditor',
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

    await audit(request, {
      module: 'USER', action: 'CREATE', entityType: 'User', entityId: String(user._id), entityName: user.email,
      description: `Created ${role} user ${user.name}${user.branchCode ? ` (branch ${user.branchCode})` : ''}`,
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
