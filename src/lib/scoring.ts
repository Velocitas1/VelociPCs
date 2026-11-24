import type { ComputerWithRelations, Cpu, Gpu } from '../types/database';
import { getLatestBenchmarksMap } from './benchmarks';

export const PASSMARK_GPU_WEIGHT = 0.6;
export const PASSMARK_CPU_WEIGHT = 0.4;
export const DUAL_CPU_EXTRA_SOCKET_FACTOR = 0.8;

export interface RankPosition {
  rank: number;
  total: number;
  isTied: boolean;
}

export interface EffectiveGpuPassMark {
  score: number | null;
  source: 'gpu' | 'igpu' | 'none';
  gpu: Gpu | null;
}

export interface RigFleetStanding {
  compositeScore: number | null;
  effectiveCpuScore: number | null;
  rawCpuScore: number | null;
  cpuMultiplier: number;
  effectiveGpuScore: number | null;
  gpuSource: 'gpu' | 'igpu' | 'none';
  isPartial: boolean;
  overallRank: RankPosition | null;
  classRank: RankPosition | null;
  cpuRank: RankPosition | null;
  gpuRank: RankPosition | null;
  benchmarkRanks: Record<string, RankPosition>;
}

/**
 * PassMark multi-socket scaling factor: 1.0x for 1 CPU, 1.8x for 2 CPUs, etc.
 */
export function getCpuSocketMultiplier(cpuCount: number): number {
  const normalizedCount = Math.max(1, Number.isFinite(cpuCount) ? cpuCount : 1);
  return 1 + DUAL_CPU_EXTRA_SOCKET_FACTOR * (normalizedCount - 1);
}

/**
 * Returns the rig's effective PassMark CPU Mark, accounting for multi-socket builds.
 */
export function getEffectiveCpuPassMark(
  cpu: Cpu | null | undefined,
  cpuCount: number,
): number | null {
  if (!cpu || cpu.passmark_score === null || cpu.passmark_score === undefined) {
    return null;
  }
  return Math.round(cpu.passmark_score * getCpuSocketMultiplier(cpuCount));
}

/**
 * Resolves the effective GPU G3D Mark (discrete GPU -> iGPU fallback -> none).
 */
export function getEffectiveGpuPassMark(
  rig: Pick<ComputerWithRelations, 'gpu' | 'igpu'>,
): EffectiveGpuPassMark {
  if (rig.gpu?.passmark_score !== null && rig.gpu?.passmark_score !== undefined) {
    return {
      score: rig.gpu.passmark_score,
      source: 'gpu',
      gpu: rig.gpu,
    };
  }
  if (rig.igpu?.passmark_score !== null && rig.igpu?.passmark_score !== undefined) {
    return {
      score: rig.igpu.passmark_score,
      source: 'igpu',
      gpu: rig.igpu,
    };
  }
  return {
    score: null,
    source: 'none',
    gpu: null,
  };
}

/**
 * Computes standard competition rankings (1, 1, 3) descending by score.
 */
export function computeCompetitionRanks(
  entries: Array<{ id: number; score: number }>,
): Map<number, RankPosition> {
  const result = new Map<number, RankPosition>();
  if (entries.length === 0) return result;

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const counts = new Map<number, number>();
  for (const item of sorted) {
    counts.set(item.score, (counts.get(item.score) ?? 0) + 1);
  }

  const total = sorted.length;
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i].score !== sorted[i - 1].score) {
      currentRank = i + 1;
    }
    const score = sorted[i].score;
    result.set(sorted[i].id, {
      rank: currentRank,
      total,
      isTied: (counts.get(score) ?? 0) > 1,
    });
  }

  return result;
}

/**
 * Computes unified PassMark Fleet Ranks, class ranks, CPU/GPU ranks, and
 * per-suite 3DMark Fleet Ranks across the entire computer inventory.
 */
export function computeFleetRankings(
  computers: ComputerWithRelations[],
): Map<number, RigFleetStanding> {
  interface BaseStanding {
    id: number;
    deviceType: ComputerWithRelations['device_type'];
    compositeScore: number | null;
    effectiveCpuScore: number | null;
    rawCpuScore: number | null;
    cpuMultiplier: number;
    effectiveGpuScore: number | null;
    gpuSource: 'gpu' | 'igpu' | 'none';
    isPartial: boolean;
    latestBenchmarks: Record<string, { score: number }>;
  }

  const baseList: BaseStanding[] = computers.map((rig) => {
    const rawCpuScore = rig.cpu?.passmark_score ?? null;
    const cpuMultiplier = getCpuSocketMultiplier(rig.cpu_count);
    const effectiveCpuScore = getEffectiveCpuPassMark(rig.cpu, rig.cpu_count);
    const gpuInfo = getEffectiveGpuPassMark(rig);
    const effectiveGpuScore = gpuInfo.score;

    const hasCpu = effectiveCpuScore !== null;
    const hasGpu = effectiveGpuScore !== null;
    const isPartial = hasCpu !== hasGpu;

    const compositeScore =
      !hasCpu && !hasGpu
        ? null
        : Math.round(
            PASSMARK_GPU_WEIGHT * (effectiveGpuScore ?? 0) +
              PASSMARK_CPU_WEIGHT * (effectiveCpuScore ?? 0),
          );

    return {
      id: rig.id,
      deviceType: rig.device_type,
      compositeScore,
      effectiveCpuScore,
      rawCpuScore,
      cpuMultiplier,
      effectiveGpuScore,
      gpuSource: gpuInfo.source,
      isPartial,
      latestBenchmarks: getLatestBenchmarksMap(rig),
    };
  });

  const overallEntries = baseList
    .filter((b): b is BaseStanding & { compositeScore: number } => b.compositeScore !== null)
    .map((b) => ({ id: b.id, score: b.compositeScore }));
  const overallRankMap = computeCompetitionRanks(overallEntries);

  const desktopRankMap = computeCompetitionRanks(
    baseList
      .filter(
        (b): b is BaseStanding & { compositeScore: number } =>
          b.deviceType === 'Desktop' && b.compositeScore !== null,
      )
      .map((b) => ({ id: b.id, score: b.compositeScore })),
  );

  const laptopRankMap = computeCompetitionRanks(
    baseList
      .filter(
        (b): b is BaseStanding & { compositeScore: number } =>
          b.deviceType === 'Laptop' && b.compositeScore !== null,
      )
      .map((b) => ({ id: b.id, score: b.compositeScore })),
  );

  const cpuRankMap = computeCompetitionRanks(
    baseList
      .filter(
        (b): b is BaseStanding & { effectiveCpuScore: number } =>
          b.effectiveCpuScore !== null,
      )
      .map((b) => ({ id: b.id, score: b.effectiveCpuScore })),
  );

  const gpuRankMap = computeCompetitionRanks(
    baseList
      .filter(
        (b): b is BaseStanding & { effectiveGpuScore: number } =>
          b.effectiveGpuScore !== null,
      )
      .map((b) => ({ id: b.id, score: b.effectiveGpuScore })),
  );

  const suiteBuckets = new Map<string, Array<{ id: number; score: number }>>();
  for (const item of baseList) {
    for (const [suiteName, bench] of Object.entries(item.latestBenchmarks)) {
      const bucket = suiteBuckets.get(suiteName) ?? [];
      bucket.push({ id: item.id, score: bench.score });
      suiteBuckets.set(suiteName, bucket);
    }
  }

  const suiteRankMaps = new Map<string, Map<number, RankPosition>>();
  for (const [suiteName, entries] of suiteBuckets.entries()) {
    suiteRankMaps.set(suiteName, computeCompetitionRanks(entries));
  }

  const standings = new Map<number, RigFleetStanding>();
  for (const item of baseList) {
    const classRank =
      item.deviceType === 'Desktop'
        ? (desktopRankMap.get(item.id) ?? null)
        : (laptopRankMap.get(item.id) ?? null);

    const benchmarkRanks: Record<string, RankPosition> = {};
    for (const suiteName of Object.keys(item.latestBenchmarks)) {
      const rankPos = suiteRankMaps.get(suiteName)?.get(item.id);
      if (rankPos) {
        benchmarkRanks[suiteName] = rankPos;
      }
    }

    standings.set(item.id, {
      compositeScore: item.compositeScore,
      effectiveCpuScore: item.effectiveCpuScore,
      rawCpuScore: item.rawCpuScore,
      cpuMultiplier: item.cpuMultiplier,
      effectiveGpuScore: item.effectiveGpuScore,
      gpuSource: item.gpuSource,
      isPartial: item.isPartial,
      overallRank: overallRankMap.get(item.id) ?? null,
      classRank,
      cpuRank: cpuRankMap.get(item.id) ?? null,
      gpuRank: gpuRankMap.get(item.id) ?? null,
      benchmarkRanks,
    });
  }

  return standings;
}

/**
 * Computes competition ranks for standalone CPU or GPU catalog entries.
 */
export function computeCatalogRanks<
  T extends { id: number; passmark_score: number | null },
>(parts: T[]): Map<number, RankPosition> {
  const scored = parts
    .filter((p): p is T & { passmark_score: number } => p.passmark_score !== null)
    .map((p) => ({ id: p.id, score: p.passmark_score }));
  return computeCompetitionRanks(scored);
}

export function formatPassMark(score: number | null | undefined): string {
  return score !== null && score !== undefined ? score.toLocaleString() : '—';
}

export function formatRankBadge(pos: RankPosition | null | undefined): string {
  return pos ? `#${pos.rank} of ${pos.total}` : '—';
}

export function formatShortRank(pos: RankPosition | null | undefined): string {
  return pos ? `#${pos.rank}` : '—';
}

export function formatScoreUpdatedDate(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function getRankBadgeClasses(
  pos: RankPosition | null | undefined,
): string {
  if (!pos) {
    return 'border-slate-800 bg-slate-950 text-slate-500';
  }
  if (pos.rank === 1) {
    return 'border-amber-400/50 bg-amber-500/15 text-amber-200';
  }
  if (pos.rank <= 3) {
    return 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200';
  }
  return 'border-slate-700 bg-slate-950 text-slate-300';
}

export function getCompositeTooltip(standing: RigFleetStanding): string {
  if (standing.compositeScore === null) {
    return 'No PassMark CPU or GPU scores assigned yet';
  }
  const gpuText =
    standing.effectiveGpuScore !== null
      ? `GPU ${standing.effectiveGpuScore.toLocaleString()}${
          standing.gpuSource === 'igpu' ? ' (iGPU)' : ''
        }`
      : 'GPU 0';
  const cpuText =
    standing.effectiveCpuScore !== null
      ? `CPU ${standing.effectiveCpuScore.toLocaleString()}${
          standing.cpuMultiplier > 1 ? ` (${standing.cpuMultiplier}x)` : ''
        }`
      : 'CPU 0';

  const notes: string[] = [];
  if (standing.isPartial) {
    notes.push(
      standing.effectiveGpuScore === null
        ? 'Partial: no GPU PassMark yet'
        : 'Partial: no CPU PassMark yet',
    );
  }
  if (standing.overallRank?.isTied) {
    notes.push('Tied rank');
  }

  const suffix = notes.length > 0 ? ` — ${notes.join('; ')}` : '';
  return `Composite PassMark: ${standing.compositeScore.toLocaleString()} (60% ${gpuText} + 40% ${cpuText})${suffix}`;
}

export function buildPassMarkSearchUrl(
  partType: 'cpu' | 'gpu',
  brand: string,
  name: string,
): string {
  const site =
    partType === 'cpu' ? 'cpubenchmark.net' : 'videocardbenchmark.net';
  const query = [brand, name].filter(Boolean).join(' ').trim();
  return `https://www.google.com/search?q=${encodeURIComponent(
    `site:${site} ${query}`.trim(),
  )}`;
}
