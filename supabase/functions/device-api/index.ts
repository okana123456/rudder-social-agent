import { handler, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
Deno.serve(
  handler(async (request) => {
    const token = request.headers.get('x-device-token');
    if (!token) return json({ error: 'Device token required' }, 401);
    const db = adminClient();
    const tokenHash = await sha256(token);
    const { data: device } = await db
      .from('devices')
      .select('*')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .maybeSingle();
    if (!device) return json({ error: 'Device not registered or revoked' }, 401);
    const input = await request.json().catch(() => ({}));
    const action = input.action;
    if (action === 'heartbeat') {
      await db
        .from('devices')
        .update({
          last_heartbeat_at: new Date().toISOString(),
          recent_error: input.error ?? null,
          extension_version: input.version ?? device.extension_version,
        })
        .eq('id', device.id);
      await db.from('device_heartbeats').insert({
        organisation_id: device.organisation_id,
        device_id: device.id,
        status: device.paused ? 'paused' : 'online',
        current_job_id: device.current_job_id,
        metadata: { version: input.version },
      });
      const { count } = await db
        .from('publishing_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', device.organisation_id)
        .eq('status', 'ready');
      return json({
        ok: true,
        device: {
          id: device.id,
          name: device.name,
          paused: device.paused,
          mode: device.mode,
          lastHeartbeatAt: new Date().toISOString(),
        },
        pending: count ?? 0,
      });
    }
    if (action === 'claim') {
      if (device.paused) return json({ error: 'Device is paused' }, 409);
      const { data: claimed, error } = await db.rpc('claim_next_group_job', {
        p_device_id: device.id,
        p_lease_seconds: 300,
      });
      if (error) throw error;
      const job = claimed?.[0];
      if (!job) return json({ job: null });
      const { data: detail, error: detailError } = await db
        .from('publishing_jobs')
        .select(
          `id,status,attempt_count,max_attempts,post_destination:post_destinations!inner(mode,post:posts!inner(caption_override,caption:captions(body),post_media(media_asset:media_assets(storage_path))),destination:destinations!inner(name,group:facebook_groups!inner(url,name,confirmation_only)))`,
        )
        .eq('id', job.id)
        .single();
      if (detailError) throw detailError;
      const relation: any = detail.post_destination;
      const mediaUrls = [];
      for (const item of relation.post.post_media ?? []) {
        const signed = await db.storage
          .from('media')
          .createSignedUrl(item.media_asset.storage_path, 600);
        if (!signed.error) mediaUrls.push(signed.data.signedUrl);
      }
      return json({
        job: {
          id: detail.id,
          status: detail.status,
          caption: relation.post.caption_override || relation.post.caption?.body,
          destinationName: relation.destination.name,
          destinationUrl: relation.destination.group.url,
          mode: relation.mode,
          confirmationOnly: relation.destination.group.confirmation_only,
          mediaUrls,
          attemptCount: detail.attempt_count,
          maxAttempts: detail.max_attempts,
        },
      });
    }
    if (action === 'status') {
      const allowed = [
        'awaiting_confirmation',
        'publishing',
        'published',
        'failed',
        'skipped',
        'requires_attention',
      ];
      if (!allowed.includes(input.status)) return json({ error: 'Invalid status' }, 400);
      const { data: job } = await db
        .from('publishing_jobs')
        .select('id,organisation_id,claimed_by,status')
        .eq('id', input.jobId)
        .eq('claimed_by', device.id)
        .maybeSingle();
      if (!job) return json({ error: 'Job is not leased to this device' }, 409);
      const terminal = ['published', 'failed', 'skipped', 'requires_attention'].includes(
        input.status,
      );
      await db
        .from('publishing_jobs')
        .update({
          status: input.status,
          last_error_code: input.code ?? null,
          last_error_message: input.message ?? null,
          external_post_url: input.externalPostUrl ?? null,
          published_at: input.status === 'published' ? new Date().toISOString() : null,
          lease_expires_at: terminal ? null : new Date(Date.now() + 300000).toISOString(),
          claimed_by: terminal ? null : device.id,
        })
        .eq('id', job.id);
      if (terminal)
        await db
          .from('devices')
          .update({
            current_job_id: null,
            completed_today:
              input.status === 'published' ? device.completed_today + 1 : device.completed_today,
            recent_error: input.status === 'published' ? null : (input.message ?? null),
          })
          .eq('id', device.id);
      await db
        .from('publishing_attempts')
        .update({
          finished_at: terminal ? new Date().toISOString() : null,
          outcome: input.status,
          error_code: input.code ?? null,
          error_message: input.message ?? null,
        })
        .eq('job_id', job.id)
        .eq('attempt_number', job.attempt_count);
      return json({ ok: true });
    }
    if (action === 'pause') {
      await db
        .from('devices')
        .update({ paused: Boolean(input.paused) })
        .eq('id', device.id);
      return json({ ok: true, paused: Boolean(input.paused) });
    }
    return json({ error: 'Unknown action' }, 400);
  }),
);
