-- Add spec_links jsonb to cpus & gpus, spec_url + spec_links to storage_drives,
-- and part_spec_links jsonb slot map to computers (zero RLS policy changes).

create or replace function private.is_valid_http_url(u text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select u is not null
    and btrim(u) = u
    and u ~* '^https?://[^[:space:]]+$';
$$;

revoke all on function private.is_valid_http_url(text) from public, anon;
grant execute on function private.is_valid_http_url(text) to authenticated, service_role;

create or replace function private.is_valid_spec_links(links jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select links is not null
    and jsonb_typeof(links) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(links) as elem
      where jsonb_typeof(elem) <> 'object'
        or jsonb_typeof(elem->'label') <> 'string'
        or length(btrim(elem->>'label')) = 0
        or jsonb_typeof(elem->'url') <> 'string'
        or not private.is_valid_http_url(elem->>'url')
    );
$$;

revoke all on function private.is_valid_spec_links(jsonb) from public, anon;
grant execute on function private.is_valid_spec_links(jsonb) to authenticated, service_role;

create or replace function private.is_valid_part_spec_links(slot_map jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select slot_map is not null
    and jsonb_typeof(slot_map) = 'object'
    and not exists (
      select 1
      from jsonb_each(slot_map) as kv(k, v)
      where kv.k not in ('gpu_aib', 'motherboard', 'laptop', 'wifi', 'psu', 'ram')
        or jsonb_typeof(kv.v) <> 'object'
        or (
          kv.v ? 'spec_url'
          and kv.v->'spec_url' <> 'null'::jsonb
          and (
            jsonb_typeof(kv.v->'spec_url') <> 'string'
            or not private.is_valid_http_url(kv.v->>'spec_url')
          )
        )
        or (
          kv.v ? 'links'
          and not private.is_valid_spec_links(kv.v->'links')
        )
    );
$$;

revoke all on function private.is_valid_part_spec_links(jsonb) from public, anon;
grant execute on function private.is_valid_part_spec_links(jsonb) to authenticated, service_role;

alter table public.cpus
  add column if not exists spec_links jsonb not null default '[]'::jsonb;

alter table public.gpus
  add column if not exists spec_links jsonb not null default '[]'::jsonb;

alter table public.storage_drives
  add column if not exists spec_url text,
  add column if not exists spec_links jsonb not null default '[]'::jsonb;

alter table public.computers
  add column if not exists part_spec_links jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cpus_spec_url_http_check'
      and conrelid = 'public.cpus'::regclass
  ) then
    alter table public.cpus
      add constraint cpus_spec_url_http_check
      check (spec_url is null or private.is_valid_http_url(spec_url));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cpus_spec_links_valid_check'
      and conrelid = 'public.cpus'::regclass
  ) then
    alter table public.cpus
      add constraint cpus_spec_links_valid_check
      check (private.is_valid_spec_links(spec_links));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gpus_spec_url_http_check'
      and conrelid = 'public.gpus'::regclass
  ) then
    alter table public.gpus
      add constraint gpus_spec_url_http_check
      check (spec_url is null or private.is_valid_http_url(spec_url));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gpus_spec_links_valid_check'
      and conrelid = 'public.gpus'::regclass
  ) then
    alter table public.gpus
      add constraint gpus_spec_links_valid_check
      check (private.is_valid_spec_links(spec_links));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'storage_drives_spec_url_http_check'
      and conrelid = 'public.storage_drives'::regclass
  ) then
    alter table public.storage_drives
      add constraint storage_drives_spec_url_http_check
      check (spec_url is null or private.is_valid_http_url(spec_url));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'storage_drives_spec_links_valid_check'
      and conrelid = 'public.storage_drives'::regclass
  ) then
    alter table public.storage_drives
      add constraint storage_drives_spec_links_valid_check
      check (private.is_valid_spec_links(spec_links));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'computers_part_spec_links_valid_check'
      and conrelid = 'public.computers'::regclass
  ) then
    alter table public.computers
      add constraint computers_part_spec_links_valid_check
      check (private.is_valid_part_spec_links(part_spec_links));
  end if;
end;
$$;
