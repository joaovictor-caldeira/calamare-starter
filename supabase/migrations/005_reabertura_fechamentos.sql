-- ============================================================
-- JOCA GERENCIAMENTO IMOBILIÁRIO
-- MIGRAÇÃO 005 — REABERTURA CONTROLADA DE FECHAMENTOS
--
-- Fluxo:
-- open -> approved -> review -> open -> approved
--
-- Regras:
-- - somente superadmin pode reabrir;
-- - motivo obrigatório;
-- - repasse pago nunca pode ser reaberto;
-- - cada reabertura arquiva uma fotografia da versão anterior;
-- - o repasse agendado é cancelado temporariamente;
-- - ao aprovar novamente, o mesmo repasse é reagendado com novo valor;
-- - o fechamento mantém o mesmo ID.
-- ============================================================

begin;

-- 1. Metadados da versão atual do fechamento.
alter table public.closings
  add column if not exists version integer not null default 1,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id) on delete set null,
  add column if not exists reopen_reason text;

-- 2. Histórico imutável das versões que já haviam sido aprovadas.
create table if not exists public.closing_versions (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.closings(id) on delete restrict,
  version integer not null check (version >= 1),
  archived_at timestamptz not null default now(),
  archived_by uuid references auth.users(id) on delete set null,
  reopen_reason text not null,
  closing_snapshot jsonb not null,
  items_snapshot jsonb not null default '[]'::jsonb,
  unique (closing_id, version)
);

alter table public.closing_versions enable row level security;

drop policy if exists "closing versions scoped read" on public.closing_versions;
create policy "closing versions scoped read"
on public.closing_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.closings c
    where c.id = closing_id
      and private.can_access_client(c.client_id)
  )
);

-- A tabela de versões é somente leitura pela API.
grant select on public.closing_versions to authenticated;
revoke insert, update, delete on public.closing_versions from authenticated;

-- Impede edição ou exclusão de versões históricas.
create or replace function public.prevent_closing_version_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Versões históricas de fechamento são imutáveis.';
end;
$$;

drop trigger if exists closing_versions_immutable on public.closing_versions;
create trigger closing_versions_immutable
before update or delete on public.closing_versions
for each row
execute function public.prevent_closing_version_change();

-- 3. Ajusta a proteção do fechamento aprovado.
-- Permite apenas:
-- a) approved -> paid, sem mudar valores;
-- b) approved/payout_scheduled -> review, somente para superadmin,
--    com motivo e sem mudar os valores naquele mesmo comando.
create or replace function public.prevent_locked_closing_change()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved','payout_scheduled','paid') then
      raise exception 'Fechamento aprovado está bloqueado.';
    end if;
    return old;
  end if;

  -- Registrar pagamento do repasse.
  if old.status = 'approved'
     and new.status = 'paid'
     and new.client_id = old.client_id
     and new.period_start = old.period_start
     and new.period_end = old.period_end
     and new.gross_revenue = old.gross_revenue
     and new.platform_fees = old.platform_fees
     and new.discounts = old.discounts
     and new.operating_expenses = old.operating_expenses
     and new.management_fee = old.management_fee
     and new.emergency_reserve = old.emergency_reserve
     and new.owner_net = old.owner_net then
    return new;
  end if;

  -- Reabertura controlada.
  if old.status in ('approved','payout_scheduled')
     and new.status = 'review'
     and private.current_role() = 'superadmin'
     and nullif(btrim(new.reopen_reason), '') is not null
     and new.client_id = old.client_id
     and new.period_start = old.period_start
     and new.period_end = old.period_end
     and new.gross_revenue = old.gross_revenue
     and new.platform_fees = old.platform_fees
     and new.discounts = old.discounts
     and new.operating_expenses = old.operating_expenses
     and new.management_fee = old.management_fee
     and new.emergency_reserve = old.emergency_reserve
     and new.owner_net = old.owner_net
     and new.version = old.version + 1 then
    return new;
  end if;

  if old.status in ('approved','payout_scheduled','paid') then
    raise exception 'Fechamento aprovado está bloqueado.';
  end if;

  return new;
end;
$$;

-- O trigger já existe da migração 002, mas recriamos para garantir
-- que esteja ligado à nova função.
drop trigger if exists closings_locked_update on public.closings;
create trigger closings_locked_update
before update or delete on public.closings
for each row
when (old.status in ('approved','payout_scheduled','paid'))
execute function public.prevent_locked_closing_change();

-- 4. RPC de reabertura.
create or replace function public.reopen_financial_closing(
  p_closing_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_closing public.closings%rowtype;
  v_payout_status text;
  v_items jsonb;
  v_new_version integer;
begin
  if private.current_role() <> 'superadmin' then
    raise exception 'Somente o superadministrador pode reabrir um fechamento.';
  end if;

  if nullif(btrim(p_reason), '') is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'Informe um motivo de reabertura com pelo menos 10 caracteres.';
  end if;

  select *
    into v_closing
  from public.closings
  where id = p_closing_id
  for update;

  if not found then
    raise exception 'Fechamento não encontrado.';
  end if;

  if v_closing.status = 'paid' then
    raise exception 'Fechamento com repasse realizado não pode ser reaberto. Faça um ajuste no fechamento seguinte.';
  end if;

  if v_closing.status not in ('approved','payout_scheduled') then
    raise exception 'Somente fechamento aprovado e ainda não pago pode ser reaberto.';
  end if;

  select status
    into v_payout_status
  from public.payouts
  where closing_id = p_closing_id
  for update;

  if v_payout_status = 'paid' then
    raise exception 'O repasse já foi realizado. O fechamento não pode ser reaberto.';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(ci) order by ci.created_at, ci.id),
    '[]'::jsonb
  )
  into v_items
  from public.closing_items ci
  where ci.closing_id = p_closing_id;

  -- Arquiva a versão aprovada antes da alteração.
  insert into public.closing_versions (
    closing_id,
    version,
    archived_by,
    reopen_reason,
    closing_snapshot,
    items_snapshot
  ) values (
    p_closing_id,
    v_closing.version,
    auth.uid(),
    btrim(p_reason),
    to_jsonb(v_closing),
    v_items
  );

  v_new_version := v_closing.version + 1;

  -- O repasse deixa de ficar pendente enquanto o fechamento está em revisão.
  update public.payouts
  set status = 'cancelled',
      updated_at = now(),
      updated_by = auth.uid()
  where closing_id = p_closing_id
    and status <> 'paid';

  -- Não altera valores neste momento. Apenas desbloqueia para revisão.
  update public.closings
  set status = 'review',
      version = v_new_version,
      reopened_at = now(),
      reopened_by = auth.uid(),
      reopen_reason = btrim(p_reason),
      approved_at = null,
      approved_by = null,
      locked_at = null,
      updated_at = now()
  where id = p_closing_id;

  return v_new_version;
end;
$$;

-- 5. Reescreve o cálculo para reutilizar o mesmo fechamento.
-- Isso é necessário porque agora um fechamento reaberto já possui
-- um payout vinculado e não deve ser apagado/recriado.
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
  v_existing_snapshot jsonb;
begin
  if private.current_role() not in ('superadmin','financeiro') then
    raise exception 'Somente financeiro ou superadministrador pode criar fechamento.';
  end if;

  if p_period_end < p_period_start then
    raise exception 'O fim do período deve ser igual ou posterior ao início.';
  end if;

  select
    management_fee_type,
    management_fee_value,
    management_fee_base,
    emergency_reserve_default
  into
    v_fee_type,
    v_fee_value,
    v_fee_base,
    v_default_reserve
  from public.clients
  where id = p_client_id;

  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  select
    id,
    status,
    calculation_snapshot
  into
    v_closing_id,
    v_existing_status,
    v_existing_snapshot
  from public.closings
  where client_id = p_client_id
    and period_start = p_period_start
    and period_end = p_period_end
  for update;

  if v_existing_status in ('approved','payout_scheduled','paid') then
    raise exception 'Já existe fechamento bloqueado para este período.';
  end if;

  -- Se for uma revisão de fechamento já aprovado, preserva a regra de
  -- comissão usada na versão anterior, evitando mudança histórica
  -- caso o cadastro do cliente tenha sido alterado depois.
  if v_existing_status = 'review' and v_existing_snapshot is not null then
    v_fee_type := coalesce(v_existing_snapshot->>'management_fee_type', v_fee_type);
    v_fee_value := coalesce(
      nullif(v_existing_snapshot->>'management_fee_value','')::numeric,
      v_fee_value
    );
    v_fee_base := coalesce(v_existing_snapshot->>'management_fee_base', v_fee_base);
  end if;

  if v_closing_id is null then
    insert into public.closings (
      client_id,
      period_start,
      period_end,
      status,
      created_by
    ) values (
      p_client_id,
      p_period_start,
      p_period_end,
      'open',
      auth.uid()
    )
    returning id into v_closing_id;
  else
    -- Mantém o mesmo ID e a versão atual.
    update public.closings
    set status = 'open',
        gross_revenue = 0,
        platform_fees = 0,
        discounts = 0,
        operating_expenses = 0,
        management_fee = 0,
        emergency_reserve = 0,
        owner_net = 0,
        approved_at = null,
        approved_by = null,
        locked_at = null,
        updated_at = now()
    where id = v_closing_id;

    delete from public.closing_items
    where closing_id = v_closing_id;
  end if;

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
    and coalesce(r.received_date, r.expected_date)
      between p_period_start and p_period_end
    and r.payment_status = 'paid';

  insert into public.closing_items (
    closing_id, item_type, source_table, source_id, unit_id,
    description, occurred_on, amount
  )
  select
    v_closing_id, 'platform_fee', 'revenues', r.id, r.unit_id,
    'Comissão do canal — ' || r.description,
    coalesce(r.received_date, r.expected_date),
    r.platform_commission
  from public.revenues r
  where r.client_id = p_client_id
    and coalesce(r.received_date, r.expected_date)
      between p_period_start and p_period_end
    and r.payment_status = 'paid'
    and r.platform_commission > 0;

  insert into public.closing_items (
    closing_id, item_type, source_table, source_id, unit_id,
    description, occurred_on, amount
  )
  select
    v_closing_id, 'discount', 'revenues', r.id, r.unit_id,
    'Desconto — ' || r.description,
    coalesce(r.received_date, r.expected_date),
    r.discounts
  from public.revenues r
  where r.client_id = p_client_id
    and coalesce(r.received_date, r.expected_date)
      between p_period_start and p_period_end
    and r.payment_status = 'paid'
    and r.discounts > 0;

  insert into public.closing_items (
    closing_id, item_type, source_table, source_id, unit_id,
    description, occurred_on, amount, metadata
  )
  select
    v_closing_id, 'expense', 'expenses', e.id, e.unit_id,
    e.description, e.expense_date, e.amount,
    jsonb_build_object(
      'supplier', e.supplier,
      'payment_status', e.payment_status
    )
  from public.expenses e
  where e.client_id = p_client_id
    and e.expense_date between p_period_start and p_period_end
    and e.charge_owner = true
    and e.payment_status <> 'cancelled';

  select coalesce(sum(amount),0)
  into v_gross
  from public.closing_items
  where closing_id = v_closing_id
    and item_type = 'revenue';

  select coalesce(sum(amount),0)
  into v_platform
  from public.closing_items
  where closing_id = v_closing_id
    and item_type = 'platform_fee';

  select coalesce(sum(amount),0)
  into v_discounts
  from public.closing_items
  where closing_id = v_closing_id
    and item_type = 'discount';

  select coalesce(sum(amount),0)
  into v_expenses
  from public.closing_items
  where closing_id = v_closing_id
    and item_type = 'expense';

  v_management := case
    when v_fee_type = 'fixed'
      then greatest(v_fee_value,0)
    when v_fee_base = 'gross'
      then greatest(v_gross * v_fee_value / 100,0)
    else greatest(
      (v_gross - v_platform - v_discounts) * v_fee_value / 100,
      0
    )
  end;

  v_reserve := greatest(
    coalesce(p_emergency_reserve, v_default_reserve, 0),
    0
  );

  v_owner_net :=
      v_gross
    - v_platform
    - v_discounts
    - v_expenses
    - v_management
    - v_reserve;

  if v_management > 0 then
    insert into public.closing_items (
      closing_id,
      item_type,
      description,
      amount,
      metadata
    ) values (
      v_closing_id,
      'management_fee',
      'Comissão da JOCA',
      v_management,
      jsonb_build_object(
        'fee_type', v_fee_type,
        'fee_value', v_fee_value,
        'fee_base', v_fee_base
      )
    );
  end if;

  if v_reserve > 0 then
    insert into public.closing_items (
      closing_id,
      item_type,
      description,
      amount
    ) values (
      v_closing_id,
      'emergency_reserve',
      'Reserva de emergência',
      v_reserve
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

-- 6. Recria a aprovação para reagendar o payout e limpar dados
-- antigos do agendamento cancelado após uma reabertura.
create or replace function public.approve_financial_closing(
  p_closing_id uuid
)
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

  select *
    into v_closing
  from public.closings
  where id = p_closing_id
  for update;

  if not found then
    raise exception 'Fechamento não encontrado.';
  end if;

  if v_closing.status <> 'open' then
    raise exception 'Somente fechamentos em aberto podem ser aprovados.';
  end if;

  select payout_day
    into v_payout_day
  from public.clients
  where id = v_closing.client_id;

  v_base_month :=
    date_trunc(
      'month',
      v_closing.period_end + interval '1 month'
    )::date;

  v_scheduled := make_date(
    extract(year from v_base_month)::integer,
    extract(month from v_base_month)::integer,
    least(
      v_payout_day,
      extract(
        day from (
          v_base_month + interval '1 month - 1 day'
        )
      )::integer
    )
  );

  update public.closings
  set status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      locked_at = now(),
      updated_at = now()
  where id = p_closing_id;

  insert into public.payouts (
    closing_id,
    client_id,
    amount,
    scheduled_date,
    status,
    created_by
  ) values (
    p_closing_id,
    v_closing.client_id,
    greatest(v_closing.owner_net,0),
    v_scheduled,
    'scheduled',
    auth.uid()
  )
  on conflict (closing_id) do update
  set amount = excluded.amount,
      scheduled_date = excluded.scheduled_date,
      status = 'scheduled',
      paid_at = null,
      payment_method = null,
      proof_path = null,
      notes = null,
      updated_at = now(),
      updated_by = auth.uid()
  returning id into v_payout_id;

  return v_payout_id;
end;
$$;

-- 7. Permissões das RPCs.
revoke execute on function public.reopen_financial_closing(uuid,text) from public;
revoke execute on function public.reopen_financial_closing(uuid,text) from anon;
grant execute on function public.reopen_financial_closing(uuid,text) to authenticated;

-- As funções substituídas mantêm o acesso autenticado.
revoke execute on function public.create_financial_closing(uuid,date,date,numeric) from public;
revoke execute on function public.approve_financial_closing(uuid) from public;
grant execute on function public.create_financial_closing(uuid,date,date,numeric) to authenticated;
grant execute on function public.approve_financial_closing(uuid) to authenticated;

create index if not exists idx_closing_versions_closing_version
  on public.closing_versions(closing_id, version desc);

commit;
