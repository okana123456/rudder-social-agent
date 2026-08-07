begin;
-- Run through `supabase test db` after local Auth fixtures are created.
select has_function('public','claim_next_group_job',array['uuid','integer'],'atomic device claim RPC exists');
select has_function('public','release_expired_leases',array[]::text[],'lease recovery RPC exists');
select has_function('public','schedule_post',array['uuid','uuid','uuid','text','uuid[]','uuid[]','timestamp with time zone','text','operating_mode'],'idempotent scheduling RPC exists');
select row_security_active('public','campaigns','campaign RLS active');
select row_security_active('public','publishing_jobs','job RLS active');
select row_security_active('public','devices','device RLS active');
select row_security_active('public','facebook_page_connections','Meta token table RLS active');
select col_is_pk('public','publishing_jobs','id','jobs use primary keys');
select has_role('anon','Supabase anon role exists and remains restricted by grants and RLS');
select * from finish();
rollback;
