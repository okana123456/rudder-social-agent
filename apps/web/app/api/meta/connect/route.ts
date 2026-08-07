import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { serverClient } from '@/lib/supabase-server';
import { sha256 } from '@/lib/security';
export async function GET(request: Request) {
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/sign-in', request.url));
  const url = new URL(request.url);
  const organisation = url.searchParams.get('organisation');
  if (!organisation)
    return NextResponse.json({ error: 'organisation is required' }, { status: 400 });
  const appId = process.env.META_APP_ID,
    redirect = process.env.META_REDIRECT_URI;
  if (!appId || !redirect)
    return NextResponse.json({ error: 'Meta server configuration is missing' }, { status: 503 });
  const state = randomBytes(32).toString('base64url');
  const { error } = await db.from('oauth_states').insert({
    user_id: user.id,
    organisation_id: organisation,
    state_hash: sha256(state),
    expires_at: new Date(Date.now() + 600000).toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const oauth = new URL('https://www.facebook.com/dialog/oauth');
  oauth.search = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirect,
    state,
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts',
    response_type: 'code',
  }).toString();
  return NextResponse.redirect(oauth);
}
