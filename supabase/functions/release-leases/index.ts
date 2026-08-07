import { handler, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { requireCronSecret } from '../_shared/auth.ts';

Deno.serve(
  handler(async (request) => {
    requireCronSecret(request);
    const { data, error } = await adminClient().rpc('release_expired_leases');
    if (error) throw error;
    return json({ released: data, at: new Date().toISOString() });
  }),
);
