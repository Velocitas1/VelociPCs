import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { AiExportModal } from './components/AiExportModal';
import { AuthModal } from './components/AuthModal';
import { BenchmarkModal } from './components/BenchmarkModal';
import { ComparisonMatrixView } from './components/ComparisonMatrixView';
import { ComputerDetailModal } from './components/ComputerDetailModal';
import { ComputerFormModal } from './components/ComputerFormModal';
import { CsvImportView } from './components/CsvImportView';
import { HardwareLookupModal } from './components/HardwareLookupModal';
import { Header } from './components/Header';
import { InventoryView } from './components/InventoryView';
import { PartsCatalogView } from './components/PartsCatalogView';
import { SteamCompatibilityView } from './components/SteamCompatibilityView';
import { useAuth } from './hooks/useAuth';
import { useInventory } from './hooks/useInventory';
import { computeFleetRankings } from './lib/scoring';
import type {
  AppTab,
  Benchmark,
  ComputerWithRelations,
  Cpu,
  Gpu,
} from './types/database';

const VALID_TABS: AppTab[] = ['inventory', 'compare', 'parts', 'steam', 'import'];

function readHashTab(): AppTab {
  const hash = window.location.hash.replace(/^#\/?/, '') as AppTab;
  return VALID_TABS.includes(hash) ? hash : 'inventory';
}

export function App() {
  const auth = useAuth();
  const inventory = useInventory();

  const [activeTab, setActiveTab] = useState<AppTab>(() => readHashTab());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiExportOpen, setAiExportOpen] = useState(false);
  const [selectedRigId, setSelectedRigId] = useState<number | null>(null);
  const [rigFormOpen, setRigFormOpen] = useState(false);
  const [editingRig, setEditingRig] = useState<ComputerWithRelations | null>(null);
  const [benchmarkModalState, setBenchmarkModalState] = useState<{
    rig: ComputerWithRelations | null;
    editingBenchmark: Benchmark | null;
    focusResultUrl: boolean;
  }>({
    rig: null,
    editingBenchmark: null,
    focusResultUrl: false,
  });

  const [lookupState, setLookupState] = useState<{
    open: boolean;
    partType: 'cpu' | 'gpu';
    mode: 'search' | 'manual';
    initialQuery: string;
    editingCpu: Cpu | null;
    editingGpu: Gpu | null;
    targetField?: 'cpu_id' | 'gpu_id' | 'igpu_id';
  }>({
    open: false,
    partType: 'cpu',
    mode: 'search',
    initialQuery: '',
    editingCpu: null,
    editingGpu: null,
  });

  const [recentlyCreatedPart, setRecentlyCreatedPart] = useState<{
    targetField: 'cpu_id' | 'gpu_id' | 'igpu_id';
    id: number;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const onHashChange = () => setActiveTab(readHashTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const selectedRig = useMemo(
    () =>
      selectedRigId !== null
        ? (inventory.computers.find((c) => c.id === selectedRigId) ?? null)
        : null,
    [inventory.computers, selectedRigId],
  );

  const fleetStandings = useMemo(
    () => computeFleetRankings(inventory.computers),
    [inventory.computers],
  );

  const handleDeleteRig = async (rig: ComputerWithRelations) => {
    if (!window.confirm(`Delete "${rig.name}" (${rig.device_type})?`)) return;
    await inventory.deleteComputer(rig.id);
    setSelectedRigId(null);
    showToast(`Deleted ${rig.name}`);
  };

  const handleDeleteCpu = async (cpu: Cpu) => {
    if (!window.confirm(`Delete CPU "${cpu.brand} ${cpu.name}" from catalog?`)) {
      return;
    }
    await inventory.deleteCpu(cpu.id);
    showToast(`Deleted ${cpu.name}`);
  };

  const handleDeleteGpu = async (gpu: Gpu) => {
    if (!window.confirm(`Delete GPU "${gpu.brand} ${gpu.name}" from catalog?`)) {
      return;
    }
    await inventory.deleteGpu(gpu.id);
    showToast(`Deleted ${gpu.name}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        totalRigs={inventory.computers.length}
        isOwner={auth.isOwner}
        userEmail={auth.user?.email ?? null}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={() => void auth.signOut()}
        onOpenAddRig={() => {
          setEditingRig(null);
          setRigFormOpen(true);
        }}
        onOpenAiExport={() => setAiExportOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {inventory.error ? (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{inventory.error}</span>
            </div>
            <button
              type="button"
              onClick={() => void inventory.refresh()}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 px-2.5 py-1 hover:bg-rose-500/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : null}

        {inventory.loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-400" />
            Loading hardware inventory from Supabase...
          </div>
        ) : (
          <>
            {activeTab === 'inventory' ? (
              <InventoryView
                computers={inventory.computers}
                fleetStandings={fleetStandings}
                onSelectComputer={(rig) => setSelectedRigId(rig.id)}
              />
            ) : null}

            {activeTab === 'compare' ? (
              <ComparisonMatrixView
                computers={inventory.computers}
                fleetStandings={fleetStandings}
                onSelectComputer={(rig) => setSelectedRigId(rig.id)}
              />
            ) : null}

            {activeTab === 'parts' ? (
              <PartsCatalogView
                cpus={inventory.cpus}
                gpus={inventory.gpus}
                computers={inventory.computers}
                isOwner={auth.isOwner}
                onAddPartLookup={(partType) =>
                  setLookupState({
                    open: true,
                    partType,
                    mode: 'search',
                    initialQuery: '',
                    editingCpu: null,
                    editingGpu: null,
                  })
                }
                onEditCpu={(cpu) =>
                  setLookupState({
                    open: true,
                    partType: 'cpu',
                    mode: 'manual',
                    initialQuery: '',
                    editingCpu: cpu,
                    editingGpu: null,
                  })
                }
                onDeleteCpu={(cpu) => void handleDeleteCpu(cpu)}
                onEditGpu={(gpu) =>
                  setLookupState({
                    open: true,
                    partType: 'gpu',
                    mode: 'manual',
                    initialQuery: '',
                    editingCpu: null,
                    editingGpu: gpu,
                  })
                }
                onDeleteGpu={(gpu) => void handleDeleteGpu(gpu)}
              />
            ) : null}

            {activeTab === 'steam' ? (
              <SteamCompatibilityView
                computers={inventory.computers}
                steamGames={inventory.steamGames}
                compatibilityRows={inventory.compatibilityRows}
                isOwner={auth.isOwner}
              />
            ) : null}

            {activeTab === 'import' ? (
              <CsvImportView
                isOwner={auth.isOwner}
                onOpenAuth={() => setAuthModalOpen(true)}
                onImportComplete={async () => {
                  await inventory.refresh();
                  showToast('Inventory synced from CSV');
                }}
              />
            ) : null}
          </>
        )}
      </main>

      {/* Modals */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSignIn={async (email, pw) => {
          await auth.signIn(email, pw);
          showToast('Signed in');
        }}
      />

      <AiExportModal
        open={aiExportOpen}
        computers={inventory.computers}
        fleetStandings={fleetStandings}
        onClose={() => setAiExportOpen(false)}
      />

      <ComputerDetailModal
        rig={selectedRig}
        standing={selectedRig ? (fleetStandings.get(selectedRig.id) ?? null) : null}
        isOwner={auth.isOwner}
        onClose={() => setSelectedRigId(null)}
        onEdit={(rig) => {
          setSelectedRigId(null);
          setEditingRig(rig);
          setRigFormOpen(true);
        }}
        onDelete={(rig) => void handleDeleteRig(rig)}
        onAddBenchmark={(rig) =>
          setBenchmarkModalState({
            rig,
            editingBenchmark: null,
            focusResultUrl: false,
          })
        }
        onEditBenchmark={(rig, benchmark, focusUrl = false) =>
          setBenchmarkModalState({
            rig,
            editingBenchmark: benchmark,
            focusResultUrl: focusUrl,
          })
        }
        onDeleteBenchmark={(id) =>
          void inventory.deleteBenchmark(id).then(() => showToast('Benchmark deleted'))
        }
      />

      <ComputerFormModal
        open={rigFormOpen}
        editingRig={editingRig}
        computers={inventory.computers}
        cpus={inventory.cpus}
        gpus={inventory.gpus}
        onClose={() => setRigFormOpen(false)}
        onSave={async (payload, drives, id) => {
          const savedId = await inventory.saveComputer(payload, drives, id);
          showToast(id ? `Updated ${payload.name}` : `Added ${payload.name}`);
          return savedId;
        }}
        onOpenPartLookup={(partType, mode, initialQuery, targetField) =>
          setLookupState({
            open: true,
            partType,
            mode,
            initialQuery,
            editingCpu: null,
            editingGpu: null,
            targetField,
          })
        }
        recentlyCreatedPart={recentlyCreatedPart}
      />

      <HardwareLookupModal
        open={lookupState.open}
        partType={lookupState.partType}
        initialMode={lookupState.mode}
        initialQuery={lookupState.initialQuery}
        editingCpu={lookupState.editingCpu}
        editingGpu={lookupState.editingGpu}
        onClose={() => setLookupState((s) => ({ ...s, open: false }))}
        onSaveCpu={inventory.saveCpu}
        onSaveGpu={inventory.saveGpu}
        onSaved={(part) => {
          if (lookupState.targetField) {
            setRecentlyCreatedPart({
              targetField: lookupState.targetField,
              id: part.id,
            });
          }
          showToast(`Saved ${part.brand} ${part.name}`);
        }}
      />

      <BenchmarkModal
        rig={benchmarkModalState.rig}
        editingBenchmark={benchmarkModalState.editingBenchmark}
        focusResultUrl={benchmarkModalState.focusResultUrl}
        cpus={inventory.cpus}
        gpus={inventory.gpus}
        onClose={() =>
          setBenchmarkModalState({
            rig: null,
            editingBenchmark: null,
            focusResultUrl: false,
          })
        }
        onSave={async (payload, existingId) => {
          await inventory.saveBenchmark(payload, existingId);
          showToast(
            existingId
              ? `Updated ${payload.suite_name} benchmark`
              : `Logged ${payload.suite_name} score`,
          );
        }}
      />

      {toast ? (
        <div className="fixed right-4 bottom-4 z-[70] rounded-xl border border-cyan-500/40 bg-slate-900 px-4 py-2.5 text-xs font-medium text-cyan-200 shadow-2xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export default App;
