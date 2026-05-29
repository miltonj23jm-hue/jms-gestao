-- ============================================================================
-- JMS GESTÃO EMPRESARIAL — SCHEMA SUPABASE
-- Versão: 1.0 (Fase 1 — Setup inicial)
-- Como usar:
--   1. Crie projeto novo em https://supabase.com
--   2. Abra SQL Editor (menu lateral)
--   3. Cole TODO este arquivo e clique "Run"
--   4. Verifique em Table Editor que as 16 tabelas foram criadas
-- ============================================================================

-- Garantir que extensões necessárias estejam ativas
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PERFIS DE USUÁRIO (estende auth.users do Supabase Auth)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  username text unique,
  email text,
  role text default 'master' check (role in ('master','admin','nivel1','nivel2')),
  avatar_url text,
  preferences jsonb default '{}',
  assigned_company_ids uuid[],
  assigned_region_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 2. REGIÕES (agrupamento geográfico de empresas)
-- ============================================================================
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 3. EMPRESAS
-- ============================================================================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  region_id uuid references public.regions(id) on delete set null,
  name text not null,
  cnpj text,
  razao_social text,
  fantasia text,
  inscricao_estadual text,
  inscricao_municipal text,
  address text,
  city text,
  state text,
  cep text,
  phone text,
  email text,
  icon text default '🏢',
  logo_url text,
  representante jsonb,  -- {nome, cpf, cargo}
  config jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 4. CONTAS BANCÁRIAS
-- ============================================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  bank text,
  agency text,
  number text,
  type text check (type in ('corrente','poupanca','investimento','caixa','cartao','outro')),
  initial_balance numeric default 0,
  created_at timestamptz default now()
);

-- ============================================================================
-- 5. CATEGORIAS (receita / despesa)
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('receita','despesa')),
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================================
-- 6. CENTRO DE CUSTOS
-- ============================================================================
create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 7. PARCEIROS (fornecedores / clientes)
-- ============================================================================
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  fantasy text,
  document text,  -- CNPJ ou CPF
  type text,      -- fornecedor, cliente, ambos
  email text,
  phone text,
  address text,
  city text,
  state text,
  cep text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 8. LANÇAMENTOS FINANCEIROS
-- ============================================================================
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  description text,
  type text check (type in ('receita','despesa','transferencia')),
  amount numeric not null,
  date date not null,
  due_date date,
  paid boolean default false,
  paid_at date,
  source text default 'manual', -- manual, ofx, csv
  recurring_id uuid,
  attachments jsonb default '[]',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================================
-- 9. LICITAÇÕES (BIDS) — base do organograma Lei 14.133/2021
-- ============================================================================
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  numero text,
  objeto text,
  orgao text,
  modalidade text,        -- pregao_eletronico, dispensa, credenciamento, etc.
  categoria text,          -- Licitação, Contratação Direta, Procedimentos Auxiliares, Procedimentos Especiais
  modo_disputa text,       -- aberto, fechado, aberto_fechado
  criterio text,           -- menor_preco, maior_desconto, etc.
  fase text,               -- planejamento, edital, julgamento, habilitacao, recursos, contratacao
  data_sessao date,
  prazo_proposta date,
  valor_estimado numeric default 0,
  valor_proposta numeric default 0,
  status text default 'cadastrado',
  documentos_exigidos text,
  drive_link text,
  observacoes text,
  numero_controle_pncp text,
  importado_pncp boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 10. CONTRATOS
-- ============================================================================
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  bid_id uuid references public.bids(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  numero text,
  objeto text,
  orgao text,
  tipo text,
  data_inicio date,
  data_fim date,
  data_fim_original date,
  valor_total numeric default 0,
  valor_original numeric default 0,
  status text,             -- vigente, encerrado, rescindido, emergencial
  garantia_exigida boolean default false,
  aditivos jsonb default '[]',
  notes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 11. CERTIDÕES (Documentos com validade)
-- ============================================================================
create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  nome text,
  tipo text,
  numero text,
  orgao_emissor text,
  emissao date,
  validade date,
  drive_link text,
  anexo_url text,
  arquivo_path text,       -- path no Supabase Storage bucket 'certidoes'
  arquivo_meta jsonb,      -- {name, size, type}
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 12. GARANTIAS CONTRATUAIS
-- ============================================================================
create table if not exists public.garantias (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  contrato_id uuid references public.contracts(id) on delete set null,
  tipo text,               -- seguro_garantia, fianca_bancaria, caucao
  seguradora text,
  numero_apolice text,
  valor_segurado numeric default 0,
  data_emissao date,
  data_vencimento date,
  arquivo_path text,
  observacoes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 13. PENALIDADES / OCORRÊNCIAS
-- ============================================================================
create table if not exists public.penalidades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  data date,
  tipo text,
  orgao text,
  descricao text,
  valor numeric,
  status text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 14. PROCURADORES / RESPONSÁVEIS
-- ============================================================================
create table if not exists public.procuradores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  nome text not null,
  cpf text,
  cargo text,
  validade date,
  arquivo_path text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 15. ATESTADOS DE CAPACIDADE TÉCNICA
-- ============================================================================
create table if not exists public.atestados (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  cliente text,
  objeto text,
  data_emissao date,
  valor numeric,
  arquivo_path text,
  observacoes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 16. FUNCIONÁRIOS (RH)
-- ============================================================================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  cpf text,
  cargo text,
  admissao date,
  demissao date,
  salario numeric,
  status text default 'ativo',
  data jsonb default '{}',  -- dados extras flexíveis
  emprestimos jsonb default '[]',
  created_at timestamptz default now()
);

-- ============================================================================
-- 17. BENS PATRIMONIAIS
-- ============================================================================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  type text,
  acquisition_date date,
  acquisition_value numeric,
  current_value numeric,
  depreciation_rate numeric,
  vehicle jsonb,           -- {placa, renavam, codigoFipe, marca, modelo, ano}
  notes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 18. NOTAS FISCAIS
-- ============================================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  numero text,
  serie text,
  tipo text,                -- entrada, saida
  data_emissao date,
  valor_total numeric,
  valor_iss numeric,
  valor_irrf numeric,
  status text,
  xml_path text,
  pdf_path text,
  data jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================================
-- 19. PRODUTOS / ESTOQUE
-- ============================================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  sku text,
  unit text default 'un',
  qty_stock numeric default 0,
  qty_min numeric default 0,
  cost_price numeric,
  sale_price numeric,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 20. SNAPSHOTS DO APLICATIVO (migração segura localStorage -> nuvem)
-- ============================================================================
create table if not exists public.app_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text,
  app_version text default '1.0',
  data jsonb not null default '{}',
  data_hash text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_app_snapshots_owner_created on public.app_snapshots(owner_id, created_at desc);

-- ============================================================================
-- 21. AUDIT LOG (registro de ações)
-- ============================================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  user_name text,
  action text,
  description text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================================================
-- ÍNDICES (queries comuns)
-- ============================================================================
create index if not exists idx_companies_owner on public.companies(owner_id);
create index if not exists idx_bids_owner_company on public.bids(owner_id, company_id);
create index if not exists idx_bids_status on public.bids(status);
create index if not exists idx_contracts_owner on public.contracts(owner_id, company_id);
create index if not exists idx_certifications_validade on public.certifications(company_id, validade);
create index if not exists idx_entries_company_date on public.entries(company_id, date);
create index if not exists idx_partners_company on public.partners(company_id);
create index if not exists idx_garantias_vencimento on public.garantias(company_id, data_vencimento);

-- ============================================================================
-- MIGRAÇÃO FASE 3 — suporte a sync por registro mantendo IDs locais do sistema
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'regions','companies','accounts','categories','cost_centers',
    'partners','entries','bids','contracts','certifications','assets',
    'invoices','products'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I add column if not exists local_id text', t);
    execute format('alter table public.%I add column if not exists local_company_id text', t);
    execute format('alter table public.%I add column if not exists local_updated_at timestamptz', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz default now()', t);
    execute format('alter table public.%I add column if not exists raw_data jsonb default ''{}''::jsonb', t);
    execute format('create unique index if not exists %I on public.%I(owner_id, local_id)', 'idx_'||t||'_owner_local_id', t);
  end loop;
end $$;

alter table public.entries add column if not exists local_account_id text;
alter table public.entries add column if not exists local_category_id text;
alter table public.entries add column if not exists local_partner_id text;
alter table public.entries add column if not exists local_cost_center_id text;
alter table public.contracts add column if not exists local_bid_id text;
alter table public.contracts add column if not exists local_partner_id text;
alter table public.assets add column if not exists group_id text;
alter table public.assets add column if not exists purchase_date date;
alter table public.assets add column if not exists purchase_value numeric;
alter table public.assets add column if not exists status text default 'ativo';
alter table public.assets add column if not exists location text;
alter table public.invoices add column if not exists issue_date date;
alter table public.invoices add column if not exists amount numeric default 0;
alter table public.invoices add column if not exists xml_url text;
alter table public.invoices add column if not exists pdf_url text;
alter table public.invoices add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists price numeric default 0;
alter table public.products add column if not exists cost numeric default 0;
alter table public.products add column if not exists stock numeric default 0;
alter table public.products add column if not exists min_stock numeric default 0;
alter table public.products add column if not exists active boolean default true;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — cada usuário só vê seus próprios dados
-- ============================================================================
-- Função genérica de policy: dono pode tudo
-- Habilita RLS em todas as tabelas e cria policy "owner_id = auth.uid()"

do $$
declare
  t text;
  tables text[] := array[
    'profiles','regions','companies','accounts','categories','cost_centers',
    'partners','entries','bids','contracts','certifications','garantias',
    'penalidades','procuradores','atestados','employees','assets',
    'invoices','products','app_snapshots','audit_log'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    -- Remove policies antigas (idempotente)
    execute format('drop policy if exists "own_select" on public.%I', t);
    execute format('drop policy if exists "own_insert" on public.%I', t);
    execute format('drop policy if exists "own_update" on public.%I', t);
    execute format('drop policy if exists "own_delete" on public.%I', t);
    -- Cria policies novas
    if t = 'profiles' then
      execute format('create policy "own_select" on public.%I for select using (auth.uid() = id)', t);
      execute format('create policy "own_insert" on public.%I for insert with check (auth.uid() = id)', t);
      execute format('create policy "own_update" on public.%I for update using (auth.uid() = id) with check (auth.uid() = id)', t);
      execute format('create policy "own_delete" on public.%I for delete using (auth.uid() = id)', t);
    else
      execute format('create policy "own_select" on public.%I for select using (auth.uid() = owner_id)', t);
      execute format('create policy "own_insert" on public.%I for insert with check (auth.uid() = owner_id)', t);
      execute format('create policy "own_update" on public.%I for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id)', t);
      execute format('create policy "own_delete" on public.%I for delete using (auth.uid() = owner_id)', t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- TRIGGER: auto-cria profile quando usuário se cadastra via Supabase Auth
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- STORAGE BUCKETS — para anexos (PDFs, imagens)
-- Exige rodar este arquivo com permissões de proprietário/service_role no SQL Editor.
-- ============================================================================
insert into storage.buckets (id, name, public) values
  ('certidoes',  'certidoes',  false),
  ('contratos',  'contratos',  false),
  ('anexos',     'anexos',     false),
  ('avatars',    'avatars',    true)
on conflict (id) do update set public = excluded.public;

-- Policies de Storage (cada usuário acessa só arquivos em pasta com seu auth.uid()).
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

-- ============================================================================
-- FIM DO SCHEMA — 21 tabelas + índices + RLS + trigger de profile
-- Resultado esperado: "Success. No rows returned"
-- Verifique em "Table Editor" se as tabelas aparecem
-- ============================================================================
