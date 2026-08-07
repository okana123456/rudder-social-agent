import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase-server';
import { encrypt, sha256 } from '@/lib/security';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code'),
    state = url.searchParams.get('state');
  if (!code || !state)
    return NextResponse.redirect(
      new URL('/dashboard/facebook-pages?error=missing_oauth_response', url.origin),
    );
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/sign-in', url.origin));
  const { data: stored } = await db
    .from('oauth_states')
    .select('*')
    .eq('state_hash', sha256(state))
    .eq('user_id', user.id)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!stored)
    return NextResponse.redirect(
      new URL('/dashboard/facebook-pages?error=invalid_state', url.origin),
    );
  await db.from('oauth_states').update({ used_at: new Date().toISOString() }).eq('id', stored.id);
  try {
    const version = process.env.META_GRAPH_VERSION;
    if (!version) throw new Error('META_GRAPH_VERSION is missing');
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: process.env.META_REDIRECT_URI!,
      code,
    }).toString();
    const tokenResponse = await fetch(tokenUrl);
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(token.error?.message ?? 'Token exchange failed');
    const pagesResponse = await fetch(
      `https://graph.facebook.com/${version}/me/accounts?fields=id,name,picture,access_token,tasks&access_token=${encodeURIComponent(token.access_token)}`,
    );
    const pages = await pagesResponse.json();
    if (!pagesResponse.ok) throw new Error(pages.error?.message ?? 'Could not list Pages');
    let pageList = pages.data ?? [];
    if (pageList.length === 0) {
      const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`);
      debugUrl.search = new URLSearchParams({
        input_token: token.access_token,
        access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
      }).toString();
      const debugResponse = await fetch(debugUrl);
      const debug = await debugResponse.json();
      if (!debugResponse.ok || !debug.data?.is_valid)
        throw new Error(debug.error?.message ?? 'Meta returned an invalid access token');
      const pageScopes = new Set([
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
      ]);
      const pageIds = new Set<string>();
      for (const grant of debug.data.granular_scopes ?? []) {
        if (!pageScopes.has(grant.scope)) continue;
        for (const pageId of grant.target_ids ?? []) pageIds.add(pageId);
      }
      pageList = await Promise.all(
        [...pageIds].map(async (pageId) => {
          const pageUrl = new URL(`https://graph.facebook.com/${version}/${pageId}`);
          pageUrl.search = new URLSearchParams({
            fields: 'id,name,picture,access_token',
            access_token: token.access_token,
          }).toString();
          const pageResponse = await fetch(pageUrl);
          const page = await pageResponse.json();
          if (!pageResponse.ok)
            throw new Error(page.error?.message ?? `Could not load Page ${pageId}`);
          return page;
        }),
      );
    }
    if (pageList.length === 0)
      throw new Error('Meta authorised access but returned no Facebook Pages');
    for (const page of pageList) {
      if (!page.id || !page.name || !page.access_token)
        throw new Error('Meta returned incomplete Facebook Page credentials');
      const { data: connection, error } = await db
        .from('facebook_page_connections')
        .upsert(
          {
            organisation_id: stored.organisation_id,
            page_id: page.id,
            page_name: page.name,
            picture_url: page.picture?.data?.url,
            encrypted_page_token: encrypt(page.access_token),
            permissions: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
            status: 'connected',
            created_by: user.id,
          },
          { onConflict: 'organisation_id,page_id' },
        )
        .select()
        .single();
      if (error) throw error;
      await db.from('destinations').upsert(
        {
          organisation_id: stored.organisation_id,
          kind: 'page',
          page_connection_id: connection.id,
          name: page.name,
        },
        { onConflict: 'organisation_id,page_connection_id' },
      );
    }
    return NextResponse.redirect(new URL('/dashboard/facebook-pages?connected=1', url.origin));
  } catch (error) {
    const target = new URL('/dashboard/facebook-pages', url.origin);
    target.searchParams.set('error', error instanceof Error ? error.message : 'connection_failed');
    return NextResponse.redirect(target);
  }
}
