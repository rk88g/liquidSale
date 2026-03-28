do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'liq_app_role'
  ) then
    create type public.liq_app_role as enum (
      'super_admin',
      'admin',
      'manager',
      'seller',
      'viewer'
    );
  end if;
end
$$;

create table if not exists public.liq_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.liq_app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.liq_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists liq_set_profiles_updated_at on public.liq_profiles;

create trigger liq_set_profiles_updated_at
before update on public.liq_profiles
for each row
execute function public.liq_set_updated_at();

create or replace function public.liq_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.liq_profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists liq_on_auth_user_created on auth.users;

create trigger liq_on_auth_user_created
after insert on auth.users
for each row
execute function public.liq_handle_new_user();

alter table public.liq_profiles enable row level security;

drop policy if exists "liq_users_can_read_own_profile" on public.liq_profiles;

create policy "liq_users_can_read_own_profile"
on public.liq_profiles
for select
to authenticated
using (auth.uid() = id);

create index if not exists liq_profiles_role_idx on public.liq_profiles (role);
