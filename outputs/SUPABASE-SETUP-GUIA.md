# Guia de Setup do Supabase — JMS Gestão Empresarial

**Fase 1 (esta):** criar conta, configurar projeto, conectar ao sistema.
**Fase 2 (próxima):** migrar autenticação local para Supabase Auth.
**Fase 3:** migrar dados (módulo por módulo) do localStorage para o Supabase.

---

## Passo 1 — Criar conta gratuita

1. Abra https://supabase.com no navegador.
2. Clique em **Start your project** (canto superior direito).
3. Faça login com **GitHub** (recomendado — mais rápido) ou crie com email.
4. Após o login, clique em **New project**.

---

## Passo 2 — Criar o projeto

Na tela "New project":

- **Organization:** selecione a sua (Supabase cria uma automaticamente com seu nome)
- **Name:** `jms-gestao` (ou qualquer nome — é só identificação)
- **Database Password:** clique em **Generate a password** e **SALVE essa senha** (você pode precisar para acessar o Postgres direto futuramente)
- **Region:** escolha **South America (São Paulo)** — menor latência para Brasil
- **Pricing Plan:** **Free** (deixe selecionado)

Clique em **Create new project**. O projeto leva ~2 minutos para ficar pronto.

---

## Passo 3 — Rodar o SQL Schema

1. Quando o projeto estiver pronto, no menu lateral clique em **SQL Editor** (ícone `>_`).
2. Clique em **+ New query** (canto superior direito).
3. Abra o arquivo **`supabase-schema.sql`** (na mesma pasta onde está seu `sistema-gestao.html`).
4. Copie **TODO** o conteúdo do arquivo.
5. Cole na janela do SQL Editor do Supabase.
6. Clique em **Run** (canto inferior direito, ou pressione `Ctrl+Enter`).
7. Aguarde alguns segundos. Você deve ver a mensagem **"Success. No rows returned"**.

> Se você já tinha rodado uma versão antiga do schema, rode o arquivo novamente. Ele é idempotente e adiciona a tabela `app_snapshots`, usada para migrar o banco local inteiro para a nuvem sem quebrar vínculos.

### Verificação rápida

No menu lateral, clique em **Table Editor**. Você deve ver as 21 tabelas criadas:

- `profiles`, `regions`, `companies`, `accounts`, `categories`, `cost_centers`
- `partners`, `entries`, `bids`, `contracts`, `certifications`, `garantias`
- `penalidades`, `procuradores`, `atestados`, `employees`, `assets`
- `invoices`, `products`, `app_snapshots`, `audit_log`

Se faltar alguma, role o SQL Editor para baixo e veja se houve erro em alguma seção.

---

## Passo 4 — Criar os Storage Buckets (para anexos)

Para guardar PDFs/imagens das certidões, contratos, etc. O arquivo `supabase-schema.sql` atualizado já tenta criar estes buckets automaticamente quando rodado com permissão de proprietário/service_role:

1. `certidoes` → privado
2. `contratos` → privado
3. `anexos` → privado
4. `avatars` → público

Se o SQL Editor não tiver permissão para criar buckets, crie manualmente:

1. No menu lateral, clique em **Storage**.
2. Clique em **New bucket**.
3. Crie estes 4 buckets:
   - `certidoes` → **Public bucket = OFF** (privado)
   - `contratos` → **Public bucket = OFF**
   - `anexos`    → **Public bucket = OFF**
   - `avatars`   → **Public bucket = ON** (avatares são públicos)
4. Em cada bucket, vá em **Configuration → Policies** e ative o RLS.

SQL rápido para executar separadamente, se necessário:

```sql
insert into storage.buckets (id, name, public) values
  ('certidoes', 'certidoes', false),
  ('contratos', 'contratos', false),
  ('anexos',    'anexos',    false),
  ('avatars',   'avatars',   true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "own_storage_select" on storage.objects;
drop policy if exists "own_storage_insert" on storage.objects;
drop policy if exists "own_storage_update" on storage.objects;
drop policy if exists "own_storage_delete" on storage.objects;

create policy "own_storage_select" on storage.objects for select
  using (auth.uid()::text = (storage.foldername(name))[1]);
create policy "own_storage_insert" on storage.objects for insert
  with check (auth.uid()::text = (storage.foldername(name))[1]);
create policy "own_storage_update" on storage.objects for update
  using (auth.uid()::text = (storage.foldername(name))[1])
  with check (auth.uid()::text = (storage.foldername(name))[1]);
create policy "own_storage_delete" on storage.objects for delete
  using (auth.uid()::text = (storage.foldername(name))[1]);
```

---

## Passo 5 — Pegar as credenciais

1. No menu lateral, clique em **Project Settings** (ícone de engrenagem, embaixo).
2. Clique em **API** (submenu).
3. Você vai ver dois campos importantes:
   - **Project URL** → algo tipo `https://xxxxxxxxxxxxxxxxx.supabase.co`
   - **Project API keys** → seção com a chave `anon` `public` (texto bem longo começando com `eyJ...`)
4. **Copie ambos** (deixe a aba aberta).

**⚠️ Importante sobre segurança:**
- A **anon key** é segura para usar no navegador (é "pública por design")
- **NÃO use** a `service_role` (essa NUNCA pode ir para o frontend — só backend)
- O RLS que criamos no schema impede que um usuário veja dados de outros mesmo com a anon key

---

## Passo 6 — Configurar no JMS Gestão

1. Abra o sistema (sistema-gestao.html).
2. Vá em **Sistema → Configurações → aba 🔌 Integrações**.
3. No card **"Supabase — Backend na Nuvem"**:
   - Cole a **Project URL** no campo correspondente
   - Cole a **anon key** no campo "Anon / Public Key"
4. Clique em **💾 Salvar**.
5. Clique em **🔌 Testar conexão**.

### Resultados esperados

- ✅ **"Conexão Supabase OK!"** → tudo certo. Pode passar para a Fase 2.
- ⚠️ **"Conectou mas a tabela 'companies' NÃO foi criada"** → volte ao Passo 3 e rode o SQL.
- ❌ **"Falha: ..."** → confira URL e anon key (Passo 5).

---

## Próximas fases (não rodam ainda)

### Fase 2 — Autenticação

Trocar o login local (que usa `localStorage` + SHA-256) por **Supabase Auth**:
- Email + senha verificada server-side
- Recuperação de senha por email (Supabase envia automático)
- Login com Google/GitHub (opcional)
- Sessão JWT com refresh token

### Fase 3 — Migração de dados

O sistema já tem dois caminhos de migração:

1. **Snapshot completo** em `app_snapshots`, usado como backup seguro e restauração integral.
2. **Tabelas reais por registro**, usando `local_id`, `local_updated_at` e `raw_data` para preservar os IDs atuais do sistema e permitir merge por item.

Depois de rodar o `supabase-schema.sql` atualizado, use em **Sistema → Configurações → Integrações**:

- **Migrar dados locais**: salva o snapshot completo.
- **Enviar tabelas reais**: grava registros individualmente em `companies`, `accounts`, `entries`, etc.
- **Restaurar tabelas reais**: baixa registros por `local_id` e mescla usando `updatedAt`.

Ordem recomendada para evoluir tela por tela até usar tabelas reais diretamente:

1. **Empresas** (menor risco)
2. **Parceiros, Contas, Categorias** (cadastros básicos)
3. **Licitações & Contratos**
4. **Certidões + upload de PDFs no Storage**
5. **Lançamentos financeiros**
6. **Funcionários e Patrimônio**

Cada módulo pode ser migrado independente, com fallback para localStorage caso o Supabase fique offline. Enquanto a migração fina evolui, o snapshot completo continua como rede de segurança.

### Fase 4 — Multi-usuário

- Convite de membros da equipe (eles criam conta e você libera empresas específicas)
- Permissões granulares (Nivel 1 vê tudo, Nivel 2 só dashboard, etc.)
- Audit log automático (quem criou/alterou cada registro)

---

## Resumo do que você tem agora (após Fase 1)

- Conta Supabase grátis ativa
- Projeto com 20 tabelas + RLS + trigger de profile
- Storage configurado para anexos
- Sistema conectado (botão "Testar conexão" funcionando)
- Credenciais salvas em `localStorage` na chave `jms_supabase_config`

**Nada foi migrado ainda** — seu sistema continua usando localStorage normalmente. O Supabase está pronto para receber dados quando você quiser avançar para a Fase 2/3.

---

## Limites do plano Free (referência)

- **500 MB** de banco PostgreSQL (cabem milhões de registros pequenos)
- **1 GB** de Storage (cabem ~500 PDFs de certidão)
- **5 GB** de banda de saída por mês
- **50.000 usuários ativos** por mês (auth)
- **2 projetos** simultâneos
- Projeto pausa se ficar **7 dias sem uso** (basta acessar para despausar)

Para um sistema de uso interno de empresa pequena, o plano free dura indefinidamente.
