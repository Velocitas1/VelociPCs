import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type {
  BuildStatus,
  ComputerWithRelations,
  Cpu,
  DeviceType,
  Gpu,
} from '../types/database';
import type { ComputerUpsertPayload, DriveDraft } from '../hooks/useInventory';
import { PartCombobox } from './PartCombobox';

interface ComputerFormModalProps {
  open: boolean;
  editingRig: ComputerWithRelations | null;
  cpus: Cpu[];
  gpus: Gpu[];
  onClose: () => void;
  onSave: (
    payload: ComputerUpsertPayload,
    drives: DriveDraft[],
    existingId?: number,
  ) => Promise<number>;
  onOpenPartLookup: (
    partType: 'cpu' | 'gpu',
    mode: 'search' | 'manual',
    initialQuery: string,
    targetField: 'cpu_id' | 'gpu_id' | 'igpu_id',
  ) => void;
  recentlyCreatedPart?: {
    targetField: 'cpu_id' | 'gpu_id' | 'igpu_id';
    id: number;
  } | null;
}

function intOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function floatOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function ComputerFormModal({
  open,
  editingRig,
  cpus,
  gpus,
  onClose,
  onSave,
  onOpenPartLookup,
  recentlyCreatedPart,
}: ComputerFormModalProps) {
  const [name, setName] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>('Desktop');
  const [status, setStatus] = useState<BuildStatus>('Active');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [buildDate, setBuildDate] = useState('');
  const [overallRank, setOverallRank] = useState('');
  const [notes, setNotes] = useState('');

  const [cpuId, setCpuId] = useState<number | null>(null);
  const [cpuCount, setCpuCount] = useState('1');
  const [gpuId, setGpuId] = useState<number | null>(null);
  const [gpuAibMfg, setGpuAibMfg] = useState('');
  const [gpuAibModel, setGpuAibModel] = useState('');
  const [igpuId, setIgpuId] = useState<number | null>(null);

  const [mbName, setMbName] = useState('');
  const [mbBrand, setMbBrand] = useState('');
  const [mbLaunch, setMbLaunch] = useState('');

  const [ramGb, setRamGb] = useState('');
  const [ramSpeed, setRamSpeed] = useState('');
  const [ramType, setRamType] = useState('');
  const [ramPc, setRamPc] = useState('');

  const [psuWattage, setPsuWattage] = useState('');
  const [psuBrand, setPsuBrand] = useState('');
  const [psu8Pin, setPsu8Pin] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [psu6Pin, setPsu6Pin] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [powerAdapterNotes, setPowerAdapterNotes] = useState('');

  const [screenSize, setScreenSize] = useState('');
  const [screenRes, setScreenRes] = useState('');
  const [weightLbs, setWeightLbs] = useState('');

  const [wifiBrand, setWifiBrand] = useState('');
  const [wifiProduct, setWifiProduct] = useState('');
  const [wifiModel, setWifiModel] = useState('');
  const [wifiStandard, setWifiStandard] = useState('');
  const [bluetooth, setBluetooth] = useState('');

  const [drives, setDrives] = useState<DriveDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingRig) {
      setName(editingRig.name);
      setDeviceType(editingRig.device_type);
      setStatus(editingRig.status);
      setBrand(editingRig.brand ?? '');
      setModel(editingRig.model ?? '');
      setBuildDate(editingRig.build_date ?? '');
      setOverallRank(editingRig.overall_rank?.toString() ?? '');
      setNotes(editingRig.notes ?? '');
      setCpuId(editingRig.cpu_id);
      setCpuCount(editingRig.cpu_count.toString());
      setGpuId(editingRig.gpu_id);
      setGpuAibMfg(editingRig.gpu_aib_manufacturer ?? '');
      setGpuAibModel(editingRig.gpu_aib_model ?? '');
      setIgpuId(editingRig.igpu_id);
      setMbName(editingRig.motherboard_name ?? '');
      setMbBrand(editingRig.motherboard_brand ?? '');
      setMbLaunch(editingRig.motherboard_launch ?? '');
      setRamGb(editingRig.ram_gb?.toString() ?? '');
      setRamSpeed(editingRig.ram_speed_mhz?.toString() ?? '');
      setRamType(editingRig.ram_type ?? '');
      setRamPc(editingRig.ram_pc_rating ?? '');
      setPsuWattage(editingRig.psu_wattage?.toString() ?? '');
      setPsuBrand(editingRig.psu_brand ?? '');
      setPsu8Pin(
        editingRig.psu_has_8pin_cpu === null
          ? 'unknown'
          : editingRig.psu_has_8pin_cpu
            ? 'yes'
            : 'no',
      );
      setPsu6Pin(
        editingRig.psu_has_6pin_pcie === null
          ? 'unknown'
          : editingRig.psu_has_6pin_pcie
            ? 'yes'
            : 'no',
      );
      setPowerAdapterNotes(editingRig.power_adapter_notes ?? '');
      setScreenSize(editingRig.screen_size_inches?.toString() ?? '');
      setScreenRes(editingRig.screen_resolution ?? '');
      setWeightLbs(editingRig.weight_lbs?.toString() ?? '');
      setWifiBrand(editingRig.wifi_brand ?? '');
      setWifiProduct(editingRig.wifi_product ?? '');
      setWifiModel(editingRig.wifi_model ?? '');
      setWifiStandard(editingRig.wifi_standard ?? '');
      setBluetooth(editingRig.bluetooth_version ?? '');
      setDrives(
        editingRig.storage_drives.map((d) => ({
          id: d.id,
          capacity_gb: d.capacity_gb,
          form_factor: d.form_factor,
          brand: d.brand,
          model: d.model,
          model_number: d.model_number,
          nand_type: d.nand_type,
          read_mb_s: d.read_mb_s,
          write_mb_s: d.write_mb_s,
          is_primary: d.is_primary,
        })),
      );
    } else {
      setName('');
      setDeviceType('Desktop');
      setStatus('Active');
      setBrand('');
      setModel('');
      setBuildDate('');
      setOverallRank('');
      setNotes('');
      setCpuId(null);
      setCpuCount('1');
      setGpuId(null);
      setGpuAibMfg('');
      setGpuAibModel('');
      setIgpuId(null);
      setMbName('');
      setMbBrand('');
      setMbLaunch('');
      setRamGb('');
      setRamSpeed('');
      setRamType('');
      setRamPc('');
      setPsuWattage('');
      setPsuBrand('');
      setPsu8Pin('unknown');
      setPsu6Pin('unknown');
      setPowerAdapterNotes('');
      setScreenSize('');
      setScreenRes('');
      setWeightLbs('');
      setWifiBrand('');
      setWifiProduct('');
      setWifiModel('');
      setWifiStandard('');
      setBluetooth('');
      setDrives([
        {
          capacity_gb: null,
          form_factor: 'NVMe',
          brand: '',
          model: '',
          model_number: null,
          nand_type: null,
          read_mb_s: null,
          write_mb_s: null,
          is_primary: true,
        },
      ]);
    }
  }, [open, editingRig]);

  useEffect(() => {
    if (!recentlyCreatedPart) return;
    if (recentlyCreatedPart.targetField === 'cpu_id') {
      setCpuId(recentlyCreatedPart.id);
    } else if (recentlyCreatedPart.targetField === 'gpu_id') {
      setGpuId(recentlyCreatedPart.id);
    } else if (recentlyCreatedPart.targetField === 'igpu_id') {
      setIgpuId(recentlyCreatedPart.id);
    }
  }, [recentlyCreatedPart]);

  if (!open) return null;

  const isLaptop = deviceType === 'Laptop';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Rig name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          name: name.trim(),
          device_type: deviceType,
          brand: brand.trim() || null,
          model: model.trim() || null,
          build_date: buildDate.trim() || null,
          overall_rank: intOrNull(overallRank),
          status,
          notes: notes.trim() || null,
          cpu_id: cpuId,
          cpu_count: Math.max(1, intOrNull(cpuCount) ?? 1),
          gpu_id: gpuId,
          gpu_aib_manufacturer: gpuAibMfg.trim() || null,
          gpu_aib_model: gpuAibModel.trim() || null,
          igpu_id: igpuId,
          motherboard_name: mbName.trim() || null,
          motherboard_brand: mbBrand.trim() || null,
          motherboard_launch: mbLaunch.trim() || null,
          ram_gb: intOrNull(ramGb),
          ram_speed_mhz: intOrNull(ramSpeed),
          ram_type: ramType.trim() || null,
          ram_pc_rating: ramPc.trim() || null,
          psu_wattage: intOrNull(psuWattage),
          psu_brand: psuBrand.trim() || null,
          psu_has_8pin_cpu:
            psu8Pin === 'unknown' ? null : psu8Pin === 'yes',
          psu_has_6pin_pcie:
            psu6Pin === 'unknown' ? null : psu6Pin === 'yes',
          power_adapter_notes: powerAdapterNotes.trim() || null,
          screen_size_inches: floatOrNull(screenSize),
          screen_resolution: screenRes.trim() || null,
          weight_lbs: floatOrNull(weightLbs),
          wifi_brand: wifiBrand.trim() || null,
          wifi_product: wifiProduct.trim() || null,
          wifi_model: wifiModel.trim() || null,
          wifi_codename: editingRig?.wifi_codename ?? null,
          wifi_launch_date: editingRig?.wifi_launch_date ?? null,
          wifi_antenna: editingRig?.wifi_antenna ?? null,
          wifi_bands: editingRig?.wifi_bands ?? null,
          wifi_max_speed: editingRig?.wifi_max_speed ?? null,
          wifi_standard: wifiStandard.trim() || null,
          bluetooth_version: bluetooth.trim() || null,
          wifi_form_factor: editingRig?.wifi_form_factor ?? null,
        },
        drives,
        editingRig?.id,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rig.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-white">
            {editingRig ? `Edit ${editingRig.name}` : 'Add Computer / Laptop'}
          </h2>
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
          className="space-y-5 overflow-y-auto p-5 text-xs"
        >
          {/* Identity */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium text-slate-300">
                Rig Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. VelociCool or VelociG14"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">
                Device Type
              </label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="Desktop">Desktop</option>
                <option value="Laptop">Laptop</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BuildStatus)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="Active">Active</option>
                <option value="Storage">Storage</option>
                <option value="In Progress">In Progress</option>
                <option value="Retired">Retired</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-slate-400">
                System Brand (OEM)
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={isLaptop ? 'ASUS / Dell / Lenovo' : 'Optional'}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">System Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Build Date</label>
              <input
                type="date"
                value={buildDate}
                onChange={(e) => setBuildDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Overall Rank</label>
              <input
                type="number"
                value={overallRank}
                onChange={(e) => setOverallRank(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Core Source-of-Truth Parts */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="font-semibold text-cyan-300 uppercase">
              Source-of-Truth CPU &amp; GPU Selection
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-3">
                <PartCombobox
                  partType="cpu"
                  label="Processor (CPU)"
                  parts={cpus}
                  selectedId={cpuId}
                  onSelect={setCpuId}
                  onOpenLookup={(mode, q) =>
                    onOpenPartLookup('cpu', mode, q, 'cpu_id')
                  }
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  CPU Count
                </label>
                <input
                  type="number"
                  min={1}
                  value={cpuCount}
                  onChange={(e) => setCpuCount(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <PartCombobox
                partType="gpu"
                label="Primary Graphics Card (GPU)"
                parts={gpus}
                selectedId={gpuId}
                onSelect={setGpuId}
                onOpenLookup={(mode, q) =>
                  onOpenPartLookup('gpu', mode, q, 'gpu_id')
                }
              />
              <PartCombobox
                partType="gpu"
                label="Integrated / Secondary GPU (Optional)"
                parts={gpus}
                selectedId={igpuId}
                onSelect={setIgpuId}
                onOpenLookup={(mode, q) =>
                  onOpenPartLookup('gpu', mode, q, 'igpu_id')
                }
                placeholder="Optional iGPU..."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-slate-400">
                  GPU Board Partner / Manufacturer
                </label>
                <input
                  type="text"
                  value={gpuAibMfg}
                  onChange={(e) => setGpuAibMfg(e.target.value)}
                  placeholder="ASUS / EVGA / Sapphire / PowerColor"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">
                  GPU Board Model Number
                </label>
                <input
                  type="text"
                  value={gpuAibModel}
                  onChange={(e) => setGpuAibModel(e.target.value)}
                  placeholder="STRIX-GTX970-DC2OC-4GD5"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                />
              </div>
            </div>
          </div>

          {/* Memory */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-slate-400">RAM (GB)</label>
              <input
                type="number"
                value={ramGb}
                onChange={(e) => setRamGb(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">
                RAM Speed (MHz)
              </label>
              <input
                type="number"
                value={ramSpeed}
                onChange={(e) => setRamSpeed(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">RAM Type</label>
              <input
                type="text"
                value={ramType}
                onChange={(e) => setRamType(e.target.value)}
                placeholder="DDR4 / DDR3 / LPDDR5X"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">PC Rating</label>
              <input
                type="text"
                value={ramPc}
                onChange={(e) => setRamPc(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Device-specific Section */}
          {!isLaptop ? (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="font-semibold text-sky-300 uppercase">
                Desktop Motherboard &amp; Power Supply
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-slate-400">
                    Motherboard Brand
                  </label>
                  <input
                    type="text"
                    value={mbBrand}
                    onChange={(e) => setMbBrand(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">
                    Motherboard Model
                  </label>
                  <input
                    type="text"
                    value={mbName}
                    onChange={(e) => setMbName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">
                    Motherboard Launch
                  </label>
                  <input
                    type="text"
                    value={mbLaunch}
                    onChange={(e) => setMbLaunch(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">
                    PSU Wattage (W)
                  </label>
                  <input
                    type="number"
                    value={psuWattage}
                    onChange={(e) => setPsuWattage(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">PSU Brand</label>
                  <input
                    type="text"
                    value={psuBrand}
                    onChange={(e) => setPsuBrand(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-slate-400">8-pin CPU</label>
                    <select
                      value={psu8Pin}
                      onChange={(e) =>
                        setPsu8Pin(e.target.value as 'unknown' | 'yes' | 'no')
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
                      value={psu6Pin}
                      onChange={(e) =>
                        setPsu6Pin(e.target.value as 'unknown' | 'yes' | 'no')
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                    >
                      <option value="unknown">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="font-semibold text-violet-300 uppercase">
                Laptop Display, Weight, Power &amp; Wireless
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-slate-400">
                    Screen (inches)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={screenSize}
                    onChange={(e) => setScreenSize(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">
                    Resolution
                  </label>
                  <input
                    type="text"
                    value={screenRes}
                    onChange={(e) => setScreenRes(e.target.value)}
                    placeholder="1920 x 1080"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={weightLbs}
                    onChange={(e) => setWeightLbs(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">
                    Power Adapter
                  </label>
                  <input
                    type="text"
                    value={powerAdapterNotes}
                    onChange={(e) => setPowerAdapterNotes(e.target.value)}
                    placeholder="e.g. 180W Barrel / USB-C"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">
                    Wi-Fi Brand
                  </label>
                  <input
                    type="text"
                    value={wifiBrand}
                    onChange={(e) => setWifiBrand(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">
                    Wi-Fi Model
                  </label>
                  <input
                    type="text"
                    value={wifiModel}
                    placeholder={wifiProduct || 'e.g. AX210NGW'}
                    onChange={(e) => setWifiModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Bluetooth</label>
                  <input
                    type="text"
                    value={bluetooth}
                    onChange={(e) => setBluetooth(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Storage Drives */}
          <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 uppercase">
                Storage Drives
              </span>
              <button
                type="button"
                onClick={() =>
                  setDrives((prev) => [
                    ...prev,
                    {
                      capacity_gb: null,
                      form_factor: 'NVMe',
                      brand: '',
                      model: '',
                      model_number: null,
                      nand_type: null,
                      read_mb_s: null,
                      write_mb_s: null,
                      is_primary: prev.length === 0,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Drive
              </button>
            </div>

            {drives.map((d, idx) => (
              <div
                key={idx}
                className="grid items-center gap-2 sm:grid-cols-12"
              >
                <input
                  type="number"
                  placeholder="GB"
                  value={d.capacity_gb ?? ''}
                  onChange={(e) => {
                    const val = intOrNull(e.target.value);
                    setDrives((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, capacity_gb: val } : row,
                      ),
                    );
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white sm:col-span-2"
                />
                <input
                  type="text"
                  placeholder="Form Factor"
                  value={d.form_factor ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrives((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, form_factor: val } : row,
                      ),
                    );
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white sm:col-span-3"
                />
                <input
                  type="text"
                  placeholder="Brand"
                  value={d.brand ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrives((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, brand: val } : row,
                      ),
                    );
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white sm:col-span-3"
                />
                <input
                  type="text"
                  placeholder="Model"
                  value={d.model ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrives((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, model: val } : row,
                      ),
                    );
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white sm:col-span-3"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDrives((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="flex justify-center rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300 sm:col-span-1"
                >
                  <Trash2 className="h-4 w-4" />
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

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-cyan-500 px-5 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingRig ? 'Save Changes' : 'Create Rig'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
