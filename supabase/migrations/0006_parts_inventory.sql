-- Phase 3: Full Desktop Parts Inventory (Installed vs. Spare) + Catalog Tables + Backfill
-- Access Model: Public Read-Only (anon + authenticated SELECT) + Owner-Only Writes (private.is_owner())

-- 1. Add spare_count to public.cpus
alter table public.cpus
  add column if not exists spare_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cpus_spare_count_nonneg_check'
      and conrelid = 'public.cpus'::regclass
  ) then
    alter table public.cpus
      add constraint cpus_spare_count_nonneg_check
      check (spare_count >= 0);
  end if;
end;
$$;

-- 2. Dedicated Catalog Tables for Owned Part Models/Variants

-- 2a. GPU Cards (AIB / Board Partner models linked to canonical public.gpus)
create table if not exists public.gpu_cards (
  id bigint generated always as identity primary key,
  gpu_id bigint not null references public.gpus(id) on delete restrict,
  brand text not null,
  model text not null,
  part_number text,
  cooling_type text,
  length_mm integer check (length_mm is null or length_mm > 0),
  spare_count integer not null default 0 check (spare_count >= 0),
  spec_url text check (spec_url is null or private.is_valid_http_url(spec_url)),
  spec_links jsonb not null default '[]'::jsonb check (private.is_valid_spec_links(spec_links)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gpu_cards_gpu_id_idx on public.gpu_cards (gpu_id);
create unique index if not exists gpu_cards_unique_idx
  on public.gpu_cards (gpu_id, lower(brand), lower(model));

-- 2b. Motherboards
create table if not exists public.motherboards (
  id bigint generated always as identity primary key,
  brand text not null,
  model text not null,
  socket text,
  chipset text,
  form_factor text,
  memory_type text,
  launch_date text,
  spare_count integer not null default 0 check (spare_count >= 0),
  spec_url text check (spec_url is null or private.is_valid_http_url(spec_url)),
  spec_links jsonb not null default '[]'::jsonb check (private.is_valid_spec_links(spec_links)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists motherboards_brand_model_unique_idx
  on public.motherboards (lower(brand), lower(model));

-- 2c. RAM Kits
create table if not exists public.ram_kits (
  id bigint generated always as identity primary key,
  brand text,
  model text not null,
  capacity_gb integer check (capacity_gb is null or capacity_gb > 0),
  modules_count integer check (modules_count is null or modules_count > 0),
  ram_type text,
  speed_mhz integer check (speed_mhz is null or speed_mhz > 0),
  pc_rating text,
  is_mobile boolean not null default false,
  spare_count integer not null default 0 check (spare_count >= 0),
  spec_url text check (spec_url is null or private.is_valid_http_url(spec_url)),
  spec_links jsonb not null default '[]'::jsonb check (private.is_valid_spec_links(spec_links)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ram_kits_unique_idx
  on public.ram_kits (
    lower(coalesce(brand, '')),
    lower(model),
    coalesce(capacity_gb, 0),
    lower(coalesce(ram_type, '')),
    coalesce(speed_mhz, 0),
    is_mobile
  );

-- 2d. Storage Drive Models
create table if not exists public.storage_drive_models (
  id bigint generated always as identity primary key,
  brand text,
  model text not null,
  model_number text,
  capacity_gb integer check (capacity_gb is null or capacity_gb > 0),
  form_factor text,
  nand_type text,
  read_mb_s integer check (read_mb_s is null or read_mb_s > 0),
  write_mb_s integer check (write_mb_s is null or write_mb_s > 0),
  spare_count integer not null default 0 check (spare_count >= 0),
  spec_url text check (spec_url is null or private.is_valid_http_url(spec_url)),
  spec_links jsonb not null default '[]'::jsonb check (private.is_valid_spec_links(spec_links)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists storage_drive_models_unique_idx
  on public.storage_drive_models (
    lower(coalesce(brand, '')),
    lower(model),
    coalesce(capacity_gb, 0),
    lower(coalesce(form_factor, ''))
  );

-- 2e. Power Supplies (PSUs)
create table if not exists public.psus (
  id bigint generated always as identity primary key,
  brand text not null,
  model text not null,
  wattage integer check (wattage is null or wattage > 0),
  efficiency_rating text,
  modular text,
  has_8pin_cpu boolean,
  has_6pin_pcie boolean,
  spare_count integer not null default 0 check (spare_count >= 0),
  spec_url text check (spec_url is null or private.is_valid_http_url(spec_url)),
  spec_links jsonb not null default '[]'::jsonb check (private.is_valid_spec_links(spec_links)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists psus_unique_idx
  on public.psus (lower(brand), lower(model), coalesce(wattage, 0));

-- 2f. Cases
create table if not exists public.cases (
  id bigint generated always as identity primary key,
  brand text not null,
  model text not null,
  form_factor text,
  color text,
  max_gpu_length_mm integer check (max_gpu_length_mm is null or max_gpu_length_mm > 0),
  spare_count integer not null default 0 check (spare_count >= 0),
  spec_url text check (spec_url is null or private.is_valid_http_url(spec_url)),
  spec_links jsonb not null default '[]'::jsonb check (private.is_valid_spec_links(spec_links)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cases_brand_model_unique_idx
  on public.cases (lower(brand), lower(model));

-- 2g. Coolers
create table if not exists public.coolers (
  id bigint generated always as identity primary key,
  brand text not null,
  model text not null,
  cooler_type text,
  fan_size_mm integer check (fan_size_mm is null or fan_size_mm > 0),
  socket_support text,
  tdp_rating_w integer check (tdp_rating_w is null or tdp_rating_w > 0),
  spare_count integer not null default 0 check (spare_count >= 0),
  spec_url text check (spec_url is null or private.is_valid_http_url(spec_url)),
  spec_links jsonb not null default '[]'::jsonb check (private.is_valid_spec_links(spec_links)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coolers_brand_model_unique_idx
  on public.coolers (lower(brand), lower(model));

-- 2h. Wi-Fi Cards
create table if not exists public.wifi_cards (
  id bigint generated always as identity primary key,
  brand text not null,
  product text,
  model text not null,
  wifi_standard text,
  bluetooth_version text,
  form_factor text,
  is_mobile boolean not null default false,
  spare_count integer not null default 0 check (spare_count >= 0),
  spec_url text check (spec_url is null or private.is_valid_http_url(spec_url)),
  spec_links jsonb not null default '[]'::jsonb check (private.is_valid_spec_links(spec_links)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wifi_cards_unique_idx
  on public.wifi_cards (
    lower(brand),
    lower(coalesce(product, '')),
    lower(model),
    is_mobile
  );

-- 3. Triggers, Grants & Option A RLS Policies for all 8 new tables
grant usage, select on all sequences in schema public to authenticated, service_role;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'gpu_cards',
    'motherboards',
    'ram_kits',
    'storage_drive_models',
    'psus',
    'cases',
    'coolers',
    'wifi_cards'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', tbl || '_set_updated_at', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      tbl || '_set_updated_at',
      tbl
    );

    execute format('revoke all on table public.%I from public', tbl);
    execute format('grant select on table public.%I to anon', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated, service_role', tbl);
    execute format('alter table public.%I enable row level security', tbl);

    execute format('drop policy if exists %I on public.%I', tbl || '_public_read', tbl);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      tbl || '_public_read',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_owner_insert', tbl);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_owner()))',
      tbl || '_owner_insert',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_owner_update', tbl);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))',
      tbl || '_owner_update',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_owner_delete', tbl);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_owner()))',
      tbl || '_owner_delete',
      tbl
    );
  end loop;
end;
$$;

-- 4. Nullable Foreign Keys & Indexes on public.computers & public.storage_drives
alter table public.computers
  add column if not exists gpu_card_id bigint references public.gpu_cards(id) on delete set null,
  add column if not exists motherboard_id bigint references public.motherboards(id) on delete set null,
  add column if not exists ram_kit_id bigint references public.ram_kits(id) on delete set null,
  add column if not exists psu_id bigint references public.psus(id) on delete set null,
  add column if not exists case_id bigint references public.cases(id) on delete set null,
  add column if not exists cooler_id bigint references public.coolers(id) on delete set null,
  add column if not exists wifi_card_id bigint references public.wifi_cards(id) on delete set null;

create index if not exists computers_gpu_card_id_idx on public.computers (gpu_card_id);
create index if not exists computers_motherboard_id_idx on public.computers (motherboard_id);
create index if not exists computers_ram_kit_id_idx on public.computers (ram_kit_id);
create index if not exists computers_psu_id_idx on public.computers (psu_id);
create index if not exists computers_case_id_idx on public.computers (case_id);
create index if not exists computers_cooler_id_idx on public.computers (cooler_id);
create index if not exists computers_wifi_card_id_idx on public.computers (wifi_card_id);

alter table public.storage_drives
  add column if not exists storage_drive_model_id bigint references public.storage_drive_models(id) on delete set null;

create index if not exists storage_drives_model_id_idx on public.storage_drives (storage_drive_model_id);

-- 5. Atomic Owner-Only Spare Count Adjustment RPC
create or replace function public.adjust_part_spare_count(
  p_table text,
  p_id bigint,
  p_delta integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_next integer;
begin
  if not private.is_owner() then
    raise exception 'Owner privileges required';
  end if;

  if p_delta is null or p_id is null then
    raise exception 'p_id and p_delta are required';
  end if;

  case p_table
    when 'cpus' then
      update public.cpus
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    when 'gpu_cards' then
      update public.gpu_cards
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    when 'motherboards' then
      update public.motherboards
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    when 'ram_kits' then
      update public.ram_kits
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    when 'storage_drive_models' then
      update public.storage_drive_models
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    when 'psus' then
      update public.psus
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    when 'cases' then
      update public.cases
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    when 'coolers' then
      update public.coolers
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    when 'wifi_cards' then
      update public.wifi_cards
      set spare_count = greatest(0, spare_count + p_delta)
      where id = p_id
      returning spare_count into v_next;
    else
      raise exception 'Unsupported parts table: %', p_table;
  end case;

  if not found then
    raise exception 'Part % not found in %', p_id, p_table;
  end if;

  return v_next;
end;
$$;

revoke all on function public.adjust_part_spare_count(text, bigint, integer) from public, anon;
grant execute on function public.adjust_part_spare_count(text, bigint, integer) to authenticated, service_role;

-- 6. Idempotent Backfill from Existing Computers & Storage Drives
do $$
declare
  rec record;
  v_brand text;
  v_model text;
  v_product text;
  v_spec_url text;
  v_spec_links jsonb;
  v_part_id bigint;
  v_is_mobile boolean;
begin
  -- 6a. GPU Cards (Desktops with discrete gpu_id)
  for rec in
    select
      c.id as computer_id,
      c.gpu_id,
      c.gpu_aib_manufacturer,
      c.gpu_aib_model,
      c.part_spec_links,
      g.brand as chip_brand
    from public.computers c
    join public.gpus g on g.id = c.gpu_id
    where c.device_type = 'Desktop'
      and c.gpu_id is not null
  loop
    v_brand := coalesce(nullif(btrim(rec.gpu_aib_manufacturer), ''), rec.chip_brand, 'Reference');
    v_model := coalesce(nullif(btrim(rec.gpu_aib_model), ''), 'Reference');

    v_spec_url := nullif(btrim(rec.part_spec_links #>> '{gpu_aib,spec_url}'), '');
    if v_spec_url is not null and not private.is_valid_http_url(v_spec_url) then
      v_spec_url := null;
    end if;

    v_spec_links := coalesce(rec.part_spec_links #> '{gpu_aib,links}', '[]'::jsonb);
    if not private.is_valid_spec_links(v_spec_links) then
      v_spec_links := '[]'::jsonb;
    end if;

    insert into public.gpu_cards (gpu_id, brand, model, spec_url, spec_links)
    values (rec.gpu_id, v_brand, v_model, v_spec_url, v_spec_links)
    on conflict (gpu_id, (lower(brand)), (lower(model))) do update set
      spec_url = coalesce(public.gpu_cards.spec_url, excluded.spec_url),
      spec_links = case
        when jsonb_array_length(public.gpu_cards.spec_links) > 0 then public.gpu_cards.spec_links
        else excluded.spec_links
      end
    returning id into v_part_id;

    update public.computers
    set gpu_card_id = v_part_id
    where id = rec.computer_id
      and gpu_card_id is null;
  end loop;

  -- 6b. Motherboards (Desktops with motherboard_name)
  for rec in
    select
      c.id as computer_id,
      c.motherboard_brand,
      c.motherboard_name,
      c.motherboard_launch,
      c.ram_type,
      c.part_spec_links,
      cpu.socket as cpu_socket,
      cpu.memory_type as cpu_memory_type
    from public.computers c
    left join public.cpus cpu on cpu.id = c.cpu_id
    where c.device_type = 'Desktop'
      and nullif(btrim(c.motherboard_name), '') is not null
  loop
    v_brand := coalesce(nullif(btrim(rec.motherboard_brand), ''), 'Unknown');
    v_model := btrim(rec.motherboard_name);

    v_spec_url := nullif(btrim(rec.part_spec_links #>> '{motherboard,spec_url}'), '');
    if v_spec_url is not null and not private.is_valid_http_url(v_spec_url) then
      v_spec_url := null;
    end if;

    v_spec_links := coalesce(rec.part_spec_links #> '{motherboard,links}', '[]'::jsonb);
    if not private.is_valid_spec_links(v_spec_links) then
      v_spec_links := '[]'::jsonb;
    end if;

    insert into public.motherboards (
      brand,
      model,
      socket,
      memory_type,
      launch_date,
      spec_url,
      spec_links
    )
    values (
      v_brand,
      v_model,
      nullif(btrim(rec.cpu_socket), ''),
      coalesce(nullif(btrim(rec.ram_type), ''), nullif(btrim(rec.cpu_memory_type), '')),
      nullif(btrim(rec.motherboard_launch), ''),
      v_spec_url,
      v_spec_links
    )
    on conflict ((lower(brand)), (lower(model))) do update set
      socket = coalesce(public.motherboards.socket, excluded.socket),
      memory_type = coalesce(public.motherboards.memory_type, excluded.memory_type),
      launch_date = coalesce(public.motherboards.launch_date, excluded.launch_date),
      spec_url = coalesce(public.motherboards.spec_url, excluded.spec_url),
      spec_links = case
        when jsonb_array_length(public.motherboards.spec_links) > 0 then public.motherboards.spec_links
        else excluded.spec_links
      end
    returning id into v_part_id;

    update public.computers
    set motherboard_id = v_part_id
    where id = rec.computer_id
      and motherboard_id is null;
  end loop;

  -- 6c. RAM Kits (Desktops with RAM info)
  for rec in
    select
      c.id as computer_id,
      c.ram_gb,
      c.ram_speed_mhz,
      c.ram_type,
      c.ram_pc_rating,
      c.part_spec_links
    from public.computers c
    where c.device_type = 'Desktop'
      and (c.ram_gb is not null or nullif(btrim(c.ram_type), '') is not null)
  loop
    v_model := nullif(
      concat_ws(
        ' ',
        case when rec.ram_gb is not null then rec.ram_gb::text || 'GB' else null end,
        nullif(btrim(rec.ram_type), ''),
        case when rec.ram_speed_mhz is not null then rec.ram_speed_mhz::text || 'MHz' else null end
      ),
      ''
    );
    if v_model is null then
      v_model := 'RAM Kit';
    end if;

    v_spec_url := nullif(btrim(rec.part_spec_links #>> '{ram,spec_url}'), '');
    if v_spec_url is not null and not private.is_valid_http_url(v_spec_url) then
      v_spec_url := null;
    end if;

    v_spec_links := coalesce(rec.part_spec_links #> '{ram,links}', '[]'::jsonb);
    if not private.is_valid_spec_links(v_spec_links) then
      v_spec_links := '[]'::jsonb;
    end if;

    insert into public.ram_kits (
      brand,
      model,
      capacity_gb,
      ram_type,
      speed_mhz,
      pc_rating,
      is_mobile,
      spec_url,
      spec_links
    )
    values (
      null,
      v_model,
      rec.ram_gb,
      nullif(btrim(rec.ram_type), ''),
      rec.ram_speed_mhz,
      nullif(btrim(rec.ram_pc_rating), ''),
      false,
      v_spec_url,
      v_spec_links
    )
    on conflict (
      (lower(coalesce(brand, ''))),
      (lower(model)),
      (coalesce(capacity_gb, 0)),
      (lower(coalesce(ram_type, ''))),
      (coalesce(speed_mhz, 0)),
      is_mobile
    ) do update set
      pc_rating = coalesce(public.ram_kits.pc_rating, excluded.pc_rating),
      spec_url = coalesce(public.ram_kits.spec_url, excluded.spec_url),
      spec_links = case
        when jsonb_array_length(public.ram_kits.spec_links) > 0 then public.ram_kits.spec_links
        else excluded.spec_links
      end
    returning id into v_part_id;

    update public.computers
    set ram_kit_id = v_part_id
    where id = rec.computer_id
      and ram_kit_id is null;
  end loop;

  -- 6d. PSUs (Desktops with PSU info)
  for rec in
    select
      c.id as computer_id,
      c.psu_brand,
      c.psu_wattage,
      c.psu_has_8pin_cpu,
      c.psu_has_6pin_pcie,
      c.part_spec_links
    from public.computers c
    where c.device_type = 'Desktop'
      and (c.psu_wattage is not null or nullif(btrim(c.psu_brand), '') is not null)
  loop
    v_brand := coalesce(nullif(btrim(rec.psu_brand), ''), 'Unknown');
    v_model := case
      when rec.psu_wattage is not null then rec.psu_wattage::text || 'W PSU'
      else 'PSU'
    end;

    v_spec_url := nullif(btrim(rec.part_spec_links #>> '{psu,spec_url}'), '');
    if v_spec_url is not null and not private.is_valid_http_url(v_spec_url) then
      v_spec_url := null;
    end if;

    v_spec_links := coalesce(rec.part_spec_links #> '{psu,links}', '[]'::jsonb);
    if not private.is_valid_spec_links(v_spec_links) then
      v_spec_links := '[]'::jsonb;
    end if;

    insert into public.psus (
      brand,
      model,
      wattage,
      has_8pin_cpu,
      has_6pin_pcie,
      spec_url,
      spec_links
    )
    values (
      v_brand,
      v_model,
      rec.psu_wattage,
      rec.psu_has_8pin_cpu,
      rec.psu_has_6pin_pcie,
      v_spec_url,
      v_spec_links
    )
    on conflict ((lower(brand)), (lower(model)), (coalesce(wattage, 0))) do update set
      has_8pin_cpu = coalesce(public.psus.has_8pin_cpu, excluded.has_8pin_cpu),
      has_6pin_pcie = coalesce(public.psus.has_6pin_pcie, excluded.has_6pin_pcie),
      spec_url = coalesce(public.psus.spec_url, excluded.spec_url),
      spec_links = case
        when jsonb_array_length(public.psus.spec_links) > 0 then public.psus.spec_links
        else excluded.spec_links
      end
    returning id into v_part_id;

    update public.computers
    set psu_id = v_part_id
    where id = rec.computer_id
      and psu_id is null;
  end loop;

  -- 6e. Wi-Fi Cards (Desktops & Laptops with wifi_model or wifi_product)
  for rec in
    select
      c.id as computer_id,
      c.device_type,
      c.wifi_brand,
      c.wifi_product,
      c.wifi_model,
      c.wifi_standard,
      c.bluetooth_version,
      c.wifi_form_factor,
      c.part_spec_links
    from public.computers c
    where nullif(btrim(c.wifi_model), '') is not null
       or nullif(btrim(c.wifi_product), '') is not null
  loop
    v_brand := coalesce(nullif(btrim(rec.wifi_brand), ''), 'Unknown');
    v_product := nullif(btrim(rec.wifi_product), '');
    v_model := coalesce(nullif(btrim(rec.wifi_model), ''), v_product);
    v_is_mobile := (rec.device_type = 'Laptop');

    v_spec_url := nullif(btrim(rec.part_spec_links #>> '{wifi,spec_url}'), '');
    if v_spec_url is not null and not private.is_valid_http_url(v_spec_url) then
      v_spec_url := null;
    end if;

    v_spec_links := coalesce(rec.part_spec_links #> '{wifi,links}', '[]'::jsonb);
    if not private.is_valid_spec_links(v_spec_links) then
      v_spec_links := '[]'::jsonb;
    end if;

    insert into public.wifi_cards (
      brand,
      product,
      model,
      wifi_standard,
      bluetooth_version,
      form_factor,
      is_mobile,
      spec_url,
      spec_links
    )
    values (
      v_brand,
      v_product,
      v_model,
      nullif(btrim(rec.wifi_standard), ''),
      nullif(btrim(rec.bluetooth_version), ''),
      nullif(btrim(rec.wifi_form_factor), ''),
      v_is_mobile,
      v_spec_url,
      v_spec_links
    )
    on conflict ((lower(brand)), (lower(coalesce(product, ''))), (lower(model)), is_mobile) do update set
      wifi_standard = coalesce(public.wifi_cards.wifi_standard, excluded.wifi_standard),
      bluetooth_version = coalesce(public.wifi_cards.bluetooth_version, excluded.bluetooth_version),
      form_factor = coalesce(public.wifi_cards.form_factor, excluded.form_factor),
      spec_url = coalesce(public.wifi_cards.spec_url, excluded.spec_url),
      spec_links = case
        when jsonb_array_length(public.wifi_cards.spec_links) > 0 then public.wifi_cards.spec_links
        else excluded.spec_links
      end
    returning id into v_part_id;

    update public.computers
    set wifi_card_id = v_part_id
    where id = rec.computer_id
      and wifi_card_id is null;
  end loop;

  -- 6f. Storage Drive Models (All storage_drives)
  for rec in
    select
      sd.id as drive_id,
      sd.brand,
      sd.model,
      sd.model_number,
      sd.capacity_gb,
      sd.form_factor,
      sd.nand_type,
      sd.read_mb_s,
      sd.write_mb_s,
      sd.spec_url,
      sd.spec_links
    from public.storage_drives sd
    where nullif(btrim(sd.model), '') is not null
       or nullif(btrim(sd.model_number), '') is not null
       or nullif(btrim(sd.brand), '') is not null
       or sd.capacity_gb is not null
  loop
    v_brand := nullif(btrim(rec.brand), '');
    v_model := coalesce(
      nullif(btrim(rec.model), ''),
      nullif(btrim(rec.model_number), ''),
      coalesce(nullif(btrim(rec.form_factor), ''), 'Storage Drive')
    );

    v_spec_url := nullif(btrim(rec.spec_url), '');
    if v_spec_url is not null and not private.is_valid_http_url(v_spec_url) then
      v_spec_url := null;
    end if;

    v_spec_links := coalesce(rec.spec_links, '[]'::jsonb);
    if not private.is_valid_spec_links(v_spec_links) then
      v_spec_links := '[]'::jsonb;
    end if;

    insert into public.storage_drive_models (
      brand,
      model,
      model_number,
      capacity_gb,
      form_factor,
      nand_type,
      read_mb_s,
      write_mb_s,
      spec_url,
      spec_links
    )
    values (
      v_brand,
      v_model,
      nullif(btrim(rec.model_number), ''),
      nullif(rec.capacity_gb, 0),
      nullif(btrim(rec.form_factor), ''),
      nullif(btrim(rec.nand_type), ''),
      nullif(rec.read_mb_s, 0),
      nullif(rec.write_mb_s, 0),
      v_spec_url,
      v_spec_links
    )
    on conflict (
      (lower(coalesce(brand, ''))),
      (lower(model)),
      (coalesce(capacity_gb, 0)),
      (lower(coalesce(form_factor, '')))
    ) do update set
      model_number = coalesce(public.storage_drive_models.model_number, excluded.model_number),
      nand_type = coalesce(public.storage_drive_models.nand_type, excluded.nand_type),
      read_mb_s = coalesce(public.storage_drive_models.read_mb_s, excluded.read_mb_s),
      write_mb_s = coalesce(public.storage_drive_models.write_mb_s, excluded.write_mb_s),
      spec_url = coalesce(public.storage_drive_models.spec_url, excluded.spec_url),
      spec_links = case
        when jsonb_array_length(public.storage_drive_models.spec_links) > 0 then public.storage_drive_models.spec_links
        else excluded.spec_links
      end
    returning id into v_part_id;

    update public.storage_drives
    set storage_drive_model_id = v_part_id
    where id = rec.drive_id
      and storage_drive_model_id is null;
  end loop;
end;
$$;
