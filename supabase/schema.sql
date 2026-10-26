-- Garaje · esquema para Supabase
-- Ejecutar una sola vez en el SQL Editor del proyecto.
--
-- Modelo: un garaje (documento JSON) por usuario autenticado.
-- La app usa la anon key + Row Level Security; nunca la service_role key.

create table if not exists public.garages (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  client_id  text,
  updated_at timestamptz not null default now()
);

comment on table public.garages is
  'Un garaje por usuario de Garaje: vehículo, servicios e historial en un documento JSON.';

alter table public.garages enable row level security;

-- Necesario para que los eventos DELETE de Realtime incluyan todas las columnas
-- y el filtro por user_id funcione también al borrar.
alter table public.garages replica identity full;

-- Lectura: solo el dueño.
drop policy if exists "garages_select_own" on public.garages;
create policy "garages_select_own"
  on public.garages
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Inserción: solo el propio user_id.
drop policy if exists "garages_insert_own" on public.garages;
create policy "garages_insert_own"
  on public.garages
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Actualización: solo el dueño y sin cambiar de dueño.
drop policy if exists "garages_update_own" on public.garages;
create policy "garages_update_own"
  on public.garages
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Borrado: solo el dueño.
drop policy if exists "garages_delete_own" on public.garages;
create policy "garages_delete_own"
  on public.garages
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Realtime: permite que otros dispositivos reciban los cambios.
-- El bloque ignora el error si la tabla ya estaba agregada a la publicación.
do $$
begin
  alter publication supabase_realtime add table public.garages;
exception
  when duplicate_object then null;
end $$;

-- updated_at siempre lo define el servidor, también en el primer insert
-- (evita relojes desfasados entre dispositivos).
create or replace function public.touch_garages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists garages_touch_updated_at on public.garages;
create trigger garages_touch_updated_at
  before insert or update on public.garages
  for each row
  execute function public.touch_garages_updated_at();

-- PostgREST necesita permisos de tabla; RLS sigue filtrando por usuario.
grant select, insert, update, delete on public.garages to authenticated;
revoke all on public.garages from anon;
