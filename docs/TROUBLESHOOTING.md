# Troubleshooting

- **Configuration required:** add public Supabase values to `apps/web/.env.local` and restart Next.js.
- **Migration failure:** verify extensions allowed by the project, inspect the first failing migration, and do not skip RLS migrations.
- **Meta invalid redirect:** the URI must exactly match both Meta settings and `META_REDIRECT_URI`, including scheme and path.
- **Page permission error:** inspect granted tasks/permissions, app mode, review status, and token revocation; reauthorise instead of retrying endlessly.
- **Extension disconnected:** revoke and register a new device token, verify the Supabase URL/public key, and deploy `device-api`.
- **Composer not found:** stop the agent, capture diagnostics only with consent, inspect Facebook UI/language, and update the selector adapter. Do not add evasion.
- **Outcome unverified:** check the Group manually before retrying; duplicate prevention intentionally requires review.
- **Desktop offline:** save connection settings, check Windows network/firewall, and ensure protected storage is available.
