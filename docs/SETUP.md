# Local setup

1. Install Node.js 22+, npm, Docker Desktop, and the Supabase CLI.
2. Run `npm install` at the repository root.
3. Copy `.env.example` to `apps/web/.env.local`. Add the public Supabase values first; keep server secrets private.
4. Run `supabase start` for local development or link a hosted project with `supabase link --project-ref YOUR_REF`.
5. Apply schema with `supabase db push`. Deploy functions and secrets using `docs/SUPABASE.md`.
6. Start the dashboard with `npm run dev:web` and create an account. If email confirmation is enabled, follow the verification message.
7. Complete onboarding. Use `Africa/Nairobi` initially or change it in Settings.
8. Build the extension with `npm run build:extension`; load its `dist` folder as an unpacked extension.
9. Register a Chrome extension device from **Devices & Agent** and immediately copy the one-time device token into extension options.
10. Follow `docs/META_SETUP.md` only when Page publishing is needed.

Missing variables produce configuration screens or explicit API errors; no fake production credential is supplied. The AI caption adapter is optional and manual captioning works without it.
