import {
  classifyUrlToSlot,
  getSafeHttpUrl,
  getSmartLinkSlots,
  isSearchFallbackUrl,
  type PartLinkPresetKind,
  type SmartLinkSlotId,
} from './specLinks';
import { supabase } from './supabase';
import type { SpecLinkItem } from '../types/database';

export type LookupPartType = PartLinkPresetKind;

export interface LinkCandidate {
  url: string;
  title: string;
  source: string;
  confidence: 'high' | 'medium';
  passmark_score?: number | null;
}

export interface SlotLookupResult {
  slotId: string;
  label: string;
  status: 'found' | 'ambiguous' | 'not_found';
  bestUrl: string | null;
  bestTitle?: string | null;
  confidence?: 'high' | 'medium';
  source?: string | null;
  candidates: LinkCandidate[];
}

export interface HardwareLookupResultItem {
  partType: 'cpu' | 'gpu';
  name: string;
  brand: string;
  spec_url: string;
  spec_links?: SpecLinkItem[];
  source: string;
  codename?: string | null;
  socket?: string | null;
  base_clock_ghz?: number | null;
  turbo_clock_ghz?: number | null;
  cache_mb?: number | null;
  cores?: number | null;
  threads?: number | null;
  tdp_w?: number | null;
  process_nm?: number | null;
  max_memory_gb?: number | null;
  memory_type?: string | null;
  memory_speed_mhz?: number | null;
  launch_date?: string | null;
  is_mobile?: boolean;
  architecture?: string | null;
  vram_gb?: number | null;
  vram_type?: string | null;
  bus_interface?: string | null;
  directx_version?: string | null;
  directx_feature_level?: string | null;
  category?: string | null;
  passmark_score?: number | null;
  summary?: string | null;
}

export interface HardwareLookupResponse {
  results: HardwareLookupResultItem[];
  slotResults: Record<string, SlotLookupResult>;
  searchProvider: 'serper' | 'brave' | 'free';
  source: string;
  note: string | null;
}

export async function lookupPartLinksAndSpecs(params: {
  query: string;
  partType: LookupPartType;
  brand?: string;
  vendor?: 'Auto' | 'Intel' | 'AMD' | 'NVIDIA';
  slots?: SmartLinkSlotId[];
}): Promise<HardwareLookupResponse> {
  const { data, error } = await supabase.functions.invoke(
    'lookup-hardware-spec',
    {
      body: {
        query: params.query.trim(),
        partType: params.partType,
        brand: params.brand?.trim() || undefined,
        vendor: params.vendor,
        slots: params.slots,
      },
    },
  );

  if (error) {
    throw error;
  }

  return {
    results: (data?.results ?? []) as HardwareLookupResultItem[],
    slotResults: (data?.slotResults ?? {}) as Record<string, SlotLookupResult>,
    searchProvider: (data?.searchProvider ?? 'free') as
      | 'serper'
      | 'brave'
      | 'free',
    source: String(data?.source ?? 'catalog'),
    note: (data?.note ?? null) as string | null,
  };
}

export function applySlotResultsFillBlanks(args: {
  partKind: PartLinkPresetKind;
  brand: string;
  currentSpecUrl: string;
  currentSpecLinks: Array<{ label: string; url: string }>;
  slotResults: Record<string, SlotLookupResult>;
}): {
  specUrl: string;
  specLinks: Array<{ label: string; url: string }>;
  filledCount: number;
  passmarkScore: number | null;
} {
  const slots = getSmartLinkSlots(args.partKind, args.brand);
  const existingSlots = new Set<SmartLinkSlotId>();
  const seenUrls = new Set<string>();

  const safePrimary = getSafeHttpUrl(args.currentSpecUrl);
  if (safePrimary) {
    seenUrls.add(safePrimary);
    const sid = classifyUrlToSlot(safePrimary, undefined, slots);
    if (sid) existingSlots.add(sid);
  }

  const nextLinks = args.currentSpecLinks.map((l) => ({ ...l }));
  for (const row of nextLinks) {
    const safe = getSafeHttpUrl(row.url);
    if (safe) {
      seenUrls.add(safe);
      const sid = classifyUrlToSlot(safe, row.label, slots);
      if (sid) existingSlots.add(sid);
    }
  }

  const newlyFound: Array<{
    slotId: SmartLinkSlotId;
    label: string;
    url: string;
    priority: number;
  }> = [];

  for (const slot of slots) {
    if (existingSlots.has(slot.id)) continue;
    const res = args.slotResults[slot.id];
    if (!res || res.status !== 'found' || !res.bestUrl) continue;
    const safe = getSafeHttpUrl(res.bestUrl);
    if (!safe || isSearchFallbackUrl(safe) || seenUrls.has(safe)) continue;

    seenUrls.add(safe);
    existingSlots.add(slot.id);
    newlyFound.push({
      slotId: slot.id,
      label: slot.label,
      url: safe,
      priority: slot.primaryPriority,
    });
  }

  let nextSpecUrl = args.currentSpecUrl.trim();
  if (newlyFound.length > 0) {
    if (!nextSpecUrl) {
      const sorted = [...newlyFound].sort((a, b) => b.priority - a.priority);
      const primaryPick = sorted[0];
      nextSpecUrl = primaryPick.url;
      for (const item of newlyFound) {
        if (item.slotId === primaryPick.slotId) continue;
        nextLinks.push({ label: item.label, url: item.url });
      }
    } else {
      for (const item of newlyFound) {
        nextLinks.push({ label: item.label, url: item.url });
      }
    }
  }

  const pmSlot = args.slotResults.passmark_cpu ?? args.slotResults.passmark_gpu;
  const passmarkScore =
    pmSlot?.status === 'found' &&
    typeof pmSlot.candidates?.[0]?.passmark_score === 'number' &&
    pmSlot.candidates[0].passmark_score > 0
      ? pmSlot.candidates[0].passmark_score
      : null;

  return {
    specUrl: nextSpecUrl,
    specLinks: nextLinks,
    filledCount: newlyFound.length,
    passmarkScore,
  };
}
