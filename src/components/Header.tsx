import {
  Cpu,
  Download,
  FileSpreadsheet,
  Gamepad2,
  GitCompare,
  Lock,
  LogOut,
  Monitor,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import type { AppTab } from '../types/database';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  totalRigs: number;
  isOwner: boolean;
  userEmail: string | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenAddRig: () => void;
  onOpenAiExport: () => void;
}

const TABS: { id: AppTab; label: string; icon: typeof Monitor }[] = [
  { id: 'inventory', label: 'Inventory', icon: Monitor },
  { id: 'compare', label: 'Comparison Matrix', icon: GitCompare },
  { id: 'parts', label: 'Parts Catalog', icon: Cpu },
  { id: 'steam', label: 'Steam Compatibility', icon: Gamepad2 },
  { id: 'import', label: 'CSV Import', icon: FileSpreadsheet },
];

export function Header({
  activeTab,
  onSelectTab,
  totalRigs,
  isOwner,
  userEmail,
  onOpenAuth,
  onSignOut,
  onOpenAddRig,
  onOpenAiExport,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-sky-600/20 text-cyan-300 shadow-inner">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  VelociPCs
                </h1>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                  {totalRigs} Rigs
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Legacy &amp; Modern Rig Inventory · DirectX &amp; 3DMark Tracker
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenAiExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              Export Inventory for AI
            </button>

            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={onOpenAddRig}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Rig
                </button>
                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{userEmail ?? 'Owner'}</span>
                  <button
                    type="button"
                    onClick={onSignOut}
                    title="Sign out"
                    className="rounded p-0.5 text-emerald-200/80 transition hover:bg-emerald-500/20 hover:text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                Owner Sign In
              </button>
            )}
          </div>
        </div>

        <nav
          aria-label="Primary navigation"
          className="-mb-px flex gap-1 overflow-x-auto pb-0.5"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
