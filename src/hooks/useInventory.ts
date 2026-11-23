import { useCallback, useEffect, useState } from 'react';
import { compareBenchmarksNewestFirst } from '../lib/benchmarks';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  Benchmark,
  BuildGameCompatibility,
  Computer,
  ComputerWithRelations,
  Cpu,
  Gpu,
  SteamGame,
} from '../types/database';

export interface DriveDraft {
  id?: number;
  capacity_gb: number | null;
  form_factor: string | null;
  brand: string | null;
  model: string | null;
  model_number: string | null;
  nand_type: string | null;
  read_mb_s: number | null;
  write_mb_s: number | null;
  is_primary: boolean;
}

export type ComputerUpsertPayload = Omit<
  Computer,
  'id' | 'created_at' | 'updated_at'
>;

export function useInventory() {
  const [computers, setComputers] = useState<ComputerWithRelations[]>([]);
  const [cpus, setCpus] = useState<Cpu[]>([]);
  const [gpus, setGpus] = useState<Gpu[]>([]);
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
      const [compRes, cpuRes, gpuRes, steamRes, compatRes] = await Promise.all([
        supabase
          .from('computers')
          .select(
            `
            *,
            cpu:cpus!computers_cpu_id_fkey(*),
            gpu:gpus!computers_gpu_id_fkey(*),
            igpu:gpus!computers_igpu_id_fkey(*),
            storage_drives(*),
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
          .from('steam_library')
          .select('*')
          .order('title', { ascending: true }),
        supabase
          .from('build_game_compatibility')
          .select('*'),
      ]);

      if (compRes.error) throw compRes.error;
      if (cpuRes.error) throw cpuRes.error;
      if (gpuRes.error) throw gpuRes.error;
      if (steamRes.error) throw steamRes.error;
      if (compatRes.error) throw compatRes.error;

      const normalizedComputers = (
        (compRes.data ?? []) as ComputerWithRelations[]
      ).map((c) => ({
        ...c,
        storage_drives: [...(c.storage_drives ?? [])].sort((a, b) =>
          Number(b.is_primary) - Number(a.is_primary),
        ),
        benchmarks: [...(c.benchmarks ?? [])].sort(compareBenchmarksNewestFirst),
      }));

      setComputers(normalizedComputers);
      setCpus((cpuRes.data ?? []) as Cpu[]);
      setGpus((gpuRes.data ?? []) as Gpu[]);
      setSteamGames((steamRes.data ?? []) as SteamGame[]);
      setCompatibilityRows((compatRes.data ?? []) as BuildGameCompatibility[]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load inventory.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveComputer = useCallback(
    async (
      payload: ComputerUpsertPayload,
      drives: DriveDraft[],
      existingId?: number,
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
                capacity_gb: d.capacity_gb,
                form_factor: d.form_factor || null,
                brand: d.brand || null,
                model: d.model || null,
                model_number: d.model_number || null,
                nand_type: d.nand_type || null,
                read_mb_s: d.read_mb_s,
                write_mb_s: d.write_mb_s,
                is_primary: index === 0 ? true : d.is_primary,
              })),
            );
          if (insDrivesErr) throw insDrivesErr;
        }
      }

      await refresh();
      return computerId!;
    },
    [refresh],
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
    [refresh],
  );

  const deleteGpu = useCallback(
    async (id: number) => {
      const { error: delErr } = await supabase.from('gpus').delete().eq('id', id);
      if (delErr) throw delErr;
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

  return {
    computers,
    cpus,
    gpus,
    steamGames,
    compatibilityRows,
    loading,
    error,
    refresh,
    saveComputer,
    deleteComputer,
    saveCpu,
    deleteCpu,
    saveGpu,
    deleteGpu,
    saveBenchmark,
    deleteBenchmark,
  };
}
