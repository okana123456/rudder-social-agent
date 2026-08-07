create or replace function public.schedule_post(
  p_organisation_id uuid, p_campaign_id uuid, p_caption_id uuid, p_caption_override text,
  p_destination_ids uuid[], p_media_ids uuid[], p_scheduled_for timestamptz, p_timezone text, p_mode public.operating_mode
) returns uuid language plpgsql security invoker set search_path='' as $$
declare new_post uuid; destination uuid; new_pd uuid;
begin
  if not public.has_org_role(p_organisation_id,array['owner','admin','editor']::public.member_role[]) then raise exception 'not authorised'; end if;
  if coalesce(cardinality(p_destination_ids),0)=0 then raise exception 'choose at least one destination'; end if;
  if p_caption_id is null and length(trim(coalesce(p_caption_override,'')))=0 then raise exception 'caption required'; end if;
  insert into public.posts(organisation_id,campaign_id,caption_id,caption_override,scheduled_for,timezone,created_by)
    values(p_organisation_id,p_campaign_id,p_caption_id,nullif(trim(p_caption_override),''),p_scheduled_for,p_timezone,(select auth.uid())) returning id into new_post;
  insert into public.post_media(post_id,media_asset_id,position) select new_post,m,ord-1 from unnest(coalesce(p_media_ids,'{}'::uuid[])) with ordinality x(m,ord);
  foreach destination in array p_destination_ids loop
    if not exists(select 1 from public.destinations d where d.id=destination and d.organisation_id=p_organisation_id and d.active) then raise exception 'invalid destination'; end if;
    insert into public.post_destinations(post_id,destination_id,mode) values(new_post,destination,p_mode) returning id into new_pd;
    insert into public.publishing_jobs(organisation_id,post_destination_id,status,scheduled_for,next_attempt_at,idempotency_key)
      values(p_organisation_id,new_pd,case when p_scheduled_for<=now() then 'ready'::public.job_status else 'scheduled'::public.job_status end,p_scheduled_for,p_scheduled_for,encode(extensions.digest(new_post::text||':'||destination::text,'sha256'),'hex'));
  end loop;
  insert into public.activity_logs(organisation_id,actor_id,action,entity_type,entity_id,summary) values(p_organisation_id,(select auth.uid()),'scheduled','post',new_post::text,'Post scheduled');
  return new_post;
end $$;

create or replace function public.register_device(p_organisation_id uuid,p_name text,p_type public.device_type,p_os text,p_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare raw_token text; device_id uuid;
begin
  if not public.has_org_role(p_organisation_id,array['owner','admin']::public.member_role[]) then raise exception 'not authorised'; end if;
  raw_token=encode(extensions.gen_random_bytes(32),'base64');
  insert into public.devices(organisation_id,name,type,operating_system,extension_version,desktop_version,token_hash,created_by)
  values(p_organisation_id,trim(p_name),p_type,p_os,case when p_type='chrome_extension' then p_version end,case when p_type='desktop_agent' then p_version end,encode(extensions.digest(raw_token,'sha256'),'hex'),(select auth.uid())) returning id into device_id;
  return jsonb_build_object('deviceId',device_id,'deviceToken',raw_token);
end $$;

grant execute on function public.schedule_post(uuid,uuid,uuid,text,uuid[],uuid[],timestamptz,text,public.operating_mode) to authenticated;
grant execute on function public.register_device(uuid,text,public.device_type,text,text) to authenticated;
