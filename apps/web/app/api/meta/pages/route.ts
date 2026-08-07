import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase-server';
export async function GET(request: Request) {
  const db = await serverClient();
  const org = new URL(request.url).searchParams.get('organisation');
  if (!org) return NextResponse.json({ error: 'organisation is required' }, { status: 400 });
  const { data, error } = await db
    .from('facebook_page_connections')
    .select('id,page_id,page_name,picture_url,permissions,status,token_expires_at,created_at')
    .eq('organisation_id', org);
  return NextResponse.json(error ? { error: error.message } : { pages: data }, {
    status: error ? 400 : 200,
  });
}
export async function DELETE(request: Request) {
  const db = await serverClient();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await db
    .from('facebook_page_connections')
    .update({ status: 'disconnected', encrypted_page_token: '' })
    .eq('id', id);
  return NextResponse.json(error ? { error: error.message } : { disconnected: true }, {
    status: error ? 400 : 200,
  });
}
