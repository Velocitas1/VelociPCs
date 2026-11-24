import { useEffect, useState, type FormEvent } from 'react';
import {
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildPassMarkSearchUrl,
  formatScoreUpdatedDate,
} from '../lib/scoring';
import { getSafeHttpUrl, parseHttpUrl, PART_LINK_PRESETS } from '../lib/specLinks';
import { supabase } from '../lib/supabase';
import type { Cpu, Gpu, SpecLinkItem } from '../types/database';

interface LookupResultItem {
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

interface HardwareLookupModalProps {
  open: boolean;
  partType: 'cpu' | 'gpu';
  initialMode?: 'search' | 'manual';
  initialQuery?: string;
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
  const [results, setResults] = useState<LookupResultItem[]>([]);

  // Shared editable form state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState(partType === 'cpu' ? 'Intel' : 'NVIDIA');
  const [specUrl, setSpecUrl] = useState('');
  const [specLinks, setSpecLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [tdpW, setTdpW] = useState('');
  const [processNm, setProcessNm] = useState('');
  const [passmarkScore, setPassmarkScore] = useState('');

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

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLookupNote(null);
    setResults([]);
    setQuery(initialQuery);

    if (partType === 'cpu' && editingCpu) {
      setName(editingCpu.name);
      setBrand(editingCpu.brand);
      setSpecUrl(editingCpu.spec_url ?? '');
      setSpecLinks((editingCpu.spec_links ?? []).map((l) => ({ ...l })));
      setIsMobile(editingCpu.is_mobile);
      setTdpW(editingCpu.tdp_w?.toString() ?? '');
      setProcessNm(editingCpu.process_nm?.toString() ?? '');
      setPassmarkScore(editingCpu.passmark_score?.toString() ?? '');
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
    }
  }, [open, partType, initialMode, initialQuery, editingCpu, editingGpu]);

  if (!open) return null;

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

  const handleLookup = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setLookupNote(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'lookup-hardware-spec',
        {
          body: { query: query.trim(), partType, vendor },
        },
      );
      if (fnErr) throw fnErr;

      const items = (data?.results ?? []) as LookupResultItem[];
      setResults(items);
      setLookupNote(data?.note ?? null);
      if (items.length > 0) {
        applyLookupItem(items[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Spec lookup failed. Ensure you are signed in or enter details manually.',
      );
    } finally {
      setSearching(false);
    }
  };

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
      setError(`Canonical Spec URL: ${parsedSpecUrl.error}`);
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
      if (!lbl && !rawUrl) continue;
      if (!lbl) {
        setError(`Secondary research link #${i + 1} needs a label.`);
        return;
      }
      if (!rawUrl) {
        setError(`Secondary research link "${lbl}" needs a URL.`);
        return;
      }
      const parsed = parseHttpUrl(rawUrl);
      if (!parsed.valid || !parsed.normalizedUrl) {
        setError(`Secondary research link "${lbl}": ${parsed.error}`);
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
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
                  : `Search Intel / AMD Specs & Add ${partType.toUpperCase()}`}
              </h2>
              <p className="text-xs text-slate-400">
                Auto-fill specs via Supabase Edge Function (`lookup-hardware-spec`) and review before saving
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
          {/* Spec Lookup Search Bar */}
          {!editingCpu && !editingGpu ? (
            <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                Lookup Official Intel / AMD / NVIDIA Specs
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleLookup();
                      }
                    }}
                    placeholder={
                      partType === 'cpu'
                        ? 'e.g. Ryzen 7 7800X3D, Core i5-12400F, Core 2 Quad Q6600'
                        : 'e.g. GeForce RTX 4070 Super, Radeon RX 7800 XT, Arc B580'
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pr-3 pl-9 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <select
                  value={vendor}
                  onChange={(e) =>
                    setVendor(
                      e.target.value as 'Auto' | 'Intel' | 'AMD' | 'NVIDIA',
                    )
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                >
                  <option value="Auto">Auto Vendor</option>
                  <option value="Intel">Intel</option>
                  <option value="AMD">AMD</option>
                  {partType === 'gpu' ? (
                    <option value="NVIDIA">NVIDIA</option>
                  ) : null}
                </select>
                <button
                  type="button"
                  onClick={() => void handleLookup()}
                  disabled={searching}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Fetch Specs
                </button>
              </div>

              {lookupNote ? (
                <p className="mt-2 text-xs text-slate-300">{lookupNote}</p>
              ) : null}

              {results.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {results.map((item, idx) => (
                    <button
                      key={`${item.name}-${idx}`}
                      type="button"
                      onClick={() => applyLookupItem(item)}
                      className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
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
          ) : null}

          {/* Review & Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
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
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>Canonical Spec URL (Intel ARK / AMD / TechPowerUp)</span>
                  {getSafeHttpUrl(specUrl) ? (
                    <a
                      href={getSafeHttpUrl(specUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                    >
                      Test link <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </label>
                <input
                  type="url"
                  value={specUrl}
                  onChange={(e) => setSpecUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-cyan-200"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-300">
                  <span>
                    {partType === 'cpu'
                      ? 'PassMark CPU Mark'
                      : 'PassMark G3D Mark'}
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

            {/* Secondary Research Links */}
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-300 uppercase">
                  Secondary Research Links ({specLinks.length})
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PART_LINK_PRESETS[partType].labelPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setSpecLinks((prev) => [
                          ...prev,
                          { label: preset, url: '' },
                        ])
                      }
                      className="rounded border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
                    >
                      + {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setSpecLinks((prev) => [...prev, { label: '', url: '' }])
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white"
                  >
                    <Plus className="h-3 w-3 text-cyan-400" />
                    Add Link
                  </button>
                </div>
              </div>

              {specLinks.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Optional direct links shown in the split-button dropdown (e.g. PassMark, TechPowerUp, official page). Search fallbacks remain automatic.
                </p>
              ) : (
                <div className="space-y-2">
                  {specLinks.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid items-center gap-2 sm:grid-cols-12"
                    >
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSpecLinks((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, label: val } : item,
                            ),
                          );
                        }}
                        placeholder="Label (e.g. PassMark)"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white sm:col-span-4"
                      />
                      <input
                        type="url"
                        value={row.url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSpecLinks((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, url: val } : item,
                            ),
                          );
                        }}
                        placeholder="https://..."
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-cyan-200 sm:col-span-7"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSpecLinks((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        title="Remove link"
                        className="flex justify-center rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300 sm:col-span-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
