alter table public.destinations add constraint destinations_org_page_unique unique(organisation_id,page_connection_id);
alter table public.destinations add constraint destinations_org_group_unique unique(organisation_id,group_id);

revoke execute on function public.claim_next_group_job(uuid,int) from public, authenticated;
grant execute on function public.claim_next_group_job(uuid,int) to service_role;
revoke execute on function public.mark_due_jobs_ready() from public, authenticated;
revoke execute on function public.release_expired_leases() from public, authenticated;
grant execute on function public.mark_due_jobs_ready() to service_role;
grant execute on function public.release_expired_leases() to service_role;

drop policy if exists activity_logs_org_write on public.activity_logs;
create policy activity_logs_member_insert on public.activity_logs for insert
  with check(public.has_org_role(organisation_id,array['owner','admin','editor']::public.member_role[]) and actor_id=(select auth.uid()));

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
create or replace function private.invoke_rudder_function(function_name text) returns void
language plpgsql security definer set search_path='' as $$
declare project_url text; service_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='rudder_project_url' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name='rudder_service_role_key' limit 1;
  if project_url is null or service_key is null then return; end if;
  perform net.http_post(
    url := rtrim(project_url,'/')||'/functions/v1/'||function_name,
    headers := jsonb_build_object('Authorization','Bearer '||service_key,'Content-Type','application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function private.invoke_rudder_function(text) from public, anon, authenticated;
grant execute on function private.invoke_rudder_function(text) to service_role;

select cron.schedule('rudder-publish-pages','* * * * *',$$select private.invoke_rudder_function('publish-page')$$);
select cron.schedule('rudder-notifications','*/5 * * * *',$$select private.invoke_rudder_function('notifications')$$);
select cron.schedule('rudder-clean-diagnostics','30 2 * * *',$$select private.invoke_rudder_function('cleanup-diagnostics')$$);
select cron.schedule('rudder-refresh-meta','15 3 * * *',$$select private.invoke_rudder_function('refresh-meta')$$);
