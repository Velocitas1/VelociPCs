import { useCallback, useEffect, useState } from 'react';
import { compareBenchmarksNewestFirst } from '../lib/benchmarks';
import { PART_CATEGORY_META, type SpareAdjustment } from '../lib/parts';
import {
  getSafeHttpUrl,
  sanitizePartSpecLinks,
  sanitizeSpecLinks,
} from '../lib/specLinks';
import {
  evaluateRigGameCompatibility,
  parseSteamPcRequirements,
} from '../lib/steamCompatibility';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  Benchmark,
  BuildGameCompatibility,
  CatalogPart,
  CatalogPartCategory,
  CompatibilityStatus,
  Computer,
  ComputerPartLinkSlot,
  ComputerWithRelations,
  Cooler,
  Cpu,
  Gpu,
  GpuCard,
  Motherboard,
  PartSpecLinkEntry,
  PartSpecLinksMap,
  PcCase,
  Psu,
  RamKit,
  SpareTableName,
  SpecLinkItem,
  SteamGame,
  SteamRequirementsStatus,
  StorageDriveModel,
  WifiCard,
} from '../types/database';

export interface DriveDraft {
  id?: number;
  storage_drive_model_id: number | null;
  capacity_gb: number | null;
  form_factor: string | null;
  brand: string | null;
  model: string | null;
  model_number: string | null;
  nand_type: string | null;
  read_mb_s: number | null;
  write_mb_s: number | null;
  is_primary: boolean;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
}

export type ComputerUpsertPayload = Omit<
  Computer,
  'id' | 'created_at' | 'updated_at'
>;

export interface SteamGameOverridePatch {
  min_directx: string | null;
  rec_directx: string | null;
  min_vram_gb: number | null;
  rec_vram_gb: number | null;
  min_ram_gb: number | null;
  rec_ram_gb: number | null;
  storage_gb: number | null;
  override_notes: string | null;
}

async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function normalizeLinksEntity<
  T extends { spec_url: string | null; spec_links: SpecLinkItem[] },
>(item: T): T {
  return {
    ...item,
    spec_url: getSafeHttpUrl(item.spec_url),
    spec_links: sanitizeSpecLinks(item.spec_links),
  };
}

function formatSupabaseError(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') {
    return err instanceof Error ? err.message : fallback;
  }
  const rec = err as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof rec.code === 'string' ? rec.code : '';
  const msg = typeof rec.message === 'string' ? rec.message : fallback;
  if (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST200' ||
    code === 'PGRST205'
  ) {
    return `Database schema is missing Phase 3 parts inventory tables/columns (${code}). Run supabase/migrations/0006_parts_inventory.sql in Supabase SQL Editor and retry.`;
  }
  return msg;
}

export function useInventory() {
  const [computers, setComputers] = useState<ComputerWithRelations[]>([]);
  const [cpus, setCpus] = useState<Cpu[]>([]);
  const [gpus, setGpus] = useState<Gpu[]>([]);
  const [gpuCards, setGpuCards] = useState<GpuCard[]>([]);
  const [motherboards, setMotherboards] = useState<Motherboard[]>([]);
  const [ramKits, setRamKits] = useState<RamKit[]>([]);
  const [storageDriveModels, setStorageDriveModels] = useState<
    StorageDriveModel[]
  >([]);
  const [psus, setPsus] = useState<Psu[]>([]);
  const [cases, setCases] = useState<PcCase[]>([]);
  const [coolers, setCoolers] = useState<Cooler[]>([]);
  const [wifiCards, setWifiCards] = useState<WifiCard[]>([]);
  const [steamGames, setSteamGames] = useState<SteamGame[]>([]);
  const [compatibilityRows, setCompatibilityRows] = useState<
    BuildGameCompatibility[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.',
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        compRes,
        cpuRes,
        gpuRes,
        gpuCardRes,
        mbRes,
        ramRes,
        driveModelRes,
        psuRes,
        caseRes,
        coolerRes,
        wifiRes,
      ] = await Promise.all([
        supabase
          .from('computers')
          .select(
            `
            *,
            cpu:cpus!computers_cpu_id_fkey(*),
            gpu:gpus!computers_gpu_id_fkey(*),
            gpu_card:gpu_cards!computers_gpu_card_id_fkey(*, gpu:gpus!gpu_cards_gpu_id_fkey(*)),
            igpu:gpus!computers_igpu_id_fkey(*),
            motherboard:motherboards!computers_motherboard_id_fkey(*),
            ram_kit:ram_kits!computers_ram_kit_id_fkey(*),
            psu:psus!computers_psu_id_fkey(*),
            pc_case:cases!computers_case_id_fkey(*),
            cooler:coolers!computers_cooler_id_fkey(*),
            wifi_card:wifi_cards!computers_wifi_card_id_fkey(*),
            storage_drives(*, storage_drive_model:storage_drive_models!storage_drives_storage_drive_model_id_fkey(*)),
            benchmarks(*)
          `,
          )
          .order('device_type', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('cpus')
          .select('*')
          .order('brand', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('gpus')
          .select('*')
          .order('brand', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('gpu_cards')
          .select('*, gpu:gpus!gpu_cards_gpu_id_fkey(*)')
          .order('brand', { ascending: true })
          .order('model', { ascending: true }),
        supabase
          .from('motherboards')
          .select('*')
          .order('brand', { ascending: true })
          .order('model', { ascending: true }),
        supabase
          .from('ram_kits')
          .select('*')
          .order('capacity_gb', { ascending: false })
          .order('model', { ascending: true }),
        supabase
          .from('storage_drive_models')
          .select('*')
          .order('brand', { ascending: true })
          .order('model', { ascending: true }),
        supabase
          .from('psus')
          .select('*')
          .order('brand', { ascending: true })
          .order('wattage', { ascending: false }),
        supabase
          .from('cases')
          .select('*')
          .order('brand', { ascending: true })
          .order('model', { ascending: true }),
        supabase
          .from('coolers')
          .select('*')
          .order('brand', { ascending: true })
          .order('model', { ascending: true }),
        supabase
          .from('wifi_cards')
          .select('*')
          .order('brand', { ascending: true })
          .order('model', { ascending: true }),
      ]);

      const firstErr =
        compRes.error ||
        cpuRes.error ||
        gpuRes.error ||
        gpuCardRes.error ||
        mbRes.error ||
        ramRes.error ||
        driveModelRes.error ||
        psuRes.error ||
        caseRes.error ||
        coolerRes.error ||
        wifiRes.error;
      if (firstErr) throw firstErr;

      const [allSteamGames, allCompatRows] = await Promise.all([
        fetchAllRows<SteamGame>((from, to) =>
          supabase
            .from('steam_library')
            .select('*')
            .order('playtime_minutes', { ascending: false })
            .order('title', { ascending: true })
            .range(from, to),
        ),
        fetchAllRows<BuildGameCompatibility>((from, to) =>
          supabase
            .from('build_game_compatibility')
            .select('*')
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ]);

      const normalizedComputers = (
        (compRes.data ?? []) as ComputerWithRelations[]
      ).map((c) => ({
        ...c,
        part_spec_links: sanitizePartSpecLinks(c.part_spec_links),
        cpu: c.cpu ? normalizeLinksEntity(c.cpu) : null,
        gpu: c.gpu ? normalizeLinksEntity(c.gpu) : null,
        gpu_card: c.gpu_card
          ? {
              ...normalizeLinksEntity(c.gpu_card),
              gpu: c.gpu_card.gpu ? normalizeLinksEntity(c.gpu_card.gpu) : null,
            }
          : null,
        igpu: c.igpu ? normalizeLinksEntity(c.igpu) : null,
        motherboard: c.motherboard ? normalizeLinksEntity(c.motherboard) : null,
        ram_kit: c.ram_kit ? normalizeLinksEntity(c.ram_kit) : null,
        psu: c.psu ? normalizeLinksEntity(c.psu) : null,
        pc_case: c.pc_case ? normalizeLinksEntity(c.pc_case) : null,
        cooler: c.cooler ? normalizeLinksEntity(c.cooler) : null,
        wifi_card: c.wifi_card ? normalizeLinksEntity(c.wifi_card) : null,
        storage_drives: [...(c.storage_drives ?? [])]
          .map((d) => ({
            ...normalizeLinksEntity(d),
            storage_drive_model: d.storage_drive_model
              ? normalizeLinksEntity(d.storage_drive_model)
              : null,
          }))
          .sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
        benchmarks: [...(c.benchmarks ?? [])].sort(compareBenchmarksNewestFirst),
      }));

      setComputers(normalizedComputers);
      setCpus(((cpuRes.data ?? []) as Cpu[]).map(normalizeLinksEntity));
      setGpus(((gpuRes.data ?? []) as Gpu[]).map(normalizeLinksEntity));
      setGpuCards(
        ((gpuCardRes.data ?? []) as GpuCard[]).map((card) => ({
          ...normalizeLinksEntity(card),
          gpu: card.gpu ? normalizeLinksEntity(card.gpu) : null,
        })),
      );
      setMotherboards(
        ((mbRes.data ?? []) as Motherboard[]).map(normalizeLinksEntity),
      );
      setRamKits(((ramRes.data ?? []) as RamKit[]).map(normalizeLinksEntity));
      setStorageDriveModels(
        ((driveModelRes.data ?? []) as StorageDriveModel[]).map(
          normalizeLinksEntity,
        ),
      );
      setPsus(((psuRes.data ?? []) as Psu[]).map(normalizeLinksEntity));
      setCases(((caseRes.data ?? []) as PcCase[]).map(normalizeLinksEntity));
      setCoolers(((coolerRes.data ?? []) as Cooler[]).map(normalizeLinksEntity));
      setWifiCards(
        ((wifiRes.data ?? []) as WifiCard[]).map(normalizeLinksEntity),
      );
      setSteamGames(allSteamGames);
      setCompatibilityRows(allCompatRows);
    } catch (err) {
      setError(formatSupabaseError(err, 'Failed to load inventory.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshSteamData = useCallback(async () => {
    const [allSteamGames, allCompatRows] = await Promise.all([
      fetchAllRows<SteamGame>((from, to) =>
        supabase
          .from('steam_library')
          .select('*')
          .order('playtime_minutes', { ascending: false })
          .order('title', { ascending: true })
          .range(from, to),
      ),
      fetchAllRows<BuildGameCompatibility>((from, to) =>
        supabase
          .from('build_game_compatibility')
          .select('*')
          .order('id', { ascending: true })
          .range(from, to),
      ),
    ]);
    setSteamGames(allSteamGames);
    setCompatibilityRows(allCompatRows);
  }, []);

  const evaluateAndPersistForComputer = useCallback(
    async (computerId: number) => {
      const [compRes, games] = await Promise.all([
        supabase
          .from('computers')
          .select(
            `
            *,
            cpu:cpus!computers_cpu_id_fkey(*),
            gpu:gpus!computers_gpu_id_fkey(*),
            gpu_card:gpu_cards!computers_gpu_card_id_fkey(*, gpu:gpus!gpu_cards_gpu_id_fkey(*)),
            igpu:gpus!computers_igpu_id_fkey(*),
            motherboard:motherboards!computers_motherboard_id_fkey(*),
            ram_kit:ram_kits!computers_ram_kit_id_fkey(*),
            psu:psus!computers_psu_id_fkey(*),
            pc_case:cases!computers_case_id_fkey(*),
            cooler:coolers!computers_cooler_id_fkey(*),
            wifi_card:wifi_cards!computers_wifi_card_id_fkey(*),
            storage_drives(*, storage_drive_model:storage_drive_models!storage_drives_storage_drive_model_id_fkey(*)),
            benchmarks(*)
          `,
          )
          .eq('id', computerId)
          .single(),
        fetchAllRows<SteamGame>((from, to) =>
          supabase
            .from('steam_library')
            .select('*')
            .order('app_id', { ascending: true })
            .range(from, to),
        ),
      ]);

      if (compRes.error) throw compRes.error;
      if (games.length === 0 || !compRes.data) return;

      const rig = compRes.data as unknown as ComputerWithRelations;
      const nowIso = new Date().toISOString();
      const rows: Array<{
        computer_id: number;
        steam_app_id: number;
        status: CompatibilityStatus;
        blocking_reason: string | null;
        evaluated_at: string;
      }> = games.map((game) => {
        const res = evaluateRigGameCompatibility(rig, game);
        return {
          computer_id: rig.id,
          steam_app_id: game.app_id,
          status: res.status,
          blocking_reason: res.blocking_reason,
          evaluated_at: nowIso,
        };
      });

      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error: upsertErr } = await supabase
          .from('build_game_compatibility')
          .upsert(rows.slice(i, i + chunkSize), {
            onConflict: 'computer_id,steam_app_id',
          });
        if (upsertErr) throw upsertErr;
      }
    },
    [],
  );

  const saveComputer = useCallback(
    async (
      payload: ComputerUpsertPayload,
      drives: DriveDraft[],
      existingId?: number,
      spareAdjustments?: SpareAdjustment[],
    ): Promise<number> => {
      let computerId = existingId;
      if (existingId) {
        const { error: updErr } = await supabase
          .from('computers')
          .update(payload)
          .eq('id', existingId);
        if (updErr) throw updErr;
      } else {
        const { data, error: insErr } = await supabase
          .from('computers')
          .insert(payload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        computerId = data.id as number;
      }

      if (computerId) {
        const { error: delErr } = await supabase
          .from('storage_drives')
          .delete()
          .eq('computer_id', computerId);
        if (delErr) throw delErr;

        const cleanDrives = drives.filter(
          (d) =>
            d.storage_drive_model_id !== null ||
            d.capacity_gb !== null ||
            Boolean(d.brand?.trim()) ||
            Boolean(d.model?.trim()) ||
            Boolean(d.form_factor?.trim()),
        );
        if (cleanDrives.length > 0) {
          const { error: insDrivesErr } = await supabase
            .from('storage_drives')
            .insert(
              cleanDrives.map((d, index) => ({
                computer_id: computerId!,
                storage_drive_model_id: d.storage_drive_model_id ?? null,
                capacity_gb: d.capacity_gb,
                form_factor: d.form_factor || null,
                brand: d.brand || null,
                model: d.model || null,
                model_number: d.model_number || null,
                nand_type: d.nand_type || null,
                read_mb_s: d.read_mb_s,
                write_mb_s: d.write_mb_s,
                is_primary: index === 0 ? true : d.is_primary,
                spec_url: getSafeHttpUrl(d.spec_url),
                spec_links: sanitizeSpecLinks(d.spec_links),
              })),
            );
          if (insDrivesErr) throw insDrivesErr;
        }
      }

      if (spareAdjustments && spareAdjustments.length > 0) {
        for (const adj of spareAdjustments) {
          if (adj.delta === 0) continue;
          const { error: rpcErr } = await supabase.rpc(
            'adjust_part_spare_count',
            {
              p_table: adj.table,
              p_id: adj.id,
              p_delta: adj.delta,
            },
          );
          if (rpcErr) throw rpcErr;
        }
      }

      if (computerId) {
        await evaluateAndPersistForComputer(computerId);
      }

      await refresh();
      return computerId!;
    },
    [evaluateAndPersistForComputer, refresh],
  );

  const deleteComputer = useCallback(
    async (id: number) => {
      const { error: delErr } = await supabase
        .from('computers')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      await refresh();
    },
    [refresh],
  );

  const saveCpu = useCallback(
    async (
      payload: Omit<Cpu, 'id' | 'created_at' | 'updated_at'>,
      existingId?: number,
    ): Promise<Cpu> => {
      if (existingId) {
        const { data, error: updErr } = await supabase
          .from('cpus')
          .update(payload)
          .eq('id', existingId)
          .select('*')
          .single();
        if (updErr) throw updErr;
        await refresh();
        return data as Cpu;
      }
      const { data, error: insErr } = await supabase
        .from('cpus')
        .insert(payload)
        .select('*')
        .single();
      if (insErr) throw insErr;
      await refresh();
      return data as Cpu;
    },
    [refresh],
  );

  const deleteCpu = useCallback(
    async (id: number) => {
      const { error: delErr } = await supabase.from('cpus').delete().eq('id', id);
      if (delErr) throw delErr;
      await refresh();
    },
    [refresh],
  );

  const saveGpu = useCallback(
    async (
      payload: Omit<Gpu, 'id' | 'created_at' | 'updated_at'>,
      existingId?: number,
    ): Promise<Gpu> => {
      if (existingId) {
        const { data, error: updErr } = await supabase
          .from('gpus')
          .update(payload)
          .eq('id', existingId)
          .select('*')
          .single();
        if (updErr) throw updErr;
        if (steamGames.length > 0) {
          const affected = computers.filter(
            (c) => c.gpu_id === existingId || c.igpu_id === existingId,
          );
          for (const rig of affected) {
            await evaluateAndPersistForComputer(rig.id);
          }
        }
        await refresh();
        return data as Gpu;
      }
      const { data, error: insErr } = await supabase
        .from('gpus')
        .insert(payload)
        .select('*')
        .single();
      if (insErr) throw insErr;
      await refresh();
      return data as Gpu;
    },
    [computers, evaluateAndPersistForComputer, refresh, steamGames.length],
  );

  const deleteGpu = useCallback(
    async (id: number) => {
      const { error: delErr } = await supabase.from('gpus').delete().eq('id', id);
      if (delErr) throw delErr;
      await refresh();
    },
    [refresh],
  );

  const saveCatalogPart = useCallback(
    async (
      category: CatalogPartCategory,
      payload: Record<string, unknown>,
      existingId?: number,
    ): Promise<CatalogPart> => {
      const table = PART_CATEGORY_META[category].table;
      const cleanPayload = {
        ...payload,
        spec_url: getSafeHttpUrl(
          typeof payload.spec_url === 'string' ? payload.spec_url : null,
        ),
        spec_links: sanitizeSpecLinks(payload.spec_links),
      };
      const selectCols =
        category === 'gpu_card'
          ? '*, gpu:gpus!gpu_cards_gpu_id_fkey(*)'
          : '*';

      if (existingId) {
        const { data, error: updErr } = await supabase
          .from(table)
          .update(cleanPayload)
          .eq('id', existingId)
          .select(selectCols)
          .single();
        if (updErr) throw updErr;
        await refresh();
        return data as unknown as CatalogPart;
      }

      const { data, error: insErr } = await supabase
        .from(table)
        .insert(cleanPayload)
        .select(selectCols)
        .single();
      if (insErr) throw insErr;
      await refresh();
      return data as unknown as CatalogPart;
    },
    [refresh],
  );

  const deleteCatalogPart = useCallback(
    async (category: CatalogPartCategory, id: number) => {
      const table = PART_CATEGORY_META[category].table;
      const { error: delErr } = await supabase.from(table).delete().eq('id', id);
      if (delErr) throw delErr;
      await refresh();
    },
    [refresh],
  );

  const adjustSpareCount = useCallback(
    async (
      table: SpareTableName,
      id: number,
      delta: number,
    ): Promise<number> => {
      const { data, error: rpcErr } = await supabase.rpc(
        'adjust_part_spare_count',
        {
          p_table: table,
          p_id: id,
          p_delta: delta,
        },
      );
      if (rpcErr) throw rpcErr;
      await refresh();
      return data as number;
    },
    [refresh],
  );

  const updateCatalogPartLinks = useCallback(
    async (
      table: Exclude<SpareTableName, 'cpus'>,
      id: number,
      specUrl: string | null,
      specLinks: SpecLinkItem[],
    ): Promise<void> => {
      const { error: updErr } = await supabase
        .from(table)
        .update({
          spec_url: getSafeHttpUrl(specUrl),
          spec_links: sanitizeSpecLinks(specLinks),
        })
        .eq('id', id);
      if (updErr) throw updErr;
      await refresh();
    },
    [refresh],
  );

  const saveBenchmark = useCallback(
    async (
      payload: Omit<Benchmark, 'id' | 'created_at' | 'updated_at'>,
      existingId?: number,
    ): Promise<void> => {
      if (existingId) {
        const { error: updErr } = await supabase
          .from('benchmarks')
          .update(payload)
          .eq('id', existingId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('benchmarks')
          .insert(payload);
        if (insErr) throw insErr;
      }
      await refresh();
    },
    [refresh],
  );

  const deleteBenchmark = useCallback(
    async (id: number) => {
      const { error: delErr } = await supabase
        .from('benchmarks')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      await refresh();
    },
    [refresh],
  );

  const updateCpuLinks = useCallback(
    async (
      id: number,
      specUrl: string | null,
      specLinks: SpecLinkItem[],
    ): Promise<void> => {
      const { error: updErr } = await supabase
        .from('cpus')
        .update({
          spec_url: getSafeHttpUrl(specUrl),
          spec_links: sanitizeSpecLinks(specLinks),
        })
        .eq('id', id);
      if (updErr) throw updErr;
      await refresh();
    },
    [refresh],
  );

  const updateGpuLinks = useCallback(
    async (
      id: number,
      specUrl: string | null,
      specLinks: SpecLinkItem[],
    ): Promise<void> => {
      const { error: updErr } = await supabase
        .from('gpus')
        .update({
          spec_url: getSafeHttpUrl(specUrl),
          spec_links: sanitizeSpecLinks(specLinks),
        })
        .eq('id', id);
      if (updErr) throw updErr;
      await refresh();
    },
    [refresh],
  );

  const updateStorageDriveLinks = useCallback(
    async (
      id: number,
      specUrl: string | null,
      specLinks: SpecLinkItem[],
    ): Promise<void> => {
      const { error: updErr } = await supabase
        .from('storage_drives')
        .update({
          spec_url: getSafeHttpUrl(specUrl),
          spec_links: sanitizeSpecLinks(specLinks),
        })
        .eq('id', id);
      if (updErr) throw updErr;
      await refresh();
    },
    [refresh],
  );

  const updateComputerPartSlotLinks = useCallback(
    async (
      computerId: number,
      currentMap: PartSpecLinksMap,
      slot: ComputerPartLinkSlot,
      entry: PartSpecLinkEntry | null,
    ): Promise<void> => {
      const nextRaw: PartSpecLinksMap = { ...currentMap };
      if (entry) {
        nextRaw[slot] = entry;
      } else {
        delete nextRaw[slot];
      }
      const cleaned = sanitizePartSpecLinks(nextRaw);
      const { error: updErr } = await supabase
        .from('computers')
        .update({ part_spec_links: cleaned })
        .eq('id', computerId);
      if (updErr) throw updErr;
      await refresh();
    },
    [refresh],
  );

  const saveSteamGameOverride = useCallback(
    async (appId: number, patch: SteamGameOverridePatch): Promise<void> => {
      const hasAnyReq =
        patch.min_directx !== null ||
        patch.rec_directx !== null ||
        patch.min_vram_gb !== null ||
        patch.rec_vram_gb !== null ||
        patch.min_ram_gb !== null ||
        patch.rec_ram_gb !== null ||
        patch.storage_gb !== null;

      const reqStatus: SteamRequirementsStatus = hasAnyReq
        ? 'parsed'
        : 'missing';

      const { data: updatedGame, error: updErr } = await supabase
        .from('steam_library')
        .update({
          ...patch,
          manual_override: true,
          requirements_status: reqStatus,
        })
        .eq('app_id', appId)
        .select('*')
        .single();
      if (updErr) throw updErr;

      const game = updatedGame as SteamGame;
      if (computers.length > 0) {
        const nowIso = new Date().toISOString();
        const rows = computers.map((rig) => {
          const res = evaluateRigGameCompatibility(rig, game);
          return {
            computer_id: rig.id,
            steam_app_id: game.app_id,
            status: res.status,
            blocking_reason: res.blocking_reason,
            evaluated_at: nowIso,
          };
        });
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const { error: compatErr } = await supabase
            .from('build_game_compatibility')
            .upsert(rows.slice(i, i + chunkSize), {
              onConflict: 'computer_id,steam_app_id',
            });
          if (compatErr) throw compatErr;
        }
      }

      await refreshSteamData();
    },
    [computers, refreshSteamData],
  );

  const resetSteamGameOverride = useCallback(
    async (game: SteamGame): Promise<void> => {
      const parsed = parseSteamPcRequirements(game.raw_requirements);
      const reqStatus: SteamRequirementsStatus = parsed.hasAnyRequirement
        ? 'parsed'
        : 'missing';

      const { data: updatedGame, error: updErr } = await supabase
        .from('steam_library')
        .update({
          min_directx: parsed.min_directx,
          rec_directx: parsed.rec_directx,
          min_vram_gb: parsed.min_vram_gb,
          rec_vram_gb: parsed.rec_vram_gb,
          min_ram_gb: parsed.min_ram_gb,
          rec_ram_gb: parsed.rec_ram_gb,
          storage_gb: parsed.storage_gb,
          manual_override: false,
          override_notes: null,
          requirements_status: reqStatus,
        })
        .eq('app_id', game.app_id)
        .select('*')
        .single();
      if (updErr) throw updErr;

      const nextGame = updatedGame as SteamGame;
      if (computers.length > 0) {
        const nowIso = new Date().toISOString();
        const rows = computers.map((rig) => {
          const res = evaluateRigGameCompatibility(rig, nextGame);
          return {
            computer_id: rig.id,
            steam_app_id: nextGame.app_id,
            status: res.status,
            blocking_reason: res.blocking_reason,
            evaluated_at: nowIso,
          };
        });
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const { error: compatErr } = await supabase
            .from('build_game_compatibility')
            .upsert(rows.slice(i, i + chunkSize), {
              onConflict: 'computer_id,steam_app_id',
            });
          if (compatErr) throw compatErr;
        }
      }

      await refreshSteamData();
    },
    [computers, refreshSteamData],
  );

  const reevaluateAllSteamCompatibility = useCallback(async (): Promise<{
    computersEvaluated: number;
    gamesEvaluated: number;
    rowsUpserted: number;
  }> => {
    const { data, error: fnErr } = await supabase.functions.invoke(
      'sync-steam-library',
      {
        body: { action: 'evaluate_all' },
      },
    );
    if (fnErr) throw fnErr;
    const result = data as {
      status?: string;
      error?: string;
      computersEvaluated?: number;
      gamesEvaluated?: number;
      rowsUpserted?: number;
    };
    if (result.status === 'error') {
      throw new Error(result.error || 'Failed to evaluate Steam compatibility.');
    }
    await refreshSteamData();
    return {
      computersEvaluated: result.computersEvaluated ?? 0,
      gamesEvaluated: result.gamesEvaluated ?? 0,
      rowsUpserted: result.rowsUpserted ?? 0,
    };
  }, [refreshSteamData]);

  return {
    computers,
    cpus,
    gpus,
    gpuCards,
    motherboards,
    ramKits,
    storageDriveModels,
    psus,
    cases,
    coolers,
    wifiCards,
    steamGames,
    compatibilityRows,
    loading,
    error,
    refresh,
    refreshSteamData,
    saveSteamGameOverride,
    resetSteamGameOverride,
    reevaluateAllSteamCompatibility,
    saveComputer,
    deleteComputer,
    saveCpu,
    deleteCpu,
    saveGpu,
    deleteGpu,
    saveCatalogPart,
    deleteCatalogPart,
    adjustSpareCount,
    updateCatalogPartLinks,
    saveBenchmark,
    deleteBenchmark,
    updateCpuLinks,
    updateGpuLinks,
    updateStorageDriveLinks,
    updateComputerPartSlotLinks,
  };
}
