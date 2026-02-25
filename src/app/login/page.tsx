// Login page — server component wrapper.
// force-dynamic prevents static prerendering (which fails because next-auth
// pulls in @libsql/client during SSR and the build has no DB connection).

import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginForm />;
}
