import { auth } from '@/lib/auth/config';
import { type NextRequest, NextResponse } from 'next/server';

// Explicit public path allowlist. Each entry matches exactly or as a prefix with '/'.
// SECURITY: New routes under /api/auth/ must be explicitly added here to be public.
// This prevents accidental exposure if a developer adds /api/auth/admin-action.
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/callback', // NextAuth: OAuth callbacks (e.g., /callback/google)
  '/api/auth/signin', // NextAuth: sign-in handler
  '/api/auth/signout', // NextAuth: sign-out handler
  '/api/auth/session', // NextAuth: session endpoint
  '/api/auth/csrf', // NextAuth: CSRF token
  '/api/auth/providers', // NextAuth: providers list
  '/api/auth/error', // NextAuth: error handler
  '/api/auth/beta-code', // Custom: beta code validation
];

// Routes that require admin role.
const ADMIN_PATHS = ['/admin', '/api/admin'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default auth((req: NextRequest & { auth: { user?: { role?: string } } | null }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const userRole = session?.user?.role ?? 'user';

  // Allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect non-admin users away from admin routes
  if (isAdminPath(pathname) && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

// Apply middleware to all routes except Next.js internals and static files
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
