# MANUAL COMPLETO — COMO CONSTRUIR O SISTEMA CALAMARE

## Para quem é este manual

Este guia foi escrito para uma pessoa que está começando do zero. Você não precisa saber programar para executar os primeiros passos, mas precisa seguir a ordem exata e testar cada etapa antes de avançar.

O objetivo não é tentar construir todas as 25 áreas do sistema em um único dia. O caminho correto é criar uma base pequena, confiável e funcional; depois acrescentar os módulos em ciclos.

---

# PARTE 1 — O QUE VOCÊ VAI USAR

## Programas e serviços

1. **Visual Studio Code:** programa no qual os arquivos de código serão abertos e editados.
2. **Node.js LTS:** permite executar o projeto Next.js no computador.
3. **Git:** registra versões do código e permite enviá-lo ao GitHub.
4. **GitHub:** guarda uma cópia do projeto na internet.
5. **Supabase:** banco PostgreSQL, login, regras de segurança e arquivos.
6. **Vercel:** publica o sistema na internet.
7. **Google Cloud:** será usado posteriormente para Google Agenda.

## Arquitetura escolhida

- Interface: Next.js + React + TypeScript;
- Banco de dados: PostgreSQL no Supabase;
- Login e sessão: Supabase Auth;
- Segurança por registro: Row Level Security;
- Hospedagem: Vercel;
- Aplicativo instalável: PWA;
- Integrações oficiais: APIs e webhooks no servidor.

---

# PARTE 2 — INSTALAÇÃO NO WINDOWS

## 2.1 Instalar o Visual Studio Code

1. Entre no site oficial do VS Code.
2. Baixe a opção **User Installer para Windows 64 bits**.
3. Abra o instalador.
4. Aceite o contrato.
5. Marque as opções para adicionar ao PATH, criar atalho e abrir pastas com o VS Code.
6. Conclua a instalação.

Extensões recomendadas no VS Code:

- ESLint;
- Prettier - Code formatter;
- Portuguese (Brazil) Language Pack, opcional;
- GitHub Pull Requests and Issues, opcional.

Para instalar uma extensão, clique no ícone de quatro quadrados na lateral esquerda e pesquise pelo nome.

## 2.2 Instalar Node.js

1. Entre no site oficial do Node.js.
2. Escolha a versão marcada como **LTS**, não a versão Current.
3. Baixe o instalador `.msi` para Windows.
4. Continue com as opções padrão.
5. Feche e abra novamente o VS Code.

Teste no VS Code:

1. Clique em **Terminal > Novo Terminal**.
2. Digite:

```bash
node -v
npm -v
```

Os dois comandos devem mostrar números de versão.

## 2.3 Instalar Git

1. Baixe Git for Windows no site oficial.
2. Execute o instalador.
3. Nas telas de opções, mantenha os padrões.
4. Quando aparecer a escolha do editor, você pode selecionar Visual Studio Code.
5. Finalize e reinicie o VS Code.

Teste:

```bash
git --version
```

## 2.4 Criar contas

Crie contas em:

- GitHub;
- Supabase;
- Vercel.

Use um e-mail da empresa quando possível. Ative autenticação em dois fatores nas três contas.

---

# PARTE 3 — ABRIR O STARTER KIT

## 3.1 Descompactar

1. Extraia o arquivo ZIP para uma pasta fácil de encontrar, por exemplo:

```text
C:\Projetos\calamare-pms
```

Evite Área de Trabalho, Downloads e pastas sincronizadas com OneDrive no início.

## 3.2 Abrir no VS Code

1. Abra o VS Code.
2. Clique em **Arquivo > Abrir Pasta**.
3. Escolha `calamare-pms`.
4. Confirme que você vê `package.json`, `src`, `supabase` e `README.md`.

## 3.3 Instalar dependências

Abra o terminal e execute:

```bash
npm install
```

A pasta `node_modules` será criada. Ela é grande e não deve ser enviada ao GitHub.

---

# PARTE 4 — CRIAR O PROJETO NO SUPABASE

## 4.1 Novo projeto

1. Abra o painel do Supabase.
2. Clique em **New project**.
3. Escolha ou crie uma organização.
4. Nome: `calamare-pms`.
5. Gere uma senha forte para o banco e guarde em um gerenciador de senhas.
6. Escolha a região mais próxima disponível.
7. Crie o projeto e aguarde o banco ficar pronto.

## 4.2 Criar as tabelas

1. No menu lateral do Supabase, abra **SQL Editor**.
2. Clique em **New query**.
3. No VS Code, abra `supabase/schema.sql`.
4. Copie todo o conteúdo.
5. Cole no SQL Editor.
6. Clique em **Run**.
7. O resultado deve indicar sucesso.

O arquivo cria as tabelas principais, regras de segurança, categorias financeiras e a automação que gera uma limpeza quando uma reserva é confirmada.

## 4.3 Criar o primeiro usuário

1. Abra **Authentication > Users**.
2. Clique em **Add user**.
3. Escolha **Create new user**.
4. Informe seu e-mail e uma senha forte.
5. Marque o e-mail como confirmado, caso a opção apareça.
6. Crie o usuário.

## 4.4 Transformar o primeiro usuário em superadministrador

1. Abra `supabase/seed.sql` no VS Code.
2. Troque `SEU-EMAIL@EXEMPLO.COM` pelo mesmo e-mail criado no passo anterior.
3. Copie todo o arquivo.
4. Cole em uma nova consulta do SQL Editor.
5. Clique em **Run**.

O arquivo também cria, opcionalmente, um cliente de demonstração e as unidades Maréa e Coralli. Todos os dados podem ser alterados ou excluídos.

## 4.5 Criar o bucket de documentos

1. Abra `supabase/storage.sql`.
2. Copie o conteúdo.
3. Execute no SQL Editor.

O bucket será privado. No MVP, apenas usuários administrativos podem ler e enviar arquivos.

---

# PARTE 5 — CONECTAR O CÓDIGO AO SUPABASE

## 5.1 Encontrar as chaves

No Supabase:

1. Abra **Project Settings**.
2. Entre em **API Keys** ou na área de conexão do projeto.
3. Copie:
   - URL do projeto;
   - chave publicável/publishable key.

A chave pública pode ser usada pelo navegador porque a proteção real é feita pelas políticas RLS. A chave de serviço é secreta e deve existir somente no servidor.

## 5.2 Criar `.env.local`

1. No VS Code, localize `.env.example`.
2. Crie uma cópia chamada `.env.local`.
3. Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seuprojeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

No início, você pode deixar `SUPABASE_SERVICE_ROLE_KEY` sem preencher. Ela será necessária somente em tarefas administrativas do servidor e sincronizações automáticas.

Nunca envie `.env.local` por WhatsApp, e-mail ou GitHub.

---

# PARTE 6 — EXECUTAR NO COMPUTADOR

No terminal do VS Code:

```bash
npm run dev
```

Abra no navegador:

```text
http://localhost:3000
```

Entre com o usuário criado no Supabase.

## Ordem de teste

1. Abra Clientes e cadastre um proprietário.
2. Abra Imóveis e unidades.
3. Cadastre um imóvel vinculado ao cliente.
4. Cadastre uma unidade vinculada ao imóvel.
5. Abra Reservas e cadastre uma reserva.
6. Abra Calendário e confirme que o período ficou ocupado.
7. Tente cadastrar outra reserva sobreposta; o sistema deve impedir.
8. Abra Financeiro e cadastre uma despesa.
9. Volte ao Dashboard e confira os totais.
10. No Supabase, abra `Table Editor > cleaning_tasks`; deve existir uma tarefa criada para o check-out.

---

# PARTE 7 — ENTENDER AS PASTAS

```text
src/app                 páginas do sistema
src/actions             ações que salvam dados
src/components          componentes visuais reutilizados
src/lib/supabase        conexão segura com Supabase
src/app/globals.css     identidade visual
supabase/schema.sql     banco e regras de segurança
supabase/seed.sql       dados iniciais
public                  ícones, manifesto e service worker
```

Não altere muitos arquivos ao mesmo tempo. Faça uma mudança, salve, teste e registre no Git.

---

# PARTE 8 — SALVAR NO GITHUB

## 8.1 Criar repositório

1. No GitHub, clique em **New repository**.
2. Nome: `calamare-pms`.
3. Escolha **Private**.
4. Não adicione README nem `.gitignore`, porque já existem no projeto.
5. Crie o repositório.

## 8.2 Configurar seu nome no Git

No terminal:

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

## 8.3 Primeiro envio

Use os comandos mostrados pelo GitHub. Normalmente serão semelhantes a:

```bash
git init
git add .
git commit -m "Cria MVP inicial da CALAMARE"
git branch -M main
git remote add origin ENDERECO_DO_REPOSITORIO
git push -u origin main
```

Confira no GitHub se `.env.local` não apareceu. O arquivo já está ignorado pelo `.gitignore`.

## Rotina de salvamento

Depois de uma alteração que funcionou:

```bash
git add .
git commit -m "Descreva o que foi alterado"
git push
```

---

# PARTE 9 — PUBLICAR NA VERCEL

1. Entre na Vercel com sua conta do GitHub.
2. Clique em **Add New > Project**.
3. Importe `calamare-pms`.
4. A Vercel reconhecerá Next.js.
5. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
   - `NEXT_PUBLIC_SITE_URL` com o domínio publicado.
6. Clique em **Deploy**.

Depois da publicação:

1. Copie o domínio da Vercel.
2. No Supabase, abra as configurações de autenticação e ajuste a Site URL.
3. Adicione o domínio de produção e a rota `/auth/callback` às URLs permitidas.
4. Faça um novo deploy se necessário.

---

# PARTE 10 — CRONOGRAMA CORRETO DE DESENVOLVIMENTO

## Ciclo 1 — Base funcional

Já incluído no starter:

- autenticação;
- clientes;
- imóveis;
- unidades;
- reservas diretas;
- calendário inicial;
- despesas;
- dashboard;
- tarefa automática de limpeza;
- RLS;
- PWA inicial.

Critério para avançar: todos os testes da Parte 6 precisam funcionar.

## Ciclo 2 — CRUD completo

Adicionar, em cada módulo:

- abrir detalhes;
- editar;
- desativar;
- excluir somente quando permitido;
- histórico de alterações;
- filtros e paginação.

Nunca use exclusão física para reservas e lançamentos financeiros depois que o sistema estiver em produção. Prefira cancelamento ou inativação.

## Ciclo 3 — Financeiro e fechamento

Criar telas para:

- receitas;
- conciliação de recebimentos;
- despesas recorrentes;
- fechamento por ciclo configurável;
- comissão da administradora;
- repasse;
- bloqueio de fechamento aprovado;
- comprovante do repasse.

Fórmula inicial:

```text
Receita bruta
- comissão dos canais
- descontos e cancelamentos
- despesas descontáveis
- comissão da administradora
- reserva de emergência
= líquido do proprietário
```

Os cálculos devem ocorrer no servidor e ser conferidos por testes automáticos.

## Ciclo 4 — Relatórios

Criar uma página de relatório com filtros por cliente, unidade e período. Gere primeiro HTML imprimível; depois acrescente PDF e Excel.

Relatórios mínimos:

- resumo por unidade;
- consolidado por proprietário;
- receitas;
- despesas;
- ocupação;
- repasses.

Para evitar divergência, o relatório deve usar os mesmos registros do fechamento, e não recalcular números de uma maneira diferente.

## Ciclo 5 — Limpeza, manutenção e inventário

Limpeza:

- checklist por unidade;
- responsável;
- fotos antes e depois;
- materiais para reposição;
- custo de limpeza e lavanderia.

Manutenção:

- chamado;
- fotos;
- orçamento;
- aprovação;
- bloqueio da unidade;
- despesa automática ao concluir.

Inventário:

- item;
- quantidade;
- condição;
- valor;
- nota fiscal;
- garantia;
- alerta de reposição.

## Ciclo 6 — Portal do proprietário

O usuário com perfil `proprietario` deve receber um `client_id` no cadastro. As políticas do banco já foram estruturadas para limitar a leitura ao cliente vinculado.

O proprietário deve visualizar:

- suas unidades;
- reservas autorizadas;
- ocupação;
- receitas e despesas;
- relatórios;
- fechamentos e comprovantes.

Não mostre códigos de fechadura, documentos de outros hóspedes, senhas, dados bancários internos ou observações operacionais.

## Ciclo 7 — Pré-check-in e hóspede

Crie um token aleatório por reserva e uma página pública com prazo de validade. O hóspede poderá enviar dados e documentos. Documentos devem ficar em bucket privado.

Regras importantes:

- nunca use apenas o ID da reserva na URL;
- defina validade do link;
- limite tentativas;
- registre consentimento;
- permita anonimização conforme a política de retenção;
- não envie documento em anexo por WhatsApp.

## Ciclo 8 — iCal inicial

A primeira integração com Airbnb e Booking deve usar calendários iCal apenas para disponibilidade. O iCal é útil como etapa inicial, mas não substitui uma integração oficial de preços, mensagens, pagamentos e alterações completas.

Crie uma tabela de integrações contendo:

- unidade;
- canal;
- URL de importação;
- token da URL de exportação;
- última sincronização;
- último erro;
- status.

Para cada evento importado, salve o UID externo. Dessa forma, a sincronização atualiza o mesmo evento em vez de duplicá-lo.

Medidas obrigatórias no importador:

- aceitar somente HTTPS;
- bloquear endereços internos para evitar SSRF;
- limitar tamanho do arquivo;
- usar tempo máximo de resposta;
- validar datas;
- registrar logs;
- não apagar reservas manuais;
- usar transação no banco;
- identificar cancelamentos/removidos.

Execute a sincronização em fila ou tarefa agendada no servidor, nunca quando o usuário abre a página.

## Ciclo 9 — Google Agenda

1. Crie um projeto no Google Cloud.
2. Ative a Google Calendar API.
3. Configure a tela de consentimento OAuth.
4. Crie credenciais OAuth para aplicativo web.
5. Adicione os domínios e URLs de redirecionamento.
6. Solicite apenas os escopos realmente necessários.
7. Salve access token e refresh token criptografados no servidor.
8. Ao criar uma reserva, crie eventos de check-in e check-out.
9. Salve o `google_event_id` no banco.
10. Ao alterar ou cancelar, atualize ou exclua o evento pelo ID salvo.

Nunca crie um novo evento sem verificar se já existe um ID relacionado. Isso evita duplicidade.

## Ciclo 10 — Notificações

Implemente primeiro notificações internas e e-mail. Depois, push e WhatsApp.

Para push web:

- solicitar permissão somente depois de explicar o benefício;
- salvar a assinatura por dispositivo;
- permitir que o usuário desative categorias;
- remover assinaturas inválidas.

Para WhatsApp em produção, use a API oficial do WhatsApp Business ou um provedor autorizado. Não automatize WhatsApp Web com robôs não oficiais.

## Ciclo 11 — Integrações oficiais com os canais

Esta etapa não é apenas “colocar uma URL de API”. Airbnb e Booking.com controlam acesso, permissões e processos de parceria/certificação.

Antes de escrever a integração oficial:

1. Formalize a empresa e o produto;
2. Tenha política de privacidade e termos de uso;
3. Tenha domínio e ambiente de produção;
4. Implemente logs, fila, retentativas e monitoramento;
5. Solicite participação como parceiro de conectividade/software;
6. Use ambiente de testes fornecido pela plataforma;
7. Passe pela certificação exigida;
8. Somente depois libere para unidades reais.

A arquitetura deve separar cada canal em um adaptador:

```text
ChannelAdapter
  importarReservas()
  atualizarDisponibilidade()
  atualizarTarifas()
  receberCancelamento()
  testarConexao()
```

Assim, Airbnb, Booking e futuros canais não ficam misturados no restante do sistema.

## Ciclo 12 — Produção profissional

Antes de usar com clientes reais:

- domínio próprio;
- e-mails transacionais;
- backup testado;
- ambiente de homologação separado;
- monitoramento de erros;
- logs sem dados sensíveis;
- política de retenção;
- termos e privacidade;
- contrato com operadores e fornecedores;
- testes de restauração;
- revisão de RLS;
- teste de permissões por perfil;
- plano para incidentes;
- treinamento dos usuários.

---

# PARTE 11 — COMO PEDIR ALTERAÇÕES PARA UMA IA SEM QUEBRAR O PROJETO

Use solicitações pequenas e específicas. Exemplo:

```text
No projeto Next.js existente, crie a tela de edição de clientes. Não altere o banco. Use a tabela clients e as funções atuais de Supabase. Mantenha o CSS existente. Antes de finalizar, valide campos obrigatórios, trate erros e execute npm run build.
```

Depois de cada alteração:

```bash
npm run lint
npm run build
```

Somente faça commit quando os dois comandos terminarem sem erro.

Evite pedidos como “crie todo o sistema agora”. Eles tendem a gerar código inconsistente, regras conflitantes e telas que parecem funcionar sem salvar dados corretamente.

---

# PARTE 12 — ERROS COMUNS

## `npm` não é reconhecido

Node.js não foi instalado corretamente ou o terminal foi aberto antes da instalação. Reinicie o VS Code; se continuar, reinstale o Node.js LTS.

## Tela branca ou erro de variável

Confirme que `.env.local` existe e que os nomes são exatamente:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Pare e reinicie o servidor depois de editar variáveis:

```bash
Ctrl + C
npm run dev
```

## Erro de RLS ao salvar

Verifique:

1. usuário está logado;
2. perfil existe em `profiles`;
3. o primeiro usuário foi transformado em `superadmin`;
4. `schema.sql` foi executado sem erros.

## O login volta para a tela de login

Confira a URL e chave do Supabase, as configurações de autenticação e se o usuário está confirmado.

## Erro ao executar novamente o SQL

O arquivo foi escrito para ser parcialmente repetível, mas mudanças manuais no banco podem gerar conflito. Em projeto de teste, o caminho mais simples pode ser criar outro projeto Supabase e executar o SQL limpo. Em produção, use migrações versionadas; não apague o banco.

---

# PARTE 13 — CHECKLIST DO RESULTADO FINAL

O produto só deve ser considerado pronto quando:

- todos os perfis foram testados;
- proprietário nunca vê dados de outro proprietário;
- equipe de limpeza não vê financeiro;
- prestador não vê outras manutenções;
- reservas sobrepostas são bloqueadas no banco, não apenas na tela;
- sincronizações são idempotentes;
- fechamento aprovado não pode ser alterado livremente;
- arquivos privados exigem autorização;
- logs não armazenam senhas ou documentos;
- backups foram restaurados em teste;
- relatórios conferem com o fechamento;
- alterações e cancelamentos atualizam calendários externos;
- alertas não são duplicados;
- o sistema funciona no computador e celular;
- existe suporte e processo de correção de incidentes.

---

# PARTE 14 — PRÓXIMA ALTERAÇÃO RECOMENDADA

Depois que este starter estiver funcionando, a próxima entrega deve ser:

1. tela de detalhes e edição de clientes;
2. tela de detalhes e edição de unidades;
3. alteração e cancelamento de reservas;
4. bloqueios de proprietário/manutenção;
5. edição segura de bloqueios de proprietário e manutenção;
6. filtros por período, cliente e unidade.

A verificação de sobreposição já existe no PostgreSQL do starter e também é verificada pela ação de cadastro.

Essa ordem fortalece o núcleo do sistema antes de adicionar integrações externas.
