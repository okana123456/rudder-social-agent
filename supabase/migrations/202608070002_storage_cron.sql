insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('media','media',false,104857600,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy media_member_read on storage.objects for select to authenticated using(
  bucket_id='media' and public.is_org_member((storage.foldername(name))[1]::uuid)
);
create policy media_editor_insert on storage.objects for insert to authenticated with check(
  bucket_id='media' and public.has_org_role((storage.foldername(name))[1]::uuid,array['owner','admin','editor']::public.member_role[])
);
create policy media_editor_update on storage.objects for update to authenticated using(
  bucket_id='media' and public.has_org_role((storage.foldername(name))[1]::uuid,array['owner','admin','editor']::public.member_role[])
);
create policy media_editor_delete on storage.objects for delete to authenticated using(
  bucket_id='media' and public.has_org_role((storage.foldername(name))[1]::uuid,array['owner','admin','editor']::public.member_role[])
);

select cron.schedule('rudder-mark-due','* * * * *',$$select public.mark_due_jobs_ready()$$);
select cron.schedule('rudder-release-leases','*/2 * * * *',$$select public.release_expired_leases()$$);
