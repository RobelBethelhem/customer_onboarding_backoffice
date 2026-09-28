import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from './models/User';

export interface AuthUser {
  userId: string;
  role: UserRole;
  email: string;
  name: string;
}

export function getUserFromRequest(request: NextRequest): AuthUser | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role') as UserRole;

  if (!userId || !role) return null;

  return {
    userId,
    role,
    email: request.headers.get('x-user-email') || '',
    name: request.headers.get('x-user-name') || '',
  };
}

export function requireRole(request: NextRequest, allowedRoles: UserRole[]): NextResponse | null {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden: insufficient permissions' }, { status: 403 });
  }

  return null; // null means authorized
}
