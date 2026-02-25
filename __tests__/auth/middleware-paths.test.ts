import { describe, expect, it } from 'vitest';

// Replicate middleware path logic for unit testing.
// These mirror the exact lists and functions in middleware.ts.

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/callback',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/session',
  '/api/auth/csrf',
  '/api/auth/providers',
  '/api/auth/error',
  '/api/auth/beta-code',
];

const ADMIN_PATHS = ['/admin', '/api/admin'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

describe('isPublicPath', () => {
  it('allows /login', () => {
    expect(isPublicPath('/login')).toBe(true);
  });

  it('allows NextAuth callback routes', () => {
    expect(isPublicPath('/api/auth/callback/google')).toBe(true);
    expect(isPublicPath('/api/auth/callback/github')).toBe(true);
  });

  it('allows NextAuth standard routes', () => {
    expect(isPublicPath('/api/auth/signin')).toBe(true);
    expect(isPublicPath('/api/auth/signout')).toBe(true);
    expect(isPublicPath('/api/auth/session')).toBe(true);
    expect(isPublicPath('/api/auth/csrf')).toBe(true);
    expect(isPublicPath('/api/auth/providers')).toBe(true);
    expect(isPublicPath('/api/auth/error')).toBe(true);
  });

  it('allows beta-code endpoint', () => {
    expect(isPublicPath('/api/auth/beta-code')).toBe(true);
  });

  it('blocks unknown /api/auth/ sub-routes', () => {
    expect(isPublicPath('/api/auth/admin-reset')).toBe(false);
    expect(isPublicPath('/api/auth/change-role')).toBe(false);
    expect(isPublicPath('/api/auth/secret')).toBe(false);
  });

  it('blocks protected routes', () => {
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/admin')).toBe(false);
    expect(isPublicPath('/api/admin/users')).toBe(false);
    expect(isPublicPath('/api/debate')).toBe(false);
  });
});

describe('isAdminPath', () => {
  it('matches /admin and sub-routes', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/users')).toBe(true);
    expect(isAdminPath('/admin/providers')).toBe(true);
  });

  it('matches /api/admin and sub-routes', () => {
    expect(isAdminPath('/api/admin')).toBe(true);
    expect(isAdminPath('/api/admin/users')).toBe(true);
    expect(isAdminPath('/api/admin/beta-codes')).toBe(true);
  });

  it('does not match non-admin routes', () => {
    expect(isAdminPath('/')).toBe(false);
    expect(isAdminPath('/login')).toBe(false);
    expect(isAdminPath('/api/auth/callback/google')).toBe(false);
    expect(isAdminPath('/api/debate')).toBe(false);
  });
});
