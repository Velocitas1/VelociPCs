import { useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  CircuitBoard,
  Cpu as CpuIcon,
  Edit3,
  Fan,
  Globe,
  HardDrive,
  Layers,
  MemoryStick,
  Minus,
  Monitor,
  Plus,
  Search,
  Trash2,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  buildCaseResearchLinks,
  buildCoolerResearchLinks,
  buildCpuResearchLinks,
  buildGpuResearchLinks,
  buildMotherboardResearchLinks,
  buildPsuResearchLinks,
  buildRamResearchLinks,
  buildStorageDriveResearchLinks,
  buildWifiResearchLinks,
} from '../lib/specLinks';
import {
  computeCatalogRanks,
  formatPassMark,
  formatScoreUpdatedDate,
  formatShortRank,
  getRankBadgeClasses,
} from '../lib/scoring';
import type {
  CatalogPart,
  CatalogPartCategory,
  ComputerWithRelations,
  Cooler,
  Cpu,
  Gpu,
  GpuCard,
  Motherboard,
  PartsCatalogTab,
  PcCase,
  Psu,
  RamKit,
  SpareTableName,
  SpecLinkItem,
  StorageDriveModel,
  WifiCard,
} from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import type { PartLinksEditTarget } from './PartLinksModal';
import { SpecLink } from './SpecLink';

interface PartsCatalogViewProps {
  cpus: Cpu[];
  gpus: Gpu[];
  gpuCards: GpuCard[];
  motherboards: Motherboard[];
  ramKits: RamKit[];
  storageDriveModels: StorageDriveModel[];
  psus: Psu[];
  cases: PcCase[];
  coolers: Cooler[];
  wifiCards: WifiCard[];
  computers: ComputerWithRelations[];
  isOwner: boolean;
  onAddPartLookup: (partType: 'cpu' | 'gpu') => void;
  onEditCpu: (cpu: Cpu) => void;
  onDeleteCpu: (cpu: Cpu) => void;
  onEditGpu: (gpu: Gpu) => void;
  onDeleteGpu: (gpu: Gpu) => void;
  onAddCatalogPart: (category: CatalogPartCategory) => void;
  onEditCatalogPart: (category: CatalogPartCategory, part: CatalogPart) => void;
  onDeleteCatalogPart: (
    category: CatalogPartCategory,
    part: CatalogPart,
    installedCount: number,
  ) => void;
  onAdjustSpareCount: (
    table: SpareTableName,
    id: number,
    delta: number,
  ) => Promise<void>;
  onEditPartLinks?: (target: PartLinksEditTarget) => void;
}

type OwnershipFilter = 'all' | 'installed' | 'spare';
type PartSortMode = 'default' | 'name' | 'total' | 'spare' | 'installed';

interface UsageInfo {
  count: number;
  rigNames: string[];
}

const TAB_CONFIG: Array<{
  id: PartsCatalogTab;
  label: string;
  icon: typeof CpuIcon;
  category?: CatalogPartCategory;
}> = [
  { id: 'cpus', label: 'CPUs', icon: CpuIcon },
  { id: 'gpus', label: 'GPUs (Chips)', icon: Monitor },
  { id: 'gpu_cards', label: 'GPU Cards', icon: Layers, category: 'gpu_card' },
  {
    id: 'motherboards',
    label: 'Motherboards',
    icon: CircuitBoard,
    category: 'motherboard',
  },
  { id: 'ram_kits', label: 'RAM Kits', icon: MemoryStick, category: 'ram_kit' },
  {
    id: 'storage_drive_models',
    label: 'Storage Drives',
    icon: HardDrive,
    category: 'storage_drive_model',
  },
  { id: 'psus', label: 'PSUs', icon: Zap, category: 'psu' },
  { id: 'cases', label: 'Cases', icon: Box, category: 'case' },
  { id: 'coolers', label: 'Coolers', icon: Fan, category: 'cooler' },
  { id: 'wifi_cards', label: 'Wi-Fi Cards', icon: Wifi, category: 'wifi_card' },
];

function recordUsage(
  map: Map<number, UsageInfo>,
  id: number | null | undefined,
  rigName: string,
  qty = 1,
) {
  if (!id) return;
  const entry = map.get(id) ?? { count: 0, rigNames: [] };
  entry.count += qty;
  if (!entry.rigNames.includes(rigName)) {
    entry.rigNames.push(rigName);
  }
  map.set(id, entry);
}

function renderInstalledCell(usage: UsageInfo | undefined): ReactNode {
  const count = usage?.count ?? 0;
  if (count === 0) {
    return <span className="font-mono text-slate-600">0</span>;
  }
  const names = usage!.rigNames;
  const preview =
    names.length <= 2
      ? names.join(', ')
      : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  return (
    <div title={names.join(', ')} className="text-right">
      <span className="font-mono font-semibold text-cyan-300">{count}</span>
      <div className="max-w-[140px] truncate text-[10px] text-slate-400">
        {preview}
      </div>
    </div>
  );
}

export function PartsCatalogView({
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
  computers,
  isOwner,
  onAddPartLookup,
  onEditCpu,
  onDeleteCpu,
  onEditGpu,
  onDeleteGpu,
  onAddCatalogPart,
  onEditCatalogPart,
  onDeleteCatalogPart,
  onAdjustSpareCount,
  onEditPartLinks,
}: PartsCatalogViewProps) {
  const [subTab, setSubTab] = useState<PartsCatalogTab>('cpus');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');
  const [search, setSearch] = useState('');
  const [partSort, setPartSort] = useState<PartSortMode>('default');
  const [busySpareKey, setBusySpareKey] = useState<string | null>(null);

  const cpuRanks = useMemo(() => computeCatalogRanks(cpus), [cpus]);
  const gpuRanks = useMemo(() => computeCatalogRanks(gpus), [gpus]);

  const usage = useMemo(() => {
    const cpuMap = new Map<number, UsageInfo>();
    const gpuMap = new Map<number, UsageInfo>();
    const gpuCardMap = new Map<number, UsageInfo>();
    const mbMap = new Map<number, UsageInfo>();
    const ramMap = new Map<number, UsageInfo>();
    const driveMap = new Map<number, UsageInfo>();
    const psuMap = new Map<number, UsageInfo>();
    const caseMap = new Map<number, UsageInfo>();
    const coolerMap = new Map<number, UsageInfo>();
    const wifiMap = new Map<number, UsageInfo>();

    for (const c of computers) {
      recordUsage(cpuMap, c.cpu_id, c.name, Math.max(1, c.cpu_count || 1));
      recordUsage(gpuMap, c.gpu_id, c.name, 1);
      recordUsage(gpuMap, c.igpu_id, c.name, 1);
      recordUsage(gpuCardMap, c.gpu_card_id, c.name, 1);
      recordUsage(mbMap, c.motherboard_id, c.name, 1);
      recordUsage(ramMap, c.ram_kit_id, c.name, 1);
      recordUsage(psuMap, c.psu_id, c.name, 1);
      recordUsage(caseMap, c.case_id, c.name, 1);
      recordUsage(coolerMap, c.cooler_id, c.name, 1);
      recordUsage(wifiMap, c.wifi_card_id, c.name, 1);
      for (const d of c.storage_drives) {
        recordUsage(driveMap, d.storage_drive_model_id, c.name, 1);
      }
    }

    return {
      cpus: cpuMap,
      gpus: gpuMap,
      gpu_cards: gpuCardMap,
      motherboards: mbMap,
      ram_kits: ramMap,
      storage_drive_models: driveMap,
      psus: psuMap,
      cases: caseMap,
      coolers: coolerMap,
      wifi_cards: wifiMap,
    };
  }, [computers]);

  const gpuCardsByChip = useMemo(() => {
    const map = new Map<number, { models: number; spare: number }>();
    for (const card of gpuCards) {
      const entry = map.get(card.gpu_id) ?? { models: 0, spare: 0 };
      entry.models += 1;
      entry.spare += card.spare_count;
      map.set(card.gpu_id, entry);
    }
    return map;
  }, [gpuCards]);

  const tabCounts: Record<PartsCatalogTab, number> = {
    cpus: cpus.length,
    gpus: gpus.length,
    gpu_cards: gpuCards.length,
    motherboards: motherboards.length,
    ram_kits: ramKits.length,
    storage_drive_models: storageDriveModels.length,
    psus: psus.length,
    cases: cases.length,
    coolers: coolers.length,
    wifi_cards: wifiCards.length,
  };

  const globalTotals = useMemo(() => {
    const totalSpares =
      cpus.reduce((s, x) => s + x.spare_count, 0) +
      gpuCards.reduce((s, x) => s + x.spare_count, 0) +
      motherboards.reduce((s, x) => s + x.spare_count, 0) +
      ramKits.reduce((s, x) => s + x.spare_count, 0) +
      storageDriveModels.reduce((s, x) => s + x.spare_count, 0) +
      psus.reduce((s, x) => s + x.spare_count, 0) +
      cases.reduce((s, x) => s + x.spare_count, 0) +
      coolers.reduce((s, x) => s + x.spare_count, 0) +
      wifiCards.reduce((s, x) => s + x.spare_count, 0);

    const sumMap = (m: Map<number, UsageInfo>) =>
      Array.from(m.values()).reduce((s, u) => s + u.count, 0);

    const totalInstalled =
      sumMap(usage.cpus) +
      sumMap(usage.gpu_cards) +
      sumMap(usage.motherboards) +
      sumMap(usage.ram_kits) +
      sumMap(usage.storage_drive_models) +
      sumMap(usage.psus) +
      sumMap(usage.cases) +
      sumMap(usage.coolers) +
      sumMap(usage.wifi_cards);

    return { totalSpares, totalInstalled };
  }, [
    cpus,
    gpuCards,
    motherboards,
    ramKits,
    storageDriveModels,
    psus,
    cases,
    coolers,
    wifiCards,
    usage,
  ]);

  const activeKpi = useMemo(() => {
    if (subTab === 'gpus') {
      const installed = Array.from(usage.gpus.values()).reduce(
        (s, u) => s + u.count,
        0,
      );
      const spare = gpuCards.reduce((s, x) => s + x.spare_count, 0);
      return {
        models: gpus.length,
        installed,
        spare,
        total: installed + spare,
        spareNote: 'Across AIB GPU Cards',
      };
    }

    const activeSpareList: Array<{ id: number; spare_count: number }> =
      subTab === 'cpus'
        ? cpus
        : subTab === 'gpu_cards'
          ? gpuCards
          : subTab === 'motherboards'
            ? motherboards
            : subTab === 'ram_kits'
              ? ramKits
              : subTab === 'storage_drive_models'
                ? storageDriveModels
                : subTab === 'psus'
                  ? psus
                  : subTab === 'cases'
                    ? cases
                    : subTab === 'coolers'
                      ? coolers
                      : wifiCards;

    const map = usage[subTab];
    const installed = Array.from(map.values()).reduce((s, u) => s + u.count, 0);
    const spare = activeSpareList.reduce((s, x) => s + x.spare_count, 0);
    return {
      models: activeSpareList.length,
      installed,
      spare,
      total: installed + spare,
      spareNote: 'Loose / unmounted units',
    };
  }, [
    subTab,
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
    usage,
  ]);

  const handleStepSpare = async (
    table: SpareTableName,
    id: number,
    delta: number,
  ) => {
    const key = `${table}:${id}`;
    setBusySpareKey(key);
    try {
      await onAdjustSpareCount(table, id, delta);
    } finally {
      setBusySpareKey((prev) => (prev === key ? null : prev));
    }
  };

  const renderSpareCell = (
    table: SpareTableName,
    id: number,
    spareCount: number,
  ) => {
    const key = `${table}:${id}`;
    const busy = busySpareKey === key;
    return (
      <div className="inline-flex items-center justify-end gap-1.5 font-mono">
        {isOwner ? (
          <button
            type="button"
            disabled={busy || spareCount <= 0}
            onClick={() => void handleStepSpare(table, id, -1)}
            title="Decrement spare count"
            className="rounded border border-slate-700 bg-slate-950 p-0.5 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Minus className="h-3 w-3" />
          </button>
        ) : null}
        <span
          className={`min-w-[1.5rem] text-center font-semibold ${
            spareCount > 0 ? 'text-emerald-300' : 'text-slate-500'
          }`}
        >
          {spareCount}
        </span>
        {isOwner ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleStepSpare(table, id, 1)}
            title="Increment spare count"
            className="rounded border border-slate-700 bg-slate-950 p-0.5 text-slate-300 transition hover:border-emerald-500/60 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    );
  };

  const filterAndSort = <T extends { id: number; spare_count: number }>(
    list: T[],
    usageMap: Map<number, UsageInfo>,
    getSearchText: (item: T) => string,
    getName: (item: T) => string,
  ): T[] => {
    const q = search.trim().toLowerCase();
    const filtered = list.filter((item) => {
      const installed = usageMap.get(item.id)?.count ?? 0;
      if (ownershipFilter === 'installed' && installed === 0) return false;
      if (ownershipFilter === 'spare' && item.spare_count === 0) return false;
      if (q && !getSearchText(item).toLowerCase().includes(q)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const instA = usageMap.get(a.id)?.count ?? 0;
      const instB = usageMap.get(b.id)?.count ?? 0;
      if (partSort === 'spare') {
        if (b.spare_count !== a.spare_count) return b.spare_count - a.spare_count;
      } else if (partSort === 'installed') {
        if (instB !== instA) return instB - instA;
      } else if (partSort === 'total') {
        const totA = instA + a.spare_count;
        const totB = instB + b.spare_count;
        if (totB !== totA) return totB - totA;
      }
      return getName(a).localeCompare(getName(b));
    });
  };

  const filteredCpus = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = cpus.filter((c) => {
      const installed = usage.cpus.get(c.id)?.count ?? 0;
      if (ownershipFilter === 'installed' && installed === 0) return false;
      if (ownershipFilter === 'spare' && c.spare_count === 0) return false;
      if (!q) return true;
      return `${c.brand} ${c.name} ${c.codename ?? ''} ${c.socket ?? ''}`
        .toLowerCase()
        .includes(q);
    });

    return [...matches].sort((a, b) => {
      const instA = usage.cpus.get(a.id)?.count ?? 0;
      const instB = usage.cpus.get(b.id)?.count ?? 0;
      if (partSort === 'default') {
        if (a.passmark_score !== null && b.passmark_score !== null) {
          if (b.passmark_score !== a.passmark_score) {
            return b.passmark_score - a.passmark_score;
          }
        } else if (a.passmark_score !== null) return -1;
        else if (b.passmark_score !== null) return 1;
      } else if (partSort === 'spare') {
        if (b.spare_count !== a.spare_count) return b.spare_count - a.spare_count;
      } else if (partSort === 'installed') {
        if (instB !== instA) return instB - instA;
      } else if (partSort === 'total') {
        const diff = instB + b.spare_count - (instA + a.spare_count);
        if (diff !== 0) return diff;
      }
      return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
    });
  }, [cpus, search, ownershipFilter, partSort, usage.cpus]);

  const filteredGpus = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = gpus.filter((g) => {
      const installed = usage.gpus.get(g.id)?.count ?? 0;
      const spare = gpuCardsByChip.get(g.id)?.spare ?? 0;
      if (ownershipFilter === 'installed' && installed === 0) return false;
      if (ownershipFilter === 'spare' && spare === 0) return false;
      if (!q) return true;
      return `${g.brand} ${g.name} ${g.architecture ?? ''} ${g.directx_version ?? ''}`
        .toLowerCase()
        .includes(q);
    });

    return [...matches].sort((a, b) => {
      const instA = usage.gpus.get(a.id)?.count ?? 0;
      const instB = usage.gpus.get(b.id)?.count ?? 0;
      const spareA = gpuCardsByChip.get(a.id)?.spare ?? 0;
      const spareB = gpuCardsByChip.get(b.id)?.spare ?? 0;
      if (partSort === 'default') {
        if (a.passmark_score !== null && b.passmark_score !== null) {
          if (b.passmark_score !== a.passmark_score) {
            return b.passmark_score - a.passmark_score;
          }
        } else if (a.passmark_score !== null) return -1;
        else if (b.passmark_score !== null) return 1;
      } else if (partSort === 'spare') {
        if (spareB !== spareA) return spareB - spareA;
      } else if (partSort === 'installed') {
        if (instB !== instA) return instB - instA;
      } else if (partSort === 'total') {
        const diff = instB + spareB - (instA + spareA);
        if (diff !== 0) return diff;
      }
      return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
    });
  }, [gpus, search, ownershipFilter, partSort, usage.gpus, gpuCardsByChip]);

  const filteredGpuCards = useMemo(
    () =>
      filterAndSort(
        gpuCards,
        usage.gpu_cards,
        (c) =>
          `${c.brand} ${c.model} ${c.part_number ?? ''} ${c.gpu?.brand ?? ''} ${c.gpu?.name ?? ''}`,
        (c) => `${c.brand} ${c.model}`,
      ),
    [gpuCards, usage.gpu_cards, search, ownershipFilter, partSort],
  );

  const filteredMotherboards = useMemo(
    () =>
      filterAndSort(
        motherboards,
        usage.motherboards,
        (m) =>
          `${m.brand} ${m.model} ${m.socket ?? ''} ${m.chipset ?? ''} ${m.form_factor ?? ''}`,
        (m) => `${m.brand} ${m.model}`,
      ),
    [motherboards, usage.motherboards, search, ownershipFilter, partSort],
  );

  const filteredRamKits = useMemo(
    () =>
      filterAndSort(
        ramKits,
        usage.ram_kits,
        (r) =>
          `${r.brand ?? ''} ${r.model} ${r.ram_type ?? ''} ${r.capacity_gb ?? ''}GB ${r.speed_mhz ?? ''}`,
        (r) => `${r.brand ?? ''} ${r.model}`.trim(),
      ),
    [ramKits, usage.ram_kits, search, ownershipFilter, partSort],
  );

  const filteredDriveModels = useMemo(
    () =>
      filterAndSort(
        storageDriveModels,
        usage.storage_drive_models,
        (d) =>
          `${d.brand ?? ''} ${d.model} ${d.model_number ?? ''} ${d.form_factor ?? ''} ${d.capacity_gb ?? ''}GB`,
        (d) => `${d.brand ?? ''} ${d.model}`.trim(),
      ),
    [
      storageDriveModels,
      usage.storage_drive_models,
      search,
      ownershipFilter,
      partSort,
    ],
  );

  const filteredPsus = useMemo(
    () =>
      filterAndSort(
        psus,
        usage.psus,
        (p) =>
          `${p.brand} ${p.model} ${p.wattage ?? ''}W ${p.efficiency_rating ?? ''}`,
        (p) => `${p.brand} ${p.model}`,
      ),
    [psus, usage.psus, search, ownershipFilter, partSort],
  );

  const filteredCases = useMemo(
    () =>
      filterAndSort(
        cases,
        usage.cases,
        (c) => `${c.brand} ${c.model} ${c.form_factor ?? ''} ${c.color ?? ''}`,
        (c) => `${c.brand} ${c.model}`,
      ),
    [cases, usage.cases, search, ownershipFilter, partSort],
  );

  const filteredCoolers = useMemo(
    () =>
      filterAndSort(
        coolers,
        usage.coolers,
        (c) =>
          `${c.brand} ${c.model} ${c.cooler_type ?? ''} ${c.socket_support ?? ''}`,
        (c) => `${c.brand} ${c.model}`,
      ),
    [coolers, usage.coolers, search, ownershipFilter, partSort],
  );

  const filteredWifiCards = useMemo(
    () =>
      filterAndSort(
        wifiCards,
        usage.wifi_cards,
        (w) =>
          `${w.brand} ${w.product ?? ''} ${w.model} ${w.wifi_standard ?? ''} ${w.form_factor ?? ''}`,
        (w) => `${w.brand} ${w.product ?? ''} ${w.model}`,
      ),
    [wifiCards, usage.wifi_cards, search, ownershipFilter, partSort],
  );

  const activeTabMeta = TAB_CONFIG.find((t) => t.id === subTab)!;

  const renderGenericActions = (
    category: CatalogPartCategory,
    part: CatalogPart,
    installedCount: number,
  ) =>
    isOwner ? (
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => onEditCatalogPart(category, part)}
          title="Edit part"
          className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDeleteCatalogPart(category, part, installedCount)}
          title="Delete part"
          className="rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    ) : null;

  const makeLinkEditor = (
    table: Exclude<SpareTableName, 'cpus'>,
    id: number,
    presetKind:
      | 'gpu_aib'
      | 'motherboard'
      | 'ram'
      | 'storage_drive'
      | 'psu'
      | 'case'
      | 'cooler'
      | 'wifi',
    partLabel: string,
    subtitle: string,
    specUrl: string | null,
    specLinks: SpecLinkItem[],
  ) =>
    onEditPartLinks
      ? () =>
          onEditPartLinks({
            kind: 'catalog_part',
            table,
            id,
            presetKind,
            partLabel,
            subtitle,
            specUrl,
            specLinks,
          })
      : undefined;

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
          <p className="text-xs font-medium text-slate-400">
            {activeTabMeta.label} Models
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {activeKpi.models}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Distinct models in catalog
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
          <p className="text-xs font-medium text-slate-400">Installed Units</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">
            {activeKpi.installed}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {globalTotals.totalInstalled} total across all parts
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
          <p className="text-xs font-medium text-slate-400">Spare Units</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">
            {activeKpi.spare}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {globalTotals.totalSpares} spare across all parts
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
          <p className="text-xs font-medium text-slate-400">Total Owned</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">
            {activeKpi.total}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {activeKpi.spareNote}
          </p>
        </div>
      </div>

      {/* Category Tabs + Filters */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
            const active = subTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSubTab(id);
                  setPartSort('default');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-slate-700/80 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <span
                  className={`rounded px-1 py-0.2 font-mono text-[10px] ${
                    active
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tabCounts[id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-slate-800/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'installed', label: 'Installed' },
                { id: 'spare', label: 'Spare' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setOwnershipFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  ownershipFilter === f.id
                    ? 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                    : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeTabMeta.label}...`}
                className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 pr-3 pl-8 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <select
              value={partSort}
              onChange={(e) => setPartSort(e.target.value as PartSortMode)}
              aria-label="Sort parts catalog"
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
            >
              <option value="default">
                {subTab === 'cpus' || subTab === 'gpus'
                  ? 'Sort: PassMark'
                  : 'Sort: Name (A–Z)'}
              </option>
              {subTab === 'cpus' || subTab === 'gpus' ? (
                <option value="name">Sort: Name (A–Z)</option>
              ) : null}
              <option value="total">Sort: Total Owned</option>
              <option value="spare">Sort: Spare Count</option>
              <option value="installed">Sort: Installed</option>
            </select>

            {isOwner ? (
              subTab === 'cpus' || subTab === 'gpus' ? (
                <button
                  type="button"
                  onClick={() =>
                    onAddPartLookup(subTab === 'cpus' ? 'cpu' : 'gpu')
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Search Intel / AMD Specs
                </button>
              ) : activeTabMeta.category ? (
                <button
                  type="button"
                  onClick={() => onAddCatalogPart(activeTabMeta.category!)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add {activeTabMeta.label.replace(/s$/, '')}
                </button>
              ) : null
            ) : null}
          </div>
        </div>
      </div>

      {/* Tables */}
      {subTab === 'cpus' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Rank</th>
                <th className="px-3 py-2.5">Processor</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5">Socket</th>
                <th className="px-3 py-2.5 text-right">C/T</th>
                <th className="px-3 py-2.5 text-right">Base / Turbo</th>
                <th className="px-3 py-2.5 text-right">CPU Mark</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCpus.map((c) => {
                const rankPos = cpuRanks.get(c.id);
                const updatedDate = formatScoreUpdatedDate(c.score_updated_at);
                const inst = usage.cpus.get(c.id);
                const total = (inst?.count ?? 0) + c.spare_count;
                return (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      {rankPos ? (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getRankBadgeClasses(
                            rankPos,
                          )}`}
                        >
                          {formatShortRank(rankPos)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      <SpecLink
                        label={`${c.brand} ${c.name}`}
                        links={buildCpuResearchLinks(c)}
                        onEditLinks={
                          onEditPartLinks
                            ? () => onEditPartLinks({ kind: 'cpu', cpu: c })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">
                      {c.is_mobile ? 'Mobile' : 'Desktop'}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-300">
                      {c.socket ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {c.cores ?? '—'}/{c.threads ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {c.base_clock_ghz ?? '—'} / {c.turbo_clock_ghz ?? '—'} GHz
                    </td>
                    <td
                      title={updatedDate ? `Updated ${updatedDate}` : undefined}
                      className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-cyan-200"
                    >
                      {formatPassMark(c.passmark_score)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {renderInstalledCell(inst)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {renderSpareCell('cpus', c.id, c.spare_count)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                      {total}
                    </td>
                    {isOwner ? (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEditCpu(c)}
                          className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCpu(c)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'gpus' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Rank</th>
                <th className="px-3 py-2.5">Graphics Chip</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5">DirectX</th>
                <th className="px-3 py-2.5 text-right">VRAM</th>
                <th className="px-3 py-2.5 text-right">TDP</th>
                <th className="px-3 py-2.5 text-right">G3D Mark</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">AIB Cards / Spare</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredGpus.map((g) => {
                const rankPos = gpuRanks.get(g.id);
                const updatedDate = formatScoreUpdatedDate(g.score_updated_at);
                const inst = usage.gpus.get(g.id);
                const cardStats = gpuCardsByChip.get(g.id);
                return (
                  <tr key={g.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      {rankPos ? (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getRankBadgeClasses(
                            rankPos,
                          )}`}
                        >
                          {formatShortRank(rankPos)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      <SpecLink
                        label={`${g.brand} ${g.name}`}
                        links={buildGpuResearchLinks(g)}
                        onEditLinks={
                          onEditPartLinks
                            ? () => onEditPartLinks({ kind: 'gpu', gpu: g })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">
                      {g.is_mobile ? 'Mobile' : 'Desktop'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <DirectXBadge
                        version={g.directx_version}
                        featureLevel={g.directx_feature_level}
                        compact
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {g.vram_gb !== null
                        ? `${g.vram_gb} GB ${g.vram_type ?? ''}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {g.tdp_w ? `${g.tdp_w}W` : '—'}
                    </td>
                    <td
                      title={updatedDate ? `Updated ${updatedDate}` : undefined}
                      className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-emerald-200"
                    >
                      {formatPassMark(g.passmark_score)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {renderInstalledCell(inst)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {cardStats ? (
                        <span>
                          {cardStats.models} model
                          {cardStats.models === 1 ? '' : 's'}
                          {cardStats.spare > 0 ? (
                            <span className="ml-1 text-emerald-300">
                              ({cardStats.spare} spare)
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    {isOwner ? (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEditGpu(g)}
                          className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteGpu(g)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'gpu_cards' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">GPU Card (AIB Model)</th>
                <th className="px-3 py-2.5">Silicon Chip</th>
                <th className="px-3 py-2.5">Cooling / Length</th>
                <th className="px-3 py-2.5">Part #</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredGpuCards.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 8 : 7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No GPU cards match the current filter.
                  </td>
                </tr>
              ) : (
                filteredGpuCards.map((card) => {
                  const inst = usage.gpu_cards.get(card.id);
                  const instCount = inst?.count ?? 0;
                  const label = `${card.brand} ${card.model}`;
                  return (
                    <tr key={card.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <SpecLink
                          label={label}
                          links={
                            card.gpu
                              ? buildGpuResearchLinks(card.gpu, {
                                  manufacturer: card.brand,
                                  model: card.model,
                                  savedEntry: {
                                    spec_url: card.spec_url,
                                    links: card.spec_links,
                                  },
                                })
                              : []
                          }
                          onEditLinks={makeLinkEditor(
                            'gpu_cards',
                            card.id,
                            'gpu_aib',
                            label,
                            'GPU Card Catalog Entry',
                            card.spec_url,
                            card.spec_links,
                          )}
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {card.gpu ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-200">
                              {card.gpu.brand} {card.gpu.name}
                            </span>
                            <DirectXBadge
                              version={card.gpu.directx_version}
                              featureLevel={card.gpu.directx_feature_level}
                              compact
                            />
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {[
                          card.cooling_type,
                          card.length_mm ? `${card.length_mm}mm` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-400">
                        {card.part_number ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderInstalledCell(inst)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderSpareCell(
                          'gpu_cards',
                          card.id,
                          card.spare_count,
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                        {instCount + card.spare_count}
                      </td>
                      {renderGenericActions('gpu_card', card, instCount)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'motherboards' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Motherboard</th>
                <th className="px-3 py-2.5">Socket</th>
                <th className="px-3 py-2.5">Chipset</th>
                <th className="px-3 py-2.5">Form Factor</th>
                <th className="px-3 py-2.5">RAM Type</th>
                <th className="px-3 py-2.5">Launch</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredMotherboards.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 10 : 9}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No motherboards match the current filter.
                  </td>
                </tr>
              ) : (
                filteredMotherboards.map((mb) => {
                  const inst = usage.motherboards.get(mb.id);
                  const instCount = inst?.count ?? 0;
                  const label = `${mb.brand} ${mb.model}`;
                  return (
                    <tr key={mb.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <SpecLink
                          label={label}
                          links={buildMotherboardResearchLinks(
                            mb.brand,
                            mb.model,
                            mb.launch_date,
                            { spec_url: mb.spec_url, links: mb.spec_links },
                          )}
                          onEditLinks={makeLinkEditor(
                            'motherboards',
                            mb.id,
                            'motherboard',
                            label,
                            'Motherboard Catalog Entry',
                            mb.spec_url,
                            mb.spec_links,
                          )}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-300">
                        {mb.socket ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {mb.chipset ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {mb.form_factor ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-300">
                        {mb.memory_type ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-400">
                        {mb.launch_date ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderInstalledCell(inst)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderSpareCell('motherboards', mb.id, mb.spare_count)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                        {instCount + mb.spare_count}
                      </td>
                      {renderGenericActions('motherboard', mb, instCount)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'ram_kits' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">RAM Kit</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5 text-right">Capacity</th>
                <th className="px-3 py-2.5">Type / Speed</th>
                <th className="px-3 py-2.5">PC Rating</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRamKits.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 9 : 8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No RAM kits match the current filter.
                  </td>
                </tr>
              ) : (
                filteredRamKits.map((kit) => {
                  const inst = usage.ram_kits.get(kit.id);
                  const instCount = inst?.count ?? 0;
                  const label = [kit.brand, kit.model]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <tr key={kit.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <SpecLink
                          label={label}
                          links={buildRamResearchLinks({
                            spec_url: kit.spec_url,
                            links: kit.spec_links,
                          })}
                          onEditLinks={makeLinkEditor(
                            'ram_kits',
                            kit.id,
                            'ram',
                            label,
                            'RAM Kit Catalog Entry',
                            kit.spec_url,
                            kit.spec_links,
                          )}
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">
                        {kit.is_mobile ? 'Laptop / SO-DIMM' : 'Desktop DIMM'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-200">
                        {kit.capacity_gb ? `${kit.capacity_gb} GB` : '—'}
                        {kit.modules_count ? ` (${kit.modules_count}x)` : ''}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-300">
                        {[
                          kit.ram_type,
                          kit.speed_mhz ? `${kit.speed_mhz} MHz` : null,
                        ]
                          .filter(Boolean)
                          .join(' @ ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-400">
                        {kit.pc_rating ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderInstalledCell(inst)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderSpareCell('ram_kits', kit.id, kit.spare_count)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                        {instCount + kit.spare_count}
                      </td>
                      {renderGenericActions('ram_kit', kit, instCount)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'storage_drive_models' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Drive Model</th>
                <th className="px-3 py-2.5 text-right">Capacity</th>
                <th className="px-3 py-2.5">Form Factor</th>
                <th className="px-3 py-2.5">NAND / Model #</th>
                <th className="px-3 py-2.5 text-right">Read / Write</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredDriveModels.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 9 : 8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No storage drives match the current filter.
                  </td>
                </tr>
              ) : (
                filteredDriveModels.map((d) => {
                  const inst = usage.storage_drive_models.get(d.id);
                  const instCount = inst?.count ?? 0;
                  const label = [d.brand, d.model].filter(Boolean).join(' ');
                  return (
                    <tr key={d.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <SpecLink
                          label={label}
                          links={buildStorageDriveResearchLinks(d)}
                          onEditLinks={makeLinkEditor(
                            'storage_drive_models',
                            d.id,
                            'storage_drive',
                            label,
                            'Storage Drive Catalog Entry',
                            d.spec_url,
                            d.spec_links,
                          )}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-200">
                        {d.capacity_gb ? `${d.capacity_gb} GB` : '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {d.form_factor ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-400">
                        {[d.nand_type, d.model_number]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                        {d.read_mb_s || d.write_mb_s
                          ? `${d.read_mb_s ?? '—'} / ${d.write_mb_s ?? '—'} MB/s`
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderInstalledCell(inst)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderSpareCell(
                          'storage_drive_models',
                          d.id,
                          d.spare_count,
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                        {instCount + d.spare_count}
                      </td>
                      {renderGenericActions(
                        'storage_drive_model',
                        d,
                        instCount,
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'psus' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Power Supply</th>
                <th className="px-3 py-2.5 text-right">Wattage</th>
                <th className="px-3 py-2.5">Efficiency / Modular</th>
                <th className="px-3 py-2.5">Connectors</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredPsus.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 8 : 7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No PSUs match the current filter.
                  </td>
                </tr>
              ) : (
                filteredPsus.map((psu) => {
                  const inst = usage.psus.get(psu.id);
                  const instCount = inst?.count ?? 0;
                  const label = `${psu.brand} ${psu.model}`;
                  return (
                    <tr key={psu.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <SpecLink
                          label={label}
                          links={buildPsuResearchLinks(psu.brand, psu.wattage, {
                            spec_url: psu.spec_url,
                            links: psu.spec_links,
                          })}
                          onEditLinks={makeLinkEditor(
                            'psus',
                            psu.id,
                            'psu',
                            label,
                            'PSU Catalog Entry',
                            psu.spec_url,
                            psu.spec_links,
                          )}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-200">
                        {psu.wattage ? `${psu.wattage}W` : '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {[psu.efficiency_rating, psu.modular]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-400">
                        8-pin:{' '}
                        {psu.has_8pin_cpu === null
                          ? '—'
                          : psu.has_8pin_cpu
                            ? 'Yes'
                            : 'No'}{' '}
                        · 6-pin:{' '}
                        {psu.has_6pin_pcie === null
                          ? '—'
                          : psu.has_6pin_pcie
                            ? 'Yes'
                            : 'No'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderInstalledCell(inst)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderSpareCell('psus', psu.id, psu.spare_count)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                        {instCount + psu.spare_count}
                      </td>
                      {renderGenericActions('psu', psu, instCount)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'cases' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">PC Case</th>
                <th className="px-3 py-2.5">Form Factor</th>
                <th className="px-3 py-2.5">Color</th>
                <th className="px-3 py-2.5 text-right">Max GPU Length</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCases.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 8 : 7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No cases in catalog yet. Click &ldquo;Add Case&rdquo; to track
                    your cases &amp; spare chassis.
                  </td>
                </tr>
              ) : (
                filteredCases.map((pcCase) => {
                  const inst = usage.cases.get(pcCase.id);
                  const instCount = inst?.count ?? 0;
                  const label = `${pcCase.brand} ${pcCase.model}`;
                  return (
                    <tr key={pcCase.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <SpecLink
                          label={label}
                          links={buildCaseResearchLinks(
                            pcCase.brand,
                            pcCase.model,
                            {
                              spec_url: pcCase.spec_url,
                              links: pcCase.spec_links,
                            },
                          )}
                          onEditLinks={makeLinkEditor(
                            'cases',
                            pcCase.id,
                            'case',
                            label,
                            'Case Catalog Entry',
                            pcCase.spec_url,
                            pcCase.spec_links,
                          )}
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {pcCase.form_factor ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {pcCase.color ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                        {pcCase.max_gpu_length_mm
                          ? `${pcCase.max_gpu_length_mm}mm`
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderInstalledCell(inst)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderSpareCell('cases', pcCase.id, pcCase.spare_count)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                        {instCount + pcCase.spare_count}
                      </td>
                      {renderGenericActions('case', pcCase, instCount)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'coolers' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">CPU Cooler</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5 text-right">Fan / Rad</th>
                <th className="px-3 py-2.5">Socket Support</th>
                <th className="px-3 py-2.5 text-right">TDP Rating</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCoolers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 9 : 8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No coolers in catalog yet. Click &ldquo;Add Cooler&rdquo; to
                    track air/AIO/stock coolers.
                  </td>
                </tr>
              ) : (
                filteredCoolers.map((cooler) => {
                  const inst = usage.coolers.get(cooler.id);
                  const instCount = inst?.count ?? 0;
                  const label = `${cooler.brand} ${cooler.model}`;
                  return (
                    <tr key={cooler.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <SpecLink
                          label={label}
                          links={buildCoolerResearchLinks(
                            cooler.brand,
                            cooler.model,
                            {
                              spec_url: cooler.spec_url,
                              links: cooler.spec_links,
                            },
                          )}
                          onEditLinks={makeLinkEditor(
                            'coolers',
                            cooler.id,
                            'cooler',
                            label,
                            'Cooler Catalog Entry',
                            cooler.spec_url,
                            cooler.spec_links,
                          )}
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {cooler.cooler_type ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                        {cooler.fan_size_mm ? `${cooler.fan_size_mm}mm` : '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                        {cooler.socket_support ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                        {cooler.tdp_rating_w ? `${cooler.tdp_rating_w}W` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderInstalledCell(inst)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderSpareCell(
                          'coolers',
                          cooler.id,
                          cooler.spare_count,
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                        {instCount + cooler.spare_count}
                      </td>
                      {renderGenericActions('cooler', cooler, instCount)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {subTab === 'wifi_cards' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Wi-Fi Card</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5">Standard / BT</th>
                <th className="px-3 py-2.5">Form Factor</th>
                <th className="px-3 py-2.5 text-right">Installed</th>
                <th className="px-3 py-2.5 text-right">Spare</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {isOwner ? (
                  <th className="px-3 py-2.5 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredWifiCards.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 8 : 7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No Wi-Fi cards match the current filter.
                  </td>
                </tr>
              ) : (
                filteredWifiCards.map((wifi) => {
                  const inst = usage.wifi_cards.get(wifi.id);
                  const instCount = inst?.count ?? 0;
                  const label = [wifi.brand, wifi.product, wifi.model]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <tr key={wifi.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <SpecLink
                          label={label}
                          links={buildWifiResearchLinks(
                            wifi.brand,
                            wifi.product,
                            wifi.model,
                            {
                              spec_url: wifi.spec_url,
                              links: wifi.spec_links,
                            },
                          )}
                          onEditLinks={makeLinkEditor(
                            'wifi_cards',
                            wifi.id,
                            'wifi',
                            label,
                            'Wi-Fi Card Catalog Entry',
                            wifi.spec_url,
                            wifi.spec_links,
                          )}
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">
                        {wifi.is_mobile ? 'Laptop / Mobile' : 'Desktop'}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-300">
                        {[
                          wifi.wifi_standard,
                          wifi.bluetooth_version
                            ? `BT ${wifi.bluetooth_version}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-400">
                        {wifi.form_factor ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderInstalledCell(inst)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {renderSpareCell(
                          'wifi_cards',
                          wifi.id,
                          wifi.spare_count,
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-amber-300">
                        {instCount + wifi.spare_count}
                      </td>
                      {renderGenericActions('wifi_card', wifi, instCount)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
