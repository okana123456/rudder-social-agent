# Deployment

Deploy `apps/web` to Vercel or another Node-compatible Next.js host. Add all public and server environment values through the host's secret manager. Set `NEXT_PUBLIC_APP_URL` and `META_REDIRECT_URI` to the production HTTPS domain, rebuild, and update Meta's exact redirect allowlist.

Before release: apply Supabase migrations, deploy Edge Functions, set function secrets, verify Storage policies, verify cron execution, build all apps, run tests, build the extension ZIP, and package/sign Windows installer. Do not deploy or create resources from this repository automatically.

For GitHub: create an empty private repository, run `git init`, `git add .`, inspect `git status` for secrets/binaries, commit, add the remote, and push. GitHub Actions validates formatting, lint, types, tests, builds, audit, and browser flows.

Rollback web by promoting the previous deployment. Roll back Edge Functions by deploying the previous commit. Database migrations are forward-only: write a compensating migration, rehearse it against a backup, and never use destructive rollback against production without review.
