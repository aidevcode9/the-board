import { handlers } from '@/lib/auth/config';

// NextAuth.js v5 App Router handlers.
// GET handles session/callback, POST handles sign-in/sign-out.
export const { GET, POST } = handlers;
