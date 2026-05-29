-- ============================================================================
-- JMS GESTAO EMPRESARIAL — DESBLOQUEIO SUPABASE FASE 3
-- Rode este arquivo inteiro no Supabase SQL Editor.
--
-- Objetivo:
-- 1. Criar buckets de Storage.
-- 2. Adicionar colunas de sincronizacao por registro nas tabelas existentes.
-- 3. Criar indices por (owner_id, local_id).
--
-- Seguro para rodar mais de uma vez: usa "if not exists" e "on conflict".
-- ============================================================================

-- ============================================================================
-- 1. STORAGE BUCKETS
-- ============================================================================
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

create policy "own_storage_select" on storage.objects
  for select
  using (auth.uid()::text = (storage.foldername(name))[1]);

create policy "own_storage_insert" on storage.objects
  for insert
  with check (auth.uid()::text = (storage.foldername(name))[1]);

create policy "own_storage_update" on storage.objects
  for update
  using (auth.uid()::text = (storage.foldername(name))[1])
  with check (auth.uid()::text = (storage.foldername(name))[1]);

create policy "own_storage_delete" on storage.objects
  for delete
  using (auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- 2. COLUNAS GENERICAS PARA SYNC POR REGISTRO
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'regions',
    'companies',
    'accounts',
    'categories',
    'cost_centers',
    'partners',
    'entries',
    'bids',
    'contracts',
    'certifications',
    'assets',
    'invoices',
    'products'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I add column if not exists local_id text', t);
    execute format('alter table public.%I add column if not exists local_company_id text', t);
    execute format('alter table public.%I add column if not exists local_updated_at timestamptz', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz default now()', t);
    execute format('alter table public.%I add column if not exists raw_data jsonb default ''{}''::jsonb', t);
    execute format(
      'create unique index if not exists %I on public.%I(owner_id, local_id)',
      'idx_' || t || '_owner_local_id',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- 3. VINCULOS LOCAIS ENTRE REGISTROS
-- ============================================================================
alter table public.entries add column if not exists local_account_id text;
alter table public.entries add column if not exists local_category_id text;
alter table public.entries add column if not exists local_partner_id text;
alter table public.entries add column if not exists local_cost_center_id text;

alter table public.contracts add column if not exists local_bid_id text;
alter table public.contracts add column if not exists local_partner_id text;

-- ============================================================================
-- 4. COLUNAS COMPLEMENTARES USADAS PELO FRONTEND
-- ============================================================================
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
-- 5. VERIFICACAO RAPIDA
-- ============================================================================
select
  'fase3_desbloqueio_ok' as status,
  now() as executed_at;
