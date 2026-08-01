-- ============================================================
-- CALAMARE PMS — BANCO DE DADOS DO MVP
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create schema if not exists private;

-- Tipos controlados
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('superadmin', 'admin_operacional', 'financeiro', 'proprietario', 'limpeza', 'manutencao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.record_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.channel_type AS ENUM ('airbnb', 'booking', 'direct', 'owner_block', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'admin_operacional',
  client_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf_cnpj text,
  phone text,
  email text,
  address text,
  bank_details text,
  management_fee_type text not null default 'percentage' check (management_fee_type in ('percentage', 'fixed')),
  management_fee_value numeric(12,2) not null default 0,
  closing_day integer not null default 15 check (closing_day between 1 and 28),
  payout_day integer not null default 20 check (payout_day between 1 and 28),
  status public.record_status not null default 'active',
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_client_id_fkey,
  add constraint profiles_client_id_fkey foreign key (client_id) references public.clients(id) on delete set null;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  internal_code text,
  address text,
  city text,
  state char(2),
  location_url text,
  status public.record_status not null default 'active',
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  internal_code text,
  rooms integer not null default 1,
  beds integer not null default 1,
  capacity integer not null default 1,
  check_in_time time not null default '14:00',
  check_out_time time not null default '11:00',
  default_rate numeric(12,2) not null default 0,
  cleaning_fee numeric(12,2) not null default 0,
  security_deposit numeric(12,2) not null default 0,
  wifi_name text,
  wifi_password text,
  access_instructions text,
  door_code text,
  airbnb_url text,
  booking_url text,
  direct_booking_url text,
  status public.record_status not null default 'active',
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  guest_name text not null,
  guest_phone text,
  guest_email text,
  guest_count integer not null default 1,
  channel public.channel_type not null default 'direct',
  external_code text,
  external_uid text,
  check_in date not null,
  check_out date not null,
  lodging_amount numeric(12,2) not null default 0,
  cleaning_fee numeric(12,2) not null default 0,
  extra_fees numeric(12,2) not null default 0,
  discounts numeric(12,2) not null default 0,
  platform_commission numeric(12,2) not null default 0,
  status public.reservation_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_reservation_dates check (check_out > check_in),
  constraint unique_external_reservation unique nulls not distinct (channel, external_uid)
);

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('income', 'expense')),
  active boolean not null default true
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  category_id uuid not null references public.financial_categories(id),
  description text not null,
  supplier text,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null,
  payment_method text,
  payment_status public.payment_status not null default 'paid',
  receipt_path text,
  charge_owner boolean not null default true,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  reservation_id uuid unique references public.reservations(id) on delete cascade,
  scheduled_date date not null,
  checkout_time time,
  next_checkin_time time,
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','confirmed','in_progress','completed','pending_issue','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  notes text,
  cleaning_cost numeric(12,2) not null default 0,
  laundry_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  title text not null,
  category text,
  urgency text not null default 'normal' check (urgency in ('low','normal','high','critical')),
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  supplier text,
  estimated_cost numeric(12,2),
  approved_cost numeric(12,2),
  final_cost numeric(12,2),
  status text not null default 'identified',
  blocks_unit boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.closings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_revenue numeric(12,2) not null default 0,
  platform_fees numeric(12,2) not null default 0,
  operating_expenses numeric(12,2) not null default 0,
  management_fee numeric(12,2) not null default 0,
  emergency_reserve numeric(12,2) not null default 0,
  owner_net numeric(12,2) not null default 0,
  status text not null default 'open',
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (client_id, period_start, period_end)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- Índices úteis
create index if not exists idx_properties_client on public.properties(client_id);
create index if not exists idx_units_client on public.units(client_id);
create index if not exists idx_units_property on public.units(property_id);
create index if not exists idx_reservations_client on public.reservations(client_id);
create index if not exists idx_reservations_unit_dates on public.reservations(unit_id, check_in, check_out);
\n-- Bloqueio de sobreposição no próprio banco. O intervalo usa [check-in, check-out),
-- portanto o check-out de uma reserva pode ser o check-in da próxima.
DO $$ BEGIN
  ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (status IN ('pending','confirmed','checked_in'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
create index if not exists idx_expenses_client_date on public.expenses(client_id, expense_date);

-- Perfil automático ao criar usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Funções privadas de autorização
create or replace function private.current_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = (select auth.uid()) and is_active = true;
$$;

create or replace function private.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(private.current_role() in ('superadmin','admin_operacional','financeiro'), false);
$$;

create or replace function private.can_access_client(target_client uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    private.is_staff()
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and role = 'proprietario'
        and client_id = target_client
        and is_active = true
    ), false
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.can_access_client(uuid) to authenticated;

-- Tarefa automática de limpeza
create or replace function public.sync_cleaning_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('confirmed','checked_in') then
    insert into public.cleaning_tasks (client_id, unit_id, reservation_id, scheduled_date, checkout_time)
    select new.client_id, new.unit_id, new.id, new.check_out, u.check_out_time
    from public.units u where u.id = new.unit_id
    on conflict (reservation_id) do update set
      scheduled_date = excluded.scheduled_date,
      checkout_time = excluded.checkout_time,
      status = case when public.cleaning_tasks.status = 'cancelled' then 'waiting' else public.cleaning_tasks.status end,
      updated_at = now();
  elsif new.status = 'cancelled' then
    update public.cleaning_tasks set status = 'cancelled', updated_at = now() where reservation_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists reservation_cleaning_sync on public.reservations;
create trigger reservation_cleaning_sync after insert or update of status, check_out on public.reservations
for each row execute function public.sync_cleaning_task();

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.reservations enable row level security;
alter table public.financial_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.cleaning_tasks enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.closings enable row level security;
alter table public.audit_logs enable row level security;

-- Remover políticas antigas quando o arquivo for executado novamente
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','clients','properties','units','reservations','financial_categories','expenses','cleaning_tasks','maintenance_tickets','closings','audit_logs') LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

create policy "profile self or staff read" on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_staff());
create policy "profile staff write" on public.profiles for all to authenticated
using (private.is_staff()) with check (private.is_staff());

create policy "clients scoped read" on public.clients for select to authenticated
using (private.can_access_client(id));
create policy "clients staff insert" on public.clients for insert to authenticated
with check (private.is_staff());
create policy "clients staff update" on public.clients for update to authenticated
using (private.is_staff()) with check (private.is_staff());
create policy "clients superadmin delete" on public.clients for delete to authenticated
using (private.current_role() = 'superadmin');

create policy "properties scoped read" on public.properties for select to authenticated
using (private.can_access_client(client_id));
create policy "properties staff write" on public.properties for all to authenticated
using (private.is_staff()) with check (private.is_staff());

create policy "units scoped read" on public.units for select to authenticated
using (private.can_access_client(client_id));
create policy "units staff write" on public.units for all to authenticated
using (private.is_staff()) with check (private.is_staff());

create policy "reservations scoped read" on public.reservations for select to authenticated
using (private.can_access_client(client_id));
create policy "reservations staff write" on public.reservations for all to authenticated
using (private.is_staff()) with check (private.is_staff());

create policy "categories authenticated read" on public.financial_categories for select to authenticated using (true);
create policy "categories superadmin write" on public.financial_categories for all to authenticated
using (private.current_role() = 'superadmin') with check (private.current_role() = 'superadmin');

create policy "expenses scoped read" on public.expenses for select to authenticated
using (private.can_access_client(client_id));
create policy "expenses finance write" on public.expenses for all to authenticated
using (private.current_role() in ('superadmin','admin_operacional','financeiro'))
with check (private.current_role() in ('superadmin','admin_operacional','financeiro'));

create policy "cleaning staff scoped read" on public.cleaning_tasks for select to authenticated
using (
  private.can_access_client(client_id)
  or assigned_to = (select auth.uid())
);
create policy "cleaning operations write" on public.cleaning_tasks for all to authenticated
using (private.is_staff() or assigned_to = (select auth.uid()))
with check (private.is_staff() or assigned_to = (select auth.uid()));

create policy "maintenance scoped read" on public.maintenance_tickets for select to authenticated
using (private.can_access_client(client_id) or assigned_to = (select auth.uid()));
create policy "maintenance operations write" on public.maintenance_tickets for all to authenticated
using (private.is_staff() or assigned_to = (select auth.uid()))
with check (private.is_staff() or assigned_to = (select auth.uid()));

create policy "closings scoped read" on public.closings for select to authenticated
using (private.can_access_client(client_id));
create policy "closings finance write" on public.closings for all to authenticated
using (private.current_role() in ('superadmin','financeiro'))
with check (private.current_role() in ('superadmin','financeiro'));

create policy "audit superadmin read" on public.audit_logs for select to authenticated
using (private.current_role() = 'superadmin');

-- Permissões SQL das funções REST
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Categorias iniciais
insert into public.financial_categories (name, type) values
('Limpeza','expense'),('Lavanderia','expense'),('Materiais de limpeza','expense'),
('Amenidades','expense'),('Enxoval','expense'),('Manutenção','expense'),
('Eletricista','expense'),('Encanador','expense'),('Móveis','expense'),
('Eletrodomésticos','expense'),('Utensílios','expense'),('Condomínio','expense'),
('Energia','expense'),('Água','expense'),('Internet','expense'),('Impostos','expense'),
('Taxas bancárias','expense'),('Reposição por avaria','expense'),('Marketing','expense'),
('Outras despesas','expense')
on conflict (name) do nothing;
