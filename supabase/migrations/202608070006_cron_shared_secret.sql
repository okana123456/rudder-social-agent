create or replace function private.invoke_rudder_function(function_name text) returns void
language plpgsql security definer set search_path='' as $$
declare project_url text; service_key text; cron_secret text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='rudder_project_url' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name='rudder_service_role_key' limit 1;
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name='rudder_cron_secret' limit 1;
  if project_url is null or service_key is null or cron_secret is null then return; end if;
  perform net.http_post(
    url := rtrim(project_url,'/')||'/functions/v1/'||function_name,
    headers := jsonb_build_object(
      'Authorization','Bearer '||service_key,
      'Content-Type','application/json',
      'x-rudder-cron-secret',cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;

revoke all on function private.invoke_rudder_function(text) from public, anon, authenticated;
grant execute on function private.invoke_rudder_function(text) to service_role;
