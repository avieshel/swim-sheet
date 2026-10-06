-- supabase/seed.sql
-- Local-development seed data only.
--
-- The Supabase CLI applies this file to the local Docker `postgres` database
-- on `supabase db reset`. It is NEVER applied to hosted Supabase projects
-- under normal CLI usage: `supabase db push` runs migrations only and does
-- not touch this file.

-- Idempotent so repeated `db reset` runs do not error.
-- The `handle_new_user` trigger in supabase/migrations creates the matching
-- `public.profiles` row automatically when the auth user is inserted.

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-4000-8000-00000000d3e1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@swimsheet.local',
  crypt('dev-password-change-me', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dev Coach"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;