-- Grades Escolares — schema inicial
-- Espelha src/types/index.ts (AppData). IDs reaproveitados do app (schools com
-- id texto fixo; demais com uuid já gerados no navegador).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create table if not exists public.schools (
  id text primary key,
  name text not null
);

insert into public.schools (id, name) values
  ('capsula', 'Cápsula'),
  ('barra-da-tijuca', 'Barra da Tijuca'),
  ('niteroi', 'Niterói'),
  ('politecnico', 'Politécnico')
on conflict (id) do nothing;

alter table public.schools enable row level security;

create policy "schools_select_authenticated" on public.schools
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- components (currículo compartilhado entre unidades)
-- ---------------------------------------------------------------------------
create table if not exists public.components (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  color text not null,
  weekly_hours numeric not null default 0,
  planning_hours numeric not null default 0
);

alter table public.components enable row level security;

create policy "components_select_authenticated" on public.components
  for select to authenticated using (true);
create policy "components_insert_authenticated" on public.components
  for insert to authenticated with check (true);
create policy "components_update_authenticated" on public.components
  for update to authenticated using (true) with check (true);
create policy "components_delete_authenticated" on public.components
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- school_access — concede a um usuário o direito de editar uma unidade
-- ---------------------------------------------------------------------------
create table if not exists public.school_access (
  user_id uuid not null references auth.users (id) on delete cascade,
  school_id text not null references public.schools (id) on delete cascade,
  primary key (user_id, school_id)
);

alter table public.school_access enable row level security;

create policy "school_access_select_own" on public.school_access
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- teachers
-- ---------------------------------------------------------------------------
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  component_ids uuid[] not null default '{}',
  contracted_hours_2026 numeric not null default 0,
  is_orientador boolean not null default false,
  orientador_target_hours numeric not null default 40
);

alter table public.teachers enable row level security;

create policy "teachers_all_school_access" on public.teachers
  for all to authenticated
  using (exists (
    select 1 from public.school_access sa
    where sa.school_id = teachers.school_id and sa.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.school_access sa
    where sa.school_id = teachers.school_id and sa.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools (id) on delete cascade,
  name text not null,
  shift text not null,
  year text
);

alter table public.classes enable row level security;

create policy "classes_all_school_access" on public.classes
  for all to authenticated
  using (exists (
    select 1 from public.school_access sa
    where sa.school_id = classes.school_id and sa.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.school_access sa
    where sa.school_id = classes.school_id and sa.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- schedule_entries
-- ---------------------------------------------------------------------------
create table if not exists public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools (id) on delete cascade,
  type text not null check (type in ('aula', 'planejamento', 'orientacao')),
  week text not null check (week in ('A', 'B', 'AMBAS')),
  day text not null check (day in ('Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta')),
  time_slot_id text not null,
  class_id uuid references public.classes (id) on delete cascade,
  component_id uuid references public.components (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade
);

create index if not exists schedule_entries_school_idx on public.schedule_entries (school_id);
create index if not exists schedule_entries_teacher_idx on public.schedule_entries (teacher_id);
create index if not exists schedule_entries_class_idx on public.schedule_entries (class_id);

alter table public.schedule_entries enable row level security;

create policy "schedule_all_school_access" on public.schedule_entries
  for all to authenticated
  using (exists (
    select 1 from public.school_access sa
    where sa.school_id = schedule_entries.school_id and sa.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.school_access sa
    where sa.school_id = schedule_entries.school_id and sa.user_id = auth.uid()
  ));
