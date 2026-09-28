'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [step, setStep] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function routeForRole(role: string) {
    if (role === 'marketing') return '/referrals';
    if (role === 'senior_approver') return '/escalated';
    if (role === 'branch') return '/approved';
    if (role === 'sanction_uploader') return '/sanctions';
    return '/';
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success && data.otpRequired) {
        setStep('otp');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (data.success) {
        // Hard navigation (not router.push): forces a fresh top-level request that is
        // guaranteed to carry the just-set auth cookie, and re-runs route prefetches with
        // the cookie present — avoids the post-login redirect race.
        window.location.assign(routeForRole(data.user.role));
        return;
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md mx-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-2xl overflow-hidden mb-4 bg-white/10 backdrop-blur-sm p-2">
            <Image src="/zblogo.png" alt="Zemen Bank" width={96} height={96} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">Zemen Bank</h1>
          <p className="text-slate-400 text-sm mt-1">Admin Dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === 'password' ? (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-gray-900"
                    placeholder="you@zemenbank.com"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all pr-12 text-gray-900"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium rounded-lg hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (<><Loader2 size={20} className="animate-spin" />Signing in...</>) : 'Continue'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2 text-gray-800">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-semibold">Two-Factor Verification</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                We sent a 6-digit code to your registered phone number. Enter it below to finish signing in.
              </p>
              <form onSubmit={handleOtpSubmit} className="space-y-5">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">One-Time Code</label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-gray-900 text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="••••••"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium rounded-lg hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (<><Loader2 size={20} className="animate-spin" />Verifying...</>) : 'Verify & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('password'); setOtp(''); setError(''); }}
                  className="w-full py-2 text-gray-500 text-sm hover:text-gray-700"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Zemen Bank Customer Onboarding Administration Portal
        </p>
      </div>
    </div>
  );
}
