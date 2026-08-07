import { handler, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { requireCronSecret } from '../_shared/auth.ts';
Deno.serve(
  handler(async (request) => {
    requireCronSecret(request);
    const db = adminClient();
    const threshold = new Date(Date.now() + 7 * 86400000).toISOString();
    const { data, error } = await db
      .from('facebook_page_connections')
      .update({ status: 'needs_attention' })
      .lt('token_expires_at', threshold)
      .neq('status', 'disconnected')
      .select('id');
    if (error) throw error;
    return json({ connectionsNeedingAttention: data?.length ?? 0 });
  }),
);
