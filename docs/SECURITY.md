# Security model

Supabase Auth identifies users; organisation membership and roles drive RLS. The anon key is public. Service-role and Meta secrets live only in trusted server/Edge runtimes. OAuth state is random, hashed, single-use, user-bound, organisation-bound, and expires after ten minutes. Redirects are local-path constrained.

Page tokens are AES-256-GCM encrypted. Device tokens are random, stored only as SHA-256 hashes server-side, shown once, and revocable. Electron protects its token with Windows safe storage. Chrome stores the device token in extension-owned storage; it never reads Facebook cookies or passwords.

Sensitive routes authenticate, validate input, and rate-limit high-impact actions. Database constraints and Zod reject invalid data. Storage limits type/size and private object paths. CSP, frame denial, referrer policy, no `eval`, least-privilege MV3 permissions, bounded retries, audit logs, safe stop codes, and diagnostic consent reduce exposure.

Account deletion is an owner-confirmed operation: export if requested, pause devices/campaigns, revoke connections/devices, delete Storage prefixes, remove the organisation, then delete Auth identity through a server-only administrative function. Retain only records required by law and document them.
