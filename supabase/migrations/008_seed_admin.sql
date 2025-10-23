-- Seed or update admin user for custom app_users auth
-- Username: gullbaba
-- Password: gull918786 (bcrypt hashed)

insert into public.app_users (username, password_hash, full_name, role, is_active)
values (
  'gullbaba',
  '$2a$10$QhcC/fkMkf7KxD47GFpYO.vHKLcqQObWj93/Vcw2VSvpD.JrqQLWO',
  'Gull Baba',
  'admin',
  true
)
on conflict (username) do update set
  password_hash = excluded.password_hash,
  full_name     = excluded.full_name,
  role          = 'admin',
  is_active     = true,
  updated_at    = now();


