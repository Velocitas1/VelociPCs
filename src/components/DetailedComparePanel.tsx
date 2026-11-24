import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Cpu,
  ExternalLink,
  GitCompare,
  GripVertical,
  HardDrive,
  Laptop,
  Link2,
  MemoryStick,
  Monitor,
  Plus,
  SlidersHorizontal,
  Trophy,
  Wifi,
  X,
} from 'lucide-react';
import { getLatestBenchmarksMap, getSafeThreeDMarkUrl } from '../lib/benchmarks';
import {
  buildCompareShareUrl,
  computeWinnerRigIds,
  CORE_BENCHMARK_SUITES,
  DEFAULT_EXPANDED_SECTIONS,
  getAvailableBenchmarkSuites,
  hasAnyPopulatedValue,
  hasRowDifference,
  moveRigId,
  pickDefaultBenchmarkSuite,
  sortComparedRigs,
  stepRigId,
  type CompareSectionId,
  type CompareSortPreset,
  type CompareState,
} from '../lib/compare';
import { getDirectXTierRank } from '../lib/directx';
import {
  formatPassMark,
  formatRankBadge,
  formatScoreUpdatedDate,
  formatShortRank,
  getCompositeTooltip,
  getRankBadgeClasses,
  type RigFleetStanding,
} from '../lib/scoring';
import {
  buildAibGpuResearchLinks,
  buildCpuResearchLinks,
  buildGpuResearchLinks,
  buildLaptopResearchLinks,
  buildMotherboardResearchLinks,
  buildPsuResearchLinks,
  buildRamResearchLinks,
  buildStorageDriveResearchLinks,
  buildWifiResearchLinks,
} from '../lib/specLinks';
import type {
  Benchmark,
  ComputerWithRelations,
  StorageDrive,
} from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import type { PartLinksEditTarget } from './PartLinksModal';
import { SpecLink } from './SpecLink';

interface DetailedComparePanelProps {
  computers: ComputerWithRelations[];
  filteredComputers: ComputerWithRelations[];
  fleetStandings: Map<number, RigFleetStanding>;
  compareState: CompareState;
  onChangeCompareState: (
    updater: CompareState | ((prev: CompareState) => CompareState),
  ) => void;
  onSelectComputer: (rig: ComputerWithRelations) => void;
  onNotify: (message: string) => void;
  onEditPartLinks?: (target: PartLinksEditTarget) => void;
}

interface CompareRowDef {
  key: string;
  label: string;
  getCanonical: (rig: ComputerWithRelations) => string;
  getWinnerValue?: (rig: ComputerWithRelations) => number | null;
  render: (rig: ComputerWithRelations) => ReactNode;
}

interface CompareSectionDef {
  id: CompareSectionId;
  title: string;
  icon: typeof Cpu;
  iconClass: string;
  rows: CompareRowDef[];
}

interface EvaluatedRow {
  def: CompareRowDef;
  winnerIds: Set<number>;
}

interface EvaluatedSection {
  section: CompareSectionDef;
  rows: EvaluatedRow[];
}

const SORT_PRESETS: Array<{ id: CompareSortPreset; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'fleet_rank', label: 'Fleet Rank' },
  { id: 'cpu', label: 'CPU' },
  { id: 'gpu', label: 'GPU' },
  { id: 'directx', label: 'DirectX' },
  { id: '3dmark', label: '3DMark' },
];

function getPrimaryDrive(rig: ComputerWithRelations): StorageDrive | undefined {
  return rig.storage_drives.find((d) => d.is_primary) ?? rig.storage_drives[0];
}

function getEffectiveGpu(rig: ComputerWithRelations) {
  return rig.gpu ?? rig.igpu;
}

function getStatusBadgeClasses(status: ComputerWithRelations['status']): string {
  switch (status) {
    case 'Active':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300';
    case 'In Progress':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-300';
    case 'Storage':
      return 'border-slate-700 bg-slate-800/80 text-slate-300';
    case 'Retired':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function DetailedComparePanel({
  computers,
  filteredComputers,
  fleetStandings,
  compareState,
  onChangeCompareState,
  onSelectComputer,
  onNotify,
  onEditPartLinks,
}: DetailedComparePanelProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<CompareSectionId, boolean>
  >(() => ({ ...DEFAULT_EXPANDED_SECTIONS }));
  const [draggedRigId, setDraggedRigId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    rigId: number;
    position: 'before' | 'after';
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const computerById = useMemo(
    () => new Map(computers.map((c) => [c.id, c])),
    [computers],
  );

  const selectedRigs = useMemo(
    () =>
      compareState.ids
        .map((id) => computerById.get(id))
        .filter((r): r is ComputerWithRelations => Boolean(r)),
    [compareState.ids, computerById],
  );

  const availableSuites = useMemo(
    () => getAvailableBenchmarkSuites(selectedRigs),
    [selectedRigs],
  );

  const effectiveSuite = useMemo(() => {
    if (compareState.suite && availableSuites.includes(compareState.suite)) {
      return compareState.suite;
    }
    return pickDefaultBenchmarkSuite(selectedRigs);
  }, [compareState.suite, availableSuites, selectedRigs]);

  const displayedRigs = useMemo(
    () =>
      sortComparedRigs(
        selectedRigs,
        compareState.sort,
        compareState.dir,
        effectiveSuite,
        fleetStandings,
      ),
    [selectedRigs, compareState.sort, compareState.dir, effectiveSuite, fleetStandings],
  );

  const unselectedRigs = useMemo(() => {
    const selectedSet = new Set(compareState.ids);
    return [...computers]
      .filter((c) => !selectedSet.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [computers, compareState.ids]);

  const latestBenchmarksByRigId = useMemo(() => {
    const map = new Map<number, Record<string, Benchmark>>();
    for (const rig of displayedRigs) {
      map.set(rig.id, getLatestBenchmarksMap(rig));
    }
    return map;
  }, [displayedRigs]);

  const rankOrderComparator = (a: ComputerWithRelations, b: ComputerWithRelations) => {
    const ra = fleetStandings.get(a.id)?.overallRank?.rank ?? Number.MAX_SAFE_INTEGER;
    const rb = fleetStandings.get(b.id)?.overallRank?.rank ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  };

  const applyTop4Preset = () => {
    const ids = [...computers].sort(rankOrderComparator).slice(0, 4).map((c) => c.id);
    if (ids.length === 0) return;
    onChangeCompareState((prev) => ({
      ...prev,
      ids,
      sort: 'fleet_rank',
      dir: 'desc',
    }));
  };

  const applyDeviceTypePreset = (deviceType: 'Desktop' | 'Laptop') => {
    const ids = computers
      .filter((c) => c.device_type === deviceType)
      .sort(rankOrderComparator)
      .map((c) => c.id);
    if (ids.length === 0) return;
    onChangeCompareState((prev) => ({
      ...prev,
      ids,
      sort: 'fleet_rank',
      dir: 'desc',
    }));
  };

  const applyFilteredPreset = () => {
    const ids = filteredComputers.map((c) => c.id);
    if (ids.length === 0) return;
    onChangeCompareState((prev) => ({
      ...prev,
      ids,
    }));
  };

  const handleAddRig = (rawId: string) => {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    onChangeCompareState((prev) => {
      if (prev.ids.includes(id)) return prev;
      return { ...prev, ids: [...prev.ids, id] };
    });
  };

  const handleRemoveRig = (rigId: number) => {
    onChangeCompareState((prev) => ({
      ...prev,
      ids: prev.ids.filter((id) => id !== rigId),
    }));
  };

  const handleClearSelection = () => {
    onChangeCompareState((prev) => ({
      ...prev,
      ids: [],
    }));
  };

  const handleSelectSortPreset = (preset: CompareSortPreset) => {
    onChangeCompareState((prev) => {
      if (preset === '3dmark') {
        const nextSuite =
          prev.suite && availableSuites.includes(prev.suite)
            ? prev.suite
            : effectiveSuite ?? CORE_BENCHMARK_SUITES[0];
        return {
          ...prev,
          sort: '3dmark',
          dir: prev.sort === '3dmark' ? prev.dir : 'desc',
          suite: nextSuite,
        };
      }
      return {
        ...prev,
        sort: preset,
        dir: prev.sort === preset ? prev.dir : 'desc',
      };
    });
  };

  const handleToggleSortDir = () => {
    onChangeCompareState((prev) => ({
      ...prev,
      dir: prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleSelectSuite = (suite: string) => {
    onChangeCompareState((prev) => ({
      ...prev,
      sort: '3dmark',
      suite: suite || null,
    }));
  };

  const handleStepColumn = (rigId: number, delta: -1 | 1) => {
    const currentOrder = displayedRigs.map((r) => r.id);
    const nextIds = stepRigId(currentOrder, rigId, delta);
    onChangeCompareState((prev) => ({
      ...prev,
      ids: nextIds,
      sort: 'manual',
    }));
  };

  const handleDropOnColumn = (targetRigId: number, position: 'before' | 'after') => {
    if (draggedRigId === null || draggedRigId === targetRigId) return;
    const currentOrder = displayedRigs.map((r) => r.id);
    const nextIds = moveRigId(currentOrder, draggedRigId, targetRigId, position);
    onChangeCompareState((prev) => ({
      ...prev,
      ids: nextIds,
      sort: 'manual',
    }));
    setDraggedRigId(null);
    setDropTarget(null);
  };

  const handleToggleSection = (sectionId: CompareSectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSetAllSections = (expanded: boolean) => {
    setExpandedSections({
      overview: expanded,
      cpu: expanded,
      gpu: expanded,
      memory_board: expanded,
      storage: expanded,
      power_wireless: expanded,
      benchmarks: expanded,
    });
  };

  const handleCopyShareLink = async () => {
    const shareUrl = buildCompareShareUrl(
      compareState,
      displayedRigs.map((r) => r.id),
    );
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopiedLink(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopiedLink(false), 2000);
      onNotify('Compare link copied to clipboard');
    } else {
      onNotify('Unable to copy compare link to clipboard');
    }
  };

  const sections = useMemo<CompareSectionDef[]>(() => {
    const benchmarkRows: CompareRowDef[] = availableSuites.map((suite) => ({
      key: `bench_${suite}`,
      label: suite,
      getCanonical: (rig) => {
        const b = latestBenchmarksByRigId.get(rig.id)?.[suite];
        return b ? `${b.score}:${b.graphics_score ?? ''}:${b.cpu_score ?? ''}` : '';
      },
      getWinnerValue: (rig) =>
        latestBenchmarksByRigId.get(rig.id)?.[suite]?.score ?? null,
      render: (rig) => {
        const bench = latestBenchmarksByRigId.get(rig.id)?.[suite];
        if (!bench) {
          return <span className="text-slate-600">—</span>;
        }
        const safeUrl = getSafeThreeDMarkUrl(bench.result_url);
        const rank = fleetStandings.get(rig.id)?.benchmarkRanks[suite];
        return (
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5 font-mono">
              {safeUrl ? (
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${suite} result on 3DMark (recorded ${bench.recorded_at})`}
                  className="inline-flex items-center gap-1 font-semibold text-amber-300 underline decoration-amber-400/50 underline-offset-2 transition hover:text-amber-200 hover:decoration-amber-300"
                >
                  {bench.score.toLocaleString()}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span
                  title={`Recorded ${bench.recorded_at}`}
                  className="font-semibold text-amber-300"
                >
                  {bench.score.toLocaleString()}
                </span>
              )}
              {rank ? (
                <span
                  title={`Fleet ${formatRankBadge(rank)} in ${suite}`}
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getRankBadgeClasses(
                    rank,
                  )}`}
                >
                  {formatShortRank(rank)}
                </span>
              ) : null}
            </div>
            {bench.graphics_score !== null || bench.cpu_score !== null ? (
              <p className="font-mono text-[11px] text-slate-400">
                {[
                  bench.graphics_score !== null
                    ? `GFX ${bench.graphics_score.toLocaleString()}`
                    : null,
                  bench.cpu_score !== null
                    ? `CPU ${bench.cpu_score.toLocaleString()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>
        );
      },
    }));

    return [
      {
        id: 'overview',
        title: 'Overview',
        icon: GitCompare,
        iconClass: 'text-cyan-400',
        rows: [
          {
            key: 'fleet_rank',
            label: 'Fleet Rank',
            getCanonical: (rig) => {
              const s = fleetStandings.get(rig.id);
              return s?.overallRank
                ? `${s.overallRank.rank}:${s.compositeScore ?? ''}:${s.classRank?.rank ?? ''}:${s.isPartial ? '1' : '0'}`
                : '';
            },
            getWinnerValue: (rig) =>
              fleetStandings.get(rig.id)?.compositeScore ?? null,
            render: (rig) => {
              const s = fleetStandings.get(rig.id);
              if (!s?.overallRank) {
                return <span className="text-slate-600">—</span>;
              }
              return (
                <div
                  title={getCompositeTooltip(s)}
                  className="flex flex-wrap items-center gap-1.5 font-mono"
                >
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getRankBadgeClasses(
                      s.overallRank,
                    )}`}
                  >
                    {formatRankBadge(s.overallRank)}
                  </span>
                  <span className="text-slate-200">
                    {formatPassMark(s.compositeScore)}
                  </span>
                  {s.classRank ? (
                    <span className="text-[11px] text-slate-400">
                      (#{s.classRank.rank} {rig.device_type})
                    </span>
                  ) : null}
                  {s.isPartial ? (
                    <span className="rounded border border-amber-500/35 bg-amber-500/10 px-1 py-0.5 text-[10px] text-amber-300">
                      Partial
                    </span>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'device_type',
            label: 'Device Type',
            getCanonical: (rig) => rig.device_type,
            render: (rig) => (
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  rig.device_type === 'Laptop'
                    ? 'bg-violet-500/15 text-violet-300'
                    : 'bg-sky-500/15 text-sky-300'
                }`}
              >
                {rig.device_type === 'Laptop' ? (
                  <Laptop className="h-3 w-3" />
                ) : (
                  <Monitor className="h-3 w-3" />
                )}
                {rig.device_type}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            getCanonical: (rig) => rig.status ?? '',
            render: (rig) => (
              <span
                className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${getStatusBadgeClasses(
                  rig.status,
                )}`}
              >
                {rig.status}
              </span>
            ),
          },
          {
            key: 'brand_model',
            label: 'Brand / Model',
            getCanonical: (rig) =>
              [rig.brand, rig.model].filter(Boolean).join(' ').trim(),
            render: (rig) => {
              const text = [rig.brand, rig.model].filter(Boolean).join(' ').trim();
              if (!text) return <span className="text-slate-600">—</span>;
              if (rig.device_type === 'Laptop') {
                return (
                  <SpecLink
                    compact
                    label={text}
                    links={buildLaptopResearchLinks(
                      rig.brand,
                      rig.model,
                      rig.part_spec_links?.laptop,
                    )}
                    onEditLinks={
                      onEditPartLinks
                        ? () =>
                            onEditPartLinks({
                              kind: 'computer_slot',
                              computerId: rig.id,
                              rigName: rig.name,
                              slot: 'laptop',
                              partLabel: text,
                              currentMap: rig.part_spec_links,
                            })
                        : undefined
                    }
                  />
                );
              }
              return <span className="text-slate-200">{text}</span>;
            },
          },
          {
            key: 'build_date',
            label: 'Build Date',
            getCanonical: (rig) => rig.build_date ?? '',
            render: (rig) =>
              rig.build_date ? (
                <span className="font-mono text-slate-200">{rig.build_date}</span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
        ],
      },
      {
        id: 'cpu',
        title: 'Processor',
        icon: Cpu,
        iconClass: 'text-cyan-400',
        rows: [
          {
            key: 'cpu_model',
            label: 'CPU Model',
            getCanonical: (rig) =>
              rig.cpu
                ? `${rig.cpu_count > 1 ? `${rig.cpu_count}x ` : ''}${rig.cpu.brand} ${rig.cpu.name}`
                : '',
            render: (rig) =>
              rig.cpu ? (
                <SpecLink
                  compact
                  label={`${rig.cpu.brand} ${rig.cpu.name}`}
                  prefix={rig.cpu_count > 1 ? `${rig.cpu_count}x` : undefined}
                  links={buildCpuResearchLinks(rig.cpu)}
                  onEditLinks={
                    onEditPartLinks
                      ? () =>
                          onEditPartLinks({ kind: 'cpu', cpu: rig.cpu! })
                      : undefined
                  }
                />
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
          {
            key: 'cpu_passmark',
            label: 'PassMark CPU Mark',
            getCanonical: (rig) => {
              const s = fleetStandings.get(rig.id);
              return s?.effectiveCpuScore !== null &&
                s?.effectiveCpuScore !== undefined
                ? String(s.effectiveCpuScore)
                : '';
            },
            getWinnerValue: (rig) =>
              fleetStandings.get(rig.id)?.effectiveCpuScore ?? null,
            render: (rig) => {
              const s = fleetStandings.get(rig.id);
              if (
                s?.effectiveCpuScore === null ||
                s?.effectiveCpuScore === undefined
              ) {
                return <span className="text-slate-600">—</span>;
              }
              const updated = formatScoreUpdatedDate(rig.cpu?.score_updated_at);
              return (
                <div
                  title={updated ? `Updated ${updated}` : undefined}
                  className="flex flex-wrap items-center gap-1.5 font-mono"
                >
                  <span className="font-semibold text-cyan-200">
                    {formatPassMark(s.effectiveCpuScore)}
                  </span>
                  {rig.cpu_count > 1 && rig.cpu?.passmark_score != null ? (
                    <span className="text-[11px] text-slate-400">
                      ({formatPassMark(rig.cpu.passmark_score)} × {s.cpuMultiplier})
                    </span>
                  ) : null}
                  {s.cpuRank ? (
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getRankBadgeClasses(
                        s.cpuRank,
                      )}`}
                    >
                      {formatShortRank(s.cpuRank)}
                    </span>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'cpu_cores_threads',
            label: 'Cores / Threads',
            getCanonical: (rig) =>
              rig.cpu && (rig.cpu.cores !== null || rig.cpu.threads !== null)
                ? `${(rig.cpu.cores ?? 0) * rig.cpu_count}/${(rig.cpu.threads ?? 0) * rig.cpu_count}`
                : '',
            getWinnerValue: (rig) =>
              rig.cpu && rig.cpu.cores !== null
                ? rig.cpu.cores * rig.cpu_count * 1000 +
                  (rig.cpu.threads ?? 0) * rig.cpu_count
                : null,
            render: (rig) => {
              if (!rig.cpu || (rig.cpu.cores === null && rig.cpu.threads === null)) {
                return <span className="text-slate-600">—</span>;
              }
              return (
                <span className="font-mono text-slate-200">
                  {(rig.cpu.cores ?? 0) * rig.cpu_count}C /{' '}
                  {(rig.cpu.threads ?? 0) * rig.cpu_count}T
                  {rig.cpu_count > 1 ? (
                    <span className="ml-1 text-[11px] text-slate-400">
                      ({rig.cpu_count} sockets)
                    </span>
                  ) : null}
                </span>
              );
            },
          },
          {
            key: 'cpu_base_clock',
            label: 'Base Clock',
            getCanonical: (rig) =>
              rig.cpu?.base_clock_ghz !== null &&
              rig.cpu?.base_clock_ghz !== undefined
                ? String(rig.cpu.base_clock_ghz)
                : '',
            getWinnerValue: (rig) => rig.cpu?.base_clock_ghz ?? null,
            render: (rig) =>
              rig.cpu?.base_clock_ghz !== null &&
              rig.cpu?.base_clock_ghz !== undefined ? (
                <span className="font-mono text-slate-200">
                  {rig.cpu.base_clock_ghz} GHz
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
          {
            key: 'cpu_turbo_clock',
            label: 'Turbo Clock',
            getCanonical: (rig) =>
              rig.cpu?.turbo_clock_ghz !== null &&
              rig.cpu?.turbo_clock_ghz !== undefined
                ? String(rig.cpu.turbo_clock_ghz)
                : '',
            getWinnerValue: (rig) => rig.cpu?.turbo_clock_ghz ?? null,
            render: (rig) =>
              rig.cpu?.turbo_clock_ghz !== null &&
              rig.cpu?.turbo_clock_ghz !== undefined ? (
                <span className="font-mono text-slate-200">
                  {rig.cpu.turbo_clock_ghz} GHz
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
          {
            key: 'cpu_cache',
            label: 'L3 Cache',
            getCanonical: (rig) =>
              rig.cpu?.cache_mb !== null && rig.cpu?.cache_mb !== undefined
                ? String(rig.cpu.cache_mb * rig.cpu_count)
                : '',
            getWinnerValue: (rig) =>
              rig.cpu?.cache_mb !== null && rig.cpu?.cache_mb !== undefined
                ? rig.cpu.cache_mb * rig.cpu_count
                : null,
            render: (rig) =>
              rig.cpu?.cache_mb !== null && rig.cpu?.cache_mb !== undefined ? (
                <span className="font-mono text-slate-200">
                  {rig.cpu.cache_mb * rig.cpu_count} MB
                  {rig.cpu_count > 1 ? (
                    <span className="ml-1 text-[11px] text-slate-400">
                      ({rig.cpu.cache_mb} × {rig.cpu_count})
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
          {
            key: 'cpu_socket_codename',
            label: 'Socket / Codename',
            getCanonical: (rig) =>
              rig.cpu
                ? [rig.cpu.socket, rig.cpu.codename].filter(Boolean).join(' · ')
                : '',
            render: (rig) => {
              if (!rig.cpu) return <span className="text-slate-600">—</span>;
              const parts = [rig.cpu.socket, rig.cpu.codename].filter(Boolean);
              return parts.length > 0 ? (
                <span className="text-slate-200">{parts.join(' · ')}</span>
              ) : (
                <span className="text-slate-600">—</span>
              );
            },
          },
          {
            key: 'cpu_process_tdp',
            label: 'Process / TDP',
            getCanonical: (rig) =>
              rig.cpu
                ? [
                    rig.cpu.process_nm !== null ? `${rig.cpu.process_nm}nm` : null,
                    rig.cpu.tdp_w !== null
                      ? `${rig.cpu.tdp_w * rig.cpu_count}W`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '',
            render: (rig) => {
              if (!rig.cpu) return <span className="text-slate-600">—</span>;
              const parts = [
                rig.cpu.process_nm !== null ? `${rig.cpu.process_nm} nm` : null,
                rig.cpu.tdp_w !== null
                  ? `${rig.cpu.tdp_w * rig.cpu_count}W`
                  : null,
              ].filter(Boolean);
              return parts.length > 0 ? (
                <span className="font-mono text-slate-200">
                  {parts.join(' · ')}
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              );
            },
          },
          {
            key: 'cpu_launch',
            label: 'CPU Launch',
            getCanonical: (rig) => rig.cpu?.launch_date ?? '',
            render: (rig) =>
              rig.cpu?.launch_date ? (
                <span className="font-mono text-slate-300">
                  {rig.cpu.launch_date}
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
        ],
      },
      {
        id: 'gpu',
        title: 'Graphics',
        icon: Monitor,
        iconClass: 'text-emerald-400',
        rows: [
          {
            key: 'discrete_gpu',
            label: 'Discrete GPU',
            getCanonical: (rig) =>
              rig.gpu
                ? `${rig.gpu.brand} ${rig.gpu.name}|${[rig.gpu_aib_manufacturer, rig.gpu_aib_model].filter(Boolean).join(' ')}`
                : '',
            render: (rig) => {
              if (!rig.gpu) {
                return (
                  <span className="text-slate-500">
                    {rig.igpu ? 'None (iGPU)' : '—'}
                  </span>
                );
              }
              const aib = [rig.gpu_aib_manufacturer, rig.gpu_aib_model]
                .filter(Boolean)
                .join(' ');
              const aibLinks = buildAibGpuResearchLinks(
                rig.gpu,
                rig.gpu_aib_manufacturer,
                rig.gpu_aib_model,
                rig.part_spec_links?.gpu_aib,
              );
              return (
                <div className="space-y-1">
                  <div>
                    <SpecLink
                      compact
                      label={`${rig.gpu.brand} ${rig.gpu.name}`}
                      links={buildGpuResearchLinks(rig.gpu, {
                        manufacturer: rig.gpu_aib_manufacturer,
                        model: rig.gpu_aib_model,
                        savedEntry: rig.part_spec_links?.gpu_aib,
                      })}
                      onEditLinks={
                        onEditPartLinks
                          ? () =>
                              onEditPartLinks({ kind: 'gpu', gpu: rig.gpu! })
                          : undefined
                      }
                    />
                  </div>
                  {aib || aibLinks.length > 0 ? (
                    <div>
                      <SpecLink
                        compact
                        label={aib || 'Board Partner'}
                        links={aibLinks}
                        onEditLinks={
                          onEditPartLinks
                            ? () =>
                                onEditPartLinks({
                                  kind: 'computer_slot',
                                  computerId: rig.id,
                                  rigName: rig.name,
                                  slot: 'gpu_aib',
                                  partLabel:
                                    aib ||
                                    `${rig.gpu!.brand} ${rig.gpu!.name} Board Partner`,
                                  currentMap: rig.part_spec_links,
                                })
                            : undefined
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'integrated_gpu',
            label: 'Integrated GPU',
            getCanonical: (rig) =>
              rig.igpu ? `${rig.igpu.brand} ${rig.igpu.name}` : '',
            render: (rig) =>
              rig.igpu ? (
                <SpecLink
                  compact
                  label={`${rig.igpu.brand} ${rig.igpu.name}`}
                  links={buildGpuResearchLinks(rig.igpu)}
                  onEditLinks={
                    onEditPartLinks
                      ? () =>
                          onEditPartLinks({ kind: 'gpu', gpu: rig.igpu! })
                      : undefined
                  }
                />
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
          {
            key: 'gpu_passmark',
            label: 'PassMark G3D Mark',
            getCanonical: (rig) => {
              const s = fleetStandings.get(rig.id);
              return s?.effectiveGpuScore !== null &&
                s?.effectiveGpuScore !== undefined
                ? `${s.effectiveGpuScore}:${s.gpuSource}`
                : '';
            },
            getWinnerValue: (rig) =>
              fleetStandings.get(rig.id)?.effectiveGpuScore ?? null,
            render: (rig) => {
              const s = fleetStandings.get(rig.id);
              if (
                s?.effectiveGpuScore === null ||
                s?.effectiveGpuScore === undefined
              ) {
                return <span className="text-slate-600">—</span>;
              }
              const updated = formatScoreUpdatedDate(
                getEffectiveGpu(rig)?.score_updated_at,
              );
              return (
                <div
                  title={updated ? `Updated ${updated}` : undefined}
                  className="flex flex-wrap items-center gap-1.5 font-mono"
                >
                  <span className="font-semibold text-emerald-200">
                    {formatPassMark(s.effectiveGpuScore)}
                  </span>
                  {s.gpuSource === 'igpu' ? (
                    <span className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px] text-slate-400">
                      iGPU
                    </span>
                  ) : null}
                  {s.gpuRank ? (
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getRankBadgeClasses(
                        s.gpuRank,
                      )}`}
                    >
                      {formatShortRank(s.gpuRank)}
                    </span>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'gpu_directx',
            label: 'DirectX Support',
            getCanonical: (rig) => {
              const g = getEffectiveGpu(rig);
              return g?.directx_version
                ? `${g.directx_version}|${g.directx_feature_level ?? ''}`
                : '';
            },
            getWinnerValue: (rig) => {
              const g = getEffectiveGpu(rig);
              const rank = getDirectXTierRank(
                g?.directx_version,
                g?.directx_feature_level,
              );
              return rank > 0 ? rank : null;
            },
            render: (rig) => {
              const g = getEffectiveGpu(rig);
              if (!g?.directx_version) {
                return <DirectXBadge version={null} compact />;
              }
              return (
                <div className="flex flex-wrap items-center gap-1.5">
                  <DirectXBadge
                    version={g.directx_version}
                    featureLevel={g.directx_feature_level}
                    compact
                  />
                  {!rig.gpu && rig.igpu ? (
                    <span className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 font-mono text-[10px] text-slate-400">
                      iGPU
                    </span>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'gpu_vram',
            label: 'VRAM',
            getCanonical: (rig) => {
              const g = getEffectiveGpu(rig);
              return g && (g.vram_gb !== null || g.vram_type)
                ? `${g.vram_gb ?? ''}|${g.vram_type ?? ''}`
                : '';
            },
            getWinnerValue: (rig) => getEffectiveGpu(rig)?.vram_gb ?? null,
            render: (rig) => {
              const g = getEffectiveGpu(rig);
              if (!g || (g.vram_gb === null && !g.vram_type)) {
                return <span className="text-slate-600">—</span>;
              }
              return (
                <span className="font-mono text-slate-200">
                  {g.vram_gb !== null ? `${g.vram_gb} GB ` : ''}
                  {g.vram_type ?? ''}
                </span>
              );
            },
          },
          {
            key: 'gpu_architecture',
            label: 'Architecture',
            getCanonical: (rig) => getEffectiveGpu(rig)?.architecture ?? '',
            render: (rig) => {
              const arch = getEffectiveGpu(rig)?.architecture;
              return arch ? (
                <span className="text-slate-200">{arch}</span>
              ) : (
                <span className="text-slate-600">—</span>
              );
            },
          },
          {
            key: 'gpu_bus',
            label: 'Bus Interface',
            getCanonical: (rig) => getEffectiveGpu(rig)?.bus_interface ?? '',
            render: (rig) => {
              const bus = getEffectiveGpu(rig)?.bus_interface;
              return bus ? (
                <span className="font-mono text-slate-300">{bus}</span>
              ) : (
                <span className="text-slate-600">—</span>
              );
            },
          },
          {
            key: 'gpu_process_tdp',
            label: 'GPU Process / TDP',
            getCanonical: (rig) => {
              const g = getEffectiveGpu(rig);
              return g
                ? [
                    g.process_nm !== null ? `${g.process_nm}nm` : null,
                    g.tdp_w !== null ? `${g.tdp_w}W` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '';
            },
            render: (rig) => {
              const g = getEffectiveGpu(rig);
              if (!g) return <span className="text-slate-600">—</span>;
              const parts = [
                g.process_nm !== null ? `${g.process_nm} nm` : null,
                g.tdp_w !== null ? `${g.tdp_w}W` : null,
              ].filter(Boolean);
              return parts.length > 0 ? (
                <span className="font-mono text-slate-200">
                  {parts.join(' · ')}
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              );
            },
          },
          {
            key: 'gpu_category',
            label: 'GPU Category',
            getCanonical: (rig) => getEffectiveGpu(rig)?.category ?? '',
            render: (rig) => {
              const cat = getEffectiveGpu(rig)?.category;
              return cat ? (
                <span className="text-slate-300">{cat}</span>
              ) : (
                <span className="text-slate-600">—</span>
              );
            },
          },
        ],
      },
      {
        id: 'memory_board',
        title: 'Memory & Board',
        icon: MemoryStick,
        iconClass: 'text-sky-400',
        rows: [
          {
            key: 'ram_capacity',
            label: 'RAM Capacity',
            getCanonical: (rig) =>
              rig.ram_gb !== null ? String(rig.ram_gb) : '',
            getWinnerValue: (rig) => rig.ram_gb ?? null,
            render: (rig) =>
              rig.ram_gb !== null ? (
                <span className="font-mono text-slate-200">
                  {rig.ram_gb} GB
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
          {
            key: 'ram_type_speed',
            label: 'RAM Type & Speed',
            getCanonical: (rig) =>
              [
                rig.ram_type,
                rig.ram_speed_mhz !== null ? String(rig.ram_speed_mhz) : null,
                rig.ram_pc_rating,
              ]
                .filter(Boolean)
                .join('|'),
            getWinnerValue: (rig) => rig.ram_speed_mhz ?? null,
            render: (rig) => {
              if (!rig.ram_type && rig.ram_speed_mhz === null && !rig.ram_pc_rating) {
                return <span className="text-slate-600">—</span>;
              }
              const summary = `${rig.ram_type ?? ''}${
                rig.ram_speed_mhz !== null
                  ? `${rig.ram_type ? ' @ ' : ''}${rig.ram_speed_mhz} MHz`
                  : ''
              }`.trim();
              const ramLinks = buildRamResearchLinks(rig.part_spec_links?.ram);
              return (
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-slate-200">
                  {ramLinks.length > 0 ? (
                    <SpecLink
                      compact
                      label={summary || 'RAM Kit'}
                      links={ramLinks}
                      onEditLinks={
                        onEditPartLinks
                          ? () =>
                              onEditPartLinks({
                                kind: 'computer_slot',
                                computerId: rig.id,
                                rigName: rig.name,
                                slot: 'ram',
                                partLabel: summary || 'RAM Kit',
                                currentMap: rig.part_spec_links,
                              })
                          : undefined
                      }
                    />
                  ) : (
                    <span>{summary}</span>
                  )}
                  {rig.ram_pc_rating ? (
                    <span className="text-[11px] text-slate-400">
                      ({rig.ram_pc_rating})
                    </span>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'cpu_memory_support',
            label: 'CPU Memory Support',
            getCanonical: (rig) =>
              rig.cpu
                ? [
                    rig.cpu.max_memory_gb !== null
                      ? String(rig.cpu.max_memory_gb)
                      : null,
                    rig.cpu.memory_type,
                    rig.cpu.memory_speed_mhz !== null
                      ? String(rig.cpu.memory_speed_mhz)
                      : null,
                  ]
                    .filter(Boolean)
                    .join('|')
                : '',
            render: (rig) => {
              if (!rig.cpu) return <span className="text-slate-600">—</span>;
              const memSpec = [
                rig.cpu.memory_type,
                rig.cpu.memory_speed_mhz !== null
                  ? `${rig.cpu.memory_speed_mhz} MHz`
                  : null,
              ]
                .filter(Boolean)
                .join(' ');
              const maxMem =
                rig.cpu.max_memory_gb !== null
                  ? `Max ${rig.cpu.max_memory_gb} GB`
                  : null;
              const combined = [maxMem, memSpec].filter(Boolean).join(' · ');
              return combined ? (
                <span className="font-mono text-slate-300">{combined}</span>
              ) : (
                <span className="text-slate-600">—</span>
              );
            },
          },
          {
            key: 'motherboard',
            label: 'Motherboard',
            getCanonical: (rig) =>
              [
                rig.motherboard_brand,
                rig.motherboard_name,
                rig.motherboard_launch,
              ]
                .filter(Boolean)
                .join('|'),
            render: (rig) => {
              const name = [rig.motherboard_brand, rig.motherboard_name]
                .filter(Boolean)
                .join(' ');
              const mbLinks = buildMotherboardResearchLinks(
                rig.motherboard_brand,
                rig.motherboard_name,
                rig.motherboard_launch,
                rig.part_spec_links?.motherboard,
              );
              if (!name && !rig.motherboard_launch && mbLinks.length === 0) {
                return <span className="text-slate-600">—</span>;
              }
              return (
                <div className="space-y-0.5">
                  {name || mbLinks.length > 0 ? (
                    <SpecLink
                      compact
                      label={name || 'Motherboard'}
                      links={mbLinks}
                      onEditLinks={
                        onEditPartLinks
                          ? () =>
                              onEditPartLinks({
                                kind: 'computer_slot',
                                computerId: rig.id,
                                rigName: rig.name,
                                slot: 'motherboard',
                                partLabel: name || 'Motherboard',
                                currentMap: rig.part_spec_links,
                              })
                          : undefined
                      }
                    />
                  ) : (
                    <span className="text-slate-200">—</span>
                  )}
                  {rig.motherboard_launch ? (
                    <p className="font-mono text-[11px] text-slate-400">
                      Launch {rig.motherboard_launch}
                    </p>
                  ) : null}
                </div>
              );
            },
          },
        ],
      },
      {
        id: 'storage',
        title: 'Storage',
        icon: HardDrive,
        iconClass: 'text-sky-400',
        rows: [
          {
            key: 'storage_total',
            label: 'Total Storage',
            getCanonical: (rig) => {
              const total = rig.storage_drives.reduce(
                (sum, d) => sum + (d.capacity_gb ?? 0),
                0,
              );
              return total > 0 ? `${total}:${rig.storage_drives.length}` : '';
            },
            getWinnerValue: (rig) => {
              const total = rig.storage_drives.reduce(
                (sum, d) => sum + (d.capacity_gb ?? 0),
                0,
              );
              return total > 0 ? total : null;
            },
            render: (rig) => {
              const total = rig.storage_drives.reduce(
                (sum, d) => sum + (d.capacity_gb ?? 0),
                0,
              );
              if (total <= 0) return <span className="text-slate-600">—</span>;
              return (
                <span className="font-mono text-slate-200">
                  {total.toLocaleString()} GB{' '}
                  <span className="text-[11px] text-slate-400">
                    ({rig.storage_drives.length}{' '}
                    {rig.storage_drives.length === 1 ? 'drive' : 'drives'})
                  </span>
                </span>
              );
            },
          },
          {
            key: 'storage_primary_speed',
            label: 'Primary Drive Speed',
            getCanonical: (rig) => {
              const d = getPrimaryDrive(rig);
              return d && (d.read_mb_s !== null || d.write_mb_s !== null)
                ? `${d.read_mb_s ?? ''}/${d.write_mb_s ?? ''}`
                : '';
            },
            getWinnerValue: (rig) => getPrimaryDrive(rig)?.read_mb_s ?? null,
            render: (rig) => {
              const d = getPrimaryDrive(rig);
              if (!d || (d.read_mb_s === null && d.write_mb_s === null)) {
                return <span className="text-slate-600">—</span>;
              }
              return (
                <span className="font-mono text-slate-200">
                  {d.read_mb_s !== null ? `R: ${d.read_mb_s} MB/s` : ''}
                  {d.read_mb_s !== null && d.write_mb_s !== null ? ' · ' : ''}
                  {d.write_mb_s !== null ? `W: ${d.write_mb_s} MB/s` : ''}
                </span>
              );
            },
          },
          {
            key: 'storage_drives',
            label: 'Installed Drives',
            getCanonical: (rig) =>
              rig.storage_drives
                .map((d) =>
                  [
                    d.capacity_gb,
                    d.brand,
                    d.model,
                    d.form_factor,
                    d.nand_type,
                    d.read_mb_s,
                    d.write_mb_s,
                  ]
                    .filter((v) => v !== null && v !== '')
                    .join(' '),
                )
                .join('; '),
            render: (rig) => {
              if (rig.storage_drives.length === 0) {
                return <span className="text-slate-600">—</span>;
              }
              return (
                <div className="space-y-1.5">
                  {rig.storage_drives.map((d) => {
                    const label = [d.brand, d.model].filter(Boolean).join(' ') || 'Drive';
                    const meta = [
                      d.nand_type,
                      d.read_mb_s !== null ? `R ${d.read_mb_s}` : null,
                      d.write_mb_s !== null ? `W ${d.write_mb_s}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <div
                        key={d.id}
                        className="rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                          <SpecLink
                            compact
                            label={`${d.capacity_gb ? `${d.capacity_gb} GB ` : ''}${label}`}
                            links={buildStorageDriveResearchLinks(d)}
                            onEditLinks={
                              onEditPartLinks
                                ? () =>
                                    onEditPartLinks({
                                      kind: 'storage_drive',
                                      rigName: rig.name,
                                      drive: d,
                                    })
                                : undefined
                            }
                          />
                          {d.form_factor ? (
                            <span className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-300">
                              {d.form_factor}
                            </span>
                          ) : null}
                        </div>
                        {meta ? (
                          <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                            {meta}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            },
          },
        ],
      },
      {
        id: 'power_wireless',
        title: 'Power, Display & Wireless',
        icon: Wifi,
        iconClass: 'text-violet-400',
        rows: [
          {
            key: 'psu',
            label: 'Power Supply (PSU)',
            getCanonical: (rig) =>
              rig.psu_wattage !== null || rig.psu_brand
                ? `${rig.psu_wattage ?? ''}|${rig.psu_brand ?? ''}`
                : '',
            getWinnerValue: (rig) => rig.psu_wattage ?? null,
            render: (rig) => {
              if (rig.psu_wattage === null && !rig.psu_brand) {
                return <span className="text-slate-600">—</span>;
              }
              const psuLabel = [
                rig.psu_wattage !== null ? `${rig.psu_wattage}W` : null,
                rig.psu_brand,
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <SpecLink
                  compact
                  label={psuLabel}
                  links={buildPsuResearchLinks(
                    rig.psu_brand,
                    rig.psu_wattage,
                    rig.part_spec_links?.psu,
                  )}
                  onEditLinks={
                    onEditPartLinks
                      ? () =>
                          onEditPartLinks({
                            kind: 'computer_slot',
                            computerId: rig.id,
                            rigName: rig.name,
                            slot: 'psu',
                            partLabel: psuLabel,
                            currentMap: rig.part_spec_links,
                          })
                      : undefined
                  }
                />
              );
            },
          },
          {
            key: 'psu_connectors',
            label: 'PSU Connectors',
            getCanonical: (rig) =>
              rig.psu_has_8pin_cpu !== null || rig.psu_has_6pin_pcie !== null
                ? `${rig.psu_has_8pin_cpu ?? ''}|${rig.psu_has_6pin_pcie ?? ''}`
                : '',
            render: (rig) => {
              if (
                rig.psu_has_8pin_cpu === null &&
                rig.psu_has_6pin_pcie === null
              ) {
                return <span className="text-slate-600">—</span>;
              }
              const fmt = (val: boolean | null) =>
                val === null ? '—' : val ? 'Yes' : 'No';
              return (
                <span className="font-mono text-slate-300">
                  8-pin CPU: {fmt(rig.psu_has_8pin_cpu)} · 6-pin PCIe:{' '}
                  {fmt(rig.psu_has_6pin_pcie)}
                </span>
              );
            },
          },
          {
            key: 'power_adapter_notes',
            label: 'Power Adapter / Notes',
            getCanonical: (rig) => rig.power_adapter_notes?.trim() ?? '',
            render: (rig) =>
              rig.power_adapter_notes?.trim() ? (
                <span className="text-slate-300">{rig.power_adapter_notes}</span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
          {
            key: 'display',
            label: 'Display',
            getCanonical: (rig) =>
              rig.screen_size_inches !== null || rig.screen_resolution
                ? `${rig.screen_size_inches ?? ''}|${rig.screen_resolution ?? ''}`
                : '',
            render: (rig) => {
              if (rig.screen_size_inches === null && !rig.screen_resolution) {
                return <span className="text-slate-600">—</span>;
              }
              return (
                <span className="font-mono text-slate-200">
                  {rig.screen_size_inches !== null
                    ? `${rig.screen_size_inches}" `
                    : ''}
                  {rig.screen_resolution ?? ''}
                </span>
              );
            },
          },
          {
            key: 'weight',
            label: 'Weight',
            getCanonical: (rig) =>
              rig.weight_lbs !== null ? String(rig.weight_lbs) : '',
            render: (rig) =>
              rig.weight_lbs !== null ? (
                <span className="font-mono text-slate-200">
                  {rig.weight_lbs} lbs
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
          {
            key: 'wifi',
            label: 'Wi-Fi Adapter',
            getCanonical: (rig) =>
              [
                rig.wifi_brand,
                rig.wifi_product,
                rig.wifi_model,
                rig.wifi_standard,
                rig.wifi_max_speed,
                rig.wifi_bands,
              ]
                .filter(Boolean)
                .join('|'),
            render: (rig) => {
              const name = [rig.wifi_brand, rig.wifi_product, rig.wifi_model]
                .filter(Boolean)
                .join(' ');
              const details = [
                rig.wifi_standard,
                rig.wifi_max_speed,
                rig.wifi_bands,
              ]
                .filter(Boolean)
                .join(' · ');
              if (!name && !details) {
                return <span className="text-slate-600">—</span>;
              }
              const wifiLinks = buildWifiResearchLinks(
                rig.wifi_brand,
                rig.wifi_product,
                rig.wifi_model,
                rig.part_spec_links?.wifi,
              );
              return (
                <div className="space-y-0.5">
                  {name || wifiLinks.length > 0 ? (
                    <div>
                      <SpecLink
                        compact
                        label={name || 'Wi-Fi Adapter'}
                        links={wifiLinks}
                        onEditLinks={
                          onEditPartLinks
                            ? () =>
                                onEditPartLinks({
                                  kind: 'computer_slot',
                                  computerId: rig.id,
                                  rigName: rig.name,
                                  slot: 'wifi',
                                  partLabel: name || 'Wi-Fi Adapter',
                                  currentMap: rig.part_spec_links,
                                })
                            : undefined
                        }
                      />
                    </div>
                  ) : null}
                  {details ? (
                    <p className="font-mono text-[11px] text-slate-400">
                      {details}
                    </p>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'bluetooth',
            label: 'Bluetooth',
            getCanonical: (rig) => rig.bluetooth_version?.trim() ?? '',
            render: (rig) =>
              rig.bluetooth_version?.trim() ? (
                <span className="font-mono text-slate-200">
                  BT {rig.bluetooth_version}
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              ),
          },
        ],
      },
      {
        id: 'benchmarks',
        title: '3DMark Benchmarks',
        icon: Trophy,
        iconClass: 'text-amber-400',
        rows: benchmarkRows,
      },
    ];
  }, [availableSuites, fleetStandings, latestBenchmarksByRigId, onEditPartLinks]);

  const { evaluatedSections, totalPopulatedRowCount, diffRowCount } = useMemo(() => {
    if (displayedRigs.length === 0) {
      return {
        evaluatedSections: [] as EvaluatedSection[],
        totalPopulatedRowCount: 0,
        diffRowCount: 0,
      };
    }

    let totalPopulated = 0;
    let totalDiff = 0;
    const out: EvaluatedSection[] = [];

    for (const section of sections) {
      const visibleRows: EvaluatedRow[] = [];
      for (const row of section.rows) {
        const canonicalValues = displayedRigs.map((r) => row.getCanonical(r));
        if (!hasAnyPopulatedValue(canonicalValues)) {
          continue;
        }
        totalPopulated += 1;
        const differs = hasRowDifference(canonicalValues);
        if (differs) {
          totalDiff += 1;
        }
        if (compareState.diffOnly && !differs) {
          continue;
        }
        const winnerIds = row.getWinnerValue
          ? computeWinnerRigIds(
              displayedRigs.map((r) => ({
                rigId: r.id,
                value: row.getWinnerValue!(r),
              })),
            )
          : new Set<number>();
        visibleRows.push({ def: row, winnerIds });
      }
      if (visibleRows.length > 0) {
        out.push({ section, rows: visibleRows });
      }
    }

    return {
      evaluatedSections: out,
      totalPopulatedRowCount: totalPopulated,
      diffRowCount: totalDiff,
    };
  }, [sections, displayedRigs, compareState.diffOnly]);

  const desktopCount = useMemo(
    () => computers.filter((c) => c.device_type === 'Desktop').length,
    [computers],
  );
  const laptopCount = useMemo(
    () => computers.filter((c) => c.device_type === 'Laptop').length,
    [computers],
  );

  const showCompareFiltered =
    filteredComputers.length >= 2 && filteredComputers.length < computers.length;

  const renderPresetButtons = () => (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={applyTop4Preset}
        disabled={computers.length < 2}
        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Top 4 Overall
      </button>
      <button
        type="button"
        onClick={() => applyDeviceTypePreset('Desktop')}
        disabled={desktopCount < 2}
        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        All Desktops ({desktopCount})
      </button>
      <button
        type="button"
        onClick={() => applyDeviceTypePreset('Laptop')}
        disabled={laptopCount < 2}
        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        All Laptops ({laptopCount})
      </button>
      {showCompareFiltered ? (
        <button
          type="button"
          onClick={applyFilteredPreset}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
        >
          Compare Filtered ({filteredComputers.length})
        </button>
      ) : null}
    </div>
  );

  const renderAddRigSelect = () => (
    <label className="inline-flex items-center gap-1.5">
      <Plus className="h-3.5 w-3.5 text-cyan-400" />
      <select
        value=""
        onChange={(e) => handleAddRig(e.target.value)}
        disabled={unselectedRigs.length === 0}
        aria-label="Add rig to comparison"
        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          {unselectedRigs.length === 0 ? 'All Rigs Added' : '+ Add Rig...'}
        </option>
        {unselectedRigs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.device_type})
          </option>
        ))}
      </select>
    </label>
  );

  const handleSelectPresetValue = (value: string) => {
    if (value === 'top4') applyTop4Preset();
    else if (value === 'desktops') applyDeviceTypePreset('Desktop');
    else if (value === 'laptops') applyDeviceTypePreset('Laptop');
    else if (value === 'filtered') applyFilteredPreset();
  };

  const renderPresetSelect = () => (
    <select
      value=""
      onChange={(e) => handleSelectPresetValue(e.target.value)}
      aria-label="Load comparison preset"
      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none"
    >
      <option value="">Load Preset...</option>
      {computers.length >= 2 ? (
        <option value="top4">Top 4 Overall</option>
      ) : null}
      {desktopCount >= 2 ? (
        <option value="desktops">All Desktops ({desktopCount})</option>
      ) : null}
      {laptopCount >= 2 ? (
        <option value="laptops">All Laptops ({laptopCount})</option>
      ) : null}
      {showCompareFiltered ? (
        <option value="filtered">
          Compare Filtered ({filteredComputers.length})
        </option>
      ) : null}
    </select>
  );

  // Empty state (0 rigs selected)
  if (selectedRigs.length === 0) {
    return (
      <section className="rounded-xl border border-cyan-500/30 bg-slate-900/75 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-cyan-300 uppercase">
              <GitCompare className="h-4 w-4" />
              Detailed Side-by-Side Comparison
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Select 2 or more rigs from the Fleet Matrix below, pick a preset, or
              add builds directly to compare specs, PassMark scores, and 3DMark runs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {renderPresetButtons()}
            {renderAddRigSelect()}
          </div>
        </div>
      </section>
    );
  }

  // Single-rig state (1 rig selected)
  if (selectedRigs.length === 1) {
    const onlyRig = selectedRigs[0];
    return (
      <section className="rounded-xl border border-cyan-500/30 bg-slate-900/75 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-cyan-300 uppercase">
              <GitCompare className="h-4 w-4" />
              Comparison
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-white">
              {onlyRig.name}
              <span className="text-slate-400">({onlyRig.device_type})</span>
              <button
                type="button"
                onClick={() => handleRemoveRig(onlyRig.id)}
                aria-label={`Remove ${onlyRig.name}`}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
            <span className="text-xs text-slate-400">
              Select at least 1 more rig to compare side-by-side.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {renderAddRigSelect()}
            {renderPresetButtons()}
            <button
              type="button"
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
      </section>
    );
  }

  const suiteDropdownOptions =
    availableSuites.length > 0 ? availableSuites : [...CORE_BENCHMARK_SUITES];

  return (
    <section className="space-y-3 rounded-xl border border-cyan-500/35 bg-slate-900/90 p-4">
      {/* Row 1 Controls: Header, + Add Rig, Expand/Collapse All, Share, Clear */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-cyan-300 uppercase">
            <GitCompare className="h-4 w-4" />
            Detailed Comparison
          </div>
          <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-200">
            {displayedRigs.length} Rigs
          </span>
          {renderAddRigSelect()}
          {renderPresetSelect()}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSetAllSections(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Expand All
          </button>
          <button
            type="button"
            onClick={() => handleSetAllSections(false)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            Collapse All
          </button>
          <button
            type="button"
            onClick={() => void handleCopyShareLink()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                Copied
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                Copy Share Link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleClearSelection}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Row 2 Controls: Sort Presets, Suite Picker, Asc/Desc, Differences Only, Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800/80 pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">
            Order Columns:
          </span>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
            {SORT_PRESETS.map((preset) => {
              const active = compareState.sort === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectSortPreset(preset.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {compareState.sort === '3dmark' ? (
            <select
              value={effectiveSuite ?? suiteDropdownOptions[0]}
              onChange={(e) => handleSelectSuite(e.target.value)}
              aria-label="3DMark suite to sort by"
              className="rounded-lg border border-amber-500/40 bg-slate-950 px-2.5 py-1 text-xs text-amber-200 focus:border-amber-400 focus:outline-none"
            >
              {suiteDropdownOptions.map((suite) => (
                <option key={suite} value={suite}>
                  {suite}
                </option>
              ))}
            </select>
          ) : null}

          {compareState.sort !== 'manual' ? (
            <button
              type="button"
              onClick={handleToggleSortDir}
              title="Toggle column sort direction"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-500"
            >
              {compareState.dir === 'desc' ? (
                <>
                  <ArrowDown className="h-3.5 w-3.5 text-cyan-400" />
                  Best → Worst
                </>
              ) : (
                <>
                  <ArrowUp className="h-3.5 w-3.5 text-cyan-400" />
                  Worst → Best
                </>
              )}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onChangeCompareState((prev) => ({
                ...prev,
                diffOnly: !prev.diffOnly,
              }))
            }
            aria-pressed={compareState.diffOnly}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              compareState.diffOnly
                ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Differences Only
            <span className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              {diffRowCount}/{totalPopulatedRowCount} differ
            </span>
          </button>
        </div>
      </div>

      {/* Scrollable Sticky Compare Table */}
      <div className="max-h-[75vh] overflow-auto rounded-lg border border-slate-800 bg-slate-950/60">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 min-w-[165px] max-w-[195px] border-r border-b border-slate-800 bg-slate-950 px-3 py-2.5 align-bottom font-semibold text-slate-400 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.6)]">
                <div>Spec</div>
                <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                  Drag headers or use ←/→
                </div>
              </th>

              {displayedRigs.map((rig, index) => {
                const standing = fleetStandings.get(rig.id);
                const isDragged = draggedRigId === rig.id;
                const isDropBefore =
                  dropTarget?.rigId === rig.id && dropTarget.position === 'before';
                const isDropAfter =
                  dropTarget?.rigId === rig.id && dropTarget.position === 'after';

                return (
                  <th
                    key={rig.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedRigId(rig.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(rig.id));
                    }}
                    onDragOver={(e) => {
                      if (draggedRigId === null || draggedRigId === rig.id) {
                        return;
                      }
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos: 'before' | 'after' =
                        e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                      setDropTarget((prev) =>
                        prev && prev.rigId === rig.id && prev.position === pos
                          ? prev
                          : { rigId: rig.id, position: pos },
                      );
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        setDropTarget((prev) =>
                          prev?.rigId === rig.id ? null : prev,
                        );
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos: 'before' | 'after' =
                        e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                      handleDropOnColumn(rig.id, pos);
                    }}
                    onDragEnd={() => {
                      setDraggedRigId(null);
                      setDropTarget(null);
                    }}
                    className={`sticky top-0 z-20 min-w-[210px] max-w-[260px] cursor-grab border-r border-b border-slate-800 bg-slate-950 px-3 py-2.5 align-top transition select-none last:border-r-0 active:cursor-grabbing ${
                      isDragged ? 'opacity-50' : ''
                    } ${
                      isDropBefore
                        ? 'border-l-2 border-l-cyan-400 bg-cyan-500/10'
                        : ''
                    } ${
                      isDropAfter
                        ? 'border-r-2 border-r-cyan-400 bg-cyan-500/10'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-slate-400">
                      <span
                        title="Drag to reorder column"
                        className="inline-flex items-center gap-1 text-[10px] text-slate-500"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                        <span>#{index + 1}</span>
                      </span>

                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleStepColumn(rig.id, -1)}
                          disabled={index === 0}
                          title="Move column left"
                          aria-label={`Move ${rig.name} left`}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStepColumn(rig.id, 1)}
                          disabled={index === displayedRigs.length - 1}
                          title="Move column right"
                          aria-label={`Move ${rig.name} right`}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRig(rig.id)}
                          title={`Remove ${rig.name} from comparison`}
                          aria-label={`Remove ${rig.name} from comparison`}
                          className="rounded p-1 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectComputer(rig)}
                        className="text-left text-sm font-bold text-white transition hover:text-cyan-300"
                      >
                        {rig.name}
                      </button>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          rig.device_type === 'Laptop'
                            ? 'bg-violet-500/15 text-violet-300'
                            : 'bg-sky-500/15 text-sky-300'
                        }`}
                      >
                        {rig.device_type}
                      </span>
                      {standing?.overallRank ? (
                        <span
                          title={getCompositeTooltip(standing)}
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${getRankBadgeClasses(
                            standing.overallRank,
                          )}`}
                        >
                          {formatShortRank(standing.overallRank)}
                        </span>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {evaluatedSections.length === 0 ? (
              <tr>
                <td
                  colSpan={displayedRigs.length + 1}
                  className="px-4 py-8 text-center text-xs text-slate-400"
                >
                  <div>All specs match across the selected rigs.</div>
                  {compareState.diffOnly ? (
                    <button
                      type="button"
                      onClick={() =>
                        onChangeCompareState((prev) => ({
                          ...prev,
                          diffOnly: false,
                        }))
                      }
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                    >
                      Show All Specs
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : (
              evaluatedSections.flatMap(({ section, rows }) => {
                const isExpanded = expandedSections[section.id];
                const SectionIcon = section.icon;

                const headerRow = (
                  <tr
                    key={`section_${section.id}`}
                    onClick={() => handleToggleSection(section.id)}
                    className="cursor-pointer select-none"
                  >
                    <td className="sticky left-0 z-10 border-r border-b border-slate-800 bg-slate-900 px-3 py-2 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.6)]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSection(section.id);
                        }}
                        aria-expanded={isExpanded}
                        className="flex w-full items-center gap-1.5 text-left text-[11px] font-semibold tracking-wider text-slate-200 uppercase"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                        <SectionIcon
                          className={`h-3.5 w-3.5 shrink-0 ${section.iconClass}`}
                        />
                        <span className="truncate">{section.title}</span>
                        <span className="ml-auto rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] font-normal text-slate-400">
                          {rows.length}
                        </span>
                      </button>
                    </td>
                    <td
                      colSpan={displayedRigs.length}
                      className="border-b border-slate-800 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-500"
                    >
                      {isExpanded ? '' : `Collapsed (${rows.length} rows)`}
                    </td>
                  </tr>
                );

                if (!isExpanded) {
                  return [headerRow];
                }

                const dataRows = rows.map(({ def, winnerIds }) => (
                  <tr key={def.key} className="group hover:bg-slate-900/40">
                    <td className="sticky left-0 z-10 border-r border-b border-slate-800/70 bg-slate-900 px-3 py-2 font-medium text-slate-400 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.6)]">
                      {def.label}
                    </td>
                    {displayedRigs.map((rig) => {
                      const isWinner = winnerIds.has(rig.id);
                      return (
                        <td
                          key={`${def.key}_${rig.id}`}
                          className={`border-r border-b border-slate-800/70 px-3 py-2 align-top last:border-r-0 ${
                            isWinner ? 'bg-emerald-500/10' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">{def.render(rig)}</div>
                            {isWinner ? (
                              <span
                                title="Best in row"
                                className="mt-0.5 shrink-0 text-emerald-400"
                              >
                                <Trophy className="h-3 w-3" />
                              </span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ));

                return [headerRow, ...dataRows];
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
