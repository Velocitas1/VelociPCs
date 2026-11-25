import type {
  BuildGameCompatibility,
  CompatibilityStatus,
  ComputerWithRelations,
  Gpu,
  SteamGame,
} from '../types/database';
import { getDirectXTierRank } from './directx';

export interface ParsedSteamRequirements {
  min_directx: string | null;
  rec_directx: string | null;
  min_vram_gb: number | null;
  rec_vram_gb: number | null;
  min_ram_gb: number | null;
  rec_ram_gb: number | null;
  storage_gb: number | null;
  hasAnyRequirement: boolean;
}

export interface EffectiveRigProfile {
  effectiveGpu: Gpu | null;
  isIntegratedOnly: boolean;
  directxVersion: string | null;
  directxFeatureLevel: string | null;
  directxRank: number;
  vramGb: number | null;
  ramGb: number | null;
  largestDriveGb: number | null;
  totalStorageGb: number | null;
  driveCount: number;
}

export interface CompatibilityEvaluation {
  status: CompatibilityStatus;
  blocking_reason: string | null;
}

export interface RigCompatibilitySummary {
  total: number;
  playable: number;
  minimum: number;
  blocked: number;
  blockedDirectx: number;
  blockedVram: number;
  blockedRam: number;
  blockedStorage: number;
  unknown: number;
}

export const COMPAT_STATUS_META: Record<
  CompatibilityStatus,
  {
    label: string;
    shortLabel: string;
    sortOrder: number;
    badgeClass: string;
    dotClass: string;
  }
> = {
  playable: {
    label: 'Playable (Rec+)',
    shortLabel: 'Playable',
    sortOrder: 0,
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  minimum: {
    label: 'Meets Minimum',
    shortLabel: 'Minimum',
    sortOrder: 1,
    badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    dotClass: 'bg-amber-400',
  },
  blocked_storage: {
    label: 'Blocked: Storage',
    shortLabel: 'Low Storage',
    sortOrder: 2,
    badgeClass: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
    dotClass: 'bg-orange-400',
  },
  blocked_ram: {
    label: 'Blocked: RAM',
    shortLabel: 'Low RAM',
    sortOrder: 3,
    badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
    dotClass: 'bg-rose-400',
  },
  blocked_vram: {
    label: 'Blocked: VRAM',
    shortLabel: 'Low VRAM',
    sortOrder: 4,
    badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
    dotClass: 'bg-rose-400',
  },
  blocked_directx: {
    label: 'Blocked: DirectX',
    shortLabel: 'DirectX',
    sortOrder: 5,
    badgeClass: 'border-rose-500/50 bg-rose-500/20 text-rose-200',
    dotClass: 'bg-rose-500',
  },
  unknown: {
    label: 'Unknown Specs',
    shortLabel: 'Unknown',
    sortOrder: 6,
    badgeClass: 'border-slate-700 bg-slate-800/80 text-slate-300',
    dotClass: 'bg-slate-400',
  },
};

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&reg;': '®',
  '&trade;': '™',
  '&lt;': '<',
  '&gt;': '>',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&quot;': '"',
};

/**
 * Converts Steam's HTML pc_requirements string into clean, plain-text lines.
 * Always use this instead of dangerouslySetInnerHTML.
 */
export function extractHtmlLines(html: string | null | undefined): string[] {
  if (!html || typeof html !== 'string') return [];
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:li|p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');

  const decoded = withBreaks.replace(
    /&(?:amp|nbsp|reg|trade|lt|gt|apos|quot|#39|#x27);/gi,
    (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity,
  );

  return decoded
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseMemoryToGb(
  rawNum: string,
  unit: string,
  minGb: number,
  maxGb: number,
): number | null {
  const numeric = Number.parseFloat(rawNum.replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const upperUnit = unit.toUpperCase();
  const gb =
    upperUnit === 'TB'
      ? numeric * 1024
      : upperUnit === 'MB'
        ? numeric / 1024
        : numeric;
  if (gb < minGb || gb > maxGb) return null;
  return roundTwoDecimals(gb);
}

function extractDirectXFromLines(lines: string[]): string | null {
  const dxLines = lines.filter((line) => /\b(?:directx|dx)\b/i.test(line));
  const targets = dxLines.length > 0 ? dxLines : lines;

  for (const line of targets) {
    const flMatch = line.match(
      /\bdirectx\b[^0-9]*(12)[^\n]*?(?:feature\s*level|fl)\s*(12_[012])/i,
    );
    if (flMatch) {
      return flMatch[2];
    }

    if (/\bdirectx\b[^0-9]*12\s*ultimate\b/i.test(line)) {
      return '12_2';
    }

    const match =
      line.match(
        /\bdirectx(?:\s*version)?\s*:?\s*(?:version\s*)?(1[0-2](?:\.[0-9])?|9(?:\.0[a-c]?)?|8(?:\.[01])?|7)\b/i,
      ) ?? line.match(/\bdx\s*(1[0-2](?:\.[0-9])?|9(?:\.0[a-c]?)?)\b/i);

    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

function extractRamGbFromLines(lines: string[]): number | null {
  const ramLines = lines.filter((line) =>
    /\b(?:memory|ram|system\s*memory)\s*:/i.test(line),
  );
  for (const line of ramLines) {
    const values: number[] = [];
    for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(GB|MB)\b/gi)) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.03, 512);
      if (parsed !== null) values.push(parsed);
    }
    if (values.length > 0) {
      return Math.min(...values);
    }
  }

  for (const line of lines) {
    const m = line.match(/(\d+(?:[.,]\d+)?)\s*(GB|MB)\s*(?:of\s*)?RAM\b/i);
    if (m) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.03, 512);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function extractVramGbFromLines(lines: string[]): number | null {
  const gpuLines = lines.filter((line) =>
    /\b(?:graphics|video(?:\s*card)?|gpu|display)\s*:/i.test(line),
  );
  if (gpuLines.length === 0) return null;

  for (const line of gpuLines) {
    const values: number[] = [];
    for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(GB|MB)\b/gi)) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.03, 64);
      if (parsed !== null) values.push(parsed);
    }
    if (values.length > 0) {
      return Math.min(...values);
    }
  }
  return null;
}

function extractStorageGbFromLines(lines: string[]): number | null {
  const storageLines = lines.filter((line) =>
    /\b(?:storage|hard\s*(?:disk|drive)|disk\s*space|hd\s*space)\s*:/i.test(
      line,
    ),
  );
  for (const line of storageLines) {
    const values: number[] = [];
    for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)\b/gi)) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.01, 2000);
      if (parsed !== null) values.push(parsed);
    }
    if (values.length > 0) {
      return Math.min(...values);
    }
  }

  for (const line of lines) {
    const m = line.match(
      /(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)\s*(?:of\s*)?(?:available|free)\s*(?:hard\s*(?:disk|drive)\s*)?space\b/i,
    );
    if (m) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.01, 2000);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

export function parseSteamPcRequirements(
  raw: Record<string, unknown> | null | undefined,
): ParsedSteamRequirements {
  const minHtml =
    raw && typeof raw === 'object' && typeof raw.minimum === 'string'
      ? raw.minimum
      : null;
  const recHtml =
    raw && typeof raw === 'object' && typeof raw.recommended === 'string'
      ? raw.recommended
      : null;

  const minLines = extractHtmlLines(minHtml);
  const recLines = extractHtmlLines(recHtml);

  const min_directx = extractDirectXFromLines(minLines);
  const rec_directx = extractDirectXFromLines(recLines);
  const min_vram_gb = extractVramGbFromLines(minLines);
  const rec_vram_gb = extractVramGbFromLines(recLines);
  const min_ram_gb = extractRamGbFromLines(minLines);
  const rec_ram_gb = extractRamGbFromLines(recLines);
  const minStorage = extractStorageGbFromLines(minLines);
  const recStorage = extractStorageGbFromLines(recLines);
  const storage_gb = minStorage ?? recStorage;

  const hasAnyRequirement =
    min_directx !== null ||
    rec_directx !== null ||
    min_vram_gb !== null ||
    rec_vram_gb !== null ||
    min_ram_gb !== null ||
    rec_ram_gb !== null ||
    storage_gb !== null;

  return {
    min_directx,
    rec_directx,
    min_vram_gb,
    rec_vram_gb,
    min_ram_gb,
    rec_ram_gb,
    storage_gb,
    hasAnyRequirement,
  };
}

/**
 * Normalizes a parsed or manually entered DirectX requirement string to the same
 * numeric tier scale as getDirectXTierRank() in src/lib/directx.ts.
 */
export function getRequiredDirectXRank(
  version: string | null | undefined,
): number {
  if (!version || !version.trim()) return 0;
  const normalized = version.trim().toLowerCase().replace(/^dx\s*/i, '');

  if (normalized.includes('12_2') || normalized.includes('ultimate')) {
    return 1220;
  }
  if (normalized.includes('12_1')) return 1210;
  if (normalized.includes('12_0') || normalized.startsWith('12')) return 1200;
  if (normalized.startsWith('11.2') || normalized.includes('11_2')) return 1120;
  if (normalized.startsWith('11.1') || normalized.includes('11_1')) return 1110;
  if (normalized.startsWith('11')) return 1100;
  if (normalized.startsWith('10.1')) return 1010;
  if (normalized.startsWith('10')) return 1000;
  if (normalized.startsWith('9')) return 900;
  if (normalized.startsWith('8')) return 800;
  if (normalized.startsWith('7')) return 700;
  return 0;
}

export function getEffectiveRigProfile(
  rig: ComputerWithRelations,
): EffectiveRigProfile {
  const effectiveGpu = rig.gpu ?? rig.igpu ?? null;
  const isIntegratedOnly = !rig.gpu && Boolean(rig.igpu);
  const directxVersion = effectiveGpu?.directx_version ?? null;
  const directxFeatureLevel = effectiveGpu?.directx_feature_level ?? null;
  const directxRank = getDirectXTierRank(directxVersion, directxFeatureLevel);
  const vramGb = effectiveGpu?.vram_gb ?? null;
  const ramGb = rig.ram_gb ?? rig.ram_kit?.capacity_gb ?? null;

  const driveCapacities = rig.storage_drives
    .map((d) => d.capacity_gb ?? d.storage_drive_model?.capacity_gb ?? null)
    .filter((cap): cap is number => cap !== null && cap > 0);

  const largestDriveGb =
    driveCapacities.length > 0 ? Math.max(...driveCapacities) : null;
  const totalStorageGb =
    driveCapacities.length > 0
      ? driveCapacities.reduce((sum, cap) => sum + cap, 0)
      : null;

  return {
    effectiveGpu,
    isIntegratedOnly,
    directxVersion,
    directxFeatureLevel,
    directxRank,
    vramGb,
    ramGb,
    largestDriveGb,
    totalStorageGb,
    driveCount: rig.storage_drives.length,
  };
}

export function formatGbSpec(gb: number | null | undefined): string {
  if (gb === null || gb === undefined) return '—';
  if (gb < 1) {
    const mb = Math.round(gb * 1024);
    return `${mb} MB`;
  }
  return `${Number.isInteger(gb) ? gb : Number(gb.toFixed(2))} GB`;
}

export function formatPlaytime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return 'Unplayed';
  if (minutes < 60) return `${minutes}m played`;
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours).toLocaleString()}h played`;
  return `${hours.toFixed(1)}h played`;
}

export function evaluateRigGameCompatibility(
  rig: ComputerWithRelations,
  game: Pick<
    SteamGame,
    | 'min_directx'
    | 'rec_directx'
    | 'min_vram_gb'
    | 'rec_vram_gb'
    | 'min_ram_gb'
    | 'rec_ram_gb'
    | 'storage_gb'
  >,
): CompatibilityEvaluation {
  const hasAnyReq =
    game.min_directx !== null ||
    game.rec_directx !== null ||
    game.min_vram_gb !== null ||
    game.rec_vram_gb !== null ||
    game.min_ram_gb !== null ||
    game.rec_ram_gb !== null ||
    game.storage_gb !== null;

  if (!hasAnyReq) {
    return {
      status: 'unknown',
      blocking_reason: 'No parsed PC requirements available yet.',
    };
  }

  const profile = getEffectiveRigProfile(rig);
  const blockReasons: string[] = [];
  let primaryBlock: CompatibilityStatus | null = null;

  const assignBlock = (status: CompatibilityStatus, reason: string) => {
    if (!primaryBlock) primaryBlock = status;
    blockReasons.push(reason);
  };

  // 1. DirectX minimum check
  const minDxRank = getRequiredDirectXRank(game.min_directx);
  if (minDxRank > 0) {
    if (!profile.effectiveGpu) {
      assignBlock(
        'blocked_directx',
        `Requires DirectX ${game.min_directx} (no GPU or iGPU recorded)`,
      );
    } else if (profile.directxRank > 0 && profile.directxRank < minDxRank) {
      assignBlock(
        'blocked_directx',
        `Requires DX ${game.min_directx}; rig supports ${
          profile.directxVersion ?? 'unknown'
        }${
          profile.directxFeatureLevel
            ? ` (${profile.directxFeatureLevel})`
            : ''
        }`,
      );
    }
  }

  // 2. VRAM minimum check (iGPUs with null vram_gb use shared memory — don't hard-block)
  if (game.min_vram_gb !== null && game.min_vram_gb > 0) {
    if (!profile.effectiveGpu) {
      assignBlock(
        'blocked_vram',
        `Requires ${formatGbSpec(game.min_vram_gb)} VRAM (no GPU recorded)`,
      );
    } else if (
      profile.vramGb !== null &&
      profile.vramGb < game.min_vram_gb
    ) {
      assignBlock(
        'blocked_vram',
        `Requires ${formatGbSpec(game.min_vram_gb)} VRAM; rig has ${formatGbSpec(
          profile.vramGb,
        )}`,
      );
    }
  }

  // 3. System RAM minimum check
  if (
    game.min_ram_gb !== null &&
    game.min_ram_gb > 0 &&
    profile.ramGb !== null &&
    profile.ramGb < game.min_ram_gb
  ) {
    assignBlock(
      'blocked_ram',
      `Requires ${formatGbSpec(game.min_ram_gb)} RAM; rig has ${formatGbSpec(
        profile.ramGb,
      )}`,
    );
  }

  // 4. Storage check against largest single drive (skip if no drives recorded)
  if (
    game.storage_gb !== null &&
    game.storage_gb > 0 &&
    profile.largestDriveGb !== null &&
    profile.largestDriveGb < game.storage_gb
  ) {
    assignBlock(
      'blocked_storage',
      `Needs ${formatGbSpec(game.storage_gb)} storage; largest drive is ${formatGbSpec(
        profile.largestDriveGb,
      )}`,
    );
  }

  if (primaryBlock !== null) {
    return {
      status: primaryBlock,
      blocking_reason: blockReasons.join(' · '),
    };
  }

  // Passes minimum! Now check recommended targets + integrated shared-VRAM caution.
  const shortfalls: string[] = [];

  const recDxRank = getRequiredDirectXRank(game.rec_directx);
  if (
    recDxRank > 0 &&
    profile.directxRank > 0 &&
    profile.directxRank < recDxRank
  ) {
    shortfalls.push(
      `Recommended DX ${game.rec_directx} (rig has DX ${profile.directxVersion})`,
    );
  }

  if (game.rec_vram_gb !== null && game.rec_vram_gb > 0) {
    if (profile.vramGb !== null && profile.vramGb < game.rec_vram_gb) {
      shortfalls.push(
        `Recommended ${formatGbSpec(game.rec_vram_gb)} VRAM (rig has ${formatGbSpec(
          profile.vramGb,
        )})`,
      );
    }
  }

  if (
    profile.isIntegratedOnly &&
    profile.vramGb === null &&
    (game.rec_vram_gb ?? game.min_vram_gb ?? 0) >= 2
  ) {
    const targetVram = game.rec_vram_gb ?? game.min_vram_gb;
    shortfalls.push(
      `Integrated GPU shares system RAM (game asks ${formatGbSpec(targetVram)} VRAM)`,
    );
  }

  if (
    game.rec_ram_gb !== null &&
    game.rec_ram_gb > 0 &&
    profile.ramGb !== null &&
    profile.ramGb < game.rec_ram_gb
  ) {
    shortfalls.push(
      `Recommended ${formatGbSpec(game.rec_ram_gb)} RAM (rig has ${formatGbSpec(
        profile.ramGb,
      )})`,
    );
  }

  if (shortfalls.length > 0) {
    return {
      status: 'minimum',
      blocking_reason: shortfalls.join(' · '),
    };
  }

  return {
    status: 'playable',
    blocking_reason: null,
  };
}

export function summarizeRigCompatibility(
  rows: BuildGameCompatibility[],
): RigCompatibilitySummary {
  const summary: RigCompatibilitySummary = {
    total: rows.length,
    playable: 0,
    minimum: 0,
    blocked: 0,
    blockedDirectx: 0,
    blockedVram: 0,
    blockedRam: 0,
    blockedStorage: 0,
    unknown: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case 'playable':
        summary.playable += 1;
        break;
      case 'minimum':
        summary.minimum += 1;
        break;
      case 'blocked_directx':
        summary.blockedDirectx += 1;
        summary.blocked += 1;
        break;
      case 'blocked_vram':
        summary.blockedVram += 1;
        summary.blocked += 1;
        break;
      case 'blocked_ram':
        summary.blockedRam += 1;
        summary.blocked += 1;
        break;
      case 'blocked_storage':
        summary.blockedStorage += 1;
        summary.blocked += 1;
        break;
      case 'unknown':
        summary.unknown += 1;
        break;
    }
  }

  return summary;
}
