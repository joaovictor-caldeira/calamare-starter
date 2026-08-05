-- Execute somente depois de criar o primeiro usuário no Supabase Auth.
-- Troque o e-mail abaixo pelo e-mail real do administrador.
update public.profiles
set role = 'superadmin', full_name = 'Administrador JOCA'
where id = (select id from auth.users where email = 'joaovictor.santoscaldeira@gmail.com');

-- Dados demonstrativos editáveis (opcional)
insert into public.clients (name, email, phone, management_fee_value)
select 'Cliente demonstração', 'cliente@exemplo.com', '(82) 99999-9999', 20
where not exists (select 1 from public.clients where name = 'Cliente demonstração');

insert into public.properties (client_id, name, city, state)
select c.id, 'Portfólio Litoral', 'Maceió', 'AL'
from public.clients c
where c.name = 'Cliente demonstração'
  and not exists (select 1 from public.properties where name = 'Portfólio Litoral');

insert into public.units (client_id, property_id, name, internal_code, rooms, capacity, default_rate, cleaning_fee)
select c.id, p.id, 'Maréa — Praia do Francês', 'MAR-001', 2, 6, 450, 150
from public.clients c join public.properties p on p.client_id = c.id
where c.name = 'Cliente demonstração' and p.name = 'Portfólio Litoral'
  and not exists (select 1 from public.units where internal_code = 'MAR-001');

insert into public.units (client_id, property_id, name, internal_code, rooms, capacity, default_rate, cleaning_fee)
select c.id, p.id, 'Coralli — Japaratinga', 'COR-001', 2, 5, 420, 140
from public.clients c join public.properties p on p.client_id = c.id
where c.name = 'Cliente demonstração' and p.name = 'Portfólio Litoral'
  and not exists (select 1 from public.units where internal_code = 'COR-001');
