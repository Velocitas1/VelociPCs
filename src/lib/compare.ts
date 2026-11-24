import type { AppTab, ComputerWithRelations } from '../types/database';
import { BENCHMARK_PRESET_SUITES, getLatestBenchmarksMap } from './benchmarks';
import { getDirectXTierRank } from './directx';
import type { RigFleetStanding } from './scoring';

export type CompareSortPreset =
  | 'manual'
  | 'fleet_rank'
  | 'cpu'
  | 'gpu'
  | 'directx'
  | '3dmark';

export type CompareSortDir = 'desc' | 'asc';

export type CompareSectionId =
  | 'overview'
  | 'cpu'
  | 'gpu'
  | 'memory_board'
  | 'storage'
  | 'power_wireless'
  | 'benchmarks';

export interface CompareState {
  ids: number[];
  sort: CompareSortPreset;
  dir: CompareSortDir;
  suite: string | null;
  diffOnly: boolean;
}

export const DEFAULT_COMPARE_STATE: CompareState = {
  ids: [],
  sort: 'manual',
  dir: 'desc',
  suite: null,
  diffOnly: false,
};

export const DEFAULT_EXPANDED_SECTIONS: Record<CompareSectionId, boolean> = {
  overview: true,
  cpu: true,
  gpu: true,
  memory_board: false,
  storage: false,
  power_wireless: false,
  benchmarks: true,
};

export const CORE_BENCHMARK_SUITES = [
  'Time Spy',
  'Fire Strike',
  'Sky Diver',
  'Cloud Gate',
] as const;

export const COMPARE_PARAM_KEYS = [
  'compare',
  'sort',
  'dir',
  'suite',
  'diff',
] as const;

const VALID_SORT_PRESETS: ReadonlySet<CompareSortPreset> = new Set([
  'manual',
  'fleet_rank',
  'cpu',
  'gpu',
  'directx',
  '3dmark',
]);

export function hasCompareUrlParams(search?: string): boolean {
  const params = new URLSearchParams(search ?? window.location.search);
  return params.has('compare');
}

export function readCompareUrlState(search?: string): CompareState {
  const params = new URLSearchParams(search ?? window.location.search);

  const rawCompare = params.get('compare') ?? '';
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of rawCompare.split(',')) {
    const trimmed = part.trim();
    if (!/^\d+$/.test(trimmed)) continue;
    const id = Number(trimmed);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  const rawSort = params.get('sort') as CompareSortPreset | null;
  const sort: CompareSortPreset =
    rawSort && VALID_SORT_PRESETS.has(rawSort) ? rawSort : 'manual';

  const rawDir = params.get('dir');
  const dir: CompareSortDir =
    rawDir === 'asc' || rawDir === 'desc' ? rawDir : 'desc';

  const rawSuite = params.get('suite')?.trim() ?? '';
  const suite = rawSuite.length > 0 ? rawSuite : null;

  const rawDiff = params.get('diff');
  const diffOnly = rawDiff === '1' || rawDiff === 'true';

  return {
    ids,
    sort,
    dir,
    suite,
    diffOnly,
  };
}

function appendCompareParams(
  params: URLSearchParams,
  state: CompareState,
  ids: number[],
): void {
  if (ids.length === 0) return;
  params.set('compare', ids.join(','));
  if (state.sort !== 'manual') {
    params.set('sort', state.sort);
    if (state.dir !== 'desc') {
      params.set('dir', state.dir);
    }
    if (state.sort === '3dmark' && state.suite) {
      params.set('suite', state.suite);
    }
  }
  if (state.diffOnly) {
    params.set('diff', '1');
  }
}

export function buildCompareShareUrl(
  state: CompareState,
  orderedIds?: number[],
): string {
  const ids = orderedIds ?? state.ids;
  const params = new URLSearchParams();
  appendCompareParams(params, state, ids);
  const query = params.toString();
  return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}#compare`;
}

export function syncCompareParamsToUrl(
  activeTab: AppTab,
  state: CompareState,
): void {
  const params = new URLSearchParams(window.location.search);
  for (const key of COMPARE_PARAM_KEYS) {
    params.delete(key);
  }

  if (activeTab === 'compare' && state.ids.length > 0) {
    appendCompareParams(params, state, state.ids);
  }

  const query = params.toString();
  const search = query ? `?${query}` : '';
  const nextUrl = `${window.location.pathname}${search}#${activeTab}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, '', nextUrl);
  }
}

export function getAvailableBenchmarkSuites(
  rigs: ComputerWithRelations[],
): string[] {
  const suiteSet = new Set<string>();
  for (const rig of rigs) {
    const latest = getLatestBenchmarksMap(rig);
    for (const suite of Object.keys(latest)) {
      suiteSet.add(suite);
    }
  }

  const coreOrder = new Map<string, number>(
    CORE_BENCHMARK_SUITES.map((s, idx) => [s, idx]),
  );
  const presetOrder = new Map<string, number>(
    BENCHMARK_PRESET_SUITES.map((s, idx) => [s, idx]),
  );

  return [...suiteSet].sort((a, b) => {
    const aCore = coreOrder.get(a);
    const bCore = coreOrder.get(b);
    if (aCore !== undefined && bCore !== undefined) return aCore - bCore;
    if (aCore !== undefined) return -1;
    if (bCore !== undefined) return 1;

    const aPreset = presetOrder.get(a);
    const bPreset = presetOrder.get(b);
    if (aPreset !== undefined && bPreset !== undefined) return aPreset - bPreset;
    if (aPreset !== undefined) return -1;
    if (bPreset !== undefined) return 1;

    return a.localeCompare(b);
  });
}

export function pickDefaultBenchmarkSuite(
  rigs: ComputerWithRelations[],
): string | null {
  const orderedSuites = getAvailableBenchmarkSuites(rigs);
  if (orderedSuites.length === 0) return null;

  const counts = new Map<string, number>();
  for (const rig of rigs) {
    const latest = getLatestBenchmarksMap(rig);
    for (const suite of Object.keys(latest)) {
      counts.set(suite, (counts.get(suite) ?? 0) + 1);
    }
  }

  let bestSuite = orderedSuites[0];
  let bestCount = counts.get(bestSuite) ?? 0;
  for (let i = 1; i < orderedSuites.length; i += 1) {
    const suite = orderedSuites[i];
    const count = counts.get(suite) ?? 0;
    if (count > bestCount) {
      bestSuite = suite;
      bestCount = count;
    }
  }
  return bestSuite;
}

export function sortComparedRigs(
  rigs: ComputerWithRelations[],
  sort: CompareSortPreset,
  dir: CompareSortDir,
  suite: string | null,
  fleetStandings: Map<number, RigFleetStanding>,
): ComputerWithRelations[] {
  if (sort === 'manual') {
    return [...rigs];
  }

  const latestById = new Map<number, ReturnType<typeof getLatestBenchmarksMap>>();
  if (sort === '3dmark') {
    for (const rig of rigs) {
      latestById.set(rig.id, getLatestBenchmarksMap(rig));
    }
  }

  const getMetric = (rig: ComputerWithRelations): number | null => {
    const standing = fleetStandings.get(rig.id);
    switch (sort) {
      case 'fleet_rank':
        return standing?.compositeScore ?? null;
      case 'cpu':
        return standing?.effectiveCpuScore ?? null;
      case 'gpu':
        return standing?.effectiveGpuScore ?? null;
      case 'directx': {
        const effectiveGpu = rig.gpu ?? rig.igpu;
        const rank = getDirectXTierRank(
          effectiveGpu?.directx_version,
          effectiveGpu?.directx_feature_level,
        );
        return rank > 0 ? rank : null;
      }
      case '3dmark':
        return suite ? (latestById.get(rig.id)?.[suite]?.score ?? null) : null;
    }
  };

  return [...rigs].sort((a, b) => {
    const av = getMetric(a);
    const bv = getMetric(b);

    if (av !== null && bv !== null) {
      if (av !== bv) {
        return dir === 'desc' ? bv - av : av - bv;
      }
      if (sort === 'directx') {
        const gpuA = fleetStandings.get(a.id)?.effectiveGpuScore ?? null;
        const gpuB = fleetStandings.get(b.id)?.effectiveGpuScore ?? null;
        if (gpuA !== null && gpuB !== null && gpuA !== gpuB) {
          return gpuB - gpuA;
        }
        if (gpuA !== null && gpuB === null) return -1;
        if (gpuA === null && gpuB !== null) return 1;
      }
      return a.name.localeCompare(b.name);
    }

    if (av !== null) return -1;
    if (bv !== null) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function computeWinnerRigIds(
  entries: Array<{ rigId: number; value: number | null }>,
): Set<number> {
  const populated = entries.filter(
    (e): e is { rigId: number; value: number } =>
      e.value !== null && Number.isFinite(e.value),
  );
  if (populated.length < 2) {
    return new Set();
  }

  let maxVal = populated[0].value;
  let minVal = populated[0].value;
  for (let i = 1; i < populated.length; i += 1) {
    const val = populated[i].value;
    if (val > maxVal) maxVal = val;
    if (val < minVal) minVal = val;
  }

  if (maxVal === minVal) {
    return new Set();
  }

  const winners = new Set<number>();
  for (const item of populated) {
    if (item.value === maxVal) {
      winners.add(item.rigId);
    }
  }
  return winners;
}

export function moveRigId(
  ids: number[],
  draggedId: number,
  targetId: number,
  position: 'before' | 'after',
): number[] {
  if (draggedId === targetId) return ids;
  if (!ids.includes(draggedId) || !ids.includes(targetId)) return ids;

  const remaining = ids.filter((id) => id !== draggedId);
  const targetIdx = remaining.indexOf(targetId);
  if (targetIdx === -1) return ids;

  const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
  const next = [...remaining];
  next.splice(insertIdx, 0, draggedId);
  return next;
}

export function stepRigId(
  ids: number[],
  rigId: number,
  delta: -1 | 1,
): number[] {
  const idx = ids.indexOf(rigId);
  if (idx === -1) return ids;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= ids.length) return ids;

  const next = [...ids];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

export function hasRowDifference(canonicalValues: string[]): boolean {
  return new Set(canonicalValues).size > 1;
}

export function hasAnyPopulatedValue(canonicalValues: string[]): boolean {
  return canonicalValues.some((v) => v !== '');
}
