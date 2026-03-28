do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'liq_ticket_status'
  ) then
    create type public.liq_ticket_status as enum (
      'open',
      'in_progress',
      'waiting_response',
      'resolved',
      'closed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'liq_ticket_priority'
  ) then
    create type public.liq_ticket_priority as enum (
      'low',
      'medium',
      'high',
      'urgent'
    );
  end if;
end
$$;

create table if not exists public.liq_modulos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  slug text not null unique,
  route text not null unique,
  icon text,
  description text,
  visible_roles public.liq_app_role[] not null default array['viewer']::public.liq_app_role[],
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists liq_set_modulos_updated_at on public.liq_modulos;

create trigger liq_set_modulos_updated_at
before update on public.liq_modulos
for each row
execute function public.liq_set_updated_at();

create table if not exists public.liq_tickets (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.liq_modulos (id) on delete set null,
  record_table text,
  record_id text,
  subject text not null,
  description text not null,
  status public.liq_ticket_status not null default 'open',
  priority public.liq_ticket_priority not null default 'medium',
  created_by uuid references auth.users (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

drop trigger if exists liq_set_tickets_updated_at on public.liq_tickets;

create trigger liq_set_tickets_updated_at
before update on public.liq_tickets
for each row
execute function public.liq_set_updated_at();

create table if not exists public.liq_ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.liq_tickets (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  recipient_user_id uuid references auth.users (id) on delete set null,
  module_id uuid references public.liq_modulos (id) on delete set null,
  record_table text,
  record_id text,
  comment text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.liq_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  module_id uuid references public.liq_modulos (id) on delete set null,
  action_type text not null,
  entity_table text not null,
  entity_id text not null,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  context jsonb not null default '{}'::jsonb,
  is_reversible boolean not null default false,
  revert_payload jsonb,
  reverted_at timestamptz,
  reverted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.liq_modulos enable row level security;
alter table public.liq_tickets enable row level security;
alter table public.liq_ticket_comments enable row level security;
alter table public.liq_logs enable row level security;

create index if not exists liq_modulos_sort_idx on public.liq_modulos (sort_order, name);
create index if not exists liq_modulos_roles_idx on public.liq_modulos using gin (visible_roles);
create index if not exists liq_tickets_status_idx on public.liq_tickets (status, priority);
create index if not exists liq_tickets_module_idx on public.liq_tickets (module_id);
create index if not exists liq_ticket_comments_ticket_idx on public.liq_ticket_comments (ticket_id, created_at);
create index if not exists liq_logs_actor_idx on public.liq_logs (actor_user_id, created_at desc);
create index if not exists liq_logs_entity_idx on public.liq_logs (entity_table, entity_id);

insert into public.liq_modulos (
  code,
  name,
  slug,
  route,
  icon,
  visible_roles,
  sort_order
)
values
  (
    'dashboard',
    'Dashboard',
    'dashboard',
    '/dashboard',
    'layout-dashboard',
    array['super_admin', 'admin', 'manager', 'seller', 'viewer']::public.liq_app_role[],
    1
  ),
  (
    'modules',
    'Modulos',
    'modulos',
    '/dashboard/modulos',
    'blocks',
    array['super_admin']::public.liq_app_role[],
    2
  ),
  (
    'tickets',
    'Tickets',
    'tickets',
    '/dashboard/tickets',
    'messages-square',
    array['super_admin', 'admin', 'manager', 'seller', 'viewer']::public.liq_app_role[],
    3
  ),
  (
    'logs',
    'Logs',
    'logs',
    '/dashboard/logs',
    'history',
    array['super_admin']::public.liq_app_role[],
    4
  )
on conflict (code) do nothing;
