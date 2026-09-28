import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
import { requireRole } from '@/lib/apiAuth';
import { audit, fieldChanges } from '@/lib/audit';

// PATCH /api/users/[id] - Update user (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const { id } = params;
    const body = await request.json();
    const { name, role, isActive, isLocked, password, phone, branchCode } = body;

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const before = { name: user.name, phone: user.phone, role: user.role, branchCode: user.branchCode, isActive: user.isActive, isLocked: user.isLocked };

    if (name) user.name = name;
    if (typeof phone === 'string') user.phone = phone;
    if (role && ['admin', 'kyc', 'marketing', 'branch', 'senior_approver', 'sanction_uploader', 'personal_banker'].includes(role)) user.role = role;
    if (typeof branchCode === 'string') user.branchCode = branchCode;
    // Branch users and Personal Bankers must have a branch code
    if (['branch', 'personal_banker'].includes(user.role) && !user.branchCode) {
      return NextResponse.json({ success: false, error: 'Branch code is required for branch and personal banker roles' }, { status: 400 });
    }

    // Reactivating (or explicitly unlocking) clears the lockout so the user can log in again (F4)
    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
      if (isActive) { user.isLocked = false; user.failedLoginAttempts = 0; user.lockedAt = undefined; }
    }
    if (typeof isLocked === 'boolean') {
      user.isLocked = isLocked;
      if (!isLocked) { user.failedLoginAttempts = 0; user.lockedAt = undefined; }
    }

    if (password) {
      const pwCheck = validatePasswordStrength(password);
      if (!pwCheck.valid) {
        return NextResponse.json({ success: false, error: pwCheck.error }, { status: 400 });
      }
      user.passwordHash = await hashPassword(password);
    }

    await user.save();

    // Audit each kind of change separately so it can be filtered by action type
    const target = { module: 'USER' as const, entityType: 'User', entityId: String(user._id), entityName: user.email };
    const changes = fieldChanges(before, user.toObject(), ['name', 'phone', 'role', 'branchCode']);
    if (changes.length) {
      await audit(request, { ...target, action: 'UPDATE', changes, description: `Changed ${changes.map(c => c.field).join(', ')}` });
    }
    if (before.isActive !== user.isActive) {
      await audit(request, { ...target, action: user.isActive ? 'ACTIVATE' : 'DEACTIVATE', description: user.isActive ? 'Activated user' : 'Deactivated user' });
    }
    if (before.isLocked !== user.isLocked) {
      await audit(request, { ...target, action: user.isLocked ? 'LOCK' : 'UNLOCK', description: user.isLocked ? 'Locked user' : 'Unlocked user' });
    }
    if (password) {
      await audit(request, { ...target, action: 'PASSWORD_RESET', description: 'Reset the password' });
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Users] Update error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Deactivate user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const { id } = params;
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    user.isActive = false;
    await user.save();
    await audit(request, {
      module: 'USER', action: 'DEACTIVATE', entityType: 'User', entityId: String(user._id),
      entityName: user.email, description: 'Deactivated user (delete)',
    });

    return NextResponse.json({ success: true, message: 'User deactivated' });
  } catch (error: any) {
    console.error('[Users] Delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
