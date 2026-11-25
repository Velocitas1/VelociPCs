-- Phase 4: Live Steam Library Integration Enhancements
-- Adds fractional RAM support, playtime tracking, manual requirement overrides,
-- batch sync status tracking, and blocked_storage compatibility status.

-- 1. Enhance public.steam_library
alter table public.steam_library
  alter column min_ram_gb type numeric(6,2) using min_ram_gb::numeric(6,2),
  alter column rec_ram_gb type numeric(6,2) using rec_ram_gb::numeric(6,2);

alter table public.steam_library
  add column if not exists playtime_minutes integer not null default 0,
  add column if not exists manual_override boolean not null default false,
  add column if not exists override_notes text,
  add column if not exists requirements_synced_at timestamptz,
  add column if not exists requirements_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'steam_library_playtime_nonneg_check'
      and conrelid = 'public.steam_library'::regclass
  ) then
    alter table public.steam_library
      add constraint steam_library_playtime_nonneg_check
      check (playtime_minutes >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'steam_library_requirements_status_check'
      and conrelid = 'public.steam_library'::regclass
  ) then
    alter table public.steam_library
      add constraint steam_library_requirements_status_check
      check (requirements_status in ('pending', 'parsed', 'missing', 'error'));
  end if;
end;
$$;

create index if not exists steam_library_playtime_idx
  on public.steam_library (playtime_minutes desc);

create index if not exists steam_library_requirements_status_idx
  on public.steam_library (requirements_status);

-- 2. Expand build_game_compatibility status constraint to include blocked_storage
alter table public.build_game_compatibility
  drop constraint if exists build_game_compatibility_status_check;

alter table public.build_game_compatibility
  add constraint build_game_compatibility_status_check
  check (
    status in (
      'playable',
      'minimum',
      'blocked_directx',
      'blocked_vram',
      'blocked_ram',
      'blocked_storage',
      'unknown'
    )
  );

create index if not exists build_game_compat_computer_status_idx
  on public.build_game_compatibility (computer_id, status);
