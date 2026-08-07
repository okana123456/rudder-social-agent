import { handler, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { decryptToken } from '../_shared/crypto.ts';
import { requireCronSecret } from '../_shared/auth.ts';

const nonRetryable = new Set([10, 102, 190, 200, 368]);
Deno.serve(
  handler(async (request) => {
    requireCronSecret(request);
    const db = adminClient();
    const { data: jobs, error } = await db
      .from('publishing_jobs')
      .select(
        `
    id,attempt_count,max_attempts,idempotency_key,organisation_id,
    post_destination:post_destinations!inner(id,post:posts!inner(caption_override,caption:captions(body),post_media(media_asset:media_assets(storage_path))),destination:destinations!inner(kind,page:facebook_page_connections(page_id,encrypted_page_token)))
  `,
      )
      .eq('status', 'ready')
      .eq('post_destination.destination.kind', 'page')
      .lte('next_attempt_at', new Date().toISOString())
      .limit(10);
    if (error) throw error;
    let published = 0;
    for (const job of jobs ?? []) {
      const claimed = await db
        .from('publishing_jobs')
        .update({ status: 'publishing', attempt_count: job.attempt_count + 1 })
        .eq('id', job.id)
        .eq('status', 'ready')
        .select()
        .maybeSingle();
      if (!claimed.data) continue;
      const relation: any = job.post_destination;
      const post = relation.post;
      const page = relation.destination.page;
      try {
        const token = await decryptToken(page.encrypted_page_token);
        const message = post.caption_override || post.caption?.body;
        const media = post.post_media?.[0]?.media_asset?.storage_path;
        const version = Deno.env.get('META_GRAPH_VERSION');
        if (!version) throw new Error('META_GRAPH_VERSION is missing');
        const endpoint = media ? `${page.page_id}/photos` : `${page.page_id}/feed`;
        const body: Record<string, string> = { message, access_token: token };
        if (media) {
          const signed = await db.storage.from('media').createSignedUrl(media, 600);
          if (signed.error) throw signed.error;
          body.url = signed.data.signedUrl;
        }
        const response = await fetch(`https://graph.facebook.com/${version}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(body),
        });
        const result = await response.json();
        if (!response.ok) {
          const e = new Error(result.error?.message ?? 'Meta publishing failed') as Error & {
            code?: number;
          };
          e.code = result.error?.code;
          throw e;
        }
        await db
          .from('publishing_jobs')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            external_post_id: result.post_id ?? result.id,
            last_error_code: null,
            last_error_message: null,
          })
          .eq('id', job.id);
        published++;
      } catch (error) {
        const e = error as Error & { code?: number };
        const stop = e.code ? nonRetryable.has(e.code) : false;
        const attempts = job.attempt_count + 1;
        const status = stop || attempts >= job.max_attempts ? 'requires_attention' : 'failed';
        await db
          .from('publishing_jobs')
          .update({
            status,
            last_error_code: e.code ? `META_${e.code}` : 'PUBLISH_FAILED',
            last_error_message: e.message,
            next_attempt_at: new Date(
              Date.now() + Math.min(3600000, 60000 * 2 ** attempts),
            ).toISOString(),
          })
          .eq('id', job.id);
      }
    }
    return json({ processed: jobs?.length ?? 0, published });
  }),
);
