import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ExternalLink, Globe, X } from 'lucide-react';
import {
  applySlotResultsFillBlanks,
  lookupPartLinksAndSpecs,
  type HardwareLookupResultItem,
  type SlotLookupResult,
} from '../lib/linkLookup';
import {
  buildPassMarkSearchUrl,
  formatScoreUpdatedDate,
} from '../lib/scoring';
import { getSmartLinkSlots, parseHttpUrl } from '../lib/specLinks';
import type { RefCpu, RefGpu } from '../lib/referenceCatalog';
import type { Cpu, Gpu, SpecLinkItem } from '../types/database';
import { ReferenceCatalogSearch } from './ReferenceCatalogSearch';
import { SmartLinksEditor } from './SmartLinksEditor';

type LookupResultItem = HardwareLookupResultItem;

interface HardwareLookupModalProps {
  open: boolean;
  partType: 'cpu' | 'gpu';
  initialMode?: 'search' | 'manual';
  initialQuery?: string;
  initialReferenceItem?: RefCpu | RefGpu | null;
  editingCpu?: Cpu | null;
  editingGpu?: Gpu | null;
  onClose: () => void;
  onSaveCpu: (
    payload: Omit<Cpu, 'id' | 'created_at' | 'updated_at'>,
    existingId?: number,
  ) => Promise<Cpu>;
  onSaveGpu: (
    payload: Omit<Gpu, 'id' | 'created_at' | 'updated_at'>,
    existingId?: number,
  ) => Promise<Gpu>;
  onSaved?: (part: Cpu | Gpu) => void;
}

function toNumOrNull(val: string): number | null {
  if (!val.trim()) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function HardwareLookupModal({
  open,
  partType,
  initialMode = 'search',
  initialQuery = '',
  initialReferenceItem = null,
  editingCpu = null,
  editingGpu = null,
  onClose,
  onSaveCpu,
  onSaveGpu,
  onSaved,
}: HardwareLookupModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [vendor, setVendor] = useState<'Auto' | 'Intel' | 'AMD' | 'NVIDIA'>('Auto');
  const [searching, setSearching] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searchProvider, setSearchProvider] = useState<'serper' | 'brave' | 'free' | null>(null);
  const [slotResults, setSlotResults] = useState<Record<string, SlotLookupResult>>({});
  const [results, setResults] = useState<LookupResultItem[]>([]);
  const lookupRequestIdRef = useRef(0);

  // Shared editable form state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState(partType === 'cpu' ? 'Intel' : 'NVIDIA');
  const [specUrl, setSpecUrl] = useState('');
  const [specLinks, setSpecLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [tdpW, setTdpW] = useState('');
  const [processNm, setProcessNm] = useState('');
  const [passmarkScore, setPassmarkScore] = useState('');
  const [spareCount, setSpareCount] = useState('0');

  // CPU fields
  const [codename, setCodename] = useState('');
  const [socket, setSocket] = useState('');
  const [baseGhz, setBaseGhz] = useState('');
  const [turboGhz, setTurboGhz] = useState('');
  const [cacheMb, setCacheMb] = useState('');
  const [cores, setCores] = useState('');
  const [threads, setThreads] = useState('');
  const [maxMemGb, setMaxMemGb] = useState('');
  const [memType, setMemType] = useState('');
  const [memSpeedMhz, setMemSpeedMhz] = useState('');
  const [launchDate, setLaunchDate] = useState('');

  // GPU fields
  const [architecture, setArchitecture] = useState('');
  const [vramGb, setVramGb] = useState('');
  const [vramType, setVramType] = useState('');
  const [busInterface, setBusInterface] = useState('');
  const [dxVersion, setDxVersion] = useState('');
  const [dxFeatureLevel, setDxFeatureLevel] = useState('');
  const [category, setCategory] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyReferenceItem = (
    item: RefCpu | RefGpu,
    mode: 'replace' | 'fill_blanks',
  ) => {
    const fill = (prev: string, nextVal: string | number | null | undefined) => {
      const nextStr =
        nextVal !== null && nextVal !== undefined ? String(nextVal) : '';
      if (mode === 'fill_blanks') {
        return prev.trim() ? prev : nextStr;
      }
      return nextStr;
    };

    if (mode === 'replace') {
      setBrand(item.brand);
      setName(item.name);
      setIsMobile(Boolean(item.is_mobile));
    } else {
      setBrand((prev) => (prev.trim() ? prev : item.brand));
      setName((prev) => (prev.trim() ? prev : item.name));
    }

    setSpecUrl((prev) => fill(prev, item.spec_url));
    setTdpW((prev) => fill(prev, item.tdp_w));
    setProcessNm((prev) => fill(prev, item.process_nm));

    if (partType === 'cpu') {
      const c = item as RefCpu;
      setCodename((prev) => fill(prev, c.codename));
      setSocket((prev) => fill(prev, c.socket));
      setBaseGhz((prev) => fill(prev, c.base_clock_ghz));
      setTurboGhz((prev) => fill(prev, c.turbo_clock_ghz));
      setCacheMb((prev) => fill(prev, c.cache_mb));
      setCores((prev) => fill(prev, c.cores));
      setThreads((prev) => fill(prev, c.threads));
      setMaxMemGb((prev) => fill(prev, c.max_memory_gb));
      setMemType((prev) => fill(prev, c.memory_type));
      setMemSpeedMhz((prev) => fill(prev, c.memory_speed_mhz));
      setLaunchDate((prev) => fill(prev, c.launch_date));
    } else {
      const g = item as RefGpu;
      setArchitecture((prev) => fill(prev, g.architecture));
      setVramGb((prev) => fill(prev, g.vram_gb));
      setVramType((prev) => fill(prev, g.vram_type));
      setBusInterface((prev) => fill(prev, g.bus_interface));
      setDxVersion((prev) => fill(prev, g.directx_version));
      setDxFeatureLevel((prev) => fill(prev, g.directx_feature_level));
      setCategory((prev) => fill(prev, g.category));
    }
  };

  const applyLookupItem = (item: LookupResultItem) => {
    setName(item.name);
    setBrand(item.brand);
    setSpecUrl(item.spec_url ?? '');
    setSpecLinks((item.spec_links ?? []).map((l) => ({ ...l })));
    setIsMobile(Boolean(item.is_mobile));
    setTdpW(item.tdp_w?.toString() ?? '');
    setProcessNm(item.process_nm?.toString() ?? '');
    setPassmarkScore(item.passmark_score?.toString() ?? '');

    if (partType === 'cpu') {
      setCodename(item.codename ?? '');
      setSocket(item.socket ?? '');
      setBaseGhz(item.base_clock_ghz?.toString() ?? '');
      setTurboGhz(item.turbo_clock_ghz?.toString() ?? '');
      setCacheMb(item.cache_mb?.toString() ?? '');
      setCores(item.cores?.toString() ?? '');
      setThreads(item.threads?.toString() ?? '');
      setMaxMemGb(item.max_memory_gb?.toString() ?? '');
      setMemType(item.memory_type ?? '');
      setMemSpeedMhz(item.memory_speed_mhz?.toString() ?? '');
      setLaunchDate(item.launch_date ?? '');
    } else {
      setArchitecture(item.architecture ?? '');
      setVramGb(item.vram_gb?.toString() ?? '');
      setVramType(item.vram_type ?? '');
      setBusInterface(item.bus_interface ?? '');
      setDxVersion(item.directx_version ?? '');
      setDxFeatureLevel(item.directx_feature_level ?? '');
      setCategory(item.category ?? '');
    }
  };

  const mergeLookupSpecsOnly = (item: LookupResultItem) => {
    const fill = (prev: string, nextVal: string | number | null | undefined) => {
      if (prev.trim()) return prev;
      return nextVal !== null && nextVal !== undefined ? String(nextVal) : '';
    };

    setBrand((prev) => (prev.trim() ? prev : item.brand));
    setName((prev) => (prev.trim() ? prev : item.name));
    setPassmarkScore((prev) => fill(prev, item.passmark_score));
    setTdpW((prev) => fill(prev, item.tdp_w));
    setProcessNm((prev) => fill(prev, item.process_nm));

    if (partType === 'cpu') {
      setCodename((prev) => fill(prev, item.codename));
      setSocket((prev) => fill(prev, item.socket));
      setBaseGhz((prev) => fill(prev, item.base_clock_ghz));
      setTurboGhz((prev) => fill(prev, item.turbo_clock_ghz));
      setCacheMb((prev) => fill(prev, item.cache_mb));
      setCores((prev) => fill(prev, item.cores));
      setThreads((prev) => fill(prev, item.threads));
      setMaxMemGb((prev) => fill(prev, item.max_memory_gb));
      setMemType((prev) => fill(prev, item.memory_type));
      setMemSpeedMhz((prev) => fill(prev, item.memory_speed_mhz));
      setLaunchDate((prev) => fill(prev, item.launch_date));
    } else {
      setArchitecture((prev) => fill(prev, item.architecture));
      setVramGb((prev) => fill(prev, item.vram_gb));
      setVramType((prev) => fill(prev, item.vram_type));
      setBusInterface((prev) => fill(prev, item.bus_interface));
      setDxVersion((prev) => fill(prev, item.directx_version));
      setDxFeatureLevel((prev) => fill(prev, item.directx_feature_level));
      setCategory((prev) => fill(prev, item.category));
    }
  };

  const handleLookup = async (override?: {
    query?: string;
    brand?: string;
    currentSpecUrl?: string;
    currentSpecLinks?: Array<{ label: string; url: string }>;
    fillBlanksOnly?: boolean;
  }) => {
    const effectiveBrand = (override?.brand ?? brand).trim();
    const searchTerm = (
      override?.query ??
      (query.trim() || `${brand} ${name}`.trim())
    ).trim();
    if (!searchTerm) return;

    const requestId = ++lookupRequestIdRef.current;
    setSearching(true);
    setLookupError(null);
    setLookupNote(null);

    try {
      const slots = getSmartLinkSlots(partType, effectiveBrand).map((s) => s.id);
      const data = await lookupPartLinksAndSpecs({
        query: searchTerm,
        partType,
        brand: effectiveBrand || undefined,
        vendor,
        slots,
      });

      if (requestId !== lookupRequestIdRef.current) return;

      setResults(data.results);
      setSlotResults(data.slotResults);
      setSearchProvider(data.searchProvider);
      setLookupNote(data.note);

      const appliedLinks = applySlotResultsFillBlanks({
        partKind: partType,
        brand: effectiveBrand,
        currentSpecUrl: override?.currentSpecUrl ?? specUrl,
        currentSpecLinks: override?.currentSpecLinks ?? specLinks,
        slotResults: data.slotResults,
      });

      if (appliedLinks.filledCount > 0) {
        setSpecUrl(appliedLinks.specUrl);
        setSpecLinks(appliedLinks.specLinks);
      }

      if (appliedLinks.passmarkScore !== null) {
        setPassmarkScore((prev) =>
          prev.trim() ? prev : String(appliedLinks.passmarkScore),
        );
      }

      if (data.results.length > 0) {
        if (override?.fillBlanksOnly || name.trim()) {
          mergeLookupSpecsOnly(data.results[0]);
        } else {
          applyLookupItem(data.results[0]);
          if (appliedLinks.filledCount > 0) {
            setSpecUrl(appliedLinks.specUrl);
            setSpecLinks(appliedLinks.specLinks);
          }
        }
      }
    } catch (err) {
      if (requestId !== lookupRequestIdRef.current) return;
      setLookupError(
        err instanceof Error
          ? err.message
          : 'Auto-lookup failed. Ensure you are signed in or paste links manually below.',
      );
    } finally {
      if (requestId === lookupRequestIdRef.current) {
        setSearching(false);
      }
    }
  };

  useEffect(() => {
    lookupRequestIdRef.current += 1;
    setSearching(false);
    if (!open) return;
    setError(null);
    setLookupNote(null);
    setLookupError(null);
    setSearchProvider(null);
    setSlotResults({});
    setResults([]);
    setQuery(initialQuery);

    if (partType === 'cpu' && editingCpu) {
      setQuery(`${editingCpu.brand} ${editingCpu.name}`.trim());
      setName(editingCpu.name);
      setBrand(editingCpu.brand);
      setSpecUrl(editingCpu.spec_url ?? '');
      setSpecLinks((editingCpu.spec_links ?? []).map((l) => ({ ...l })));
      setIsMobile(editingCpu.is_mobile);
      setTdpW(editingCpu.tdp_w?.toString() ?? '');
      setProcessNm(editingCpu.process_nm?.toString() ?? '');
      setPassmarkScore(editingCpu.passmark_score?.toString() ?? '');
      setSpareCount(editingCpu.spare_count.toString());
      setCodename(editingCpu.codename ?? '');
      setSocket(editingCpu.socket ?? '');
      setBaseGhz(editingCpu.base_clock_ghz?.toString() ?? '');
      setTurboGhz(editingCpu.turbo_clock_ghz?.toString() ?? '');
      setCacheMb(editingCpu.cache_mb?.toString() ?? '');
      setCores(editingCpu.cores?.toString() ?? '');
      setThreads(editingCpu.threads?.toString() ?? '');
      setMaxMemGb(editingCpu.max_memory_gb?.toString() ?? '');
      setMemType(editingCpu.memory_type ?? '');
      setMemSpeedMhz(editingCpu.memory_speed_mhz?.toString() ?? '');
      setLaunchDate(editingCpu.launch_date ?? '');
    } else if (partType === 'gpu' && editingGpu) {
      setQuery(`${editingGpu.brand} ${editingGpu.name}`.trim());
      setName(editingGpu.name);
      setBrand(editingGpu.brand);
      setSpecUrl(editingGpu.spec_url ?? '');
      setSpecLinks((editingGpu.spec_links ?? []).map((l) => ({ ...l })));
      setIsMobile(editingGpu.is_mobile);
      setTdpW(editingGpu.tdp_w?.toString() ?? '');
      setProcessNm(editingGpu.process_nm?.toString() ?? '');
      setPassmarkScore(editingGpu.passmark_score?.toString() ?? '');
      setArchitecture(editingGpu.architecture ?? '');
      setVramGb(editingGpu.vram_gb?.toString() ?? '');
      setVramType(editingGpu.vram_type ?? '');
      setBusInterface(editingGpu.bus_interface ?? '');
      setDxVersion(editingGpu.directx_version ?? '');
      setDxFeatureLevel(editingGpu.directx_feature_level ?? '');
      setCategory(editingGpu.category ?? '');
    } else {
      setName(initialMode === 'manual' ? initialQuery : '');
      setBrand(partType === 'cpu' ? 'Intel' : 'NVIDIA');
      setSpecUrl('');
      setSpecLinks([]);
      setIsMobile(false);
      setTdpW('');
      setProcessNm('');
      setPassmarkScore('');
      setSpareCount('0');
      setCodename('');
      setSocket('');
      setBaseGhz('');
      setTurboGhz('');
      setCacheMb('');
      setCores('');
      setThreads('');
      setMaxMemGb('');
      setMemType('');
      setMemSpeedMhz('');
      setLaunchDate('');
      setArchitecture('');
      setVramGb('');
      setVramType('');
      setBusInterface('');
      setDxVersion('');
      setDxFeatureLevel('');
      setCategory('');

      if (initialReferenceItem) {
        const refQuery =
          `${initialReferenceItem.brand} ${initialReferenceItem.name}`.trim();
        setQuery(refQuery);
        setName(initialReferenceItem.name);
        setBrand(initialReferenceItem.brand);
        setSpecUrl(initialReferenceItem.spec_url ?? '');
        setIsMobile(Boolean(initialReferenceItem.is_mobile));
        setTdpW(initialReferenceItem.tdp_w?.toString() ?? '');
        setProcessNm(initialReferenceItem.process_nm?.toString() ?? '');
        if (partType === 'cpu') {
          const c = initialReferenceItem as RefCpu;
          setCodename(c.codename ?? '');
          setSocket(c.socket ?? '');
          setBaseGhz(c.base_clock_ghz?.toString() ?? '');
          setTurboGhz(c.turbo_clock_ghz?.toString() ?? '');
          setCacheMb(c.cache_mb?.toString() ?? '');
          setCores(c.cores?.toString() ?? '');
          setThreads(c.threads?.toString() ?? '');
          setMaxMemGb(c.max_memory_gb?.toString() ?? '');
          setMemType(c.memory_type ?? '');
          setMemSpeedMhz(c.memory_speed_mhz?.toString() ?? '');
          setLaunchDate(c.launch_date ?? '');
        } else {
          const g = initialReferenceItem as RefGpu;
          setArchitecture(g.architecture ?? '');
          setVramGb(g.vram_gb?.toString() ?? '');
          setVramType(g.vram_type ?? '');
          setBusInterface(g.bus_interface ?? '');
          setDxVersion(g.directx_version ?? '');
          setDxFeatureLevel(g.directx_feature_level ?? '');
          setCategory(g.category ?? '');
        }

        void handleLookup({
          query: refQuery,
          brand: initialReferenceItem.brand,
          currentSpecUrl: initialReferenceItem.spec_url ?? '',
          currentSpecLinks: [],
          fillBlanksOnly: true,
        });
      }
    }
  }, [
    open,
    partType,
    initialMode,
    initialQuery,
    initialReferenceItem,
    editingCpu,
    editingGpu,
  ]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !brand.trim()) {
      setError('Brand and Model Name are required.');
      return;
    }

    const trimmedScore = passmarkScore.trim();
    let parsedPassmarkScore: number | null = null;
    if (trimmedScore) {
      if (!/^\d+$/.test(trimmedScore)) {
        setError('PassMark score must be a positive whole number.');
        return;
      }
      parsedPassmarkScore = Number.parseInt(trimmedScore, 10);
      if (!Number.isSafeInteger(parsedPassmarkScore) || parsedPassmarkScore <= 0) {
        setError('PassMark score must be a positive whole number.');
        return;
      }
    }

    const parsedSpecUrl = parseHttpUrl(specUrl);
    if (!parsedSpecUrl.valid) {
      setError(`Primary Spec URL: ${parsedSpecUrl.error}`);
      return;
    }

    const cleanedSpecLinks: SpecLinkItem[] = [];
    const seenUrls = new Set<string>();
    if (parsedSpecUrl.normalizedUrl) {
      seenUrls.add(parsedSpecUrl.normalizedUrl);
    }

    for (let i = 0; i < specLinks.length; i += 1) {
      const row = specLinks[i];
      const lbl = row.label.trim();
      const rawUrl = row.url.trim();
      if (!rawUrl) continue;
      if (!lbl) {
        setError(`Custom link #${i + 1} needs a label.`);
        return;
      }
      const parsed = parseHttpUrl(rawUrl);
      if (!parsed.valid || !parsed.normalizedUrl) {
        setError(`Link "${lbl}": ${parsed.error}`);
        return;
      }
      if (seenUrls.has(parsed.normalizedUrl)) continue;
      seenUrls.add(parsed.normalizedUrl);
      cleanedSpecLinks.push({ label: lbl, url: parsed.normalizedUrl });
    }

    const existingPart = partType === 'cpu' ? editingCpu : editingGpu;
    const scoreUpdatedAt =
      parsedPassmarkScore === null
        ? null
        : parsedPassmarkScore !== (existingPart?.passmark_score ?? null)
          ? new Date().toISOString()
          : (existingPart?.score_updated_at ?? new Date().toISOString());

    setSaving(true);
    setError(null);
    try {
      let saved: Cpu | Gpu;
      if (partType === 'cpu') {
        const parsedSpare = Number.parseInt(spareCount.trim() || '0', 10);
        if (!Number.isSafeInteger(parsedSpare) || parsedSpare < 0) {
          setError('Spare count must be 0 or greater.');
          setSaving(false);
          return;
        }
        saved = await onSaveCpu(
          {
            name: name.trim(),
            brand: brand.trim(),
            codename: codename.trim() || null,
            socket: socket.trim() || null,
            base_clock_ghz: toNumOrNull(baseGhz),
            turbo_clock_ghz: toNumOrNull(turboGhz),
            cache_mb: toNumOrNull(cacheMb),
            cores: toNumOrNull(cores),
            threads: toNumOrNull(threads),
            tdp_w: toNumOrNull(tdpW),
            process_nm: toNumOrNull(processNm),
            max_memory_gb: toNumOrNull(maxMemGb),
            memory_type: memType.trim() || null,
            memory_speed_mhz: toNumOrNull(memSpeedMhz),
            launch_date: launchDate.trim() || null,
            rank: editingCpu?.rank ?? null,
            passmark_score: parsedPassmarkScore,
            score_updated_at: scoreUpdatedAt,
            is_mobile: isMobile,
            spare_count: parsedSpare,
            spec_url: parsedSpecUrl.normalizedUrl,
            spec_links: cleanedSpecLinks,
          },
          editingCpu?.id,
        );
      } else {
        saved = await onSaveGpu(
          {
            name: name.trim(),
            brand: brand.trim(),
            architecture: architecture.trim() || null,
            vram_gb: toNumOrNull(vramGb),
            vram_type: vramType.trim() || null,
            bus_interface: busInterface.trim() || null,
            process_nm: toNumOrNull(processNm),
            tdp_w: toNumOrNull(tdpW),
            directx_version: dxVersion.trim() || null,
            directx_feature_level: dxFeatureLevel.trim() || null,
            category: category.trim() || null,
            rank: editingGpu?.rank ?? null,
            passmark_score: parsedPassmarkScore,
            score_updated_at: scoreUpdatedAt,
            is_mobile: isMobile,
            spec_url: parsedSpecUrl.normalizedUrl,
            spec_links: cleanedSpecLinks,
          },
          editingGpu?.id,
        );
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save part.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {editingCpu || editingGpu
                  ? `Edit ${partType.toUpperCase()}`
                  : `Search Open-Source Catalog & Add ${partType.toUpperCase()}`}
              </h2>
              <p className="text-xs text-slate-400">
                Instant open-source hardware catalog auto-fill + optional Live Web Enrich (PassMark &amp; direct links)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {/* Primary Instant Reference Catalog Auto-Fill + Auto Link Lookup */}
          <div className="space-y-2.5">
            <ReferenceCatalogSearch
              category={partType}
              isEditing={Boolean(editingCpu || editingGpu)}
              vendorFilter={vendor}
              queryValue={query}
              onQueryChange={setQuery}
              placeholder={
                partType === 'cpu'
                  ? 'e.g. Ryzen 7 7800X3D, Core i5-12400F, Core 2 Quad Q6600'
                  : 'e.g. GeForce RTX 4070 Super, Radeon RX 7800 XT, GeForce GTX 970'
              }
              onSelect={(item, mode) => {
                const refItem = item as RefCpu | RefGpu;
                const fullQuery = `${refItem.brand} ${refItem.name}`.trim();
                const nextSpecUrl =
                  mode === 'fill_blanks'
                    ? specUrl.trim()
                      ? specUrl
                      : (refItem.spec_url ?? '')
                    : (refItem.spec_url ?? '');
                const nextSpecLinks = mode === 'replace' ? [] : specLinks;
                if (mode === 'replace') {
                  setSpecLinks([]);
                }
                applyReferenceItem(refItem, mode);
                setQuery(fullQuery);
                void handleLookup({
                  query: fullQuery,
                  brand: refItem.brand,
                  currentSpecUrl: nextSpecUrl,
                  currentSpecLinks: nextSpecLinks,
                  fillBlanksOnly: true,
                });
              }}
              extraAction={
                <select
                  value={vendor}
                  onChange={(e) =>
                    setVendor(
                      e.target.value as 'Auto' | 'Intel' | 'AMD' | 'NVIDIA',
                    )
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200"
                >
                  <option value="Auto">Auto Vendor</option>
                  <option value="Intel">Intel</option>
                  <option value="AMD">AMD</option>
                  {partType === 'gpu' ? (
                    <option value="NVIDIA">NVIDIA</option>
                  ) : null}
                </select>
              }
            />

            {results.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5 px-1">
                <span className="text-[11px] text-slate-500">
                  Other spec matches:
                </span>
                {results.map((item, idx) => (
                  <button
                    key={`${item.name}-${idx}`}
                    type="button"
                    onClick={() => applyLookupItem(item)}
                    className={`rounded-lg border px-2 py-1 text-left text-[11px] transition ${
                      name === item.name
                        ? 'border-cyan-400 bg-cyan-500/20 text-white'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="font-semibold">
                      {item.brand} {item.name}
                    </span>
                    <span className="ml-1.5 font-mono text-[10px] text-cyan-300 uppercase">
                      {item.source}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Review & Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Brand *
                </label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Model Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-300">
                  <span>
                    {partType === 'cpu'
                      ? 'PassMark CPU'
                      : 'PassMark G3D'}
                  </span>
                  {name.trim() ? (
                    <a
                      href={buildPassMarkSearchUrl(partType, brand, name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-normal text-cyan-300 hover:underline"
                    >
                      Lookup <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : null}
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={passmarkScore}
                  onChange={(e) => setPassmarkScore(e.target.value)}
                  placeholder={partType === 'cpu' ? 'e.g. 21820' : 'e.g. 19462'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                />
                {formatScoreUpdatedDate(
                  (partType === 'cpu' ? editingCpu : editingGpu)
                    ?.score_updated_at,
                ) ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Updated{' '}
                    {formatScoreUpdatedDate(
                      (partType === 'cpu' ? editingCpu : editingGpu)
                        ?.score_updated_at,
                    )}
                  </p>
                ) : null}
              </div>
            </div>

            <SmartLinksEditor
              partKind={partType}
              brand={brand}
              query={query.trim() || `${brand} ${name}`.trim()}
              specUrl={specUrl}
              specLinks={specLinks}
              onChange={(next) => {
                setSpecUrl(next.specUrl);
                setSpecLinks(next.specLinks);
              }}
              onRunAutoLookup={() =>
                void handleLookup({
                  query: `${brand} ${name}`.trim() || query.trim(),
                  brand,
                  currentSpecUrl: specUrl,
                  currentSpecLinks: specLinks,
                  fillBlanksOnly: true,
                })
              }
              lookupLoading={searching}
              lookupNote={lookupNote}
              lookupError={lookupError}
              searchProvider={searchProvider}
              slotResults={slotResults}
              onPassmarkMatched={(score) => setPassmarkScore(String(score))}
              autoFindLabel="Auto-Find Links & Score"
            />

            {partType === 'cpu' ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Codename
                  </label>
                  <input
                    type="text"
                    value={codename}
                    onChange={(e) => setCodename(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Socket
                  </label>
                  <input
                    type="text"
                    value={socket}
                    onChange={(e) => setSocket(e.target.value)}
                    placeholder="LGA1700 / AM5"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Cores
                  </label>
                  <input
                    type="number"
                    value={cores}
                    onChange={(e) => setCores(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Threads
                  </label>
                  <input
                    type="number"
                    value={threads}
                    onChange={(e) => setThreads(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Base (GHz)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={baseGhz}
                    onChange={(e) => setBaseGhz(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Turbo (GHz)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={turboGhz}
                    onChange={(e) => setTurboGhz(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Cache (MB)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={cacheMb}
                    onChange={(e) => setCacheMb(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    TDP (W)
                  </label>
                  <input
                    type="number"
                    value={tdpW}
                    onChange={(e) => setTdpW(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Process (nm)
                  </label>
                  <input
                    type="number"
                    value={processNm}
                    onChange={(e) => setProcessNm(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Memory Type
                  </label>
                  <input
                    type="text"
                    value={memType}
                    onChange={(e) => setMemType(e.target.value)}
                    placeholder="DDR5 / DDR4"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Launch
                  </label>
                  <input
                    type="text"
                    value={launchDate}
                    onChange={(e) => setLaunchDate(e.target.value)}
                    placeholder="2023.Q4"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Spare Count
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={spareCount}
                    onChange={(e) => setSpareCount(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-emerald-300"
                  />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={isMobile}
                      onChange={(e) => setIsMobile(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-950 text-cyan-500"
                    />
                    Mobile CPU
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    DirectX Version
                  </label>
                  <input
                    type="text"
                    value={dxVersion}
                    onChange={(e) => setDxVersion(e.target.value)}
                    placeholder="12 / 11.2 / 10.0"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    DX Feature Level
                  </label>
                  <input
                    type="text"
                    value={dxFeatureLevel}
                    onChange={(e) => setDxFeatureLevel(e.target.value)}
                    placeholder="12_2 / 11_0"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    VRAM (GB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={vramGb}
                    onChange={(e) => setVramGb(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    VRAM Type
                  </label>
                  <input
                    type="text"
                    value={vramType}
                    onChange={(e) => setVramType(e.target.value)}
                    placeholder="GDDR6 / GDDR5"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Architecture
                  </label>
                  <input
                    type="text"
                    value={architecture}
                    onChange={(e) => setArchitecture(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Bus Interface
                  </label>
                  <input
                    type="text"
                    value={busInterface}
                    onChange={(e) => setBusInterface(e.target.value)}
                    placeholder="PCIe 4.0 x16"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    TDP (W)
                  </label>
                  <input
                    type="number"
                    value={tdpW}
                    onChange={(e) => setTdpW(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={isMobile}
                      onChange={(e) => setIsMobile(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-950 text-cyan-500"
                    />
                    Mobile / Laptop GPU
                  </label>
                </div>
              </div>
            )}

            {error ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : `Save ${partType.toUpperCase()} to Catalog`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
