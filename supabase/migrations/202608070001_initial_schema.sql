-- Rudder Social Agent: tenant model, publishing queue, audit trail, and RLS.
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create schema if not exists private;

create type public.member_role as enum ('owner','admin','editor','viewer');
create type public.destination_kind as enum ('page','group');
create type public.job_status as enum ('draft','scheduled','ready','claimed','awaiting_confirmation','publishing','published','failed','skipped','cancelled','requires_attention');
create type public.device_type as enum ('chrome_extension','desktop_agent');
create type public.operating_mode as enum ('confirmation','autopilot');

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', avatar_url text, timezone text not null default 'Africa/Nairobi',
  onboarding_completed boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organisations (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120), slug text not null unique,
  timezone text not null default 'Africa/Nairobi', owner_id uuid not null references auth.users(id), archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(), primary key(organisation_id,user_id)
);
create table public.campaigns (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check(length(name) between 2 and 120), description text not null default '', category text not null default 'General',
  status text not null default 'draft' check(status in ('draft','active','paused','completed','archived')),
  starts_on date not null default current_date, ends_on date, timezone text not null default 'Africa/Nairobi', daily_limit smallint not null default 5 check(daily_limit between 1 and 50),
  minimum_interval_minutes smallint not null default 60 check(minimum_interval_minutes between 5 and 1440), media_rotation boolean not null default true,
  caption_rotation boolean not null default true, created_by uuid not null references auth.users(id), archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_on is null or ends_on >= starts_on)
);
create table public.media_assets (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  storage_path text not null, file_name text not null, mime_type text not null, byte_size bigint not null check(byte_size between 1 and 104857600),
  sha256 text not null, alt_text text not null default '', tags text[] not null default '{}', folder text not null default 'Unfiled', metadata jsonb not null default '{}',
  created_by uuid not null references auth.users(id), archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organisation_id,sha256)
);
create table public.captions (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null, body text not null check(length(trim(body))>0), call_to_action text not null default '', link text, hashtags text[] not null default '{}', tags text[] not null default '{}',
  category text not null default 'General', created_by uuid not null references auth.users(id), archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.caption_variations (
  id uuid primary key default gen_random_uuid(), caption_id uuid not null references public.captions(id) on delete cascade,
  body text not null check(length(trim(body))>0), source text not null default 'manual' check(source in ('manual','ai')),
  created_at timestamptz not null default now()
);
create table public.facebook_page_connections (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  page_id text not null, page_name text not null, picture_url text, encrypted_page_token text not null, token_expires_at timestamptz,
  permissions text[] not null default '{}', status text not null default 'connected' check(status in ('connected','needs_attention','disconnected')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organisation_id,page_id)
);
create table public.facebook_groups (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null, url text not null check(url ~ '^https://(www\.)?facebook\.com/groups/'), rules_notes text not null default '', allowed_days smallint[] not null default '{0,1,2,3,4,5,6}',
  approval_required boolean not null default false, promotions_allowed boolean not null default false, active boolean not null default true,
  confirmation_only boolean not null default true, excluded_until timestamptz, rejection_notes text not null default '', created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organisation_id,url)
);
create table public.destinations (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind public.destination_kind not null, page_connection_id uuid references public.facebook_page_connections(id) on delete cascade,
  group_id uuid references public.facebook_groups(id) on delete cascade, name text not null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((kind='page' and page_connection_id is not null and group_id is null) or (kind='group' and group_id is not null and page_connection_id is null))
);
create table public.posts (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null, caption_id uuid references public.captions(id) on delete set null,
  caption_override text, scheduled_for timestamptz not null, timezone text not null default 'Africa/Nairobi', status text not null default 'scheduled',
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(caption_id is not null or length(trim(caption_override))>0)
);
create table public.post_media (
  post_id uuid not null references public.posts(id) on delete cascade, media_asset_id uuid not null references public.media_assets(id), position smallint not null default 0,
  primary key(post_id,media_asset_id)
);
create table public.post_destinations (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  destination_id uuid not null references public.destinations(id), mode public.operating_mode not null default 'confirmation', created_at timestamptz not null default now(), unique(post_id,destination_id)
);
create table public.devices (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null, type public.device_type not null, operating_system text not null default '', extension_version text, desktop_version text,
  mode public.operating_mode not null default 'confirmation', autopilot_acknowledged_at timestamptz, paused boolean not null default false,
  revoked_at timestamptz, last_heartbeat_at timestamptz, current_job_id uuid, completed_today int not null default 0,
  recent_error text, token_hash text not null unique, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(mode='confirmation' or autopilot_acknowledged_at is not null)
);
create table public.publishing_jobs (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  post_destination_id uuid not null unique references public.post_destinations(id) on delete cascade, status public.job_status not null default 'scheduled',
  scheduled_for timestamptz not null, next_attempt_at timestamptz not null, assigned_device_id uuid references public.devices(id), claimed_by uuid references public.devices(id),
  claimed_at timestamptz, lease_expires_at timestamptz, attempt_count smallint not null default 0, max_attempts smallint not null default 3 check(max_attempts between 1 and 10),
  idempotency_key text not null unique, last_error_code text, last_error_message text, external_post_id text, external_post_url text, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.devices add constraint devices_current_job_fk foreign key(current_job_id) references public.publishing_jobs(id) on delete set null deferrable initially deferred;
create table public.publishing_attempts (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  job_id uuid not null references public.publishing_jobs(id) on delete cascade, device_id uuid references public.devices(id), attempt_number smallint not null,
  started_at timestamptz not null default now(), finished_at timestamptz, outcome public.job_status, error_code text, error_message text, diagnostic_path text,
  metadata jsonb not null default '{}', unique(job_id,attempt_number)
);
create table public.device_heartbeats (
  id bigint generated always as identity primary key, organisation_id uuid not null references public.organisations(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade, status text not null, current_job_id uuid references public.publishing_jobs(id),
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.notification_preferences (
  organisation_id uuid not null references public.organisations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  in_app boolean not null default true, browser boolean not null default true, desktop boolean not null default true, events text[] not null default '{}',
  updated_at timestamptz not null default now(), primary key(organisation_id,user_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, kind text not null, title text not null, body text not null, href text, read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.activity_logs (
  id bigint generated always as identity primary key, organisation_id uuid not null references public.organisations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null, action text not null, entity_type text not null, entity_id text,
  summary text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.daily_posting_counters (
  organisation_id uuid not null references public.organisations(id) on delete cascade, destination_id uuid not null references public.destinations(id) on delete cascade,
  local_date date not null, published_count smallint not null default 0, failed_count smallint not null default 0, updated_at timestamptz not null default now(),
  primary key(organisation_id,destination_id,local_date)
);
create table public.system_settings (
  organisation_id uuid primary key references public.organisations(id) on delete cascade, default_mode public.operating_mode not null default 'confirmation',
  daily_limit smallint not null default 10, minimum_interval_minutes smallint not null default 60, heartbeat_timeout_seconds smallint not null default 120,
  storage_quota_bytes bigint not null default 1073741824, diagnostics_retention_days smallint not null default 7,
  notifications jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.oauth_states (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade, state_hash text not null unique,
  return_to text not null default '/dashboard/facebook-pages', expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now()
);

create index jobs_eligibility_idx on public.publishing_jobs(status,next_attempt_at,scheduled_for) where status in ('scheduled','ready','failed');
create index jobs_lease_idx on public.publishing_jobs(lease_expires_at) where status in ('claimed','awaiting_confirmation','publishing');
create index jobs_org_status_idx on public.publishing_jobs(organisation_id,status,scheduled_for desc);
create index activity_org_created_idx on public.activity_logs(organisation_id,created_at desc);
create index heartbeats_device_created_idx on public.device_heartbeats(device_id,created_at desc);
create index media_search_idx on public.media_assets using gin(tags);
create index captions_search_idx on public.captions using gin(to_tsvector('simple',title||' '||body));

do $$ declare t text; begin foreach t in array array['profiles','organisations','campaigns','media_assets','captions','facebook_page_connections','facebook_groups','destinations','posts','devices','publishing_jobs'] loop
  execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
end loop; end $$;

create or replace function public.is_org_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organisation_members m where m.organisation_id=org and m.user_id=(select auth.uid()))
$$;
create or replace function public.has_org_role(org uuid, allowed public.member_role[]) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organisation_members m where m.organisation_id=org and m.user_id=(select auth.uid()) and m.role=any(allowed))
$$;
revoke all on function public.has_org_role(uuid,public.member_role[]) from public; grant execute on function public.has_org_role(uuid,public.member_role[]) to authenticated;

create or replace function public.create_organisation(org_name text, org_slug text) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  insert into public.organisations(name,slug,owner_id) values(trim(org_name),lower(trim(org_slug)),(select auth.uid())) returning id into new_id;
  insert into public.organisation_members(organisation_id,user_id,role) values(new_id,(select auth.uid()),'owner');
  insert into public.system_settings(organisation_id) values(new_id);
  insert into public.activity_logs(organisation_id,actor_id,action,entity_type,entity_id,summary) values(new_id,(select auth.uid()),'created','organisation',new_id::text,'Organisation created');
  return new_id;
end $$;

create or replace function public.claim_next_group_job(p_device_id uuid, p_lease_seconds int default 300)
returns setof public.publishing_jobs language plpgsql security definer set search_path='' as $$
declare candidate uuid; device_org uuid;
begin
  select organisation_id into device_org from public.devices where id=p_device_id and revoked_at is null and not paused for update;
  if device_org is null then raise exception 'device unavailable'; end if;
  select j.id into candidate from public.publishing_jobs j
    join public.post_destinations pd on pd.id=j.post_destination_id join public.destinations d on d.id=pd.destination_id
    left join public.campaigns c on c.id=(select p.campaign_id from public.posts p where p.id=pd.post_id)
    where j.organisation_id=device_org and d.kind='group' and d.active and j.status='ready' and j.next_attempt_at<=now()
      and (j.assigned_device_id is null or j.assigned_device_id=p_device_id) and coalesce(c.status,'active')='active'
    order by j.scheduled_for,j.created_at for update of j skip locked limit 1;
  if candidate is null then return; end if;
  update public.publishing_jobs set status='claimed',claimed_by=p_device_id,claimed_at=now(),lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,60),900)),attempt_count=attempt_count+1 where id=candidate;
  update public.devices set current_job_id=candidate where id=p_device_id;
  insert into public.publishing_attempts(organisation_id,job_id,device_id,attempt_number) select organisation_id,id,p_device_id,attempt_count from public.publishing_jobs where id=candidate;
  return query select * from public.publishing_jobs where id=candidate;
end $$;

create or replace function public.release_expired_leases() returns integer language plpgsql security definer set search_path='' as $$
declare affected int;
begin
  update public.publishing_jobs set status=case when attempt_count>=max_attempts then 'requires_attention'::public.job_status else 'ready'::public.job_status end,
    claimed_by=null,claimed_at=null,lease_expires_at=null,last_error_code='LEASE_EXPIRED',last_error_message='The assigned device stopped responding.'
    where status in ('claimed','awaiting_confirmation','publishing') and lease_expires_at<now(); get diagnostics affected=row_count;
  update public.devices set current_job_id=null where current_job_id is not null and not exists(select 1 from public.publishing_jobs j where j.id=devices.current_job_id and j.status in ('claimed','awaiting_confirmation','publishing'));
  return affected;
end $$;

create or replace function public.mark_due_jobs_ready() returns integer language plpgsql security definer set search_path='' as $$
declare affected int;
begin
  update public.publishing_jobs j set status='ready',next_attempt_at=greatest(j.next_attempt_at,now())
  from public.post_destinations pd, public.posts p, public.destinations d
  where j.post_destination_id=pd.id and pd.post_id=p.id and pd.destination_id=d.id and j.status='scheduled' and j.scheduled_for<=now() and d.active
    and (p.campaign_id is null or exists(select 1 from public.campaigns c where c.id=p.campaign_id and c.status='active'));
  get diagnostics affected=row_count; return affected;
end $$;

alter table public.profiles enable row level security;
create policy profiles_self on public.profiles for all using(id=(select auth.uid())) with check(id=(select auth.uid()));
alter table public.organisations enable row level security;
create policy organisations_member_read on public.organisations for select using(public.is_org_member(id));
create policy organisations_admin_update on public.organisations for update using(public.has_org_role(id,array['owner','admin']::public.member_role[]));
alter table public.organisation_members enable row level security;
create policy members_read on public.organisation_members for select using(public.is_org_member(organisation_id));
create policy members_admin_write on public.organisation_members for all using(public.has_org_role(organisation_id,array['owner','admin']::public.member_role[])) with check(public.has_org_role(organisation_id,array['owner','admin']::public.member_role[]));

do $$ declare t text; begin foreach t in array array['campaigns','media_assets','captions','facebook_page_connections','facebook_groups','destinations','posts','devices','publishing_jobs','publishing_attempts','device_heartbeats','notifications','activity_logs','daily_posting_counters','system_settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy %I_org_read on public.%I for select using(public.is_org_member(organisation_id))',t,t);
  execute format('create policy %I_org_write on public.%I for all using(public.has_org_role(organisation_id,array[''owner'',''admin'',''editor'']::public.member_role[])) with check(public.has_org_role(organisation_id,array[''owner'',''admin'',''editor'']::public.member_role[]))',t,t);
end loop; end $$;

alter table public.caption_variations enable row level security;
create policy caption_variations_member on public.caption_variations for all using(exists(select 1 from public.captions c where c.id=caption_id and public.is_org_member(c.organisation_id))) with check(exists(select 1 from public.captions c where c.id=caption_id and public.is_org_member(c.organisation_id)));
alter table public.post_media enable row level security;
create policy post_media_member on public.post_media for all using(exists(select 1 from public.posts p where p.id=post_id and public.is_org_member(p.organisation_id))) with check(exists(select 1 from public.posts p where p.id=post_id and public.is_org_member(p.organisation_id)));
alter table public.post_destinations enable row level security;
create policy post_destinations_member on public.post_destinations for all using(exists(select 1 from public.posts p where p.id=post_id and public.is_org_member(p.organisation_id))) with check(exists(select 1 from public.posts p where p.id=post_id and public.is_org_member(p.organisation_id)));
alter table public.notification_preferences enable row level security;
create policy preferences_self on public.notification_preferences for all using(user_id=(select auth.uid()) and public.is_org_member(organisation_id)) with check(user_id=(select auth.uid()) and public.is_org_member(organisation_id));
alter table public.oauth_states enable row level security;
create policy oauth_state_self on public.oauth_states for all using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
alter publication supabase_realtime add table public.publishing_jobs, public.notifications, public.devices;

grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant execute on function public.create_organisation(text,text) to authenticated;
grant execute on function public.claim_next_group_job(uuid,int) to authenticated;
