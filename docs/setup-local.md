# Local setup

## Prerequisites

- Node.js 20 (the version used by CI) and npm.
- A local SQLite file for development, or a configured Turso database.
- Google OAuth credentials and an auth secret for the login flow.
- Provider credentials and active persona mappings for live model calls.
- An existing invitation/bootstrap arrangement for a fresh database.

Use [.env.example](../.env.example) as the variable inventory. Keep real values in ignored local configuration. Langfuse credentials enable tracing; leaving them absent does not constitute a telemetry test. Trigger.dev is deferred.

## Install and configure

```sh
npm ci
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Bash:

```sh
cp .env.example .env.local
```

For a local development database, set `TURSO_DATABASE_URL=file:local.db` and omit the Turso auth token. For a hosted database, set the URL and token for that database.

Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAIL`, and `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Register the local Google callback URL `http://localhost:3000/api/auth/callback/google` in the OAuth configuration. Keep the sign-in flow protected.

```sh
npm run db:push
npm run dev
```

Open [localhost:3000](http://localhost:3000). Unauthenticated visitors are sent to login.

## Fresh database caveat

Schema creation does not create a usable invitation, user, or active provider/persona mapping. The repository does not currently include a turnkey first-user seed command. `ADMIN_EMAIL` promotes the matching user after account creation; it does not bypass invitation validation.

A maintainer must establish the initial invitation through a controlled database bootstrap before first sign-in. This setup gap is intentionally explicit rather than suggesting that environment variables alone produce a working demo. Do not disable auth to get past it.

After authorized admin access exists, configure providers/models and activate the persona mappings required by the selected mode. The graph resolves those mappings from the database; having one API key in the environment is not sufficient to promise a three-persona debate.

## Verify and build

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
```

Build success checks compilation and packaging. It does not validate OAuth, provider availability, live streaming reliability, or persistent context updates on the intended host. Local builds may need network access to fetch the configured fonts.

## Evaluation commands

The package exposes `eval`, `eval:debate`, `eval:sycophancy`, and `eval:persona` scripts targeting `evals/`. A dedicated golden-query suite is not present in the inspected checkout. Judge and scoring unit tests live under `__tests__/eval/`; do not describe those as a live comparative benchmark.

A runtime change must define the relevant evaluation cases before implementation and report which checks actually ran.
