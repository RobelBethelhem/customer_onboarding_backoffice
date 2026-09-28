import mongoose from 'mongoose';
import User from '../lib/models/User';
import { hashPassword } from '../lib/auth';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zemen_onboarding';

async function seedAdmin() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const existing = await User.findOne({ email: 'admin@zemenbank.com' });
  if (existing) {
    console.log('Admin user already exists. Skipping seed.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe@2026!';
  const passwordHash = await hashPassword(adminPassword);

  await User.create({
    email: 'admin@zemenbank.com',
    passwordHash,
    name: 'System Admin',
    phone: process.env.ADMIN_PHONE || '',
    role: 'admin',
    isActive: true,
  });

  console.log('');
  console.log('=== Admin user created ===');
  console.log('Email:    admin@zemenbank.com');
  console.log('Password: ' + adminPassword);
  console.log('Phone:    ' + (process.env.ADMIN_PHONE || '(not set — set ADMIN_PHONE to receive login OTP)'));
  console.log('');
  console.log('IMPORTANT: Change this password after first login.');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
