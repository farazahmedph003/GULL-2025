-- Ensure app_users has email and seed/update admin row for gullbaba

-- 1) Add email column if missing
do $$
begin
  begin
    alter table public.app_users add column if not exists email text unique;
  exception when duplicate_column then null; end;
end$$;

-- 2) Backfill email for gullbaba user if row exists; otherwise insert
do $$
declare
  existing_id uuid;
begin
  select id into existing_id from public.app_users where username = 'gullbaba' limit 1;

  if existing_id is not null then
    update public.app_users
      set email = 'gullbaba@gmail.com',
          role = 'admin',
          is_active = true,
          updated_at = now()
      where id = existing_id;
  else
    insert into public.app_users (username, password_hash, full_name, role, is_active, email)
    values (
      'gullbaba',
      '$2a$10$QhcC/fkMkf7KxD47GFpYO.vHKLcqQObWj93/Vcw2VSvpD.JrqQLWO',
      'Gull Baba',
      'admin',
      true,
      'gullbaba@gmail.com'
    )
    on conflict (username) do update set
      password_hash = excluded.password_hash,
      full_name     = excluded.full_name,
      role          = 'admin',
      is_active     = true,
      email         = 'gullbaba@gmail.com',
      updated_at    = now();
  end if;
end$$;

-- 3) Helpful index on email
create index if not exists idx_app_users_email on public.app_users(email);


