-- Cria um bucket privado para comprovantes e documentos.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

-- No MVP, apenas equipe administrativa acessa os documentos.
drop policy if exists "staff can read documents" on storage.objects;
drop policy if exists "staff can upload documents" on storage.objects;
drop policy if exists "staff can update documents" on storage.objects;
drop policy if exists "staff can delete documents" on storage.objects;

create policy "staff can read documents"
on storage.objects for select to authenticated
using (bucket_id = 'documents' and private.is_staff());

create policy "staff can upload documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and private.is_staff());

create policy "staff can update documents"
on storage.objects for update to authenticated
using (bucket_id = 'documents' and private.is_staff())
with check (bucket_id = 'documents' and private.is_staff());

create policy "staff can delete documents"
on storage.objects for delete to authenticated
using (bucket_id = 'documents' and private.is_staff());
