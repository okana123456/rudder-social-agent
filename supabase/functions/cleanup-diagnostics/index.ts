import { handler, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { requireCronSecret } from '../_shared/auth.ts';
Deno.serve(
  handler(async (request) => {
    requireCronSecret(request);
    const db = adminClient();
    const before = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data, error } = await db.storage.from('diagnostics').list('', { limit: 1000 });
    if (error && error.message !== 'Bucket not found') throw error;
    const expired = (data ?? [])
      .filter((f) => f.created_at && f.created_at < before)
      .map((f) => f.name);
    if (expired.length) await db.storage.from('diagnostics').remove(expired);
    return json({ removed: expired.length });
  }),
);
