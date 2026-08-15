-- ============================================================
-- JOCA PMS — CICLO 3
-- Receitas, recorrências, fechamento, repasse e bloqueio.
-- Execute depois de 001_ciclo2_crud_auditoria.sql.
-- ============================================================

begin;

alter table public.clients
  add column if not exists management_fee_base text not null default 'net_channels'
    check (management_fee_base in ('gross', 'net_channels')),
  add column if not exists emergency_reserve_default numeric(12,2) not null default 0
    check (emergency_reserve_default >= 0);

create table if not exists public.revenues (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  reservation_id uuid unique references public.reservations(id) on delete set null,
  source text not null default 'reservation' check (source in ('reservation','manual','adjustment')),
  channel public.channel_type not null default 'direct',
  description text not null,
  gross_amount numeric(12,2) not null default 0 check (gross_amount >= 0),
  platform_commission numeric(12,2) not null default 0 check (platform_commission >= 0),
  discounts numeric(12,2) not null default 0 check (discounts >= 0),
  net_amount numeric(12,2) generated always as
    (gross_amount - platform_commission - discounts) stored,
  expected_date date not null,
  received_date date,
  payment_status public.payment_status not null default 'pending',
  receipt_path text,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses
  add column if not exists recurring_expense_id uuid;

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  category_id uuid not null references public.financial_categories(id),
  description text not null,
  supplier text,
  amount numeric(12,2) not null check (amount > 0),
  frequency text not null default 'monthly'
    check (frequency in ('weekly','monthly','quarterly','yearly')),
  start_date date not null,
  next_due_date date not null,
  end_date date,
  payment_method text,
  charge_owner boolean not null default true,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_end_after_start check (end_date is null or end_date >= start_date)
);

alter table public.expenses
  drop constraint if exists expenses_recurring_expense_id_fkey;
alter table public.expenses
  add constraint expenses_recurring_expense_id_fkey
  foreign key (recurring_expense_id) references public.recurring_expenses(id) on delete set null;

create unique index if not exists idx_expenses_recurring_due_unique
  on public.expenses(recurring_expense_id, expense_date)
  where recurring_expense_id is not null;

-- Evolução da tabela de fechamentos já criada no starter.
alter table public.closings
  add column if not exists discounts numeric(12,2) not null default 0,
  add column if not exists calculation_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid default auth.uid(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz;

alter table public.closings
  drop constraint if exists valid_closing_period;
alter table public.closings
  add constraint valid_closing_period check (period_end >= period_start);

create table if not exists public.closing_items (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.closings(id) on delete cascade,
  item_type text not null check (
    item_type in ('revenue','platform_fee','discount','expense','management_fee','emergency_reserve')
  ),
  source_table text,
  source_id uuid,
  unit_id uuid references public.units(id) on delete set null,
  description text not null,
  occurred_on date,
  amount numeric(12,2) not null check (amount >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null unique references public.closings(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  scheduled_date date not null,
  paid_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','paid','cancelled')),
  payment_method text,
  proof_path text,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Atualiza receitas automaticamente a partir das reservas.
create or replace function public.sync_reservation_revenue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gross_value numeric(12,2);
  mapped_payment public.payment_status;
begin
  gross_value := coalesce(new.lodging_amount,0)
    + coalesce(new.cleaning_fee,0)
    + coalesce(new.extra_fees,0);

  mapped_payment := case
    when new.status = 'cancelled' then 'cancelled'::public.payment_status
    else new.payment_status
  end;

  insert into public.revenues (
    client_id,
    unit_id,
    reservation_id,
    source,
    channel,
    description,
    gross_amount,
    platform_commission,
    discounts,
    expected_date,
    payment_status,
    created_by
  ) values (
    new.client_id,
    new.unit_id,
    new.id,
    'reservation',
    new.channel,
    'Reserva — ' || new.guest_name,
    gross_value,
    coalesce(new.platform_commission,0),
    coalesce(new.discounts,0),
    new.check_out,
    mapped_payment,
    coalesce(new.created_by, auth.uid())
  )
  on conflict (reservation_id) do update set
    client_id = excluded.client_id,
    unit_id = excluded.unit_id,
    channel = excluded.channel,
    description = excluded.description,
    gross_amount = excluded.gross_amount,
    platform_commission = excluded.platform_commission,
    discounts = excluded.discounts,
    expected_date = excluded.expected_date,
    payment_status = excluded.payment_status,
    updated_at = now(),
    updated_by = auth.uid();

  return new;
end;
$$;

drop trigger if exists reservation_revenue_sync on public.reservations;
create trigger reservation_revenue_sync
after insert or update of client_id, unit_id, guest_name, channel, check_out, lodging_amount, cleaning_fee,
  extra_fees, discounts, platform_commission, status, payment_status
on public.reservations
for each row execute function public.sync_reservation_revenue();

-- Cria receitas para reservas que já existiam antes da migração.
insert into public.revenues (
  client_id, unit_id, reservation_id, source, channel, description,
  gross_amount, platform_commission, discounts, expected_date,
  payment_status, created_by
)
select
  r.client_id,
  r.unit_id,
  r.id,
  'reservation',
  r.channel,
  'Reserva — ' || r.guest_name,
  coalesce(r.lodging_amount,0) + coalesce(r.cleaning_fee,0) + coalesce(r.extra_fees,0),
  coalesce(r.platform_commission,0),
  coalesce(r.discounts,0),
  r.check_out,
  case when r.status = 'cancelled' then 'cancelled'::public.payment_status else r.payment_status end,
  r.created_by
from public.reservations r
on conflict (reservation_id) do update set
  gross_amount = excluded.gross_amount,
  platform_commission = excluded.platform_commission,
  discounts = excluded.discounts,
  expected_date = excluded.expected_date,
  payment_status = excluded.payment_status,
  updated_at = now();

-- Gera despesas que venceram até uma data informada.
create or replace function public.generate_due_recurring_expenses(p_through_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  rec public.recurring_expenses%rowtype;
  due date;
  inserted_count integer := 0;
begin
  if private.current_role() not in ('superadmin','admin_operacional','financeiro') then
    raise exception 'Usuário sem permissão para gerar despesas recorrentes.';
  end if;

  for rec in
    select * from public.recurring_expenses
    where active = true
      and next_due_date <= p_through_date
      and (end_date is null or next_due_date <= end_date)
    order by next_due_date
    for update
  loop
    due := rec.next_due_date;

    while due <= p_through_date and (rec.end_date is null or due <= rec.end_date) loop
      insert into public.expenses (
        client_id, unit_id, category_id, recurring_expense_id,
        description, supplier, amount, expense_date, payment_method,
        payment_status, charge_owner, created_by
      ) values (
        rec.client_id, rec.unit_id, rec.category_id, rec.id,
        rec.description, rec.supplier, rec.amount, due, rec.payment_method,
        'pending', rec.charge_owner, auth.uid()
      ) on conflict (recurring_expense_id, expense_date)
        where recurring_expense_id is not null do nothing;

      if found then
        inserted_count := inserted_count + 1;
      end if;

      due := case rec.frequency
        when 'weekly' then due + 7
        when 'monthly' then (due + interval '1 month')::date
        when 'quarterly' then (due + interval '3 months')::date
        when 'yearly' then (due + interval '1 year')::date
      end;
    end loop;

    update public.recurring_expenses
    set next_due_date = due,
        updated_at = now(),
        updated_by = auth.uid()
    where id = rec.id;
  end loop;

  return inserted_count;
end;
$$;

-- Cria um fechamento como fotografia imutável dos registros do período.
create or replace function public.create_financial_closing(
  p_client_id uuid,
  p_period_start date,
  p_period_end date,
  p_emergency_reserve numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_closing_id uuid;
  v_fee_type text;
  v_fee_value numeric(12,2);
  v_fee_base text;
  v_default_reserve numeric(12,2);
  v_gross numeric(12,2) := 0;
  v_platform numeric(12,2) := 0;
  v_discounts numeric(12,2) := 0;
  v_expenses numeric(12,2) := 0;
  v_management numeric(12,2) := 0;
  v_reserve numeric(12,2) := 0;
  v_owner_net numeric(12,2) := 0;
  v_existing_status text;
begin
  if private.current_role() not in ('superadmin','financeiro') then
    raise exception 'Somente financeiro ou superadministrador pode criar fechamento.';
  end if;

  if p_period_end < p_period_start then
    raise exception 'O fim do período deve ser igual ou posterior ao início.';
  end if;

  select management_fee_type, management_fee_value, management_fee_base,
         emergency_reserve_default
    into v_fee_type, v_fee_value, v_fee_base, v_default_reserve
  from public.clients
  where id = p_client_id;

  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  select status into v_existing_status
  from public.closings
  where client_id = p_client_id
    and period_start = p_period_start
    and period_end = p_period_end;

  if v_existing_status in ('approved','payout_scheduled','paid') then
    raise exception 'Já existe fechamento bloqueado para este período.';
  end if;

  delete from public.closings
  where client_id = p_client_id
    and period_start = p_period_start
    and period_end = p_period_end;

  insert into public.closings (
    client_id, period_start, period_end, status, created_by
  ) values (
    p_client_id, p_period_start, p_period_end, 'open', auth.uid()
  ) returning id into v_closing_id;

  insert into public.closing_items (
    closing_id, item_type, source_table, source_id, unit_id,
    description, occurred_on, amount, metadata
  )
  select
    v_closing_id, 'revenue', 'revenues', r.id, r.unit_id,
    r.description, coalesce(r.received_date, r.expected_date), r.gross_amount,
    jsonb_build_object('channel', r.channel, 'status', r.payment_status)
  from public.revenues r
  where r.client_id = p_client_id
    and coalesce(r.received_date, r.expected_date) between p_period_start and p_period_end
    and r.payment_status = 'paid';

  insert into public.closing_items (
    closing_id, item_type, source_table, source_id, unit_id,
    description, occurred_on, amount
  )
  select
    v_closing_id, 'platform_fee', 'revenues', r.id, r.unit_id,
    'Comissão do canal — ' || r.description, coalesce(r.received_date, r.expected_date), r.platform_commission
  from public.revenues r
  where r.client_id = p_client_id
    and coalesce(r.received_date, r.expected_date) between p_period_start and p_period_end
    and r.payment_status = 'paid'
    and r.platform_commission > 0;

  insert into public.closing_items (
    closing_id, item_type, source_table, source_id, unit_id,
    description, occurred_on, amount
  )
  select
    v_closing_id, 'discount', 'revenues', r.id, r.unit_id,
    'Desconto — ' || r.description, coalesce(r.received_date, r.expected_date), r.discounts
  from public.revenues r
  where r.client_id = p_client_id
    and coalesce(r.received_date, r.expected_date) between p_period_start and p_period_end
    and r.payment_status = 'paid'
    and r.discounts > 0;

  insert into public.closing_items (
    closing_id, item_type, source_table, source_id, unit_id,
    description, occurred_on, amount, metadata
  )
  select
    v_closing_id, 'expense', 'expenses', e.id, e.unit_id,
    e.description, e.expense_date, e.amount,
    jsonb_build_object('supplier', e.supplier, 'payment_status', e.payment_status)
  from public.expenses e
  where e.client_id = p_client_id
    and e.expense_date between p_period_start and p_period_end
    and e.charge_owner = true
    and e.payment_status <> 'cancelled';

  select coalesce(sum(amount),0) into v_gross
    from public.closing_items where closing_id = v_closing_id and item_type = 'revenue';
  select coalesce(sum(amount),0) into v_platform
    from public.closing_items where closing_id = v_closing_id and item_type = 'platform_fee';
  select coalesce(sum(amount),0) into v_discounts
    from public.closing_items where closing_id = v_closing_id and item_type = 'discount';
  select coalesce(sum(amount),0) into v_expenses
    from public.closing_items where closing_id = v_closing_id and item_type = 'expense';

  v_management := case
    when v_fee_type = 'fixed' then greatest(v_fee_value,0)
    when v_fee_base = 'gross' then greatest(v_gross * v_fee_value / 100,0)
    else greatest((v_gross - v_platform - v_discounts) * v_fee_value / 100,0)
  end;

  v_reserve := greatest(coalesce(p_emergency_reserve, v_default_reserve, 0),0);
  v_owner_net := v_gross - v_platform - v_discounts - v_expenses - v_management - v_reserve;

  if v_management > 0 then
    insert into public.closing_items (
      closing_id, item_type, description, amount,
      metadata
    ) values (
      v_closing_id, 'management_fee', 'Comissão da JOCA', v_management,
      jsonb_build_object('fee_type', v_fee_type, 'fee_value', v_fee_value, 'fee_base', v_fee_base)
    );
  end if;

  if v_reserve > 0 then
    insert into public.closing_items (
      closing_id, item_type, description, amount
    ) values (
      v_closing_id, 'emergency_reserve', 'Reserva de emergência', v_reserve
    );
  end if;

  update public.closings
  set gross_revenue = v_gross,
      platform_fees = v_platform,
      discounts = v_discounts,
      operating_expenses = v_expenses,
      management_fee = v_management,
      emergency_reserve = v_reserve,
      owner_net = v_owner_net,
      calculation_snapshot = jsonb_build_object(
        'formula_version', 1,
        'management_fee_type', v_fee_type,
        'management_fee_value', v_fee_value,
        'management_fee_base', v_fee_base,
        'generated_at', now()
      ),
      updated_at = now()
  where id = v_closing_id;

  return v_closing_id;
end;
$$;

create or replace function public.approve_financial_closing(p_closing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_closing public.closings%rowtype;
  v_payout_id uuid;
  v_payout_day integer;
  v_base_month date;
  v_scheduled date;
begin
  if private.current_role() not in ('superadmin','financeiro') then
    raise exception 'Usuário sem permissão para aprovar fechamento.';
  end if;

  select * into v_closing
  from public.closings
  where id = p_closing_id
  for update;

  if not found then
    raise exception 'Fechamento não encontrado.';
  end if;

  if v_closing.status <> 'open' then
    raise exception 'Somente fechamentos em aberto podem ser aprovados.';
  end if;

  select payout_day into v_payout_day
  from public.clients where id = v_closing.client_id;

  v_base_month := date_trunc('month', v_closing.period_end + interval '1 month')::date;
  v_scheduled := make_date(
    extract(year from v_base_month)::integer,
    extract(month from v_base_month)::integer,
    least(v_payout_day, extract(day from (v_base_month + interval '1 month - 1 day'))::integer)
  );

  update public.closings
  set status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      locked_at = now(),
      updated_at = now()
  where id = p_closing_id;

  insert into public.payouts (
    closing_id, client_id, amount, scheduled_date, status, created_by
  ) values (
    p_closing_id, v_closing.client_id, greatest(v_closing.owner_net,0), v_scheduled,
    'scheduled', auth.uid()
  )
  on conflict (closing_id) do update set
    amount = excluded.amount,
    scheduled_date = excluded.scheduled_date,
    status = 'scheduled',
    updated_at = now(),
    updated_by = auth.uid()
  returning id into v_payout_id;

  return v_payout_id;
end;
$$;

-- Impede alterações em fechamentos já aprovados.
create or replace function public.prevent_locked_closing_change()
returns trigger
language plpgsql
as $$
begin
  -- A única alteração permitida após aprovação é registrar o repasse como pago.
  if tg_op = 'UPDATE'
     and old.status = 'approved'
     and new.status = 'paid'
     and new.gross_revenue = old.gross_revenue
     and new.platform_fees = old.platform_fees
     and new.discounts = old.discounts
     and new.operating_expenses = old.operating_expenses
     and new.management_fee = old.management_fee
     and new.emergency_reserve = old.emergency_reserve
     and new.owner_net = old.owner_net then
    return new;
  end if;

  if old.status in ('approved','payout_scheduled','paid') then
    raise exception 'Fechamento aprovado está bloqueado.';
  end if;
  return new;
end;
$$;

drop trigger if exists closings_locked_update on public.closings;
create trigger closings_locked_update
before update or delete on public.closings
for each row
when (old.status in ('approved','payout_scheduled','paid'))
execute function public.prevent_locked_closing_change();

create or replace function public.prevent_locked_closing_item_change()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.closings
  where id = coalesce(new.closing_id, old.closing_id);

  if v_status in ('approved','payout_scheduled','paid') then
    raise exception 'Itens de fechamento aprovado estão bloqueados.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists closing_items_locked_change on public.closing_items;
create trigger closing_items_locked_change
before insert or update or delete on public.closing_items
for each row execute function public.prevent_locked_closing_item_change();

-- Metadados e auditoria dos novos módulos.
drop trigger if exists revenues_update_metadata on public.revenues;
create trigger revenues_update_metadata
before update on public.revenues
for each row execute function public.set_update_metadata();

drop trigger if exists recurring_expenses_update_metadata on public.recurring_expenses;
create trigger recurring_expenses_update_metadata
before update on public.recurring_expenses
for each row execute function public.set_update_metadata();

drop trigger if exists payouts_update_metadata on public.payouts;
create trigger payouts_update_metadata
before update on public.payouts
for each row execute function public.set_update_metadata();

do $$
declare
  table_name text;
begin
  foreach table_name in array array['revenues','recurring_expenses','closings','payouts']
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
alter table public.revenues enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.closing_items enable row level security;
alter table public.payouts enable row level security;

drop policy if exists "revenues scoped read" on public.revenues;
create policy "revenues scoped read" on public.revenues
for select to authenticated using (private.can_access_client(client_id));
drop policy if exists "revenues finance insert" on public.revenues;
create policy "revenues finance insert" on public.revenues
for insert to authenticated
with check (private.current_role() in ('superadmin','admin_operacional','financeiro'));
drop policy if exists "revenues finance update" on public.revenues;
create policy "revenues finance update" on public.revenues
for update to authenticated
using (private.current_role() in ('superadmin','admin_operacional','financeiro'))
with check (private.current_role() in ('superadmin','admin_operacional','financeiro'));

drop policy if exists "recurring scoped read" on public.recurring_expenses;
create policy "recurring scoped read" on public.recurring_expenses
for select to authenticated using (private.can_access_client(client_id));
drop policy if exists "recurring finance write" on public.recurring_expenses;
create policy "recurring finance write" on public.recurring_expenses
for all to authenticated
using (private.current_role() in ('superadmin','financeiro'))
with check (private.current_role() in ('superadmin','financeiro'));

drop policy if exists "closing items scoped read" on public.closing_items;
create policy "closing items scoped read" on public.closing_items
for select to authenticated using (
  exists (
    select 1 from public.closings c
    where c.id = closing_id and private.can_access_client(c.client_id)
  )
);
drop policy if exists "closing items finance write" on public.closing_items;
create policy "closing items finance write" on public.closing_items
for all to authenticated
using (private.current_role() in ('superadmin','financeiro'))
with check (private.current_role() in ('superadmin','financeiro'));

drop policy if exists "payouts scoped read" on public.payouts;
create policy "payouts scoped read" on public.payouts
for select to authenticated using (private.can_access_client(client_id));
drop policy if exists "payouts finance update" on public.payouts;
create policy "payouts finance update" on public.payouts
for update to authenticated
using (private.current_role() in ('superadmin','financeiro'))
with check (private.current_role() in ('superadmin','financeiro'));

-- Chamada das funções somente via API autenticada.
revoke execute on function public.generate_due_recurring_expenses(date) from public;
revoke execute on function public.create_financial_closing(uuid,date,date,numeric) from public;
revoke execute on function public.approve_financial_closing(uuid) from public;
grant execute on function public.generate_due_recurring_expenses(date) to authenticated;
grant execute on function public.create_financial_closing(uuid,date,date,numeric) to authenticated;
grant execute on function public.approve_financial_closing(uuid) to authenticated;

-- Índices.
create index if not exists idx_revenues_client_date
  on public.revenues(client_id, expected_date desc);
create index if not exists idx_revenues_unit_date
  on public.revenues(unit_id, expected_date desc);
create index if not exists idx_recurring_next_due
  on public.recurring_expenses(active, next_due_date);
create index if not exists idx_closing_items_closing_type
  on public.closing_items(closing_id, item_type);
create index if not exists idx_payouts_status_date
  on public.payouts(status, scheduled_date);

commit;
