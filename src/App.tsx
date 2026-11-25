import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { AiExportModal } from './components/AiExportModal';
import { AuthModal } from './components/AuthModal';
import { BenchmarkModal } from './components/BenchmarkModal';
import { ComparisonMatrixView } from './components/ComparisonMatrixView';
import { ComputerDetailModal } from './components/ComputerDetailModal';
import { ComputerFormModal } from './components/ComputerFormModal';
import { HardwareLookupModal } from './components/HardwareLookupModal';
import { Header } from './components/Header';
import { HwinfoImportModal } from './components/HwinfoImportModal';
import { ImportView } from './components/ImportView';
import { InventoryView } from './components/InventoryView';
import { PartFormModal } from './components/PartFormModal';
import {
  PartLinksModal,
  type PartLinksEditTarget,
} from './components/PartLinksModal';
import { PartsCatalogView } from './components/PartsCatalogView';
import { SteamCompatibilityView } from './components/SteamCompatibilityView';
import { useAuth } from './hooks/useAuth';
import { useInventory } from './hooks/useInventory';
import {
  hasCompareUrlParams,
  readCompareUrlState,
  syncCompareParamsToUrl,
  type CompareState,
} from './lib/compare';
import type { InventoryCatalogContext } from './lib/hwinfoMatcher';
import {
  decodeHwinfoXmlFile,
  parseHwinfoXml,
  type ParsedHwinfoReport,
} from './lib/hwinfoParser';
import { PART_CATEGORY_META } from './lib/parts';
import type { RefCpu, RefGpu, ReferenceItem } from './lib/referenceCatalog';
import { computeFleetRankings } from './lib/scoring';
import type {
  AppTab,
  Benchmark,
  CatalogPart,
  CatalogPartCategory,
  ComputerWithRelations,
  Cpu,
  Gpu,
} from './types/database';

const VALID_TABS: AppTab[] = ['inventory', 'compare', 'parts', 'steam', 'import'];

function readHashTab(): AppTab {
  const hash = window.location.hash.replace(/^#\/?/, '') as AppTab;
  return VALID_TABS.includes(hash) ? hash : 'inventory';
}

function readInitialTab(): AppTab {
  if (hasCompareUrlParams(window.location.search)) {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    if (!rawHash || rawHash === 'compare') {
      return 'compare';
    }
  }
  return readHashTab();
}

export function App() {
  const auth = useAuth();
  const inventory = useInventory();

  const [activeTab, setActiveTab] = useState<AppTab>(() => readInitialTab());
  const [compareState, setCompareState] = useState<CompareState>(() =>
    readCompareUrlState(window.location.search),
  );
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
    initialReferenceItem?: RefCpu | RefGpu | null;
    editingCpu: Cpu | null;
    editingGpu: Gpu | null;
    targetField?: 'cpu_id' | 'gpu_id' | 'igpu_id';
    forGpuCardModal?: boolean;
  }>({
    open: false,
    partType: 'cpu',
    mode: 'search',
    initialQuery: '',
    initialReferenceItem: null,
    editingCpu: null,
    editingGpu: null,
  });

  const [partFormState, setPartFormState] = useState<{
    open: boolean;
    category: CatalogPartCategory;
    initialQuery: string;
    initialReferenceItem?: ReferenceItem | null;
    editingPart: CatalogPart | null;
    defaultSpareCount: number;
    targetSlot?: string;
  }>({
    open: false,
    category: 'motherboard',
    initialQuery: '',
    initialReferenceItem: null,
    editingPart: null,
    defaultSpareCount: 0,
  });

  const [recentlyCreatedPart, setRecentlyCreatedPart] = useState<{
    targetField: 'cpu_id' | 'gpu_id' | 'igpu_id';
    id: number;
  } | null>(null);

  const [recentlyCreatedGpuForCardId, setRecentlyCreatedGpuForCardId] = useState<
    number | null
  >(null);

  const [recentlyCreatedCatalogPart, setRecentlyCreatedCatalogPart] = useState<{
    targetSlot: string;
    category: CatalogPartCategory;
    part: CatalogPart;
  } | null>(null);

  const [editingLinksTarget, setEditingLinksTarget] =
    useState<PartLinksEditTarget | null>(null);

  const [directHwinfoModal, setDirectHwinfoModal] = useState<{
    rig: ComputerWithRelations;
    report: ParsedHwinfoReport;
  } | null>(null);
  const directHwinfoInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportTargetRigRef = useRef<ComputerWithRelations | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const catalogContext = useMemo<InventoryCatalogContext>(
    () => ({
      computers: inventory.computers,
      cpus: inventory.cpus,
      gpus: inventory.gpus,
      gpuCards: inventory.gpuCards,
      motherboards: inventory.motherboards,
      ramKits: inventory.ramKits,
      storageDriveModels: inventory.storageDriveModels,
      psus: inventory.psus,
      cases: inventory.cases,
      coolers: inventory.coolers,
      wifiCards: inventory.wifiCards,
    }),
    [
      inventory.computers,
      inventory.cpus,
      inventory.gpus,
      inventory.gpuCards,
      inventory.motherboards,
      inventory.ramKits,
      inventory.storageDriveModels,
      inventory.psus,
      inventory.cases,
      inventory.coolers,
      inventory.wifiCards,
    ],
  );

  const handleDirectHwinfoFileChange = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetRig = pendingImportTargetRigRef.current;
    pendingImportTargetRigRef.current = null;
    if (!file || !targetRig) return;

    try {
      const xml = await decodeHwinfoXmlFile(file);
      const parsed = parseHwinfoXml(xml, file.name);
      setDirectHwinfoModal({ rig: targetRig, report: parsed });
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to parse HWiNFO XML file.',
      );
    }
  };

  useEffect(() => {
    const onUrlChange = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      if (
        hasCompareUrlParams(window.location.search) &&
        (!rawHash || rawHash === 'compare')
      ) {
        setActiveTab('compare');
        setCompareState(readCompareUrlState(window.location.search));
        return;
      }
      setActiveTab(readHashTab());
    };
    window.addEventListener('hashchange', onUrlChange);
    window.addEventListener('popstate', onUrlChange);
    return () => {
      window.removeEventListener('hashchange', onUrlChange);
      window.removeEventListener('popstate', onUrlChange);
    };
  }, []);

  // Prune stale compare IDs only after inventory has loaded cleanly
  useEffect(() => {
    if (inventory.loading || inventory.error) return;
    if (inventory.computers.length === 0) return;

    const validIds = new Set(inventory.computers.map((c) => c.id));
    setCompareState((prev) => {
      const filtered = prev.ids.filter((id) => validIds.has(id));
      if (filtered.length === prev.ids.length) return prev;
      return { ...prev, ids: filtered };
    });
  }, [inventory.loading, inventory.error, inventory.computers]);

  // Sync compare query parameters when on Compare tab, strip on other tabs
  useEffect(() => {
    if (inventory.loading && activeTab === 'compare') return;
    syncCompareParamsToUrl(activeTab, compareState);
  }, [activeTab, compareState, inventory.loading]);

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
    try {
      await inventory.deleteGpu(gpu.id);
      showToast(`Deleted ${gpu.name}`);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Cannot delete GPU chip while GPU cards reference it.',
      );
    }
  };

  const handleDeleteCatalogPart = async (
    category: CatalogPartCategory,
    part: CatalogPart,
    installedCount: number,
  ) => {
    const meta = PART_CATEGORY_META[category];
    const partLabel = `${'brand' in part && part.brand ? `${part.brand} ` : ''}${part.model}`;
    const warning =
      installedCount > 0
        ? ` It is currently linked on ${installedCount} ${
            installedCount === 1 ? 'rig' : 'rigs'
          } (the rig link will be cleared).`
        : '';
    if (!window.confirm(`Delete ${meta.singular} "${partLabel}"?${warning}`)) {
      return;
    }
    await inventory.deleteCatalogPart(category, part.id);
    showToast(`Deleted ${partLabel}`);
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
                onEditPartLinks={
                  auth.isOwner ? setEditingLinksTarget : undefined
                }
              />
            ) : null}

            {activeTab === 'compare' ? (
              <ComparisonMatrixView
                computers={inventory.computers}
                fleetStandings={fleetStandings}
                compareState={compareState}
                onChangeCompareState={setCompareState}
                onSelectComputer={(rig) => setSelectedRigId(rig.id)}
                onNotify={showToast}
                onEditPartLinks={
                  auth.isOwner ? setEditingLinksTarget : undefined
                }
              />
            ) : null}

            {activeTab === 'parts' ? (
              <PartsCatalogView
                cpus={inventory.cpus}
                gpus={inventory.gpus}
                gpuCards={inventory.gpuCards}
                motherboards={inventory.motherboards}
                ramKits={inventory.ramKits}
                storageDriveModels={inventory.storageDriveModels}
                psus={inventory.psus}
                cases={inventory.cases}
                coolers={inventory.coolers}
                wifiCards={inventory.wifiCards}
                computers={inventory.computers}
                isOwner={auth.isOwner}
                onEditPartLinks={
                  auth.isOwner ? setEditingLinksTarget : undefined
                }
                onAddPartLookup={(partType) =>
                  setLookupState({
                    open: true,
                    partType,
                    mode: 'search',
                    initialQuery: '',
                    initialReferenceItem: null,
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
                    initialReferenceItem: null,
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
                    initialReferenceItem: null,
                    editingCpu: null,
                    editingGpu: gpu,
                  })
                }
                onDeleteGpu={(gpu) => void handleDeleteGpu(gpu)}
                onAddCatalogPart={(category) =>
                  setPartFormState({
                    open: true,
                    category,
                    initialQuery: '',
                    initialReferenceItem: null,
                    editingPart: null,
                    defaultSpareCount: 1,
                  })
                }
                onEditCatalogPart={(category, part) =>
                  setPartFormState({
                    open: true,
                    category,
                    initialQuery: '',
                    initialReferenceItem: null,
                    editingPart: part,
                    defaultSpareCount: 0,
                  })
                }
                onDeleteCatalogPart={(category, part, installedCount) =>
                  void handleDeleteCatalogPart(category, part, installedCount)
                }
                onAdjustSpareCount={async (table, id, delta) => {
                  await inventory.adjustSpareCount(table, id, delta);
                }}
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
              <ImportView
                catalog={catalogContext}
                isOwner={auth.isOwner}
                onOpenAuth={() => setAuthModalOpen(true)}
                onImportComplete={async () => {
                  await inventory.refresh();
                  showToast('Inventory synced from CSV');
                }}
                onSelectRig={(rigId) => setSelectedRigId(rigId)}
                onSelectTab={handleSelectTab}
                onNotify={showToast}
                saveComputer={inventory.saveComputer}
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
        partsCatalog={catalogContext}
        onClose={() => setAiExportOpen(false)}
      />

      <ComputerDetailModal
        rig={selectedRig}
        standing={
          selectedRig ? (fleetStandings.get(selectedRig.id) ?? null) : null
        }
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
          void inventory
            .deleteBenchmark(id)
            .then(() => showToast('Benchmark deleted'))
        }
        onEditPartLinks={auth.isOwner ? setEditingLinksTarget : undefined}
        onImportHwinfo={
          auth.isOwner
            ? (rig) => {
                pendingImportTargetRigRef.current = rig;
                directHwinfoInputRef.current?.click();
              }
            : undefined
        }
      />

      <input
        ref={directHwinfoInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        onChange={(e) => void handleDirectHwinfoFileChange(e)}
        className="hidden"
      />

      <HwinfoImportModal
        open={Boolean(directHwinfoModal)}
        report={directHwinfoModal?.report ?? null}
        lockedRig={directHwinfoModal?.rig ?? null}
        catalog={catalogContext}
        isOwner={auth.isOwner}
        onOpenAuth={() => setAuthModalOpen(true)}
        onClose={() => setDirectHwinfoModal(null)}
        onApplySuccess={(result) => {
          setDirectHwinfoModal(null);
          setSelectedRigId(result.computerId);
          showToast(`Updated ${result.rigName} from HWiNFO XML`);
        }}
        saveComputer={inventory.saveComputer}
      />

      <ComputerFormModal
        open={rigFormOpen}
        editingRig={editingRig}
        computers={inventory.computers}
        cpus={inventory.cpus}
        gpus={inventory.gpus}
        gpuCards={inventory.gpuCards}
        motherboards={inventory.motherboards}
        ramKits={inventory.ramKits}
        storageDriveModels={inventory.storageDriveModels}
        psus={inventory.psus}
        cases={inventory.cases}
        coolers={inventory.coolers}
        wifiCards={inventory.wifiCards}
        onClose={() => setRigFormOpen(false)}
        onSave={async (payload, drives, id, spareAdjustments) => {
          const savedId = await inventory.saveComputer(
            payload,
            drives,
            id,
            spareAdjustments,
          );
          showToast(id ? `Updated ${payload.name}` : `Added ${payload.name}`);
          return savedId;
        }}
        onOpenPartLookup={(
          partType,
          mode,
          initialQuery,
          targetField,
          initialRefItem,
        ) =>
          setLookupState({
            open: true,
            partType,
            mode,
            initialQuery,
            initialReferenceItem: initialRefItem ?? null,
            editingCpu: null,
            editingGpu: null,
            targetField,
            forGpuCardModal: false,
          })
        }
        onOpenCreateCatalogPart={(
          category,
          initialQuery,
          targetSlot,
          initialRefItem,
        ) =>
          setPartFormState({
            open: true,
            category,
            initialQuery,
            initialReferenceItem: initialRefItem ?? null,
            editingPart: null,
            defaultSpareCount: 0,
            targetSlot,
          })
        }
        recentlyCreatedPart={recentlyCreatedPart}
        recentlyCreatedCatalogPart={recentlyCreatedCatalogPart}
      />

      <PartFormModal
        open={partFormState.open}
        category={partFormState.category}
        initialQuery={partFormState.initialQuery}
        initialReferenceItem={partFormState.initialReferenceItem}
        editingPart={partFormState.editingPart}
        defaultSpareCount={partFormState.defaultSpareCount}
        gpus={inventory.gpus}
        recentlyCreatedGpuId={recentlyCreatedGpuForCardId}
        onOpenGpuLookup={(mode, initialQuery, initialRefGpu) =>
          setLookupState({
            open: true,
            partType: 'gpu',
            mode,
            initialQuery,
            initialReferenceItem: initialRefGpu ?? null,
            editingCpu: null,
            editingGpu: null,
            forGpuCardModal: true,
          })
        }
        onClose={() =>
          setPartFormState((s) => ({
            ...s,
            open: false,
            initialReferenceItem: null,
            targetSlot: undefined,
          }))
        }
        onSave={inventory.saveCatalogPart}
        onSaved={(category, part) => {
          if (partFormState.targetSlot) {
            setRecentlyCreatedCatalogPart({
              targetSlot: partFormState.targetSlot,
              category,
              part,
            });
          }
          const label =
            `${'brand' in part && part.brand ? `${part.brand} ` : ''}${part.model}`.trim();
          showToast(`Saved ${label}`);
        }}
      />

      <HardwareLookupModal
        open={lookupState.open}
        partType={lookupState.partType}
        initialMode={lookupState.mode}
        initialQuery={lookupState.initialQuery}
        initialReferenceItem={lookupState.initialReferenceItem}
        editingCpu={lookupState.editingCpu}
        editingGpu={lookupState.editingGpu}
        onClose={() =>
          setLookupState((s) => ({
            ...s,
            open: false,
            initialReferenceItem: null,
          }))
        }
        onSaveCpu={inventory.saveCpu}
        onSaveGpu={inventory.saveGpu}
        onSaved={(part) => {
          if (lookupState.forGpuCardModal) {
            setRecentlyCreatedGpuForCardId(part.id);
          } else if (lookupState.targetField) {
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

      <PartLinksModal
        target={editingLinksTarget}
        onClose={() => setEditingLinksTarget(null)}
        onSaveCpuLinks={async (id, specUrl, specLinks) => {
          await inventory.updateCpuLinks(id, specUrl, specLinks);
          showToast('Updated CPU links');
        }}
        onSaveGpuLinks={async (id, specUrl, specLinks) => {
          await inventory.updateGpuLinks(id, specUrl, specLinks);
          showToast('Updated GPU links');
        }}
        onSaveStorageDriveLinks={async (id, specUrl, specLinks) => {
          await inventory.updateStorageDriveLinks(id, specUrl, specLinks);
          showToast('Updated drive links');
        }}
        onSaveCatalogPartLinks={async (table, id, specUrl, specLinks) => {
          await inventory.updateCatalogPartLinks(table, id, specUrl, specLinks);
          showToast('Updated part links');
        }}
        onSaveComputerSlotLinks={async (computerId, currentMap, slot, entry) => {
          await inventory.updateComputerPartSlotLinks(
            computerId,
            currentMap,
            slot,
            entry,
          );
          showToast('Updated part links');
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
