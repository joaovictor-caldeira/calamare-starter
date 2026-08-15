-- ============================================================
-- JOCA PMS — ARMAZENAMENTO PRIVADO
-- Comprovantes, fotos de limpeza, manutenção e inventário.
-- Execute depois das migrações 001, 002 e 003.
-- ============================================================

-- Bucket sempre privado. Os arquivos são abertos por URL temporária assinada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array[
    'image/jpeg','image/png','image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove as políticas do starter e desta migração antes de recriá-las.
drop policy if exists "staff can read documents" on storage.objects;
drop policy if exists "staff can upload documents" on storage.objects;
drop policy if exists "staff can update documents" on storage.objects;
drop policy if exists "staff can delete documents" on storage.objects;
drop policy if exists "joca read private documents" on storage.objects;
drop policy if exists "joca upload private documents" on storage.objects;
drop policy if exists "joca update private documents" on storage.objects;
drop policy if exists "joca delete private documents" on storage.objects;

-- A equipe interna acessa todos os documentos.
-- Uma pessoa da limpeza acessa somente pastas de tarefas atribuídas a ela.
-- Um prestador de manutenção acessa somente pastas de chamados atribuídos a ele.
create policy "joca read private documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (
    private.is_staff()
    or private.current_role() = 'financeiro'
    or (
      (storage.foldername(name))[1] = 'cleaning'
      and exists (
        select 1
        from public.cleaning_tasks t
        where t.id::text = (storage.foldername(name))[4]
          and t.assigned_to = auth.uid()
      )
    )
    or (
      (storage.foldername(name))[1] = 'maintenance'
      and exists (
        select 1
        from public.maintenance_tickets m
        where m.id::text = (storage.foldername(name))[4]
          and m.assigned_to = auth.uid()
      )
    )
  )
);

create policy "joca upload private documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and (
    private.is_staff()
    or private.current_role() = 'financeiro'
    or (
      (storage.foldername(name))[1] = 'cleaning'
      and exists (
        select 1
        from public.cleaning_tasks t
        where t.id::text = (storage.foldername(name))[4]
          and t.assigned_to = auth.uid()
      )
    )
    or (
      (storage.foldername(name))[1] = 'maintenance'
      and exists (
        select 1
        from public.maintenance_tickets m
        where m.id::text = (storage.foldername(name))[4]
          and m.assigned_to = auth.uid()
      )
    )
  )
);

create policy "joca update private documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'documents'
  and (private.is_staff() or private.current_role() = 'financeiro')
)
with check (
  bucket_id = 'documents'
  and (private.is_staff() or private.current_role() = 'financeiro')
);

-- Exclusão de arquivo fica limitada ao superadministrador.
create policy "joca delete private documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and private.current_role() = 'superadmin'
);
