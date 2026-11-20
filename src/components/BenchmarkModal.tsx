import { useEffect, useState, type FormEvent } from 'react';
import { Trophy, X } from 'lucide-react';
import type { Benchmark, ComputerWithRelations } from '../types/database';

interface BenchmarkModalProps {
  rig: ComputerWithRelations | null;
  onClose: () => void;
  onSave: (
    payload: Omit<Benchmark, 'id' | 'created_at' | 'updated_at'>,
  ) => Promise<void>;
}

const PRESET_SUITES = [
  'Time Spy',
  'Fire Strike',
  'Sky Diver',
  'Cloud Gate',
  '3DMark Vantage',
  '3DMark06',
  '3DMark03',
  '3DMark2001 SE',
  'Custom',
];

export function BenchmarkModal({ rig, onClose, onSave }: BenchmarkModalProps) {
  const [suiteChoice, setSuiteChoice] = useState('Time Spy');
  const [customSuite, setCustomSuite] = useState('');
  const [score, setScore] = useState('');
  const [graphicsScore, setGraphicsScore] = useState('');
  const [cpuScore, setCpuScore] = useState('');
  const [recordedAt, setRecordedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rig) return;
    setScore('');
    setGraphicsScore('');
    setCpuScore('');
    setNotes('');
    setError(null);
  }, [rig]);

  if (!rig) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const suiteName =
      suiteChoice === 'Custom' ? customSuite.trim() : suiteChoice;
    const numericScore = Number.parseInt(score, 10);

    if (!suiteName || !Number.isFinite(numericScore) || numericScore < 0) {
      setError('Enter a valid benchmark suite and non-negative integer score.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        computer_id: rig.id,
        suite_name: suiteName,
        score: numericScore,
        graphics_score: graphicsScore.trim()
          ? Number.parseInt(graphicsScore, 10)
          : null,
        cpu_score: cpuScore.trim() ? Number.parseInt(cpuScore, 10) : null,
        cpu_id: rig.cpu_id,
        gpu_id: rig.gpu_id,
        recorded_at: recordedAt,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to record benchmark.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold text-white">
                Log 3DMark Benchmark
              </h2>
              <p className="text-xs text-slate-400">
                {rig.name} · Snapshots current CPU &amp; GPU
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
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Benchmark Suite
            </label>
            <select
              value={suiteChoice}
              onChange={(e) => setSuiteChoice(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {PRESET_SUITES.map((s) => (
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
              {saving ? 'Saving...' : 'Save Benchmark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
