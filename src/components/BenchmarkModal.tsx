import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Link2, Sparkles, Trophy, X } from 'lucide-react';
import {
  BENCHMARK_PRESET_SUITES,
  isPresetBenchmarkSuite,
  parseThreeDMarkUrl,
} from '../lib/benchmarks';
import type {
  Benchmark,
  ComputerWithRelations,
  Cpu,
  Gpu,
} from '../types/database';

interface BenchmarkModalProps {
  rig: ComputerWithRelations | null;
  editingBenchmark: Benchmark | null;
  focusResultUrl?: boolean;
  cpus: Cpu[];
  gpus: Gpu[];
  onClose: () => void;
  onSave: (
    payload: Omit<Benchmark, 'id' | 'created_at' | 'updated_at'>,
    existingId?: number,
  ) => Promise<void>;
}

function parseNonNegativeInt(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const num = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(num) && num >= 0 ? num : 'invalid';
}

export function BenchmarkModal({
  rig,
  editingBenchmark,
  focusResultUrl = false,
  cpus,
  gpus,
  onClose,
  onSave,
}: BenchmarkModalProps) {
  const [suiteChoice, setSuiteChoice] = useState('Time Spy');
  const [customSuite, setCustomSuite] = useState('');
  const [score, setScore] = useState('');
  const [graphicsScore, setGraphicsScore] = useState('');
  const [cpuScore, setCpuScore] = useState('');
  const [recordedAt, setRecordedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [resultUrl, setResultUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [resnapshotHardware, setResnapshotHardware] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultUrlInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!rig) return;
    if (editingBenchmark) {
      if (isPresetBenchmarkSuite(editingBenchmark.suite_name)) {
        setSuiteChoice(editingBenchmark.suite_name);
        setCustomSuite('');
      } else {
        setSuiteChoice('Custom');
        setCustomSuite(editingBenchmark.suite_name);
      }
      setScore(String(editingBenchmark.score));
      setGraphicsScore(
        editingBenchmark.graphics_score !== null
          ? String(editingBenchmark.graphics_score)
          : '',
      );
      setCpuScore(
        editingBenchmark.cpu_score !== null
          ? String(editingBenchmark.cpu_score)
          : '',
      );
      setRecordedAt(editingBenchmark.recorded_at);
      setResultUrl(editingBenchmark.result_url ?? '');
      setNotes(editingBenchmark.notes ?? '');
    } else {
      setSuiteChoice('Time Spy');
      setCustomSuite('');
      setScore('');
      setGraphicsScore('');
      setCpuScore('');
      setRecordedAt(new Date().toISOString().slice(0, 10));
      setResultUrl('');
      setNotes('');
    }
    setResnapshotHardware(false);
    setError(null);

    if (focusResultUrl) {
      const frame = requestAnimationFrame(() => {
        resultUrlInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [rig, editingBenchmark, focusResultUrl]);

  if (!rig) return null;

  const isEditing = Boolean(editingBenchmark);
  const parsedUrl = parseThreeDMarkUrl(resultUrl);
  const selectedSuiteName =
    suiteChoice === 'Custom' ? customSuite.trim() : suiteChoice;
  const hasSuiteMismatch = Boolean(
    isEditing &&
      parsedUrl.valid &&
      parsedUrl.detectedSuite &&
      selectedSuiteName &&
      parsedUrl.detectedSuite.toLowerCase() !== selectedSuiteName.toLowerCase(),
  );

  const hardwareDiffers = Boolean(
    editingBenchmark &&
      (editingBenchmark.cpu_id !== rig.cpu_id ||
        editingBenchmark.gpu_id !== rig.gpu_id),
  );

  const formatCpuLabel = (cpuId: number | null): string => {
    if (cpuId === null) return 'None / Unrecorded';
    const cpu = cpus.find((c) => c.id === cpuId);
    return cpu ? `${cpu.brand} ${cpu.name}` : `CPU #${cpuId}`;
  };

  const formatGpuLabel = (gpuId: number | null): string => {
    if (gpuId === null) return 'None / Unrecorded';
    const gpu = gpus.find((g) => g.id === gpuId);
    return gpu ? `${gpu.brand} ${gpu.name}` : `GPU #${gpuId}`;
  };

  const handleResultUrlChange = (value: string) => {
    setResultUrl(value);
    if (!isEditing) {
      const parsed = parseThreeDMarkUrl(value);
      if (parsed.valid && parsed.detectedSuite) {
        setSuiteChoice(parsed.detectedSuite);
        setCustomSuite('');
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const suiteName = selectedSuiteName;
    const numericScore = parseNonNegativeInt(score);
    const parsedGraphics = parseNonNegativeInt(graphicsScore);
    const parsedCpu = parseNonNegativeInt(cpuScore);

    if (!suiteName || numericScore === null || numericScore === 'invalid') {
      setError('Enter a valid benchmark suite and non-negative integer score.');
      return;
    }

    if (parsedGraphics === 'invalid' || parsedCpu === 'invalid') {
      setError('Graphics and CPU sub-scores must be non-negative integers.');
      return;
    }

    if (!recordedAt) {
      setError('Select a recorded date.');
      return;
    }

    if (!parsedUrl.valid) {
      setError(
        parsedUrl.error ??
          'Enter a valid 3dmark.com result URL (e.g. https://www.3dmark.com/spy/...).',
      );
      return;
    }

    const cpuId =
      editingBenchmark && !resnapshotHardware
        ? editingBenchmark.cpu_id
        : rig.cpu_id;
    const gpuId =
      editingBenchmark && !resnapshotHardware
        ? editingBenchmark.gpu_id
        : rig.gpu_id;

    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          computer_id: rig.id,
          suite_name: suiteName,
          score: numericScore,
          graphics_score: parsedGraphics,
          cpu_score: parsedCpu,
          cpu_id: cpuId,
          gpu_id: gpuId,
          recorded_at: recordedAt,
          notes: notes.trim() || null,
          result_url: parsedUrl.normalizedUrl,
        },
        editingBenchmark?.id,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save benchmark.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold text-white">
                {isEditing ? 'Edit 3DMark Benchmark' : 'Log 3DMark Benchmark'}
              </h2>
              <p className="text-xs text-slate-400">
                {rig.name} ·{' '}
                {isEditing
                  ? 'Editing existing run'
                  : 'Snapshots current CPU & GPU'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Link2 className="h-3.5 w-3.5 text-cyan-400" />
              3DMark Result URL
            </label>
            <input
              ref={resultUrlInputRef}
              type="text"
              inputMode="url"
              value={resultUrl}
              onChange={(e) => handleResultUrlChange(e.target.value)}
              placeholder="https://www.3dmark.com/spy/1234567"
              className={`w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none ${
                resultUrl.trim() && !parsedUrl.valid
                  ? 'border-rose-500/70 focus:border-rose-400'
                  : 'border-slate-700 focus:border-cyan-400'
              }`}
            />

            {resultUrl.trim() && !parsedUrl.valid ? (
              <p className="mt-1 text-[11px] text-rose-300">
                {parsedUrl.error}
              </p>
            ) : null}

            {!isEditing && parsedUrl.valid && parsedUrl.detectedSuite ? (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Auto-detected: {parsedUrl.detectedSuite}
              </div>
            ) : null}

            {hasSuiteMismatch && parsedUrl.detectedSuite ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  URL looks like{' '}
                  <strong className="text-white">
                    {parsedUrl.detectedSuite}
                  </strong>
                  .
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSuiteChoice(parsedUrl.detectedSuite!);
                    setCustomSuite('');
                  }}
                  className="rounded-md bg-amber-500/20 px-2 py-1 font-medium text-amber-200 transition hover:bg-amber-500/30 hover:text-white"
                >
                  Switch to {parsedUrl.detectedSuite}
                </button>
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Benchmark Suite
            </label>
            <select
              value={suiteChoice}
              onChange={(e) => setSuiteChoice(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {BENCHMARK_PRESET_SUITES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {suiteChoice === 'Custom' ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Custom Suite Name *
              </label>
              <input
                type="text"
                required
                value={customSuite}
                onChange={(e) => setCustomSuite(e.target.value)}
                placeholder="e.g. Steel Nomad Light"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Total Score *
              </label>
              <input
                type="number"
                min={0}
                step={1}
                required
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Graphics
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={graphicsScore}
                onChange={(e) => setGraphicsScore(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">CPU</label>
              <input
                type="number"
                min={0}
                step={1}
                value={cpuScore}
                onChange={(e) => setCpuScore(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Recorded Date
            </label>
            <input
              type="date"
              required
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Driver version, OC settings, etc."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          {hardwareDiffers && editingBenchmark ? (
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/70 p-3 text-[11px] text-slate-300">
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500">Recorded snapshot:</span>{' '}
                  {formatCpuLabel(editingBenchmark.cpu_id)} ·{' '}
                  {formatGpuLabel(editingBenchmark.gpu_id)}
                </div>
                <div>
                  <span className="text-slate-500">Current rig:</span>{' '}
                  {formatCpuLabel(rig.cpu_id)} · {formatGpuLabel(rig.gpu_id)}
                </div>
              </div>
              <label className="mt-2.5 flex cursor-pointer items-center gap-2 font-medium text-amber-200">
                <input
                  type="checkbox"
                  checked={resnapshotHardware}
                  onChange={(e) => setResnapshotHardware(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950 text-amber-500"
                />
                Update hardware snapshot to current rig CPU &amp; GPU
              </label>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
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
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {saving
                ? 'Saving...'
                : isEditing
                  ? 'Update Benchmark'
                  : 'Save Benchmark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
