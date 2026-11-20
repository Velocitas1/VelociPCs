-- VelociPCs Legacy Computer & Hardware Inventory Schema
-- Access Model: Public Read-Only (anon + authenticated SELECT) + Owner-Only Writes (private.app_admins)

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table if not exists private.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create or replace function private.is_owner()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from private.app_admins
      where user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select private.is_owner();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 1. Source-of-Truth CPU Catalog
create table if not exists public.cpus (
  id bigint generated always as identity primary key,
  name text not null,
  brand text not null,
  codename text,
  socket text,
  base_clock_ghz numeric(5,2),
  turbo_clock_ghz numeric(5,2),
  cache_mb numeric(6,2),
  cores integer,
  threads integer,
  tdp_w integer,
  process_nm integer,
  max_memory_gb integer,
  memory_type text,
  memory_speed_mhz integer,
  launch_date text,
  rank integer,
  is_mobile boolean not null default false,
  spec_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cpus_brand_name_unique_idx
  on public.cpus (lower(brand), lower(name));

create trigger cpus_set_updated_at
  before update on public.cpus
  for each row execute function private.set_updated_at();

-- 2. Source-of-Truth GPU Catalog
create table if not exists public.gpus (
  id bigint generated always as identity primary key,
  name text not null,
  brand text not null,
  architecture text,
  vram_gb numeric(6,2),
  vram_type text,
  bus_interface text,
  process_nm integer,
  tdp_w integer,
  directx_version text,
  directx_feature_level text,
  category text,
  rank integer,
  is_mobile boolean not null default false,
  spec_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gpus_brand_name_mobile_unique_idx
  on public.gpus (lower(brand), lower(name), is_mobile);

create trigger gpus_set_updated_at
  before update on public.gpus
  for each row execute function private.set_updated_at();

-- 3. Unified Computers (Desktops & Laptops)
create table if not exists public.computers (
  id bigint generated always as identity primary key,
  name text not null,
  device_type text not null check (device_type in ('Desktop', 'Laptop')),
  brand text,
  model text,
  build_date date,
  overall_rank integer,
  status text not null default 'Active' check (status in ('Active', 'Retired', 'Storage', 'In Progress')),
  notes text,

  -- CPU
  cpu_id bigint references public.cpus(id) on delete set null,
  cpu_count integer not null default 1 check (cpu_count >= 1),

  -- GPU (discrete + optional integrated)
  gpu_id bigint references public.gpus(id) on delete set null,
  gpu_aib_manufacturer text,
  gpu_aib_model text,
  igpu_id bigint references public.gpus(id) on delete set null,

  -- Motherboard (desktops)
  motherboard_name text,
  motherboard_brand text,
  motherboard_launch text,

  -- Memory (RAM)
  ram_gb integer,
  ram_speed_mhz integer,
  ram_type text,
  ram_pc_rating text,

  -- Power Supply / Adapter
  psu_wattage integer,
  psu_brand text,
  psu_has_8pin_cpu boolean,
  psu_has_6pin_pcie boolean,
  power_adapter_notes text,

  -- Laptop display & physical
  screen_size_inches numeric(4,1),
  screen_resolution text,
  weight_lbs numeric(5,2),

  -- Wireless & Bluetooth
  wifi_brand text,
  wifi_product text,
  wifi_model text,
  wifi_codename text,
  wifi_launch_date text,
  wifi_antenna text,
  wifi_bands text,
  wifi_max_speed text,
  wifi_standard text,
  bluetooth_version text,
  wifi_form_factor text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint computers_name_device_type_unique unique (name, device_type)
);

create index if not exists computers_cpu_id_idx on public.computers (cpu_id);
create index if not exists computers_gpu_id_idx on public.computers (gpu_id);
create index if not exists computers_igpu_id_idx on public.computers (igpu_id);
create index if not exists computers_device_type_idx on public.computers (device_type);

create trigger computers_set_updated_at
  before update on public.computers
  for each row execute function private.set_updated_at();

-- 4. Storage Drives (1-to-many per computer)
create table if not exists public.storage_drives (
  id bigint generated always as identity primary key,
  computer_id bigint not null references public.computers(id) on delete cascade,
  capacity_gb integer,
  form_factor text,
  brand text,
  model text,
  model_number text,
  nand_type text,
  read_mb_s integer,
  write_mb_s integer,
  rank integer,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storage_drives_computer_id_idx on public.storage_drives (computer_id);

create trigger storage_drives_set_updated_at
  before update on public.storage_drives
  for each row execute function private.set_updated_at();

-- 5. 3DMark & Performance Benchmarks (history per build)
create table if not exists public.benchmarks (
  id bigint generated always as identity primary key,
  computer_id bigint not null references public.computers(id) on delete cascade,
  suite_name text not null,
  score integer not null check (score >= 0),
  graphics_score integer check (graphics_score is null or graphics_score >= 0),
  cpu_score integer check (cpu_score is null or cpu_score >= 0),
  cpu_id bigint references public.cpus(id) on delete set null,
  gpu_id bigint references public.gpus(id) on delete set null,
  recorded_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists benchmarks_computer_id_suite_idx
  on public.benchmarks (computer_id, suite_name, recorded_at desc);
create index if not exists benchmarks_cpu_id_idx on public.benchmarks (cpu_id);
create index if not exists benchmarks_gpu_id_idx on public.benchmarks (gpu_id);

create trigger benchmarks_set_updated_at
  before update on public.benchmarks
  for each row execute function private.set_updated_at();

-- 6. Phase 2 Roadmap: Steam Library Catalog
create table if not exists public.steam_library (
  app_id integer primary key,
  title text not null,
  min_directx text,
  rec_directx text,
  min_vram_gb numeric(6,2),
  rec_vram_gb numeric(6,2),
  min_ram_gb integer,
  rec_ram_gb integer,
  storage_gb numeric(7,2),
  header_image_url text,
  store_url text,
  raw_requirements jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger steam_library_set_updated_at
  before update on public.steam_library
  for each row execute function private.set_updated_at();

-- 7. Phase 2 Roadmap: Per-Build Steam Game Compatibility
create table if not exists public.build_game_compatibility (
  id bigint generated always as identity primary key,
  computer_id bigint not null references public.computers(id) on delete cascade,
  steam_app_id integer not null references public.steam_library(app_id) on delete cascade,
  status text not null check (status in ('playable', 'minimum', 'blocked_directx', 'blocked_vram', 'blocked_ram', 'unknown')),
  blocking_reason text,
  evaluated_at timestamptz not null default now(),

  constraint build_game_compat_unique unique (computer_id, steam_app_id)
);

create index if not exists build_game_compat_computer_id_idx
  on public.build_game_compatibility (computer_id);
create index if not exists build_game_compat_steam_app_id_idx
  on public.build_game_compatibility (steam_app_id);

-- Grants & Row-Level Security (Option A: Public Read-Only, Owner-Only Writes)
grant usage on schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'cpus',
    'gpus',
    'computers',
    'storage_drives',
    'benchmarks',
    'steam_library',
    'build_game_compatibility'
  ]
  loop
    execute format('revoke all on table public.%I from public', tbl);
    execute format('grant select on table public.%I to anon', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated, service_role', tbl);
    execute format('alter table public.%I enable row level security', tbl);

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      tbl || '_public_read',
      tbl
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_owner()))',
      tbl || '_owner_insert',
      tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))',
      tbl || '_owner_update',
      tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_owner()))',
      tbl || '_owner_delete',
      tbl
    );
  end loop;
end;
$$;
