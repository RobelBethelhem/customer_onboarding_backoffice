import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { UserRole } from './models/User';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'zemen-bank-jwt-secret-change-in-production');
// Short-lived access token (was 8h) — reduces the exposure window after logout/theft
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  branchCode?: string;
  tokenVersion?: number;  // must match the user's current tokenVersion (invalidated on logout)
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_EXPIRY)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Login OTP (MFA) helpers ──
export function generateOtp(): string {
  // 6-digit numeric OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function compareOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

// ── Strong password policy (F3) ──
const COMMON_PASSWORDS = new Set([
  '123456', '12345678', '123456789', 'password', 'password1', 'qwerty', 'admin',
  'admin123', 'welcome', 'welcome1', 'letmein', 'iloveyou', '111111', '000000',
  'abc123', 'zemenbank', 'changeme', 'p@ssw0rd', 'passw0rd',
]);

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long' };
  }
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must include a lowercase letter' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must include an uppercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must include a number' };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: 'Password must include a symbol' };
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common — choose a less guessable password' };
  }
  return { valid: true };
}
