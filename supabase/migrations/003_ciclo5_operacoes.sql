-- ============================================================
-- JOCA PMS — CICLO 5
-- Limpeza, manutenção, bloqueios e inventário.
-- Execute depois da migração 002.
-- ============================================================

begin;

-- Checklist padrão por unidade.
create table if not exists public.cleaning_checklist_items (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cleaning_task_items (
  id uuid primary key default gen_random_uuid(),
  cleaning_task_id uuid not null references public.cleaning_tasks(id) on delete cascade,
  checklist_item_id uuid references public.cleaning_checklist_items(id) on delete set null,
  label_snapshot text not null,
  sort_order integer not null default 0,
  is_done boolean not null default false,
  notes text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(cleaning_task_id, checklist_item_id)
);

alter table public.cleaning_tasks
  add column if not exists before_photos text[] not null default '{}',
  add column if not exists after_photos text[] not null default '{}',
  add column if not exists found_items text,
  add column if not exists damages text,
  add column if not exists materials_to_replace text,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- Bloqueios independentes do calendário de reservas.
create table if not exists public.unit_blocks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  maintenance_ticket_id uuid unique,
  start_date date not null,
  end_date date not null,
  reason text not null,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_unit_block_dates check (end_date > start_date)
);

alter table public.maintenance_tickets
  add column if not exists photo_paths text[] not null default '{}',
  add column if not exists quote_path text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists generated_expense_id uuid references public.expenses(id) on delete set null,
  add column if not exists block_start date,
  add column if not exists block_end date,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.unit_blocks
  drop constraint if exists unit_blocks_maintenance_ticket_id_fkey;
alter table public.unit_blocks
  add constraint unit_blocks_maintenance_ticket_id_fkey
  foreign key (maintenance_ticket_id) references public.maintenance_tickets(id) on delete cascade;

-- Inventário por unidade.
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  name text not null,
  category text not null default 'outros',
  quantity numeric(12,2) not null default 1 check (quantity >= 0),
  minimum_quantity numeric(12,2) not null default 0 check (minimum_quantity >= 0),
  condition text not null default 'good'
    check (condition in ('new','good','fair','damaged','discarded')),
  purchase_date date,
  purchase_value numeric(12,2) check (purchase_value is null or purchase_value >= 0),
  invoice_path text,
  warranty_until date,
  photo_paths text[] not null default '{}',
  location_in_unit text,
  notes text,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items
  add column if not exists needs_restock boolean generated always as
    (minimum_quantity > 0 and quantity <= minimum_quantity) stored;

-- Mantém a tarefa automática de limpeza sincronizada quando uma reserva muda de unidade ou data.
create or replace function public.sync_cleaning_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('confirmed','checked_in') then
    insert into public.cleaning_tasks (
      client_id, unit_id, reservation_id, scheduled_date, checkout_time
    )
    select new.client_id, new.unit_id, new.id, new.check_out, u.check_out_time
    from public.units u
    where u.id = new.unit_id
    on conflict (reservation_id) do update set
      client_id = excluded.client_id,
      unit_id = excluded.unit_id,
      scheduled_date = excluded.scheduled_date,
      checkout_time = excluded.checkout_time,
      status = case
        when public.cleaning_tasks.status = 'cancelled' then 'waiting'
        else public.cleaning_tasks.status
      end,
      updated_at = now();
  elsif new.status in ('pending','cancelled') then
    update public.cleaning_tasks
    set status = 'cancelled', updated_at = now()
    where reservation_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists reservation_cleaning_sync on public.reservations;
create trigger reservation_cleaning_sync
  after insert or update of status, check_out, unit_id, client_id
  on public.reservations
  for each row execute function public.sync_cleaning_task();

-- Ao criar uma tarefa de limpeza, fotografa o checklist vigente da unidade.
create or replace function public.seed_cleaning_task_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cleaning_task_items (
    cleaning_task_id, checklist_item_id, label_snapshot, sort_order
  )
  select new.id, c.id, c.label, c.sort_order
  from public.cleaning_checklist_items c
  where c.unit_id = new.unit_id and c.active = true
  on conflict (cleaning_task_id, checklist_item_id) do nothing;

  return new;
end;
$$;

drop trigger if exists cleaning_task_seed_items on public.cleaning_tasks;
create trigger cleaning_task_seed_items
after insert on public.cleaning_tasks
for each row execute function public.seed_cleaning_task_items();

create or replace function public.reseed_cleaning_task_items_after_unit_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unit_id is distinct from old.unit_id then
    delete from public.cleaning_task_items
    where cleaning_task_id = new.id;

    insert into public.cleaning_task_items (
      cleaning_task_id, checklist_item_id, label_snapshot, sort_order
    )
    select new.id, c.id, c.label, c.sort_order
    from public.cleaning_checklist_items c
    where c.unit_id = new.unit_id and c.active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists cleaning_task_reseed_after_unit_change on public.cleaning_tasks;
create trigger cleaning_task_reseed_after_unit_change
after update of unit_id on public.cleaning_tasks
for each row execute function public.reseed_cleaning_task_items_after_unit_change();

-- Também cria itens para tarefas antigas que ainda não possuem checklist.
insert into public.cleaning_task_items (
  cleaning_task_id, checklist_item_id, label_snapshot, sort_order
)
select t.id, c.id, c.label, c.sort_order
from public.cleaning_tasks t
join public.cleaning_checklist_items c on c.unit_id = t.unit_id and c.active = true
where not exists (
  select 1 from public.cleaning_task_items ti
  where ti.cleaning_task_id = t.id and ti.checklist_item_id = c.id
)
on conflict (cleaning_task_id, checklist_item_id) do nothing;

-- Sincroniza o bloqueio da unidade com o chamado de manutenção.
create or replace function public.sync_maintenance_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.blocks_unit = true
     and new.status not in ('concluded','cancelled')
     and new.block_start is not null
     and new.block_end is not null then

    if new.block_end <= new.block_start then
      raise exception 'O fim do bloqueio deve ser posterior ao início.';
    end if;

    insert into public.unit_blocks (
      client_id, unit_id, maintenance_ticket_id,
      start_date, end_date, reason, active, created_by
    ) values (
      new.client_id, new.unit_id, new.id,
      new.block_start, new.block_end,
      'Manutenção — ' || new.title, true, auth.uid()
    )
    on conflict (maintenance_ticket_id) do update set
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      reason = excluded.reason,
      active = true,
      updated_at = now();
  else
    update public.unit_blocks
    set active = false, updated_at = now()
    where maintenance_ticket_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists maintenance_block_sync on public.maintenance_tickets;
create trigger maintenance_block_sync
after insert or update of blocks_unit, status, block_start, block_end, title
on public.maintenance_tickets
for each row execute function public.sync_maintenance_block();

-- A proteção também existe no banco para evitar conflito mesmo em duas operações simultâneas.
create or replace function public.prevent_reservation_during_unit_block()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('pending','confirmed','checked_in')
     and exists (
       select 1
       from public.unit_blocks b
       where b.unit_id = new.unit_id
         and b.active = true
         and daterange(b.start_date, b.end_date, '[)')
             && daterange(new.check_in, new.check_out, '[)')
     ) then
    raise exception 'A unidade possui bloqueio operacional no período informado.';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_check_unit_blocks on public.reservations;
create trigger reservations_check_unit_blocks
before insert or update of unit_id, check_in, check_out, status
on public.reservations
for each row execute function public.prevent_reservation_during_unit_block();

create or replace function public.prevent_unit_block_during_reservation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.active = true
     and exists (
       select 1
       from public.reservations r
       where r.unit_id = new.unit_id
         and r.status in ('pending','confirmed','checked_in')
         and daterange(r.check_in, r.check_out, '[)')
             && daterange(new.start_date, new.end_date, '[)')
     ) then
    raise exception 'Já existe uma reserva ativa no período do bloqueio.';
  end if;

  return new;
end;
$$;

drop trigger if exists unit_blocks_check_reservations on public.unit_blocks;
create trigger unit_blocks_check_reservations
before insert or update of unit_id, start_date, end_date, active
on public.unit_blocks
for each row execute function public.prevent_unit_block_during_reservation();

-- Verificação de bloqueio usada pela aplicação antes de criar/editar reserva.
create or replace function public.has_unit_block(
  p_unit_id uuid,
  p_check_in date,
  p_check_out date,
  p_ignore_reservation_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.unit_blocks b
      where b.unit_id = p_unit_id
        and b.active = true
        and daterange(b.start_date, b.end_date, '[)') && daterange(p_check_in, p_check_out, '[)')
    )
    or exists (
      select 1
      from public.reservations r
      where r.unit_id = p_unit_id
        and r.status in ('pending','confirmed','checked_in')
        and (p_ignore_reservation_id is null or r.id <> p_ignore_reservation_id)
        and daterange(r.check_in, r.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
    );
$$;

-- Concluir manutenção gera uma despesa uma única vez e libera o bloqueio.
create or replace function public.complete_maintenance_ticket(
  p_ticket_id uuid,
  p_category_id uuid,
  p_final_cost numeric,
  p_completion_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_ticket public.maintenance_tickets%rowtype;
  v_expense_id uuid;
begin
  if private.current_role() not in ('superadmin','admin_operacional','financeiro') then
    raise exception 'Usuário sem permissão para concluir manutenção.';
  end if;

  select * into v_ticket
  from public.maintenance_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Chamado não encontrado.';
  end if;

  if p_final_cost < 0 then
    raise exception 'O custo final não pode ser negativo.';
  end if;

  if v_ticket.generated_expense_id is null and p_final_cost > 0 then
    insert into public.expenses (
      client_id, unit_id, category_id, description, supplier,
      amount, expense_date, payment_status, charge_owner, notes, created_by
    ) values (
      v_ticket.client_id,
      v_ticket.unit_id,
      p_category_id,
      'Manutenção — ' || v_ticket.title,
      v_ticket.supplier,
      p_final_cost,
      current_date,
      'pending',
      true,
      p_completion_notes,
      auth.uid()
    ) returning id into v_expense_id;
  else
    v_expense_id := v_ticket.generated_expense_id;
  end if;

  update public.maintenance_tickets
  set status = 'concluded',
      final_cost = p_final_cost,
      generated_expense_id = v_expense_id,
      completed_at = now(),
      blocks_unit = false,
      description = case
        when p_completion_notes is null or trim(p_completion_notes) = '' then description
        else concat_ws(E'\n', description, 'Conclusão: ' || p_completion_notes)
      end,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_ticket_id;

  return v_expense_id;
end;
$$;

-- Metadados.
drop trigger if exists cleaning_tasks_update_metadata on public.cleaning_tasks;
create trigger cleaning_tasks_update_metadata
before update on public.cleaning_tasks
for each row execute function public.set_update_metadata();

drop trigger if exists maintenance_tickets_update_metadata on public.maintenance_tickets;
create trigger maintenance_tickets_update_metadata
before update on public.maintenance_tickets
for each row execute function public.set_update_metadata();

drop trigger if exists inventory_items_update_metadata on public.inventory_items;
create trigger inventory_items_update_metadata
before update on public.inventory_items
for each row execute function public.set_update_metadata();

-- Auditoria.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['cleaning_tasks','maintenance_tickets','inventory_items','unit_blocks']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      table_name,
      table_name
    );
  end loop;
end $$;

-- RLS.
alter table public.cleaning_checklist_items enable row level security;
alter table public.cleaning_task_items enable row level security;
alter table public.unit_blocks enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "cleaning templates scoped read" on public.cleaning_checklist_items;
create policy "cleaning templates scoped read" on public.cleaning_checklist_items
for select to authenticated using (
  exists (
    select 1 from public.units u
    where u.id = unit_id and private.can_access_client(u.client_id)
  )
);
drop policy if exists "cleaning templates operations write" on public.cleaning_checklist_items;
create policy "cleaning templates operations write" on public.cleaning_checklist_items
for all to authenticated
using (private.current_role() in ('superadmin','admin_operacional'))
with check (private.current_role() in ('superadmin','admin_operacional'));

drop policy if exists "cleaning task items scoped read" on public.cleaning_task_items;
create policy "cleaning task items scoped read" on public.cleaning_task_items
for select to authenticated using (
  exists (
    select 1 from public.cleaning_tasks t
    where t.id = cleaning_task_id
      and (private.can_access_client(t.client_id) or t.assigned_to = auth.uid())
  )
);
drop policy if exists "cleaning task items operations write" on public.cleaning_task_items;
create policy "cleaning task items operations write" on public.cleaning_task_items
for update to authenticated
using (
  exists (
    select 1 from public.cleaning_tasks t
    where t.id = cleaning_task_id
      and (private.current_role() in ('superadmin','admin_operacional') or t.assigned_to = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.cleaning_tasks t
    where t.id = cleaning_task_id
      and (private.current_role() in ('superadmin','admin_operacional') or t.assigned_to = auth.uid())
  )
);

drop policy if exists "unit blocks scoped read" on public.unit_blocks;
create policy "unit blocks scoped read" on public.unit_blocks
for select to authenticated using (private.can_access_client(client_id));
drop policy if exists "unit blocks operations write" on public.unit_blocks;
create policy "unit blocks operations write" on public.unit_blocks
for all to authenticated
using (private.current_role() in ('superadmin','admin_operacional'))
with check (private.current_role() in ('superadmin','admin_operacional'));

drop policy if exists "inventory scoped read" on public.inventory_items;
create policy "inventory scoped read" on public.inventory_items
for select to authenticated using (private.can_access_client(client_id));
drop policy if exists "inventory operations write" on public.inventory_items;
create policy "inventory operations write" on public.inventory_items
for all to authenticated
using (private.current_role() in ('superadmin','admin_operacional'))
with check (private.current_role() in ('superadmin','admin_operacional'));

revoke execute on function public.has_unit_block(uuid,date,date,uuid) from public;
revoke execute on function public.complete_maintenance_ticket(uuid,uuid,numeric,text) from public;
grant execute on function public.has_unit_block(uuid,date,date,uuid) to authenticated;
grant execute on function public.complete_maintenance_ticket(uuid,uuid,numeric,text) to authenticated;

-- Índices e proteção de sobreposição dos bloqueios.
create index if not exists idx_cleaning_checklist_unit_order
  on public.cleaning_checklist_items(unit_id, active, sort_order);
create unique index if not exists idx_cleaning_checklist_unique_label
  on public.cleaning_checklist_items(unit_id, lower(label))
  where active = true;
create index if not exists idx_cleaning_task_items_task
  on public.cleaning_task_items(cleaning_task_id, sort_order);
create index if not exists idx_unit_blocks_unit_dates
  on public.unit_blocks(unit_id, start_date, end_date) where active = true;
create index if not exists idx_inventory_unit_active
  on public.inventory_items(unit_id, active, name);
create index if not exists idx_inventory_warranty
  on public.inventory_items(warranty_until) where active = true;

do $$ begin
  alter table public.unit_blocks
  add constraint unit_blocks_no_overlap
  exclude using gist (
    unit_id with =,
    daterange(start_date, end_date, '[)') with &&
  ) where (active = true);
exception when duplicate_object then null;
end $$;

commit;
