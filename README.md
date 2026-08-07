# Rudder Social Agent

Rudder is a production-oriented, confirmation-first publishing system for Facebook Pages and Facebook Groups. Page posts use Meta's official Graph API. Group posts are prepared locally by an MV3 Chrome extension in the user's existing Facebook session; no Facebook password, cookie, CAPTCHA bypass, fingerprint spoofing, or evasion mechanism exists in this project.

## Repository map

- `apps/web` — Next.js App Router dashboard, Supabase Auth, onboarding, Meta OAuth, composer, queues, devices, and analytics
- `apps/chrome-extension` — MV3 Group Assistant with selector adapters, review panel, strict stops, and emergency pause
- `apps/desktop-agent` — Electron Windows tray companion and protected device-token storage
- `packages/types`, `packages/config`, `packages/ui` — shared strict types, validation, and components
- `supabase/migrations` — schema, constraints, indexes, RLS, storage policies, queue RPCs, and cron
- `supabase/functions` — scheduler, Page publisher, device API, lease recovery, notifications, cleanup, and metadata refresh
- `docs` — setup, architecture, security, deployment, testing, and operator guides

## Requirements

Node.js 22+, npm 10+, Supabase CLI, and a Supabase project. Windows packaging additionally requires Windows 10/11 and the Electron Builder prerequisites. Meta credentials are needed only for live Page OAuth tests.

## Quick start

```bash
npm install
copy .env.example apps/web/.env.local
npm run dev
```

Fill in `apps/web/.env.local`, then apply migrations with `supabase db push` and deploy functions as described in [docs/SUPABASE.md](docs/SUPABASE.md). Open `http://localhost:3000`, sign up, and follow onboarding.

## Commands

| Command                      | Result                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| `npm run dev` / `dev:web`    | Run the dashboard                                           |
| `npm run dev:extension`      | Watch-build the Chrome extension                            |
| `npm run dev:desktop`        | Build and run the tray app                                  |
| `npm run build`              | Build shared packages, web, extension, and desktop          |
| `npm run build:web`          | Production Next.js build                                    |
| `npm run build:extension`    | Create `apps/chrome-extension/dist`                         |
| `npm run build:desktop`      | Create the Electron main bundle                             |
| `npm test`                   | Unit and integration-contract tests                         |
| `npm run test:e2e`           | Playwright browser tests                                    |
| `npm run lint` / `typecheck` | Static validation                                           |
| `npm run format`             | Apply Prettier formatting                                   |
| `npm run package:windows`    | Build the signed-or-unsigned NSIS installer                 |
| `npm run zip`                | Create inspected repository and extension ZIPs in `outputs` |

## Credentials to provide

Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the same Supabase URL/public key in local agent settings. Public keys are not secrets; RLS is the data boundary.

Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, a random 32-byte base64 `TOKEN_ENCRYPTION_KEY`, and optional AI provider URL/key. Never add server-only values to client variables, extension files, Electron renderer code, or source control.

## First safe test

1. Create a test organisation, campaign, caption, and one manually approved Group.
2. Register an extension device and copy the one-time token into extension settings.
3. Keep confirmation mode enabled and set a session maximum of one.
4. Queue a post with harmless test copy to that Group.
5. Click **Process next post**, inspect the destination and Facebook preview, then either approve or cancel.
6. Confirm the queue status and audit entry. If Facebook shows login, checkpoint, CAPTCHA, warning, or restriction, Rudder stops and requires review.

See [docs/SETUP.md](docs/SETUP.md) for the complete procedure.
