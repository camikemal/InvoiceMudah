-- ============================================================
-- Migration: 20260324000000_init
-- Creates the `profiles` table and an auto-insert trigger
-- ============================================================

-- 1. Profiles table
--    Stores additional user info beyond what Supabase auth tracks.
--    id references auth.users so it stays in sync automatically.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  phone      text,
  full_name  text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Row-Level Security
--    Users can only read and update their own profile.
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Trigger: auto-create profile on new user signup
--    Pulls phone from raw_user_meta_data (set during signUp options.data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. updated_at auto-update helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
