// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'zemen-bank-jwt-secret-change-in-production'
);

// secure cookies require HTTPS. Default ON in production; set COOKIE_INSECURE=true when serving over plain HTTP.
const COOKIE_SECURE =
  process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== 'true';

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/_next',
  '/favicon.ico',
  '/zblogo',
  '/api/auth/login',
  '/api/auth/verify-otp',
];

// Public API routes (called by web app / mobile app without auth)
function isPublicApiRoute(method: string, pathname: string): boolean {
  if (pathname === '/api/onboarding' && method === 'POST') return true;
  if (pathname === '/api/screening/check' && method === 'POST') return true;
  if (pathname.startsWith('/api/applications/status') && method === 'GET') return true;
  if (pathname === '/api/referrals/verify' && method === 'POST') return true;
  if (
    pathname.startsWith('/api/referrals/') &&
    !pathname.startsWith('/api/referrals/config') &&
    !pathname.startsWith('/api/referrals/stats') &&
    !pathname.startsWith('/api/referrals/rewards') &&
    !pathname.startsWith('/api/referrals/convert') &&
    method === 'GET'
  )
    return true;
  if (pathname.startsWith('/api/referrals/rewards') && method === 'GET') return true;

  // Allow OPTIONS for CORS preflight
  if (method === 'OPTIONS') return true;
  return false;
}

function checkPageAccess(role: string, path: string): boolean {
  if (role === 'admin') return true;

  if (role === 'sanction_uploader') {
    if (path === '/sanctions' || path.startsWith('/sanctions/')) return true;
    return false;
  }

  if (role === 'kyc' || role === 'senior_approver') {
    if (path === '/referrals' || path.startsWith('/referrals/')) return false;
    if (path === '/users' || path.startsWith('/users/')) return false;
    if (path === '/sanctions' || path.startsWith('/sanctions/')) return false;
    if (path === '/services' || path.startsWith('/services/')) return false;
    return true;
  }

  // Personal Banker: sets up requested services (mobile/internet banking, debit card) for their branch
  if (role === 'personal_banker') {
    return path === '/services' || path.startsWith('/services/');
  }

  if (role === 'marketing') {
    if (path === '/referrals' || path.startsWith('/referrals/')) return true;
    if (path === '/settings' || path.startsWith('/settings/')) return true;
    return false;
  }

  if (role === 'branch') {
    if (path === '/approved' || path.startsWith('/approved/')) return true;
    if (path === '/auto-approved' || path.startsWith('/auto-approved/')) return true;
    if (path.startsWith('/customers/')) return true;
    return false;
  }

  return false;
}

function checkApiAccess(role: string, method: string, pathname: string): boolean {
  if (role === 'admin') return true;

  // Auth endpoints are always accessible for authenticated users
  if (pathname.startsWith('/api/auth/')) return true;

  if (role === 'sanction_uploader') {
    if (pathname.startsWith('/api/sanctions')) return true;
    return false;
  }

  if (role === 'kyc' || role === 'senior_approver') {
    if (pathname.startsWith('/api/referrals')) return false;
    if (pathname.startsWith('/api/users')) return false;
    if (pathname.startsWith('/api/sanctions')) return false;
    if (pathname.startsWith('/api/services')) return false;
    return true;
  }

  if (role === 'personal_banker') {
    return pathname.startsWith('/api/services');
  }

  if (role === 'marketing') {
    if (pathname.startsWith('/api/referrals')) return true;
    return false;
  }

  if (role === 'branch') {
    if (pathname.startsWith('/api/customers') && method === 'GET') return true;
    if (pathname === '/api/stats' && method === 'GET') return true;
    return false;
  }

  return false;
}

function createRedirectUrl(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip public API routes
  if (pathname.startsWith('/api/') && isPublicApiRoute(method, pathname)) {
    return NextResponse.next();
  }

  // Get JWT from cookie
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(createRedirectUrl(request, '/login'));
  }

  // Verify JWT
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const role = payload.role as string;
    const userId = payload.userId as string;
    const email = payload.email as string;
    const name = payload.name as string;
    const branchCode = (payload.branchCode as string) || '';

    // Page-level role check
    if (!pathname.startsWith('/api/')) {
      if (!checkPageAccess(role, pathname)) {
        if (role === 'marketing') {
          return NextResponse.redirect(createRedirectUrl(request, '/referrals'));
        }
        if (role === 'branch') {
          return NextResponse.redirect(createRedirectUrl(request, '/approved'));
        }
        if (role === 'sanction_uploader') {
          return NextResponse.redirect(createRedirectUrl(request, '/sanctions'));
        }
        if (role === 'personal_banker') {
          return NextResponse.redirect(createRedirectUrl(request, '/services'));
        }
        return NextResponse.redirect(createRedirectUrl(request, '/'));
      }
    }

    // API-level role check
    if (pathname.startsWith('/api/')) {
      if (!checkApiAccess(role, method, pathname)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Pass user info to downstream via headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', userId);
    requestHeaders.set('x-user-role', role);
    requestHeaders.set('x-user-email', email || '');
    requestHeaders.set('x-user-name', name || '');
    requestHeaders.set('x-user-branch', branchCode);
    requestHeaders.set(
      'x-user-token-version',
      String((payload as any).tokenVersion ?? 0)
    );

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // Sliding session (F2): refresh an active user's token so they are NOT logged out mid-session.
    // Idle for 15 min (no requests) still expires.
    // Re-issue only when the current token is more than 2 minutes old.
    //
    // OPTION A FIX:
    // Do NOT refresh tokens on logout endpoint, otherwise the logout cookie clear can be overwritten.
    const isLogoutEndpoint =
      pathname === '/api/auth/logout' || pathname.startsWith('/api/auth/logout');

    if (!isLogoutEndpoint) {
      const iat = (payload.iat as number) || 0;
      const nowSec = Math.floor(Date.now() / 1000);

      if (nowSec - iat > 120) {
        try {
          const refreshed = await new SignJWT({
            userId,
            email: email || '',
            name: name || '',
            role,
            branchCode,
            tokenVersion: (payload as any).tokenVersion ?? 0,
          })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('15m')
            .sign(JWT_SECRET);

          response.cookies.set('auth-token', refreshed, {
            httpOnly: true,
            secure: COOKIE_SECURE,
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 60,
          });
        } catch {
          // if refresh fails, keep the existing valid token
        }
      }
    }

    return response;
  } catch {
    // Invalid or expired token
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.redirect(createRedirectUrl(request, '/login'));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|zblogo).*)'],
};