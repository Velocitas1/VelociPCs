import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Cpu as CpuIcon,
  FileCode2,
  HardDrive,
  Laptop,
  Loader2,
  Lock,
  Monitor,
  ShieldCheck,
  Sparkles,
  Star,
  Wifi,
  X,
} from 'lucide-react';
import type { ComputerUpsertPayload, DriveDraft } from '../hooks/useInventory';
import {
  applyHwinfoImport,
  computeHwinfoSwapAdjustments,
  getSlotChangeKind,
  matchTargetRig,
  resolveHwinfoReport,
  type DiffChangeKind,
  type HwinfoApplyResult,
  type HwinfoReviewSelections,
  type InventoryCatalogContext,
  type ResolvedHwinfoPlan,
} from '../lib/hwinfoMatcher';
import {
  inferDirectXFromGpu,
  type ParsedHwinfoReport,
} from '../lib/hwinfoParser';
import type { SpareAdjustment } from '../lib/parts';
import { supabase } from '../lib/supabase';
import type {
  BuildStatus,
  ComputerWithRelations,
  DeviceType,
} from '../types/database';
import { DirectXBadge } from './DirectXBadge';

interface HwinfoImportModalProps {
  open: boolean;
  report: ParsedHwinfoReport | null;
  lockedRig?: ComputerWithRelations | null;
  queuePosition?: { index: number; total: number } | null;
  catalog: InventoryCatalogContext;
  isOwner: boolean;
  onOpenAuth: () => void;
  onClose: () => void;
  onSkip?: () => void;
  onApplySuccess: (result: HwinfoApplyResult) => void;
  saveComputer: (
    payload: ComputerUpsertPayload,
    drives: DriveDraft[],
    existingId?: number,
    spareAdjustments?: SpareAdjustment[],
  ) => Promise<number>;
}

function ChangeBadge({ kind }: { kind: DiffChangeKind }) {
  if (kind === 'fill_blank') {
    return (
      <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
        Fill Blank
      </span>
    );
  }
  if (kind === 'changed') {
    return (
      <span className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
        Changed
      </span>
    );
  }
  return (
    <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
      Matches Current
    </span>
  );
}

function ResolutionBadge({
  confidence,
  referenceEnriched,
}: {
  confidence: 'exact' | 'fuzzy' | 'reference' | 'raw' | 'none';
  referenceEnriched: boolean;
}) {
  if (confidence === 'exact') {
    return (
      <span className="rounded border border-cyan-500/35 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300">
        Catalog Exact
      </span>
    );
  }
  if (confidence === 'fuzzy') {
    return (
      <span className="rounded border border-sky-500/35 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
        Catalog Fuzzy
      </span>
    );
  }
  if (referenceEnriched || confidence === 'reference') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">
        <Sparkles className="h-2.5 w-2.5" />
        Ref DB Enriched
      </span>
    );
  }
  if (confidence === 'raw') {
    return (
      <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
        HWiNFO Raw
      </span>
    );
  }
  return null;
}

export function HwinfoImportModal({
  open,
  report,
  lockedRig = null,
  queuePosition = null,
  catalog,
  isOwner,
  onOpenAuth,
  onClose,
  onSkip,
  onApplySuccess,
  saveComputer,
}: HwinfoImportModalProps) {
  const [targetLocked, setTargetLocked] = useState(Boolean(lockedRig));
  const [selectedRigId, setSelectedRigId] = useState<number | 'new'>('new');
  const [newRigName, setNewRigName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<DeviceType>('Desktop');
  const [newStatus, setNewStatus] = useState<BuildStatus>('Active');
  const [matchReason, setMatchReason] = useState('');

  const [resolving, setResolving] = useState(false);
  const [plan, setPlan] = useState<ResolvedHwinfoPlan | null>(null);
  const [selections, setSelections] = useState<HwinfoReviewSelections>({
    applyIdentity: true,
    applyCpu: true,
    applyGpu: true,
    applyGpuCard: true,
    applyIgpu: true,
    applyMotherboard: true,
    applyRam: true,
    applyWifi: true,
    applyDisplay: true,
    applyDrives: true,
    driveMode: 'replace',
  });
  const [showFilteredDrives, setShowFilteredDrives] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [uncheckedSwapKeys, setUncheckedSwapKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetRig = useMemo(() => {
    if (selectedRigId === 'new') return null;
    return catalog.computers.find((c) => c.id === selectedRigId) ?? null;
  }, [selectedRigId, catalog.computers]);

  const effectiveDeviceType: DeviceType = targetRig
    ? targetRig.device_type
    : newDeviceType;

  // Initialize target rig selection whenever modal opens or report changes
  useEffect(() => {
    if (!open || !report) return;
    setError(null);
    setShowFilteredDrives(false);
    setWarningsOpen(false);
    setUncheckedSwapKeys(new Set());

    if (lockedRig) {
      setTargetLocked(true);
      setSelectedRigId(lockedRig.id);
      setMatchReason(`Opened directly from ${lockedRig.name}`);
      setNewDeviceType(lockedRig.device_type);
      setNewRigName(lockedRig.name);
      return;
    }

    setTargetLocked(false);
    const match = matchTargetRig(report, catalog.computers);
    if (match.rig) {
      setSelectedRigId(match.rig.id);
      setMatchReason(match.reason);
      setNewDeviceType(match.rig.device_type);
      setNewRigName(match.rig.name);
    } else {
      setSelectedRigId('new');
      setMatchReason(match.reason);
      const fallbackName =
        report.computerName ||
        (report.fileName ? report.fileName.replace(/\.xml$/i, '') : '') ||
        'New Rig';
      setNewRigName(fallbackName);
      setNewDeviceType(report.detectedDeviceType);
      setNewStatus('Active');
    }
  }, [open, report, lockedRig, catalog.computers]);

  // Run 3-tier resolution when report or effectiveDeviceType changes
  useEffect(() => {
    if (!open || !report) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setResolving(true);
    resolveHwinfoReport(report, catalog, effectiveDeviceType)
      .then((resolved) => {
        if (cancelled) return;
        setPlan(resolved);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to resolve hardware.',
        );
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, report, catalog, effectiveDeviceType]);

  // Compute diff statuses against targetRig
  const diffKinds = useMemo(() => {
    if (!report || !plan) {
      return {
        identity: 'unchanged' as DiffChangeKind,
        cpu: 'unchanged' as DiffChangeKind,
        gpu: 'unchanged' as DiffChangeKind,
        gpuCard: 'unchanged' as DiffChangeKind,
        igpu: 'unchanged' as DiffChangeKind,
        motherboard: 'unchanged' as DiffChangeKind,
        ram: 'unchanged' as DiffChangeKind,
        wifi: 'unchanged' as DiffChangeKind,
        display: 'unchanged' as DiffChangeKind,
        drives: 'unchanged' as DiffChangeKind,
      };
    }

    const identityHas =
      effectiveDeviceType === 'Laptop' &&
      Boolean(report.systemManufacturer || report.systemModel);
    const identityMatches =
      Boolean(targetRig) &&
      (!report.systemManufacturer ||
        (targetRig?.brand ?? '').toLowerCase() ===
          report.systemManufacturer.toLowerCase()) &&
      (!report.systemModel ||
        (targetRig?.model ?? '').toLowerCase() ===
          report.systemModel.toLowerCase());
    const identity = getSlotChangeKind(
      identityHas,
      !targetRig?.brand && !targetRig?.model,
      identityMatches,
    );

    const cpuMatches =
      Boolean(targetRig?.cpu_id) &&
      plan.cpu.action === 'existing' &&
      targetRig?.cpu_id === plan.cpu.matchedId &&
      targetRig?.cpu_count === Math.max(1, report.cpuCount || 1);
    const cpu = getSlotChangeKind(
      Boolean(report.cpu),
      !targetRig?.cpu_id,
      cpuMatches,
    );

    const gpuMatches =
      Boolean(targetRig?.gpu_id) &&
      plan.gpu.action === 'existing' &&
      targetRig?.gpu_id === plan.gpu.matchedId;
    const gpu = getSlotChangeKind(
      Boolean(report.discreteGpu),
      !targetRig?.gpu_id,
      gpuMatches,
    );

    const gpuCardHas =
      effectiveDeviceType === 'Desktop' && Boolean(report.discreteGpu);
    const gpuCardMatches =
      Boolean(targetRig?.gpu_card_id) &&
      plan.gpuCard.action === 'existing' &&
      targetRig?.gpu_card_id === plan.gpuCard.matchedId;
    const gpuCard = getSlotChangeKind(
      gpuCardHas,
      !targetRig?.gpu_card_id && !targetRig?.gpu_aib_model,
      gpuCardMatches,
    );

    const igpuMatches =
      Boolean(targetRig?.igpu_id) &&
      plan.igpu.action === 'existing' &&
      targetRig?.igpu_id === plan.igpu.matchedId;
    const igpu = getSlotChangeKind(
      Boolean(report.integratedGpu),
      !targetRig?.igpu_id,
      igpuMatches,
    );

    const mbHas =
      effectiveDeviceType === 'Desktop' && Boolean(report.motherboard);
    const mbMatches =
      Boolean(targetRig?.motherboard_id) &&
      plan.motherboard.action === 'existing' &&
      targetRig?.motherboard_id === plan.motherboard.matchedId;
    const motherboard = getSlotChangeKind(
      mbHas,
      !targetRig?.motherboard_id && !targetRig?.motherboard_name,
      mbMatches,
    );

    const ramMatches =
      Boolean(targetRig?.ram_gb) &&
      (report.ram?.totalGb ?? null) === (targetRig?.ram_gb ?? null) &&
      (!report.ram?.ramType ||
        (targetRig?.ram_type ?? '').toLowerCase() ===
          report.ram.ramType.toLowerCase()) &&
      (!report.ram?.speedMhz ||
        targetRig?.ram_speed_mhz === report.ram.speedMhz) &&
      (effectiveDeviceType !== 'Desktop' ||
        plan.ramKit.action !== 'existing' ||
        targetRig?.ram_kit_id === plan.ramKit.matchedId);
    const ram = getSlotChangeKind(
      Boolean(report.ram),
      !targetRig?.ram_gb && !targetRig?.ram_kit_id,
      ramMatches,
    );

    const wifiMatches =
      Boolean(targetRig?.wifi_card_id) &&
      plan.wifiCard.action === 'existing' &&
      targetRig?.wifi_card_id === plan.wifiCard.matchedId;
    const wifi = getSlotChangeKind(
      Boolean(report.wifi),
      !targetRig?.wifi_card_id && !targetRig?.wifi_model,
      wifiMatches,
    );

    const displayHas =
      effectiveDeviceType === 'Laptop' &&
      Boolean(
        report.display?.screenResolution || report.display?.screenSizeInches,
      );
    const displayMatches =
      Boolean(targetRig) &&
      (!report.display?.screenResolution ||
        targetRig?.screen_resolution === report.display.screenResolution) &&
      (report.display?.screenSizeInches === null ||
        report.display?.screenSizeInches === undefined ||
        targetRig?.screen_size_inches === report.display.screenSizeInches);
    const display = getSlotChangeKind(
      displayHas,
      !targetRig?.screen_resolution && !targetRig?.screen_size_inches,
      displayMatches,
    );

    const fixedDrives = plan.drives.filter((d) => !d.drive.isRemovableOrOptical);
    const drivesHas = fixedDrives.length > 0;
    const existingDriveCount = targetRig?.storage_drives.length ?? 0;
    const drives = getSlotChangeKind(
      drivesHas,
      existingDriveCount === 0,
      false,
    );

    return {
      identity,
      cpu,
      gpu,
      gpuCard,
      igpu,
      motherboard,
      ram,
      wifi,
      display,
      drives,
    };
  }, [report, plan, targetRig, effectiveDeviceType]);

  // Apply smart default checkboxes whenever plan or targetRig changes
  useEffect(() => {
    if (!plan) return;
    setSelections((prev) => ({
      applyIdentity: diffKinds.identity !== 'unchanged',
      applyCpu: diffKinds.cpu !== 'unchanged',
      applyGpu: diffKinds.gpu !== 'unchanged',
      applyGpuCard: diffKinds.gpuCard !== 'unchanged',
      applyIgpu: diffKinds.igpu !== 'unchanged',
      applyMotherboard: diffKinds.motherboard !== 'unchanged',
      applyRam: diffKinds.ram !== 'unchanged',
      applyWifi: diffKinds.wifi !== 'unchanged',
      applyDisplay: diffKinds.display !== 'unchanged',
      applyDrives: diffKinds.drives !== 'unchanged',
      driveMode:
        targetRig && targetRig.storage_drives.length > 0
          ? prev.driveMode
          : 'replace',
    }));
  }, [plan, targetRig, diffKinds]);

  const swapItems = useMemo(() => {
    if (!plan) return [];
    return computeHwinfoSwapAdjustments(targetRig, plan, selections, catalog);
  }, [targetRig, plan, selections, catalog]);

  if (!open || !report) return null;

  const selectAllChanges = () => {
    setSelections((prev) => ({
      ...prev,
      applyIdentity: diffKinds.identity !== 'unchanged',
      applyCpu: diffKinds.cpu !== 'unchanged',
      applyGpu: diffKinds.gpu !== 'unchanged',
      applyGpuCard: diffKinds.gpuCard !== 'unchanged',
      applyIgpu: diffKinds.igpu !== 'unchanged',
      applyMotherboard: diffKinds.motherboard !== 'unchanged',
      applyRam: diffKinds.ram !== 'unchanged',
      applyWifi: diffKinds.wifi !== 'unchanged',
      applyDisplay: diffKinds.display !== 'unchanged',
      applyDrives: diffKinds.drives !== 'unchanged',
    }));
  };

  const fillBlanksOnly = () => {
    setSelections((prev) => ({
      ...prev,
      applyIdentity: diffKinds.identity === 'fill_blank',
      applyCpu: diffKinds.cpu === 'fill_blank',
      applyGpu: diffKinds.gpu === 'fill_blank',
      applyGpuCard: diffKinds.gpuCard === 'fill_blank',
      applyIgpu: diffKinds.igpu === 'fill_blank',
      applyMotherboard: diffKinds.motherboard === 'fill_blank',
      applyRam: diffKinds.ram === 'fill_blank',
      applyWifi: diffKinds.wifi === 'fill_blank',
      applyDisplay: diffKinds.display === 'fill_blank',
      applyDrives: diffKinds.drives === 'fill_blank',
    }));
  };

  const toggleSwapKey = (key: string) => {
    setUncheckedSwapKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = async () => {
    if (!plan || !isOwner) return;
    setApplying(true);
    setError(null);
    try {
      const activeSpareAdjustments: SpareAdjustment[] = swapItems
        .filter((item) => !uncheckedSwapKeys.has(item.key))
        .map((item) => ({
          table: item.table,
          id: item.id,
          delta: item.delta,
        }));

      const result = await applyHwinfoImport({
        supabase,
        saveComputer,
        catalog,
        report,
        plan,
        selections,
        targetRig,
        newRigMeta: {
          name: newRigName,
          deviceType: newDeviceType,
          status: newStatus,
        },
        spareAdjustments: activeSpareAdjustments,
      });

      onApplySuccess(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to apply HWiNFO import to Supabase.',
      );
    } finally {
      setApplying(false);
    }
  };

  const gpuCardsSorted = plan
    ? [...catalog.gpuCards].sort((a, b) => {
        const targetGpuId =
          plan.gpu.action === 'existing' ? plan.gpu.matchedId : null;
        const aMatch = targetGpuId !== null && a.gpu_id === targetGpuId ? 0 : 1;
        const bMatch = targetGpuId !== null && b.gpu_id === targetGpuId ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      })
    : catalog.gpuCards;

  const visibleDrives = plan
    ? plan.drives.filter(
        (d) => showFilteredDrives || !d.drive.isRemovableOrOptical,
      )
    : [];
  const hiddenDriveCount = plan
    ? plan.drives.filter((d) => d.drive.isRemovableOrOptical).length
    : 0;

  const detectedDiscreteDx = report.discreteGpu
    ? inferDirectXFromGpu(
        report.discreteGpu.brand,
        report.discreteGpu.name,
        report.discreteGpu.architecture,
      )
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[93vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                <FileCode2 className="h-3.5 w-3.5" />
                HWiNFO XML Diff &amp; Merge
              </span>
              {report.fileName ? (
                <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                  {report.fileName}
                </span>
              ) : null}
              {queuePosition ? (
                <span className="rounded-md border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-violet-300">
                  Report {queuePosition.index + 1} of {queuePosition.total}
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              {report.computerName ? (
                <span>
                  Host:{' '}
                  <strong className="text-slate-200">
                    {report.computerName}
                  </strong>
                </span>
              ) : null}
              {report.osName ? <span>OS: {report.osName}</span> : null}
              {report.hwinfoVersion ? (
                <span>HWiNFO {report.hwinfoVersion}</span>
              ) : null}
              {report.biosVersion ? (
                <span>
                  BIOS {report.biosVersion}
                  {report.biosDate ? ` (${report.biosDate})` : ''}
                </span>
              ) : null}
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

        {/* Body */}
        <div className="space-y-4 overflow-y-auto p-5">
          {/* Target Rig Selector */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  {effectiveDeviceType === 'Laptop' ? (
                    <Laptop className="h-4 w-4 text-violet-400" />
                  ) : (
                    <Monitor className="h-4 w-4 text-sky-400" />
                  )}
                  Target Rig
                  {targetLocked && lockedRig ? (
                    <button
                      type="button"
                      onClick={() => setTargetLocked(false)}
                      className="text-[11px] font-normal text-cyan-400 hover:underline"
                    >
                      Change target
                    </button>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {matchReason}
                </p>
              </div>

              {targetLocked && targetRig ? (
                <div className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                  {targetRig.name} ({targetRig.device_type})
                </div>
              ) : (
                <select
                  value={selectedRigId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'new') {
                      setSelectedRigId('new');
                    } else {
                      setSelectedRigId(Number(v));
                    }
                  }}
                  className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="new">
                    + Create New Rig ({report.detectedDeviceType})
                  </option>
                  {catalog.computers.map((c) => (
                    <option key={c.id} value={c.id}>
                      Update: {c.name} ({c.device_type})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedRigId === 'new' ? (
              <div className="mt-3 grid gap-3 border-t border-slate-800/80 pt-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    New Rig Name *
                  </label>
                  <input
                    type="text"
                    value={newRigName}
                    onChange={(e) => setNewRigName(e.target.value)}
                    placeholder="e.g. VelociXP"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Device Type ({report.deviceTypeReason})
                  </label>
                  <select
                    value={newDeviceType}
                    onChange={(e) =>
                      setNewDeviceType(e.target.value as DeviceType)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="Desktop">Desktop</option>
                    <option value="Laptop">Laptop</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(e.target.value as BuildStatus)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Storage">Storage</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
              </div>
            ) : null}
          </div>

          {/* Quick Selection Toolbar & Preservation Notice */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllChanges}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white"
              >
                Select All Changes
              </button>
              <button
                type="button"
                onClick={fillBlanksOnly}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-emerald-500/50 hover:text-white"
              >
                Fill Blanks Only
              </button>
            </div>

            {targetRig ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1 text-[11px] text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Preserved: PSU, Case, Cooler, Build Date, Status, Notes, 3DMark, Spec Links
              </div>
            ) : null}
          </div>

          {/* Parser Warnings */}
          {report.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
              <button
                type="button"
                onClick={() => setWarningsOpen((v) => !v)}
                className="flex w-full items-center justify-between font-medium"
              >
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  Parser Notices ({report.warnings.length})
                </span>
                {warningsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {warningsOpen ? (
                <ul className="mt-1.5 list-disc pl-5 text-[11px] text-amber-300/90">
                  {report.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {resolving || !plan ? (
            <div className="flex items-center justify-center py-14 text-xs text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-400" />
              Matching detected hardware against Supabase &amp; Reference Catalog...
            </div>
          ) : (
            <div className="space-y-3">
              {/* Laptop System Identity */}
              {effectiveDeviceType === 'Laptop' &&
              (report.systemManufacturer || report.systemModel) ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyIdentity
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={selections.applyIdentity}
                        onChange={(e) =>
                          setSelections((s) => ({
                            ...s,
                            applyIdentity: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                      />
                      <Laptop className="h-4 w-4 text-violet-400" />
                      Laptop Model
                      <ChangeBadge kind={diffKinds.identity} />
                    </label>
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-500">Current: </span>
                      {[targetRig?.brand, targetRig?.model]
                        .filter(Boolean)
                        .join(' ') || '—'}
                      <span className="mx-2 text-slate-600">→</span>
                      <span className="font-medium text-cyan-200">
                        {[report.systemManufacturer, report.systemModel]
                          .filter(Boolean)
                          .join(' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* CPU */}
              <div
                className={`rounded-xl border p-3.5 transition ${
                  selections.applyCpu
                    ? 'border-slate-700 bg-slate-950/75'
                    : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <label className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={selections.applyCpu}
                        disabled={!report.cpu}
                        onChange={(e) =>
                          setSelections((s) => ({
                            ...s,
                            applyCpu: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                      />
                      <CpuIcon className="h-4 w-4 text-cyan-400" />
                      Processor (CPU)
                      {report.cpuCount > 1 ? (
                        <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                          {report.cpuCount}x Sockets
                        </span>
                      ) : null}
                      <ChangeBadge kind={diffKinds.cpu} />
                      <ResolutionBadge
                        confidence={plan.cpu.confidence}
                        referenceEnriched={plan.cpu.referenceEnriched}
                      />
                    </label>
                    <div className="pl-6 text-[11px] text-slate-400">
                      <span>Current: </span>
                      <span className="text-slate-300">
                        {targetRig?.cpu
                          ? `${targetRig.cpu_count > 1 ? `${targetRig.cpu_count}x ` : ''}${targetRig.cpu.brand} ${targetRig.cpu.name}`
                          : '—'}
                      </span>
                      <span className="mx-1.5 text-slate-600">→</span>
                      <span className="text-cyan-200">
                        {report.cpu
                          ? `${report.cpuCount > 1 ? `${report.cpuCount}x ` : ''}${report.cpu.rawName}`
                          : 'Not detected'}
                      </span>
                    </div>
                  </div>

                  {report.cpu ? (
                    <select
                      value={
                        plan.cpu.action === 'existing' && plan.cpu.matchedId
                          ? String(plan.cpu.matchedId)
                          : 'create'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlan((prev) => {
                          if (!prev) return prev;
                          if (val === 'create') {
                            return {
                              ...prev,
                              cpu: {
                                ...prev.cpu,
                                action: 'create',
                                matchedId: null,
                              },
                            };
                          }
                          const id = Number(val);
                          const found = catalog.cpus.find((c) => c.id === id);
                          return {
                            ...prev,
                            cpu: {
                              ...prev.cpu,
                              action: 'existing',
                              matchedId: id,
                              matchLabel: found
                                ? `${found.brand} ${found.name}`
                                : prev.cpu.matchLabel,
                            },
                          };
                        });
                      }}
                      className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                    >
                      {plan.cpu.createPayload ? (
                        <option value="create">
                          + Create new: {plan.cpu.createPayload.brand}{' '}
                          {plan.cpu.createPayload.name}
                        </option>
                      ) : null}
                      {catalog.cpus.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.brand} {c.name}
                          {c.socket ? ` (${c.socket})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>

              {/* Discrete GPU */}
              {report.discreteGpu ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyGpu
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold text-white">
                        <input
                          type="checkbox"
                          checked={selections.applyGpu}
                          onChange={(e) =>
                            setSelections((s) => ({
                              ...s,
                              applyGpu: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                        />
                        <Monitor className="h-4 w-4 text-emerald-400" />
                        Discrete GPU (Silicon)
                        <ChangeBadge kind={diffKinds.gpu} />
                        <ResolutionBadge
                          confidence={plan.gpu.confidence}
                          referenceEnriched={plan.gpu.referenceEnriched}
                        />
                        {detectedDiscreteDx?.directx_version ? (
                          <DirectXBadge
                            version={
                              plan.gpu.createPayload?.directx_version ??
                              detectedDiscreteDx.directx_version
                            }
                            featureLevel={
                              plan.gpu.createPayload?.directx_feature_level ??
                              detectedDiscreteDx.directx_feature_level
                            }
                            compact
                          />
                        ) : null}
                      </label>
                      <div className="pl-6 text-[11px] text-slate-400">
                        <span>Current: </span>
                        <span className="text-slate-300">
                          {targetRig?.gpu
                            ? `${targetRig.gpu.brand} ${targetRig.gpu.name}`
                            : '—'}
                        </span>
                        <span className="mx-1.5 text-slate-600">→</span>
                        <span className="text-cyan-200">
                          {report.discreteGpu.rawChipset}
                          {report.discreteGpu.vramGb
                            ? ` (${report.discreteGpu.vramGb} GB)`
                            : ''}
                        </span>
                      </div>
                    </div>

                    <select
                      value={
                        plan.gpu.action === 'existing' && plan.gpu.matchedId
                          ? String(plan.gpu.matchedId)
                          : 'create'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlan((prev) => {
                          if (!prev) return prev;
                          if (val === 'create') {
                            return {
                              ...prev,
                              gpu: {
                                ...prev.gpu,
                                action: 'create',
                                matchedId: null,
                              },
                            };
                          }
                          const id = Number(val);
                          const found = catalog.gpus.find((g) => g.id === id);
                          return {
                            ...prev,
                            gpu: {
                              ...prev.gpu,
                              action: 'existing',
                              matchedId: id,
                              matchLabel: found
                                ? `${found.brand} ${found.name}`
                                : prev.gpu.matchLabel,
                            },
                          };
                        });
                      }}
                      className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                    >
                      {plan.gpu.createPayload ? (
                        <option value="create">
                          + Create new: {plan.gpu.createPayload.brand}{' '}
                          {plan.gpu.createPayload.name}
                        </option>
                      ) : null}
                      {catalog.gpus.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.brand} {g.name}
                          {g.is_mobile ? ' (Mobile)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {/* GPU AIB Card (Desktop only) */}
              {effectiveDeviceType === 'Desktop' && report.discreteGpu ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyGpuCard
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold text-white">
                        <input
                          type="checkbox"
                          checked={selections.applyGpuCard}
                          onChange={(e) =>
                            setSelections((s) => ({
                              ...s,
                              applyGpuCard: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                        />
                        GPU Board Partner / Card
                        <ChangeBadge kind={diffKinds.gpuCard} />
                        <ResolutionBadge
                          confidence={plan.gpuCard.confidence}
                          referenceEnriched={plan.gpuCard.referenceEnriched}
                        />
                        {report.discreteGpu.pciSubsysVendorId ? (
                          <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                            Subsys {report.discreteGpu.pciSubsysVendorId}:
                            {report.discreteGpu.pciSubsysDeviceId ?? '0000'}
                            {report.discreteGpu.aibManufacturer
                              ? ` → ${report.discreteGpu.aibManufacturer}`
                              : ''}
                          </span>
                        ) : null}
                      </label>
                      <div className="pl-6 text-[11px] text-slate-400">
                        <span>Current: </span>
                        <span className="text-slate-300">
                          {targetRig?.gpu_card
                            ? `${targetRig.gpu_card.brand} ${targetRig.gpu_card.model}`
                            : [
                                  targetRig?.gpu_aib_manufacturer,
                                  targetRig?.gpu_aib_model,
                                ]
                                  .filter(Boolean)
                                  .join(' ') || '—'}
                        </span>
                        <span className="mx-1.5 text-slate-600">→</span>
                        <span className="text-cyan-200">
                          {[
                            report.discreteGpu.aibManufacturer ||
                              report.discreteGpu.brand,
                            report.discreteGpu.aibModel || 'Reference',
                          ].join(' ')}
                        </span>
                      </div>
                    </div>

                    <select
                      value={
                        plan.gpuCard.action === 'existing' &&
                        plan.gpuCard.matchedId
                          ? String(plan.gpuCard.matchedId)
                          : 'create'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlan((prev) => {
                          if (!prev) return prev;
                          if (val === 'create') {
                            return {
                              ...prev,
                              gpuCard: {
                                ...prev.gpuCard,
                                action: 'create',
                                matchedId: null,
                              },
                            };
                          }
                          const id = Number(val);
                          const found = catalog.gpuCards.find(
                            (c) => c.id === id,
                          );
                          return {
                            ...prev,
                            gpuCard: {
                              ...prev.gpuCard,
                              action: 'existing',
                              matchedId: id,
                              matchLabel: found
                                ? `${found.brand} ${found.model}`
                                : prev.gpuCard.matchLabel,
                            },
                          };
                        });
                      }}
                      className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                    >
                      {plan.gpuCard.createPayload ? (
                        <option value="create">
                          + Create new: {plan.gpuCard.createPayload.brand}{' '}
                          {plan.gpuCard.createPayload.model}
                        </option>
                      ) : null}
                      {gpuCardsSorted.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.brand} {c.model}
                          {c.gpu ? ` (${c.gpu.name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {/* Integrated GPU */}
              {report.integratedGpu ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyIgpu
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold text-white">
                        <input
                          type="checkbox"
                          checked={selections.applyIgpu}
                          onChange={(e) =>
                            setSelections((s) => ({
                              ...s,
                              applyIgpu: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                        />
                        Integrated GPU (iGPU)
                        <ChangeBadge kind={diffKinds.igpu} />
                        <ResolutionBadge
                          confidence={plan.igpu.confidence}
                          referenceEnriched={plan.igpu.referenceEnriched}
                        />
                      </label>
                      <div className="pl-6 text-[11px] text-slate-400">
                        <span>Current: </span>
                        <span className="text-slate-300">
                          {targetRig?.igpu
                            ? `${targetRig.igpu.brand} ${targetRig.igpu.name}`
                            : '—'}
                        </span>
                        <span className="mx-1.5 text-slate-600">→</span>
                        <span className="text-cyan-200">
                          {report.integratedGpu.rawChipset}
                        </span>
                      </div>
                    </div>

                    <select
                      value={
                        plan.igpu.action === 'existing' && plan.igpu.matchedId
                          ? String(plan.igpu.matchedId)
                          : 'create'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlan((prev) => {
                          if (!prev) return prev;
                          if (val === 'create') {
                            return {
                              ...prev,
                              igpu: {
                                ...prev.igpu,
                                action: 'create',
                                matchedId: null,
                              },
                            };
                          }
                          const id = Number(val);
                          return {
                            ...prev,
                            igpu: {
                              ...prev.igpu,
                              action: 'existing',
                              matchedId: id,
                            },
                          };
                        });
                      }}
                      className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                    >
                      {plan.igpu.createPayload ? (
                        <option value="create">
                          + Create new: {plan.igpu.createPayload.brand}{' '}
                          {plan.igpu.createPayload.name}
                        </option>
                      ) : null}
                      {catalog.gpus.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.brand} {g.name}
                          {g.is_mobile ? ' (Mobile)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {/* Motherboard (Desktop only) */}
              {effectiveDeviceType === 'Desktop' && report.motherboard ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyMotherboard
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold text-white">
                        <input
                          type="checkbox"
                          checked={selections.applyMotherboard}
                          onChange={(e) =>
                            setSelections((s) => ({
                              ...s,
                              applyMotherboard: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                        />
                        Motherboard
                        <ChangeBadge kind={diffKinds.motherboard} />
                        <ResolutionBadge
                          confidence={plan.motherboard.confidence}
                          referenceEnriched={plan.motherboard.referenceEnriched}
                        />
                      </label>
                      <div className="pl-6 text-[11px] text-slate-400">
                        <span>Current: </span>
                        <span className="text-slate-300">
                          {[
                            targetRig?.motherboard_brand,
                            targetRig?.motherboard_name,
                          ]
                            .filter(Boolean)
                            .join(' ') || '—'}
                        </span>
                        <span className="mx-1.5 text-slate-600">→</span>
                        <span className="text-cyan-200">
                          {report.motherboard.brand} {report.motherboard.model}
                          {report.motherboard.chipset
                            ? ` (${report.motherboard.chipset})`
                            : ''}
                        </span>
                      </div>
                    </div>

                    <select
                      value={
                        plan.motherboard.action === 'existing' &&
                        plan.motherboard.matchedId
                          ? String(plan.motherboard.matchedId)
                          : 'create'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlan((prev) => {
                          if (!prev) return prev;
                          if (val === 'create') {
                            return {
                              ...prev,
                              motherboard: {
                                ...prev.motherboard,
                                action: 'create',
                                matchedId: null,
                              },
                            };
                          }
                          const id = Number(val);
                          return {
                            ...prev,
                            motherboard: {
                              ...prev.motherboard,
                              action: 'existing',
                              matchedId: id,
                            },
                          };
                        });
                      }}
                      className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                    >
                      {plan.motherboard.createPayload ? (
                        <option value="create">
                          + Create new: {plan.motherboard.createPayload.brand}{' '}
                          {plan.motherboard.createPayload.model}
                        </option>
                      ) : null}
                      {catalog.motherboards.map((mb) => (
                        <option key={mb.id} value={mb.id}>
                          {mb.brand} {mb.model}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {/* Memory (RAM) */}
              {report.ram ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyRam
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold text-white">
                        <input
                          type="checkbox"
                          checked={selections.applyRam}
                          onChange={(e) =>
                            setSelections((s) => ({
                              ...s,
                              applyRam: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                        />
                        Memory (RAM)
                        <ChangeBadge kind={diffKinds.ram} />
                        <ResolutionBadge
                          confidence={plan.ramKit.confidence}
                          referenceEnriched={plan.ramKit.referenceEnriched}
                        />
                      </label>
                      <div className="pl-6 text-[11px] text-slate-400">
                        <span>Current: </span>
                        <span className="font-mono text-slate-300">
                          {[
                            targetRig?.ram_gb ? `${targetRig.ram_gb} GB` : null,
                            targetRig?.ram_type,
                            targetRig?.ram_speed_mhz
                              ? `@ ${targetRig.ram_speed_mhz} MHz`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' ') || '—'}
                        </span>
                        <span className="mx-1.5 text-slate-600">→</span>
                        <span className="font-mono text-cyan-200">
                          {[
                            report.ram.totalGb
                              ? `${report.ram.totalGb} GB`
                              : null,
                            report.ram.modulesCount
                              ? `(${report.ram.modulesCount} DIMMs)`
                              : null,
                            report.ram.ramType,
                            report.ram.speedMhz
                              ? `@ ${report.ram.speedMhz} MHz`
                              : null,
                            report.ram.pcRating,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        </span>
                      </div>
                    </div>

                    {effectiveDeviceType === 'Desktop' ? (
                      <select
                        value={
                          plan.ramKit.action === 'existing' &&
                          plan.ramKit.matchedId
                            ? String(plan.ramKit.matchedId)
                            : 'create'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlan((prev) => {
                            if (!prev) return prev;
                            if (val === 'create') {
                              return {
                                ...prev,
                                ramKit: {
                                  ...prev.ramKit,
                                  action: 'create',
                                  matchedId: null,
                                },
                              };
                            }
                            const id = Number(val);
                            return {
                              ...prev,
                              ramKit: {
                                ...prev.ramKit,
                                action: 'existing',
                                matchedId: id,
                              },
                            };
                          });
                        }}
                        className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      >
                        {plan.ramKit.createPayload ? (
                          <option value="create">
                            + Create new:{' '}
                            {[
                              plan.ramKit.createPayload.brand,
                              plan.ramKit.createPayload.model,
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          </option>
                        ) : null}
                        {catalog.ramKits.map((k) => (
                          <option key={k.id} value={k.id}>
                            {[k.brand, k.model].filter(Boolean).join(' ')}
                            {k.capacity_gb ? ` (${k.capacity_gb}GB)` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        Saved inline on Laptop
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Wi-Fi */}
              {report.wifi ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyWifi
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold text-white">
                        <input
                          type="checkbox"
                          checked={selections.applyWifi}
                          onChange={(e) =>
                            setSelections((s) => ({
                              ...s,
                              applyWifi: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                        />
                        <Wifi className="h-4 w-4 text-violet-400" />
                        Wi-Fi Adapter
                        <ChangeBadge kind={diffKinds.wifi} />
                        <ResolutionBadge
                          confidence={plan.wifiCard.confidence}
                          referenceEnriched={plan.wifiCard.referenceEnriched}
                        />
                      </label>
                      <div className="pl-6 text-[11px] text-slate-400">
                        <span>Current: </span>
                        <span className="text-slate-300">
                          {[targetRig?.wifi_brand, targetRig?.wifi_model]
                            .filter(Boolean)
                            .join(' ') || '—'}
                        </span>
                        <span className="mx-1.5 text-slate-600">→</span>
                        <span className="text-cyan-200">
                          {report.wifi.rawName}
                        </span>
                      </div>
                    </div>

                    <select
                      value={
                        plan.wifiCard.action === 'existing' &&
                        plan.wifiCard.matchedId
                          ? String(plan.wifiCard.matchedId)
                          : 'create'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlan((prev) => {
                          if (!prev) return prev;
                          if (val === 'create') {
                            return {
                              ...prev,
                              wifiCard: {
                                ...prev.wifiCard,
                                action: 'create',
                                matchedId: null,
                              },
                            };
                          }
                          const id = Number(val);
                          return {
                            ...prev,
                            wifiCard: {
                              ...prev.wifiCard,
                              action: 'existing',
                              matchedId: id,
                            },
                          };
                        });
                      }}
                      className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                    >
                      {plan.wifiCard.createPayload ? (
                        <option value="create">
                          + Create new: {plan.wifiCard.createPayload.brand}{' '}
                          {plan.wifiCard.createPayload.model}
                        </option>
                      ) : null}
                      {catalog.wifiCards.map((w) => (
                        <option key={w.id} value={w.id}>
                          {[w.brand, w.product, w.model]
                            .filter(Boolean)
                            .join(' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {/* Laptop Display */}
              {effectiveDeviceType === 'Laptop' &&
              (report.display?.screenResolution ||
                report.display?.screenSizeInches) ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyDisplay
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={selections.applyDisplay}
                        onChange={(e) =>
                          setSelections((s) => ({
                            ...s,
                            applyDisplay: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                      />
                      Laptop Display
                      <ChangeBadge kind={diffKinds.display} />
                    </label>
                    <div className="font-mono text-xs text-slate-300">
                      <span className="text-slate-500">Current: </span>
                      {[
                        targetRig?.screen_size_inches
                          ? `${targetRig.screen_size_inches}"`
                          : null,
                        targetRig?.screen_resolution,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                      <span className="mx-2 text-slate-600">→</span>
                      <span className="text-cyan-200">
                        {[
                          report.display?.screenSizeInches
                            ? `${report.display.screenSizeInches}"`
                            : null,
                          report.display?.screenResolution,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Storage Drives */}
              {plan.drives.length > 0 ? (
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selections.applyDrives
                      ? 'border-slate-700 bg-slate-950/75'
                      : 'border-slate-800/70 bg-slate-950/30 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={selections.applyDrives}
                        onChange={(e) =>
                          setSelections((s) => ({
                            ...s,
                            applyDrives: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                      />
                      <HardDrive className="h-4 w-4 text-amber-400" />
                      Storage Drives ({visibleDrives.length})
                      <ChangeBadge kind={diffKinds.drives} />
                    </label>

                    {targetRig && targetRig.storage_drives.length > 0 ? (
                      <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setSelections((s) => ({
                              ...s,
                              driveMode: 'replace',
                            }))
                          }
                          className={`rounded-md px-2 py-0.5 transition ${
                            selections.driveMode === 'replace'
                              ? 'bg-cyan-500/20 font-medium text-cyan-200'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Replace existing ({targetRig.storage_drives.length})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelections((s) => ({
                              ...s,
                              driveMode: 'append',
                            }))
                          }
                          className={`rounded-md px-2 py-0.5 transition ${
                            selections.driveMode === 'append'
                              ? 'bg-cyan-500/20 font-medium text-cyan-200'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Append missing
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {visibleDrives.map((item) => {
                      const idx = plan.drives.indexOf(item);
                      return (
                        <div
                          key={`${item.drive.rawModel}-${idx}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              disabled={!selections.applyDrives}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPlan((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    drives: prev.drives.map((d, i) =>
                                      i === idx ? { ...d, checked } : d,
                                    ),
                                  };
                                });
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-cyan-500"
                            />
                            <button
                              type="button"
                              title={
                                item.isPrimary
                                  ? 'Primary boot drive'
                                  : 'Mark as primary drive'
                              }
                              onClick={() => {
                                setPlan((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    drives: prev.drives.map((d, i) => ({
                                      ...d,
                                      isPrimary: i === idx,
                                    })),
                                  };
                                });
                              }}
                              className={`rounded p-0.5 ${
                                item.isPrimary
                                  ? 'text-amber-400'
                                  : 'text-slate-600 hover:text-slate-300'
                              }`}
                            >
                              <Star
                                className="h-3.5 w-3.5"
                                fill={item.isPrimary ? 'currentColor' : 'none'}
                              />
                            </button>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-200">
                                <span className="truncate">
                                  {item.drive.rawModel}
                                </span>
                                {item.drive.capacityGb ? (
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                                    {item.drive.capacityGb >= 1000 &&
                                    item.drive.capacityGb % 1000 === 0
                                      ? `${item.drive.capacityGb / 1000} TB`
                                      : `${item.drive.capacityGb} GB`}
                                  </span>
                                ) : null}
                                {item.drive.formFactor ? (
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                                    {item.drive.formFactor}
                                  </span>
                                ) : null}
                                {item.drive.filterReason ? (
                                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                                    {item.drive.filterReason}
                                  </span>
                                ) : null}
                                <ResolutionBadge
                                  confidence={item.resolution.confidence}
                                  referenceEnriched={
                                    item.resolution.referenceEnriched
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <select
                            disabled={!selections.applyDrives || !item.checked}
                            value={
                              item.resolution.action === 'existing' &&
                              item.resolution.matchedId
                                ? String(item.resolution.matchedId)
                                : 'create'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              setPlan((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  drives: prev.drives.map((d, i) => {
                                    if (i !== idx) return d;
                                    if (val === 'create') {
                                      return {
                                        ...d,
                                        resolution: {
                                          ...d.resolution,
                                          action: 'create',
                                          matchedId: null,
                                        },
                                      };
                                    }
                                    return {
                                      ...d,
                                      resolution: {
                                        ...d.resolution,
                                        action: 'existing',
                                        matchedId: Number(val),
                                      },
                                    };
                                  }),
                                };
                              });
                            }}
                            className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                          >
                            {item.resolution.createPayload ? (
                              <option value="create">
                                + Create new:{' '}
                                {[
                                  item.resolution.createPayload.brand,
                                  item.resolution.createPayload.model,
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              </option>
                            ) : null}
                            {catalog.storageDriveModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {[
                                  m.capacity_gb ? `${m.capacity_gb}GB` : null,
                                  m.brand,
                                  m.model,
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}

                    {hiddenDriveCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowFilteredDrives((v) => !v)}
                        className="text-[11px] text-slate-400 hover:text-cyan-300"
                      >
                        {showFilteredDrives
                          ? 'Hide filtered USB / optical drives'
                          : `Show ${hiddenDriveCount} filtered USB / optical drive${hiddenDriveCount === 1 ? '' : 's'}`}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Desktop Swap-to-Spare Updates */}
              {swapItems.length > 0 ? (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                    <ArrowRightLeft className="h-4 w-4 text-amber-400" />
                    Desktop Swap-to-Spare Inventory Updates
                  </div>
                  <p className="mt-0.5 text-[11px] text-amber-200/80">
                    Removed parts return to spare inventory (+1); existing catalog parts installed into this rig decrement spare count (-1).
                  </p>
                  <div className="mt-2.5 space-y-1.5">
                    {swapItems.map((item) => {
                      const checked = !uncheckedSwapKeys.has(item.key);
                      const projected = Math.max(
                        0,
                        item.currentSpare + item.delta,
                      );
                      return (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-slate-950/60 px-3 py-1.5 text-xs"
                        >
                          <span className="flex items-center gap-2 text-slate-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSwapKey(item.key)}
                              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-amber-500"
                            />
                            <span className="text-slate-400">
                              {item.slotLabel}:
                            </span>
                            <span className="font-medium text-white">
                              {item.partLabel}
                            </span>
                          </span>
                          <span
                            className={`font-mono text-[11px] font-semibold ${
                              item.delta > 0
                                ? 'text-emerald-300'
                                : 'text-amber-300'
                            }`}
                          >
                            {item.delta > 0 ? `+${item.delta}` : item.delta}{' '}
                            spare ({item.currentSpare} → {projected})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/60 px-5 py-3.5">
          <div className="text-[11px] text-slate-400">
            {targetRig
              ? `Updating existing ${targetRig.device_type}: ${targetRig.name}`
              : `Creating new ${newDeviceType}: ${newRigName || 'Untitled'}`}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                disabled={applying}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Skip Report
              </button>
            ) : null}

            {isOwner ? (
              <button
                type="button"
                disabled={applying || resolving || !plan}
                onClick={() => void handleApply()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              >
                {applying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving to Supabase...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    {queuePosition &&
                    queuePosition.index + 1 < queuePosition.total
                      ? targetRig
                        ? 'Apply & Next'
                        : 'Create Rig & Next'
                      : targetRig
                        ? 'Apply Changes'
                        : 'Create Rig'}
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
              >
                <Lock className="h-3.5 w-3.5" />
                Sign In as Owner to Apply
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
