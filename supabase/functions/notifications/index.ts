import { handler, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { requireCronSecret } from '../_shared/auth.ts';
Deno.serve(
  handler(async (request) => {
    requireCronSecret(request);
    const db = adminClient();
    const cutoff = new Date(Date.now() - 120000).toISOString();
    const { data: offline, error } = await db
      .from('devices')
      .select('id,organisation_id,name')
      .lt('last_heartbeat_at', cutoff)
      .is('revoked_at', null);
    if (error) throw error;
    for (const device of offline ?? []) {
      const { data: existing } = await db
        .from('notifications')
        .select('id')
        .eq('organisation_id', device.organisation_id)
        .eq('kind', 'device_offline')
        .is('read_at', null)
        .maybeSingle();
      if (!existing)
        await db.from('notifications').insert({
          organisation_id: device.organisation_id,
          kind: 'device_offline',
          title: 'Device offline',
          body: `${device.name} has stopped sending heartbeats.`,
          href: '/dashboard/devices',
        });
    }
    return json({ offlineDevices: offline?.length ?? 0 });
  }),
);
