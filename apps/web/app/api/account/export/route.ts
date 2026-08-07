import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase-server';

const tables = [
  'campaigns',
  'media_assets',
  'captions',
  'facebook_page_connections',
  'facebook_groups',
  'destinations',
  'posts',
  'publishing_jobs',
  'publishing_attempts',
  'devices',
  'notifications',
  'activity_logs',
  'system_settings',
];
export async function GET(request: Request) {
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const organisationId = new URL(request.url).searchParams.get('organisation');
  if (!organisationId)
    return NextResponse.json({ error: 'organisation is required' }, { status: 400 });
  const { data: organisation } = await db
    .from('organisations')
    .select('*')
    .eq('id', organisationId)
    .maybeSingle();
  if (!organisation) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
  const records: Record<string, unknown[]> = {};
  for (const table of tables) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .eq('organisation_id', organisationId)
      .limit(10000);
    if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 400 });
    records[table] = data ?? [];
  }
  const { data: storage } = await db.storage.from('media').list(organisationId, { limit: 1000 });
  return new NextResponse(
    JSON.stringify(
      { exportedAt: new Date().toISOString(), organisation, records, storage: storage ?? [] },
      null,
      2,
    ),
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="rudder-${organisation.slug}-export.json"`,
      },
    },
  );
}
