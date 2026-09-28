import mongoose, { Document, Schema, Model } from 'mongoose';

export type UserRole = 'admin' | 'kyc' | 'marketing' | 'branch' | 'senior_approver' | 'sanction_uploader';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  phone: string;                 // for login OTP (MFA)
  role: UserRole;
  branchCode?: string;
  isActive: boolean;
  lastLogin?: Date;
  // Security — brute-force lockout + MFA OTP + session invalidation
  failedLoginAttempts: number;
  isLocked: boolean;
  lockedAt?: Date;
  loginOtpHash?: string;
  loginOtpExpires?: Date;
  tokenVersion: number;          // bumped on logout to invalidate issued JWTs
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'kyc', 'marketing', 'branch', 'senior_approver', 'sanction_uploader'], default: 'kyc' },
  branchCode: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  isLocked: { type: Boolean, default: false },
  lockedAt: { type: Date },
  loginOtpHash: { type: String },
  loginOtpExpires: { type: Date },
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });

let User: Model<IUser>;

try {
  User = mongoose.model<IUser>('User');
} catch {
  User = mongoose.model<IUser>('User', UserSchema);
}

export default User;
