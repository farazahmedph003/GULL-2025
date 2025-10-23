-- Projectless model: custom users and system settings
-- Migration: 007 - App Users, System Settings, Projectless Transactions

-- ============================
-- APP USERS (custom auth)
-- ============================
create table if not exists public.app_users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  password_hash text not null,
  full_name text,
  role text not null default 'user' check (role in ('user','admin')),
  balance numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep timestamps fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_users_set_updated_at on public.app_users;
create trigger trg_app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

-- ============================
-- SYSTEM SETTINGS
-- ============================
create table if not exists public.system_settings (
  id text primary key,
  entries_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Seed a default row if not exists
insert into public.system_settings (id, entries_enabled)
values ('global', true)
on conflict (id) do nothing;

-- ============================
-- TRANSACTIONS: projectless
-- ============================
-- Extend existing transactions table to support projectless model
alter table if exists public.transactions
  add column if not exists app_user_id uuid references public.app_users(id) on delete cascade;

-- Make entry_type support open/packet as well
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'entry_type'
  ) then
    -- Relax constraint by dropping and re-adding with new allowed values
    begin
      alter table public.transactions drop constraint if exists transactions_entry_type_check;
    exception when undefined_object then null; end;
    alter table public.transactions
      add constraint transactions_entry_type_check
      check (entry_type in ('open','akra','ring','packet'));
  end if;
end$$;

-- Relax number length constraint to allow open (1) and packet (4)
do $$
begin
  begin
    alter table public.transactions drop constraint if exists transactions_number_format;
  exception when undefined_object then null; end;
  alter table public.transactions
    add constraint transactions_number_format
    check (
      (entry_type = 'open'   and length(number) = 1) or
      (entry_type = 'akra'   and length(number) = 2) or
      (entry_type = 'ring'   and length(number) = 3) or
      (entry_type = 'packet' and length(number) = 4)
    );
end$$;

-- Optional: drop project_id/user_id requirement in favor of app_user_id (keep cols for backward compat)
-- NOTE: We keep existing columns to avoid breaking older code paths; new code will use app_user_id

-- Indexes
create index if not exists idx_transactions_app_user_id on public.transactions(app_user_id);
create index if not exists idx_app_users_username on public.app_users(username);

-- Enable RLS (dev-friendly, allow read/write for all authenticated; admins should use service role)
alter table if exists public.app_users enable row level security;
alter table if exists public.system_settings enable row level security;
-- Dev policies (relaxed): authenticated can read app_users (admin features rely on service role anyway)
do $$ begin
  begin
    create policy app_users_read_all on public.app_users for select to authenticated using (true);
  exception when duplicate_object then null; end;
  begin
    create policy app_users_write_admin_only on public.app_users for all to authenticated using (false) with check (false);
  exception when duplicate_object then null; end;
end $$;

comment on table public.app_users is 'Application-level users for custom username/password auth';
comment on table public.system_settings is 'Global feature flags and options';


