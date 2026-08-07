import { handler, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { requireServiceRole } from '../_shared/auth.ts';

Deno.serve(
  handler(async (request) => {
    requireServiceRole(request);
    const db = adminClient();
    const { data, error } = await db.rpc('mark_due_jobs_ready');
    if (error) throw error;
    return json({ movedToReady: data, at: new Date().toISOString() });
  }),
);
