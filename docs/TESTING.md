# Testing

Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. Run `supabase test db` against a local instance for RLS/schema pgTAP checks.

Unit tests cover validation, legal queue transitions, duplicate-terminal prevention, bounded retry delay, and non-retryable platform stops. Playwright covers authentication surfaces, navigation completeness, and mobile overflow. Production adapters remain real; automated Meta tests must mock the network at the boundary.

Manual release checklist: sign-up/verification/login/logout/reset; onboarding; campaign/caption/media CRUD; scheduling and unique job generation; two-device concurrent claim; lease expiry; failure retry; paused campaign; heartbeat/offline state; Meta OAuth denial and test Page; extension confirmation/cancel/autopilot countdown/emergency stop; mobile navigation; two-organisation isolation; export and deletion. For Group UI tests use a permitted test Group and harmless content. Stop immediately on warnings or checkpoints.
