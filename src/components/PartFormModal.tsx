import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Layers, Plus, Trash2, X } from 'lucide-react';
import {
  findReferenceGpuForChipset,
  matchCanonicalGpuChip,
  type RefCooler,
  type RefGpu,
  type RefGpuCard,
  type RefMotherboard,
  type RefPcCase,
  type RefPsu,
  type RefRamKit,
  type RefStorageDriveModel,
  type RefWifiCard,
  type ReferenceItem,
} from '../lib/referenceCatalog';
import { PART_CATEGORY_META } from '../lib/parts';
import {
  getSafeHttpUrl,
  PART_LINK_PRESETS,
  parseHttpUrl,
  type PartLinkPresetKind,
} from '../lib/specLinks';
import type {
  CatalogPart,
  CatalogPartCategory,
  Cooler,
  Gpu,
  GpuCard,
  Motherboard,
  PcCase,
  Psu,
  RamKit,
  SpecLinkItem,
  StorageDriveModel,
  WifiCard,
} from '../types/database';
import { PartCombobox } from './PartCombobox';
import { ReferenceCatalogSearch } from './ReferenceCatalogSearch';

interface PartFormModalProps {
  open: boolean;
  category: CatalogPartCategory;
  initialQuery?: string;
  initialReferenceItem?: ReferenceItem | null;
  editingPart?: CatalogPart | null;
  defaultSpareCount?: number;
  gpus: Gpu[];
  recentlyCreatedGpuId?: number | null;
  onOpenGpuLookup?: (
    mode: 'search' | 'manual',
    initialQuery: string,
    initialRefGpu?: RefGpu | null,
  ) => void;
  onClose: () => void;
  onSave: (
    category: CatalogPartCategory,
    payload: Record<string, unknown>,
    existingId?: number,
  ) => Promise<CatalogPart>;
  onSaved?: (category: CatalogPartCategory, part: CatalogPart) => void;
}

function intOrNull(val: string): number | null {
  if (!val.trim()) return null;
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

function getPresetKind(category: CatalogPartCategory): PartLinkPresetKind {
  switch (category) {
    case 'gpu_card':
      return 'gpu_aib';
    case 'motherboard':
      return 'motherboard';
    case 'ram_kit':
      return 'ram';
    case 'storage_drive_model':
      return 'storage_drive';
    case 'psu':
      return 'psu';
    case 'case':
      return 'case';
    case 'cooler':
      return 'cooler';
    case 'wifi_card':
      return 'wifi';
  }
}

export function PartFormModal({
  open,
  category,
  initialQuery = '',
  initialReferenceItem = null,
  editingPart = null,
  defaultSpareCount = 0,
  gpus,
  recentlyCreatedGpuId,
  onOpenGpuLookup,
  onClose,
  onSave,
  onSaved,
}: PartFormModalProps) {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [spareCount, setSpareCount] = useState('0');
  const [specUrl, setSpecUrl] = useState('');
  const [specLinks, setSpecLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [notes, setNotes] = useState('');

  // GPU Card
  const [gpuId, setGpuId] = useState<number | null>(null);
  const [partNumber, setPartNumber] = useState('');
  const [coolingType, setCoolingType] = useState('');
  const [lengthMm, setLengthMm] = useState('');

  // Motherboard
  const [socket, setSocket] = useState('');
  const [chipset, setChipset] = useState('');
  const [formFactor, setFormFactor] = useState('');
  const [memoryType, setMemoryType] = useState('');
  const [launchDate, setLaunchDate] = useState('');

  // RAM Kit
  const [capacityGb, setCapacityGb] = useState('');
  const [modulesCount, setModulesCount] = useState('');
  const [ramType, setRamType] = useState('');
  const [speedMhz, setSpeedMhz] = useState('');
  const [pcRating, setPcRating] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Storage Drive Model
  const [modelNumber, setModelNumber] = useState('');
  const [nandType, setNandType] = useState('');
  const [readMbS, setReadMbS] = useState('');
  const [writeMbS, setWriteMbS] = useState('');

  // PSU
  const [wattage, setWattage] = useState('');
  const [efficiencyRating, setEfficiencyRating] = useState('');
  const [modular, setModular] = useState('');
  const [has8PinCpu, setHas8PinCpu] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [has6PinPcie, setHas6PinPcie] = useState<'unknown' | 'yes' | 'no'>('unknown');

  // Case
  const [color, setColor] = useState('');
  const [maxGpuLengthMm, setMaxGpuLengthMm] = useState('');

  // Cooler
  const [coolerType, setCoolerType] = useState('');
  const [fanSizeMm, setFanSizeMm] = useState('');
  const [socketSupport, setSocketSupport] = useState('');
  const [tdpRatingW, setTdpRatingW] = useState('');

  // Wi-Fi Card
  const [wifiProduct, setWifiProduct] = useState('');
  const [wifiStandard, setWifiStandard] = useState('');
  const [bluetoothVersion, setBluetoothVersion] = useState('');

  const [unmatchedChipset, setUnmatchedChipset] = useState<string | null>(null);
  const [matchingChipLoading, setMatchingChipLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyReferencePart = (
    item: ReferenceItem,
    mode: 'replace' | 'fill_blanks',
  ) => {
    const fill = (
      prev: string,
      nextVal: string | number | null | undefined,
    ) => {
      const nextStr =
        nextVal !== null && nextVal !== undefined ? String(nextVal) : '';
      if (mode === 'fill_blanks') {
        return prev.trim() ? prev : nextStr;
      }
      return nextStr;
    };

    switch (category) {
      case 'gpu_card': {
        const gc = item as RefGpuCard;
        setBrand((prev) => fill(prev, gc.brand));
        setModel((prev) => fill(prev, gc.model));
        setPartNumber((prev) => fill(prev, gc.part_number));
        setCoolingType((prev) => fill(prev, gc.cooling_type));
        setLengthMm((prev) => fill(prev, gc.length_mm));
        setSpecUrl((prev) => fill(prev, gc.spec_url));

        if (gc.chipset) {
          const matched = matchCanonicalGpuChip(gc.chipset, gpus);
          if (matched) {
            if (mode === 'replace' || gpuId === null) {
              setGpuId(matched.id);
              setUnmatchedChipset(null);
            }
          } else if (mode === 'replace' || gpuId === null) {
            if (mode === 'replace') setGpuId(null);
            setUnmatchedChipset(gc.chipset);
          }
        }
        break;
      }
      case 'motherboard': {
        const mb = item as RefMotherboard;
        setBrand((prev) => fill(prev, mb.brand));
        setModel((prev) => fill(prev, mb.model));
        setSocket((prev) => fill(prev, mb.socket));
        setChipset((prev) => fill(prev, mb.chipset));
        setFormFactor((prev) => fill(prev, mb.form_factor));
        setMemoryType((prev) => fill(prev, mb.memory_type));
        setLaunchDate((prev) => fill(prev, mb.launch_date));
        setSpecUrl((prev) => fill(prev, mb.spec_url));
        break;
      }
      case 'ram_kit': {
        const rk = item as RefRamKit;
        setBrand((prev) => fill(prev, rk.brand));
        setModel((prev) => fill(prev, rk.model));
        setCapacityGb((prev) => fill(prev, rk.capacity_gb));
        setModulesCount((prev) => fill(prev, rk.modules_count));
        setRamType((prev) => fill(prev, rk.ram_type));
        setSpeedMhz((prev) => fill(prev, rk.speed_mhz));
        setPcRating((prev) => fill(prev, rk.pc_rating));
        if (mode === 'replace') setIsMobile(Boolean(rk.is_mobile));
        setSpecUrl((prev) => fill(prev, rk.spec_url));
        break;
      }
      case 'storage_drive_model': {
        const sd = item as RefStorageDriveModel;
        setBrand((prev) => fill(prev, sd.brand));
        setModel((prev) => fill(prev, sd.model));
        setModelNumber((prev) => fill(prev, sd.model_number));
        setCapacityGb((prev) => fill(prev, sd.capacity_gb));
        setFormFactor((prev) => fill(prev, sd.form_factor));
        setNandType((prev) => fill(prev, sd.nand_type));
        setReadMbS((prev) => fill(prev, sd.read_mb_s));
        setWriteMbS((prev) => fill(prev, sd.write_mb_s));
        setSpecUrl((prev) => fill(prev, sd.spec_url));
        break;
      }
      case 'psu': {
        const p = item as RefPsu;
        setBrand((prev) => fill(prev, p.brand));
        setModel((prev) => fill(prev, p.model));
        setWattage((prev) => fill(prev, p.wattage));
        setEfficiencyRating((prev) => fill(prev, p.efficiency_rating));
        setModular((prev) => fill(prev, p.modular));
        const next8 =
          p.has_8pin_cpu === null ? 'unknown' : p.has_8pin_cpu ? 'yes' : 'no';
        const next6 =
          p.has_6pin_pcie === null ? 'unknown' : p.has_6pin_pcie ? 'yes' : 'no';
        setHas8PinCpu((prev) =>
          mode === 'fill_blanks' && prev !== 'unknown' ? prev : next8,
        );
        setHas6PinPcie((prev) =>
          mode === 'fill_blanks' && prev !== 'unknown' ? prev : next6,
        );
        setSpecUrl((prev) => fill(prev, p.spec_url));
        break;
      }
      case 'case': {
        const c = item as RefPcCase;
        setBrand((prev) => fill(prev, c.brand));
        setModel((prev) => fill(prev, c.model));
        setFormFactor((prev) => fill(prev, c.form_factor));
        setColor((prev) => fill(prev, c.color));
        setMaxGpuLengthMm((prev) => fill(prev, c.max_gpu_length_mm));
        setSpecUrl((prev) => fill(prev, c.spec_url));
        break;
      }
      case 'cooler': {
        const cl = item as RefCooler;
        setBrand((prev) => fill(prev, cl.brand));
        setModel((prev) => fill(prev, cl.model));
        setCoolerType((prev) => fill(prev, cl.cooler_type));
        setFanSizeMm((prev) => fill(prev, cl.fan_size_mm));
        setSocketSupport((prev) => fill(prev, cl.socket_support));
        setTdpRatingW((prev) => fill(prev, cl.tdp_rating_w));
        setSpecUrl((prev) => fill(prev, cl.spec_url));
        break;
      }
      case 'wifi_card': {
        const w = item as RefWifiCard;
        setBrand((prev) => fill(prev, w.brand));
        setModel((prev) => fill(prev, w.model));
        setWifiProduct((prev) => fill(prev, w.product));
        setWifiStandard((prev) => fill(prev, w.wifi_standard));
        setBluetoothVersion((prev) => fill(prev, w.bluetooth_version));
        setFormFactor((prev) => fill(prev, w.form_factor));
        if (mode === 'replace') setIsMobile(Boolean(w.is_mobile));
        setSpecUrl((prev) => fill(prev, w.spec_url));
        break;
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUnmatchedChipset(null);

    const resetCommon = (
      b: string,
      m: string,
      spare: number,
      url: string | null,
      links: SpecLinkItem[],
      n: string | null,
    ) => {
      setBrand(b);
      setModel(m);
      setSpareCount(String(spare));
      setSpecUrl(url ?? '');
      setSpecLinks((links ?? []).map((l) => ({ ...l })));
      setNotes(n ?? '');
    };

    if (!editingPart) {
      resetCommon('', initialQuery, defaultSpareCount, null, [], null);
      setGpuId(null);
      setPartNumber('');
      setCoolingType('');
      setLengthMm('');
      setSocket('');
      setChipset('');
      setFormFactor(category === 'storage_drive_model' ? 'NVMe' : '');
      setMemoryType('');
      setLaunchDate('');
      setCapacityGb('');
      setModulesCount('');
      setRamType('');
      setSpeedMhz('');
      setPcRating('');
      setIsMobile(false);
      setModelNumber('');
      setNandType('');
      setReadMbS('');
      setWriteMbS('');
      setWattage('');
      setEfficiencyRating('');
      setModular('');
      setHas8PinCpu('unknown');
      setHas6PinPcie('unknown');
      setColor('');
      setMaxGpuLengthMm('');
      setCoolerType('');
      setFanSizeMm('');
      setSocketSupport('');
      setTdpRatingW('');
      setWifiProduct('');
      setWifiStandard('');
      setBluetoothVersion('');

      if (initialReferenceItem) {
        applyReferencePart(initialReferenceItem, 'replace');
      }
      return;
    }

    switch (category) {
      case 'gpu_card': {
        const p = editingPart as GpuCard;
        resetCommon(p.brand, p.model, p.spare_count, p.spec_url, p.spec_links, p.notes);
        setGpuId(p.gpu_id);
        setPartNumber(p.part_number ?? '');
        setCoolingType(p.cooling_type ?? '');
        setLengthMm(p.length_mm?.toString() ?? '');
        break;
      }
      case 'motherboard': {
        const p = editingPart as Motherboard;
        resetCommon(p.brand, p.model, p.spare_count, p.spec_url, p.spec_links, p.notes);
        setSocket(p.socket ?? '');
        setChipset(p.chipset ?? '');
        setFormFactor(p.form_factor ?? '');
        setMemoryType(p.memory_type ?? '');
        setLaunchDate(p.launch_date ?? '');
        break;
      }
      case 'ram_kit': {
        const p = editingPart as RamKit;
        resetCommon(p.brand ?? '', p.model, p.spare_count, p.spec_url, p.spec_links, p.notes);
        setCapacityGb(p.capacity_gb?.toString() ?? '');
        setModulesCount(p.modules_count?.toString() ?? '');
        setRamType(p.ram_type ?? '');
        setSpeedMhz(p.speed_mhz?.toString() ?? '');
        setPcRating(p.pc_rating ?? '');
        setIsMobile(p.is_mobile);
        break;
      }
      case 'storage_drive_model': {
        const p = editingPart as StorageDriveModel;
        resetCommon(p.brand ?? '', p.model, p.spare_count, p.spec_url, p.spec_links, p.notes);
        setModelNumber(p.model_number ?? '');
        setCapacityGb(p.capacity_gb?.toString() ?? '');
        setFormFactor(p.form_factor ?? '');
        setNandType(p.nand_type ?? '');
        setReadMbS(p.read_mb_s?.toString() ?? '');
        setWriteMbS(p.write_mb_s?.toString() ?? '');
        break;
      }
      case 'psu': {
        const p = editingPart as Psu;
        resetCommon(p.brand, p.model, p.spare_count, p.spec_url, p.spec_links, p.notes);
        setWattage(p.wattage?.toString() ?? '');
        setEfficiencyRating(p.efficiency_rating ?? '');
        setModular(p.modular ?? '');
        setHas8PinCpu(
          p.has_8pin_cpu === null ? 'unknown' : p.has_8pin_cpu ? 'yes' : 'no',
        );
        setHas6PinPcie(
          p.has_6pin_pcie === null ? 'unknown' : p.has_6pin_pcie ? 'yes' : 'no',
        );
        break;
      }
      case 'case': {
        const p = editingPart as PcCase;
        resetCommon(p.brand, p.model, p.spare_count, p.spec_url, p.spec_links, p.notes);
        setFormFactor(p.form_factor ?? '');
        setColor(p.color ?? '');
        setMaxGpuLengthMm(p.max_gpu_length_mm?.toString() ?? '');
        break;
      }
      case 'cooler': {
        const p = editingPart as Cooler;
        resetCommon(p.brand, p.model, p.spare_count, p.spec_url, p.spec_links, p.notes);
        setCoolerType(p.cooler_type ?? '');
        setFanSizeMm(p.fan_size_mm?.toString() ?? '');
        setSocketSupport(p.socket_support ?? '');
        setTdpRatingW(p.tdp_rating_w?.toString() ?? '');
        break;
      }
      case 'wifi_card': {
        const p = editingPart as WifiCard;
        resetCommon(p.brand, p.model, p.spare_count, p.spec_url, p.spec_links, p.notes);
        setWifiProduct(p.product ?? '');
        setWifiStandard(p.wifi_standard ?? '');
        setBluetoothVersion(p.bluetooth_version ?? '');
        setFormFactor(p.form_factor ?? '');
        setIsMobile(p.is_mobile);
        break;
      }
    }
  }, [
    open,
    category,
    editingPart,
    initialQuery,
    initialReferenceItem,
    defaultSpareCount,
  ]);

  useEffect(() => {
    if (open && category === 'gpu_card' && recentlyCreatedGpuId) {
      setGpuId(recentlyCreatedGpuId);
      setUnmatchedChipset(null);
    }
  }, [open, category, recentlyCreatedGpuId]);

  if (!open) return null;

  const meta = PART_CATEGORY_META[category];
  const presetKind = getPresetKind(category);
  const presets = PART_LINK_PRESETS[presetKind];
  const brandOptional =
    category === 'ram_kit' || category === 'storage_drive_model';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!brandOptional && !brand.trim()) {
      setError('Brand is required.');
      return;
    }
    if (!model.trim()) {
      setError('Model is required.');
      return;
    }
    if (category === 'gpu_card' && !gpuId) {
      setError('Select the canonical GPU silicon chip for this board.');
      return;
    }

    const parsedSpare = intOrNull(spareCount);
    if (parsedSpare === null || parsedSpare < 0) {
      setError('Spare count must be 0 or greater.');
      return;
    }

    const parsedSpecUrl = parseHttpUrl(specUrl);
    if (!parsedSpecUrl.valid) {
      setError(`Spec URL: ${parsedSpecUrl.error}`);
      return;
    }

    const cleanedSpecLinks: SpecLinkItem[] = [];
    const seen = new Set<string>();
    if (parsedSpecUrl.normalizedUrl) {
      seen.add(parsedSpecUrl.normalizedUrl);
    }

    for (let i = 0; i < specLinks.length; i += 1) {
      const row = specLinks[i];
      const lbl = row.label.trim();
      const rawUrl = row.url.trim();
      if (!lbl && !rawUrl) continue;
      if (!lbl) {
        setError(`Extra link #${i + 1} needs a label.`);
        return;
      }
      const parsed = parseHttpUrl(rawUrl);
      if (!parsed.valid || !parsed.normalizedUrl) {
        setError(`Extra link "${lbl}": ${parsed.error ?? 'URL is required.'}`);
        return;
      }
      if (seen.has(parsed.normalizedUrl)) continue;
      seen.add(parsed.normalizedUrl);
      cleanedSpecLinks.push({ label: lbl, url: parsed.normalizedUrl });
    }

    let payload: Record<string, unknown> = {
      spare_count: parsedSpare,
      spec_url: parsedSpecUrl.normalizedUrl,
      spec_links: cleanedSpecLinks,
      notes: notes.trim() || null,
    };

    switch (category) {
      case 'gpu_card':
        payload = {
          ...payload,
          gpu_id: gpuId,
          brand: brand.trim(),
          model: model.trim(),
          part_number: partNumber.trim() || null,
          cooling_type: coolingType.trim() || null,
          length_mm: intOrNull(lengthMm),
        };
        break;
      case 'motherboard':
        payload = {
          ...payload,
          brand: brand.trim(),
          model: model.trim(),
          socket: socket.trim() || null,
          chipset: chipset.trim() || null,
          form_factor: formFactor.trim() || null,
          memory_type: memoryType.trim() || null,
          launch_date: launchDate.trim() || null,
        };
        break;
      case 'ram_kit':
        payload = {
          ...payload,
          brand: brand.trim() || null,
          model: model.trim(),
          capacity_gb: intOrNull(capacityGb),
          modules_count: intOrNull(modulesCount),
          ram_type: ramType.trim() || null,
          speed_mhz: intOrNull(speedMhz),
          pc_rating: pcRating.trim() || null,
          is_mobile: isMobile,
        };
        break;
      case 'storage_drive_model':
        payload = {
          ...payload,
          brand: brand.trim() || null,
          model: model.trim(),
          model_number: modelNumber.trim() || null,
          capacity_gb: intOrNull(capacityGb),
          form_factor: formFactor.trim() || null,
          nand_type: nandType.trim() || null,
          read_mb_s: intOrNull(readMbS),
          write_mb_s: intOrNull(writeMbS),
        };
        break;
      case 'psu':
        payload = {
          ...payload,
          brand: brand.trim(),
          model: model.trim(),
          wattage: intOrNull(wattage),
          efficiency_rating: efficiencyRating.trim() || null,
          modular: modular.trim() || null,
          has_8pin_cpu:
            has8PinCpu === 'unknown' ? null : has8PinCpu === 'yes',
          has_6pin_pcie:
            has6PinPcie === 'unknown' ? null : has6PinPcie === 'yes',
        };
        break;
      case 'case':
        payload = {
          ...payload,
          brand: brand.trim(),
          model: model.trim(),
          form_factor: formFactor.trim() || null,
          color: color.trim() || null,
          max_gpu_length_mm: intOrNull(maxGpuLengthMm),
        };
        break;
      case 'cooler':
        payload = {
          ...payload,
          brand: brand.trim(),
          model: model.trim(),
          cooler_type: coolerType.trim() || null,
          fan_size_mm: intOrNull(fanSizeMm),
          socket_support: socketSupport.trim() || null,
          tdp_rating_w: intOrNull(tdpRatingW),
        };
        break;
      case 'wifi_card':
        payload = {
          ...payload,
          brand: brand.trim(),
          product: wifiProduct.trim() || null,
          model: model.trim(),
          wifi_standard: wifiStandard.trim() || null,
          bluetooth_version: bluetoothVersion.trim() || null,
          form_factor: formFactor.trim() || null,
          is_mobile: isMobile,
        };
        break;
    }

    setSaving(true);
    try {
      const saved = await onSave(category, payload, editingPart?.id);
      onSaved?.(category, saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save part.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {editingPart ? `Edit ${meta.singular}` : `Add ${meta.singular}`}
              </h2>
              <p className="text-xs text-slate-400">
                Save to owned parts catalog with spare count &amp; research links
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

        <form
          onSubmit={handleSubmit}
          className="space-y-4 overflow-y-auto p-5 text-xs"
        >
          <ReferenceCatalogSearch
            category={category}
            initialQuery={initialQuery}
            isEditing={Boolean(editingPart)}
            placeholder={`Search open-source ${meta.singular} catalog to auto-fill...`}
            onSelect={(item, mode) => applyReferencePart(item, mode)}
          />

          {category === 'gpu_card' ? (
            <div className="space-y-2">
              <PartCombobox
                partType="gpu"
                label="Canonical GPU Silicon Chip *"
                parts={gpus}
                selectedId={gpuId}
                onSelect={(id) => {
                  setGpuId(id);
                  if (id !== null) setUnmatchedChipset(null);
                }}
                hideMobileByDefault={true}
                onOpenLookup={(mode, q) => {
                  onOpenGpuLookup?.(mode, q);
                }}
                onSelectReferenceItem={(refGpu) => {
                  onOpenGpuLookup?.(
                    'search',
                    `${refGpu.brand} ${refGpu.name}`.trim(),
                    refGpu as RefGpu,
                  );
                }}
                placeholder="Select GPU chip (e.g. NVIDIA GeForce GTX 970)..."
              />
              {unmatchedChipset && !gpuId ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <span>
                    Chipset <strong>{unmatchedChipset}</strong> isn&apos;t in your
                    saved GPU chips yet.
                  </span>
                  <button
                    type="button"
                    disabled={matchingChipLoading}
                    onClick={async () => {
                      setMatchingChipLoading(true);
                      try {
                        const refGpu =
                          await findReferenceGpuForChipset(unmatchedChipset);
                        onOpenGpuLookup?.('search', unmatchedChipset, refGpu);
                      } finally {
                        setMatchingChipLoading(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
                  >
                    <Plus className="h-3 w-3" />
                    {matchingChipLoading
                      ? 'Loading...'
                      : `Add ${unmatchedChipset} Chip`}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <label className="mb-1 block font-medium text-slate-300">
                Brand{brandOptional ? '' : ' *'}
              </label>
              <input
                type="text"
                required={!brandOptional}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={
                  category === 'gpu_card'
                    ? 'ASUS / EVGA'
                    : category === 'motherboard'
                      ? 'ASUS / MSI'
                      : category === 'psu'
                        ? 'EVGA / Seasonic'
                        : 'Optional'
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium text-slate-300">
                Model Name *
              </label>
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={
                  category === 'gpu_card'
                    ? 'STRIX-GTX970-DC2OC-4GD5'
                    : category === 'ram_kit'
                      ? 'Vengeance LPX 16GB (2x8GB) DDR4-3200'
                      : 'Model name'
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">
                Spare Count
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={spareCount}
                onChange={(e) => setSpareCount(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-emerald-300"
              />
            </div>
          </div>

          {category === 'gpu_card' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-slate-400">Part Number</label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Cooling Type</label>
                <input
                  type="text"
                  value={coolingType}
                  onChange={(e) => setCoolingType(e.target.value)}
                  placeholder="Dual Fan / Blower"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Length (mm)</label>
                <input
                  type="number"
                  min={1}
                  value={lengthMm}
                  onChange={(e) => setLengthMm(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          ) : null}

          {category === 'motherboard' ? (
            <div className="grid gap-3 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-slate-400">Socket</label>
                <input
                  type="text"
                  value={socket}
                  onChange={(e) => setSocket(e.target.value)}
                  placeholder="AM4 / LGA1151"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Chipset</label>
                <input
                  type="text"
                  value={chipset}
                  onChange={(e) => setChipset(e.target.value)}
                  placeholder="B450 / Z390"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Form Factor</label>
                <input
                  type="text"
                  value={formFactor}
                  onChange={(e) => setFormFactor(e.target.value)}
                  placeholder="ATX / mATX / ITX"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Memory Type</label>
                <input
                  type="text"
                  value={memoryType}
                  onChange={(e) => setMemoryType(e.target.value)}
                  placeholder="DDR4 / DDR3"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Launch</label>
                <input
                  type="text"
                  value={launchDate}
                  onChange={(e) => setLaunchDate(e.target.value)}
                  placeholder="2018-10-08"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          ) : null}

          {category === 'ram_kit' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-slate-400">Capacity (GB)</label>
                <input
                  type="number"
                  min={1}
                  value={capacityGb}
                  onChange={(e) => setCapacityGb(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Modules (DIMMs)</label>
                <input
                  type="number"
                  min={1}
                  value={modulesCount}
                  onChange={(e) => setModulesCount(e.target.value)}
                  placeholder="2"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Type</label>
                <input
                  type="text"
                  value={ramType}
                  onChange={(e) => setRamType(e.target.value)}
                  placeholder="DDR4 / DDR3 / DDR2"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Speed (MHz)</label>
                <input
                  type="number"
                  min={1}
                  value={speedMhz}
                  onChange={(e) => setSpeedMhz(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">PC Rating</label>
                <input
                  type="text"
                  value={pcRating}
                  onChange={(e) => setPcRating(e.target.value)}
                  placeholder="PC3-12800"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={isMobile}
                    onChange={(e) => setIsMobile(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-950 text-cyan-500"
                  />
                  Laptop / SO-DIMM
                </label>
              </div>
            </div>
          ) : null}

          {category === 'storage_drive_model' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-slate-400">Capacity (GB)</label>
                <input
                  type="number"
                  min={1}
                  value={capacityGb}
                  onChange={(e) => setCapacityGb(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Form Factor</label>
                <input
                  type="text"
                  value={formFactor}
                  onChange={(e) => setFormFactor(e.target.value)}
                  placeholder='NVMe / M.2 / 2.5" SATA'
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Model Number</label>
                <input
                  type="text"
                  value={modelNumber}
                  onChange={(e) => setModelNumber(e.target.value)}
                  placeholder="MZ-76E500"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">NAND Type</label>
                <input
                  type="text"
                  value={nandType}
                  onChange={(e) => setNandType(e.target.value)}
                  placeholder="3D TLC / V-NAND"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Read (MB/s)</label>
                <input
                  type="number"
                  min={1}
                  value={readMbS}
                  onChange={(e) => setReadMbS(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Write (MB/s)</label>
                <input
                  type="number"
                  min={1}
                  value={writeMbS}
                  onChange={(e) => setWriteMbS(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          ) : null}

          {category === 'psu' ? (
            <div className="grid gap-3 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-slate-400">Wattage (W)</label>
                <input
                  type="number"
                  min={1}
                  value={wattage}
                  onChange={(e) => setWattage(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">80 PLUS</label>
                <input
                  type="text"
                  value={efficiencyRating}
                  onChange={(e) => setEfficiencyRating(e.target.value)}
                  placeholder="80+ Gold"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Modularity</label>
                <input
                  type="text"
                  value={modular}
                  onChange={(e) => setModular(e.target.value)}
                  placeholder="Full / Semi / Non"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">8-pin CPU</label>
                <select
                  value={has8PinCpu}
                  onChange={(e) =>
                    setHas8PinCpu(e.target.value as 'unknown' | 'yes' | 'no')
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                >
                  <option value="unknown">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-slate-400">6-pin PCIe</label>
                <select
                  value={has6PinPcie}
                  onChange={(e) =>
                    setHas6PinPcie(e.target.value as 'unknown' | 'yes' | 'no')
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                >
                  <option value="unknown">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          ) : null}

          {category === 'case' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-slate-400">Form Factor</label>
                <input
                  type="text"
                  value={formFactor}
                  onChange={(e) => setFormFactor(e.target.value)}
                  placeholder="Mid-Tower / Mini-ITX"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Color</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Black / Silver"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">
                  Max GPU Length (mm)
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxGpuLengthMm}
                  onChange={(e) => setMaxGpuLengthMm(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          ) : null}

          {category === 'cooler' ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-slate-400">Type</label>
                <input
                  type="text"
                  value={coolerType}
                  onChange={(e) => setCoolerType(e.target.value)}
                  placeholder="Air / AIO / Stock"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">
                  Fan / Rad (mm)
                </label>
                <input
                  type="number"
                  min={1}
                  value={fanSizeMm}
                  onChange={(e) => setFanSizeMm(e.target.value)}
                  placeholder="120 / 240"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">
                  Socket Support
                </label>
                <input
                  type="text"
                  value={socketSupport}
                  onChange={(e) => setSocketSupport(e.target.value)}
                  placeholder="AM4, LGA115x"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">TDP (W)</label>
                <input
                  type="number"
                  min={1}
                  value={tdpRatingW}
                  onChange={(e) => setTdpRatingW(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          ) : null}

          {category === 'wifi_card' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-slate-400">Product Line</label>
                <input
                  type="text"
                  value={wifiProduct}
                  onChange={(e) => setWifiProduct(e.target.value)}
                  placeholder="Wi-Fi 6E / Centrino"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">
                  Wi-Fi Standard
                </label>
                <input
                  type="text"
                  value={wifiStandard}
                  onChange={(e) => setWifiStandard(e.target.value)}
                  placeholder="802.11ax / ac"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Bluetooth</label>
                <input
                  type="text"
                  value={bluetoothVersion}
                  onChange={(e) => setBluetoothVersion(e.target.value)}
                  placeholder="5.3"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Form Factor</label>
                <input
                  type="text"
                  value={formFactor}
                  onChange={(e) => setFormFactor(e.target.value)}
                  placeholder="PCIe x1 / M.2 / USB"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                />
              </div>
              <div className="flex items-end pb-1.5 sm:col-span-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={isMobile}
                    onChange={(e) => setIsMobile(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-950 text-cyan-500"
                  />
                  Laptop / Mobile Module (hidden from Desktop pickers by default)
                </label>
              </div>
            </div>
          ) : null}

          {/* Spec URL & Secondary Links */}
          <div>
            <label className="mb-1 flex items-center justify-between font-medium text-slate-300">
              <span>Canonical Spec URL</span>
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-cyan-200"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-300 uppercase">
                Secondary Research Links ({specLinks.length})
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.labelPresets.map((preset) => (
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
                  placeholder="Label"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white sm:col-span-4"
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
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-cyan-200 sm:col-span-7"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSpecLinks((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="flex justify-center rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300 sm:col-span-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-slate-400">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-3.5 py-2 font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {saving ? 'Saving...' : `Save ${meta.singular}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
