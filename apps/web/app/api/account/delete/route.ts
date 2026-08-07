import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/security';

export async function DELETE(request: Request) {
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!rateLimit(`delete:${user.id}`, 3, 3600000))
    return NextResponse.json({ error: 'Deletion rate limit reached' }, { status: 429 });
  const body = await request.json();
  if (body.confirmation !== 'DELETE MY RUDDER ACCOUNT' || typeof body.organisationId !== 'string')
    return NextResponse.json({ error: 'Exact confirmation phrase required' }, { status: 400 });
  const { data: organisation } = await db
    .from('organisations')
    .select('id,owner_id')
    .eq('id', body.organisationId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!organisation)
    return NextResponse.json(
      { error: 'Only the organisation owner can delete this account' },
      { status: 403 },
    );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: 'Server deletion configuration is missing' },
      { status: 503 },
    );
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: objects } = await admin.storage
    .from('media')
    .list(body.organisationId, { limit: 1000 });
  if (objects?.length)
    await admin.storage
      .from('media')
      .remove(objects.map((object) => `${body.organisationId}/${object.name}`));
  const { error: organisationError } = await admin
    .from('organisations')
    .delete()
    .eq('id', body.organisationId);
  if (organisationError)
    return NextResponse.json({ error: organisationError.message }, { status: 500 });
  const { error: userError } = await admin.auth.admin.deleteUser(user.id, false);
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
