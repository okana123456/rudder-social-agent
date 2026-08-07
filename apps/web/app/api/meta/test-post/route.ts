import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase-server';
import { decrypt, rateLimit } from '@/lib/security';
export async function POST(request: Request) {
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!rateLimit(user.id, 3, 3600000))
    return NextResponse.json({ error: 'Test post limit reached' }, { status: 429 });
  const body = await request.json();
  if (typeof body.connectionId !== 'string')
    return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
  const { data: page, error } = await db
    .from('facebook_page_connections')
    .select('*')
    .eq('id', body.connectionId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  const version = process.env.META_GRAPH_VERSION;
  if (!version)
    return NextResponse.json({ error: 'META_GRAPH_VERSION is missing' }, { status: 503 });
  const result = await fetch(`https://graph.facebook.com/${version}/${page.page_id}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      message: `Rudder connection test · ${new Date().toISOString()}`,
      access_token: decrypt(page.encrypted_page_token),
    }),
  });
  const json = await result.json();
  return NextResponse.json(
    result.ok ? { postId: json.id } : { error: json.error?.message ?? 'Meta rejected test post' },
    { status: result.ok ? 200 : 400 },
  );
}
export async function DELETE(request: Request) {
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await request.json();
  const { data: page } = await db
    .from('facebook_page_connections')
    .select('encrypted_page_token')
    .eq('id', body.connectionId)
    .single();
  if (!page) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  const version = process.env.META_GRAPH_VERSION;
  if (!version)
    return NextResponse.json({ error: 'META_GRAPH_VERSION is missing' }, { status: 503 });
  const response = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(body.postId)}?access_token=${encodeURIComponent(decrypt(page.encrypted_page_token))}`,
    { method: 'DELETE' },
  );
  return NextResponse.json(await response.json(), { status: response.status });
}
