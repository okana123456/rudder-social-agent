# Supabase

Create a project, copy its project URL and anon/publishable key, and place them in the web public environment. Keep the service-role key only in Vercel/server and Edge Function secrets.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... TOKEN_ENCRYPTION_KEY=... META_APP_ID=... META_APP_SECRET=... META_GRAPH_VERSION=v26.0 APP_ORIGIN=https://your-domain.example
supabase functions deploy queue-scheduler publish-page release-leases notifications cleanup-diagnostics refresh-meta device-api
```

Migrations create the private `media` bucket, storage policies, Realtime tables, and `pg_cron` schedules. In hosted projects, verify that `pg_cron` is enabled and that scheduled function invocation uses Vault/network configuration appropriate to the project. The SQL scheduler functions can also be invoked by a trusted external scheduler.

After migrations, add the two scheduler secrets in the Supabase SQL editor so `pg_net` can call the deployed functions without storing plaintext in tables:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co','rudder_project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY','rudder_service_role_key');
```

For local development, run `supabase start`, `supabase db reset`, and `supabase functions serve --env-file supabase/.env.local`. Seed data is intentionally empty until a real local Auth user exists.

Back up Postgres daily and Storage according to your Supabase plan. Test point-in-time recovery. Export migrations with every schema change; do not edit already-applied production migrations.
