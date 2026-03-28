alter table public.liq_modulos
  add column if not exists section_key text not null default 'dashboard',
  add column if not exists section_name text not null default 'Dashboard',
  add column if not exists section_order integer not null default 100;

create index if not exists liq_modulos_section_idx
  on public.liq_modulos (section_order, section_name, sort_order, name);

update public.liq_modulos
set
  section_key = 'dashboard',
  section_name = 'Dashboard',
  section_order = 10
where code = 'dashboard';

update public.liq_modulos
set
  section_key = 'administracion',
  section_name = 'Administracion',
  section_order = 40
where code in ('modules', 'logs');

update public.liq_modulos
set
  section_key = 'seguimiento',
  section_name = 'Seguimiento',
  section_order = 30
where code = 'tickets';

update public.liq_modulos
set
  section_key = 'operacion',
  section_name = 'Operacion',
  section_order = 20
where route not like '/dashboard%'
  and section_key = 'dashboard';

alter table public.liq_tickets
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users (id) on delete set null,
  add column if not exists close_note text;

alter table public.liq_ticket_comments
  add column if not exists parent_comment_id uuid references public.liq_ticket_comments (id) on delete cascade;

create index if not exists liq_ticket_comments_parent_idx
  on public.liq_ticket_comments (parent_comment_id, created_at);

create or replace function public.liq_prevent_closed_ticket_comments()
returns trigger
language plpgsql
as $$
declare
  current_status public.liq_ticket_status;
begin
  select status
  into current_status
  from public.liq_tickets
  where id = new.ticket_id;

  if current_status = 'closed' then
    raise exception 'No se pueden registrar comentarios en tickets cerrados.';
  end if;

  return new;
end;
$$;

drop trigger if exists liq_prevent_closed_ticket_comments on public.liq_ticket_comments;

create trigger liq_prevent_closed_ticket_comments
before insert or update on public.liq_ticket_comments
for each row
execute function public.liq_prevent_closed_ticket_comments();
