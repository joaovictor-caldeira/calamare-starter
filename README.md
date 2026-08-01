# CALAMARE PMS — Starter Kit

Este projeto é um **MVP funcional** para iniciar o sistema de gerenciamento de hospedagens da CALAMARE.

## O que já está funcionando

- Login com Supabase Auth;
- Sessão protegida por cookies;
- Usuários e perfis básicos;
- Clientes/proprietários;
- Imóveis e unidades;
- Reservas diretas;
- Bloqueio de reservas sobrepostas na aplicação e no PostgreSQL;
- Calendário de ocupação para 14 dias;
- Despesas por unidade;
- Dashboard financeiro inicial;
- Tarefa de limpeza criada automaticamente ao confirmar uma reserva;
- Controle de acesso com RLS no banco;
- Manifesto e service worker para instalação como PWA.

## Começo rápido

1. Leia `MANUAL_PASSO_A_PASSO.md`.
2. Instale VS Code, Node.js LTS e Git.
3. Crie um projeto no Supabase.
4. Execute `supabase/schema.sql` no SQL Editor.
5. Crie o primeiro usuário no painel Authentication.
6. Edite e execute `supabase/seed.sql`.
7. Copie `.env.example` para `.env.local` e coloque as chaves do seu projeto.
8. No terminal, execute:

```bash
npm install
npm run dev
```

9. Abra `http://localhost:3000`.

## Segurança

Nunca envie `.env.local` para o GitHub. A `SUPABASE_SERVICE_ROLE_KEY` nunca pode aparecer em arquivo usado no navegador ou em variável com prefixo `NEXT_PUBLIC_`.
