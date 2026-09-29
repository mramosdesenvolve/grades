-- Sistema de administrador (núcleo pulsante) + bloqueio global de edição da grade

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

create table if not exists public.system_settings (
  id smallint primary key default 1 check (id = 1),
  schedule_locked boolean not null default false,
  locked_by uuid references auth.users(id),
  locked_at timestamptz
);
insert into public.system_settings (id) values (1) on conflict do nothing;
alter table public.system_settings enable row level security;

drop policy if exists system_settings_select_authenticated on public.system_settings;
create policy system_settings_select_authenticated on public.system_settings
  for select to authenticated using (true);

drop policy if exists system_settings_update_admin on public.system_settings;
create policy system_settings_update_admin on public.system_settings
  for update to authenticated using (is_admin()) with check (is_admin());

-- teachers: admin enxerga/edita tudo, mesmo sem school_access explícito
drop policy if exists teachers_all_school_access on public.teachers;
create policy teachers_all_school_access on public.teachers for all to authenticated
  using (is_admin() or exists (select 1 from public.school_access sa where sa.school_id = teachers.school_id and sa.user_id = auth.uid()))
  with check (is_admin() or exists (select 1 from public.school_access sa where sa.school_id = teachers.school_id and sa.user_id = auth.uid()));

-- classes: idem
drop policy if exists classes_all_school_access on public.classes;
create policy classes_all_school_access on public.classes for all to authenticated
  using (is_admin() or exists (select 1 from public.school_access sa where sa.school_id = classes.school_id and sa.user_id = auth.uid()))
  with check (is_admin() or exists (select 1 from public.school_access sa where sa.school_id = classes.school_id and sa.user_id = auth.uid()));

-- schedule_entries: leitura por school_access/admin; escrita também exige a grade destravada (exceto admin)
drop policy if exists schedule_all_school_access on public.schedule_entries;

drop policy if exists schedule_select on public.schedule_entries;
create policy schedule_select on public.schedule_entries for select to authenticated
  using (is_admin() or exists (select 1 from public.school_access sa where sa.school_id = schedule_entries.school_id and sa.user_id = auth.uid()));

drop policy if exists schedule_insert on public.schedule_entries;
create policy schedule_insert on public.schedule_entries for insert to authenticated
  with check (is_admin() or (
    exists (select 1 from public.school_access sa where sa.school_id = schedule_entries.school_id and sa.user_id = auth.uid())
    and not (select schedule_locked from public.system_settings where id = 1)
  ));

drop policy if exists schedule_update on public.schedule_entries;
create policy schedule_update on public.schedule_entries for update to authenticated
  using (is_admin() or exists (select 1 from public.school_access sa where sa.school_id = schedule_entries.school_id and sa.user_id = auth.uid()))
  with check (is_admin() or (
    exists (select 1 from public.school_access sa where sa.school_id = schedule_entries.school_id and sa.user_id = auth.uid())
    and not (select schedule_locked from public.system_settings where id = 1)
  ));

drop policy if exists schedule_delete on public.schedule_entries;
create policy schedule_delete on public.schedule_entries for delete to authenticated
  using (is_admin() or (
    exists (select 1 from public.school_access sa where sa.school_id = schedule_entries.school_id and sa.user_id = auth.uid())
    and not (select schedule_locked from public.system_settings where id = 1)
  ));
