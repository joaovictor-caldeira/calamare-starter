-- ============================================================
-- JOCA PMS — CICLO 2
-- CRUD completo, cancelamento/inativação e auditoria.
-- Execute uma única vez no SQL Editor do Supabase.
-- ============================================================

begin;

-- Segurança: contas novas não recebem acesso administrativo por padrão.
alter table public.profiles
  alter column role set default 'proprietario';

-- Corrige a unicidade de reservas importadas sem impedir várias reservas manuais.
alter table public.reservations
  drop constraint if exists unique_external_reservation;

drop index if exists public.idx_reservations_channel_external_uid_unique;
create unique index idx_reservations_channel_external_uid_unique
  on public.reservations(channel, external_uid)
  where external_uid is not null;

-- Metadados de alteração e cancelamento.
alter table public.clients
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references auth.users(id) on delete set null;

alter table public.properties
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references auth.users(id) on delete set null;

alter table public.units
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references auth.users(id) on delete set null;

alter table public.reservations
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

alter table public.expenses
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

-- A auditoria não deve armazenar senhas, códigos de acesso ou dados bancários.
create or replace function private.sanitize_audit_row(
  target_table text,
  row_data jsonb
)
returns jsonb
language sql
immutable
as $$
  select case target_table
    when 'units' then row_data - array['wifi_password', 'door_code', 'access_instructions']
    when 'clients' then row_data - array['bank_details']
    when 'profiles' then row_data - array['client_id']
    else row_data
  end;
$$;

create or replace function public.set_update_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  old_json jsonb;
  new_json jsonb;
  target_id uuid;
begin
  old_json := case when tg_op in ('UPDATE', 'DELETE')
    then private.sanitize_audit_row(tg_table_name, to_jsonb(old))
    else null end;

  new_json := case when tg_op in ('INSERT', 'UPDATE')
    then private.sanitize_audit_row(tg_table_name, to_jsonb(new))
    else null end;

  target_id := coalesce((new_json ->> 'id')::uuid, (old_json ->> 'id')::uuid);

  insert into public.audit_logs (
    user_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data
  ) values (
    auth.uid(),
    tg_table_name,
    target_id,
    lower(tg_op),
    old_json,
    new_json
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_business_hard_delete()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.allow_hard_delete', true) = 'on' then
    return old;
  end if;

  raise exception 'Exclusão física bloqueada para %. Use cancelamento ou inativação.', tg_table_name
    using errcode = 'P0001';
end;
$$;

-- Atualização automática de metadados.
drop trigger if exists clients_update_metadata on public.clients;
create trigger clients_update_metadata
before update on public.clients
for each row execute function public.set_update_metadata();

drop trigger if exists properties_update_metadata on public.properties;
create trigger properties_update_metadata
before update on public.properties
for each row execute function public.set_update_metadata();

drop trigger if exists units_update_metadata on public.units;
create trigger units_update_metadata
before update on public.units
for each row execute function public.set_update_metadata();

drop trigger if exists reservations_update_metadata on public.reservations;
create trigger reservations_update_metadata
before update on public.reservations
for each row execute function public.set_update_metadata();

drop trigger if exists expenses_update_metadata on public.expenses;
create trigger expenses_update_metadata
before update on public.expenses
for each row execute function public.set_update_metadata();

-- Auditoria dos módulos do Ciclo 2.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['clients','properties','units','reservations','expenses']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      table_name,
      table_name
    );
  end loop;
end $$;

-- Reservas e despesas passam a usar somente cancelamento.
drop trigger if exists reservations_no_hard_delete on public.reservations;
create trigger reservations_no_hard_delete
before delete on public.reservations
for each row execute function public.prevent_business_hard_delete();

drop trigger if exists expenses_no_hard_delete on public.expenses;
create trigger expenses_no_hard_delete
before delete on public.expenses
for each row execute function public.prevent_business_hard_delete();

-- Políticas separadas, sem DELETE para reservas e despesas.
drop policy if exists "reservations staff write" on public.reservations;
drop policy if exists "reservations staff insert" on public.reservations;
drop policy if exists "reservations staff update" on public.reservations;
create policy "reservations staff insert"
on public.reservations for insert to authenticated
with check (private.is_staff());
create policy "reservations staff update"
on public.reservations for update to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists "expenses finance write" on public.expenses;
drop policy if exists "expenses finance insert" on public.expenses;
drop policy if exists "expenses finance update" on public.expenses;
create policy "expenses finance insert"
on public.expenses for insert to authenticated
with check (private.current_role() in ('superadmin','admin_operacional','financeiro'));
create policy "expenses finance update"
on public.expenses for update to authenticated
using (private.current_role() in ('superadmin','admin_operacional','financeiro'))
with check (private.current_role() in ('superadmin','admin_operacional','financeiro'));

-- Índices para filtros e paginação.
create index if not exists idx_clients_status_name
  on public.clients(status, name);
create index if not exists idx_properties_status_name
  on public.properties(status, name);
create index if not exists idx_units_status_name
  on public.units(status, name);
create index if not exists idx_reservations_status_checkin
  on public.reservations(status, check_in desc);
create index if not exists idx_expenses_status_date
  on public.expenses(payment_status, expense_date desc);
create index if not exists idx_audit_record_created
  on public.audit_logs(table_name, record_id, created_at desc);

commit;
