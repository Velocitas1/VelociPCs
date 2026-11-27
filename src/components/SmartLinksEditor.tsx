import { useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { SlotLookupResult } from '../lib/linkLookup';
import {
  classifyUrlToSlot,
  formatUrlHost,
  getSafeHttpUrl,
  getSmartLinkSlots,
  inferSourceLabel,
  type PartLinkPresetKind,
  type SmartLinkSlotDefinition,
  type SmartLinkSlotId,
} from '../lib/specLinks';

interface SmartLinksEditorProps {
  partKind: PartLinkPresetKind;
  brand: string;
  query: string;
  specUrl: string;
  specLinks: Array<{ label: string; url: string }>;
  onChange: (next: {
    specUrl: string;
    specLinks: Array<{ label: string; url: string }>;
  }) => void;
  onRunAutoLookup?: () => void;
  lookupLoading?: boolean;
  lookupNote?: string | null;
  lookupError?: string | null;
  searchProvider?: 'serper' | 'brave' | 'free' | null;
  slotResults?: Record<string, SlotLookupResult>;
  onPassmarkMatched?: (score: number) => void;
  autoFindLabel?: string;
  onClearAll?: () => void;
}

interface CustomLinkEntry {
  index: number;
  label: string;
  url: string;
  isPrimary: boolean;
}

export function SmartLinksEditor({
  partKind,
  brand,
  query,
  specUrl,
  specLinks,
  onChange,
  onRunAutoLookup,
  lookupLoading = false,
  lookupNote = null,
  lookupError = null,
  searchProvider = null,
  slotResults = {},
  onPassmarkMatched,
  autoFindLabel = 'Auto-Find Links',
  onClearAll,
}: SmartLinksEditorProps) {
  const slots = useMemo(
    () => getSmartLinkSlots(partKind, brand),
    [partKind, brand],
  );

  const { slotAssignments, customRows } = useMemo(() => {
    const assignments = new Map<
      SmartLinkSlotId,
      { url: string; isPrimary: boolean; specLinksIndex: number | null }
    >();
    const custom: CustomLinkEntry[] = [];

    const trimmedPrimary = specUrl.trim();
    let primaryAssignedToSlot = false;
    if (trimmedPrimary) {
      const sid = classifyUrlToSlot(trimmedPrimary, undefined, slots);
      if (sid && !assignments.has(sid)) {
        assignments.set(sid, {
          url: specUrl,
          isPrimary: true,
          specLinksIndex: null,
        });
        primaryAssignedToSlot = true;
      }
    }

    specLinks.forEach((row, idx) => {
      const trimmedUrl = row.url.trim();
      if (trimmedUrl) {
        const sid = classifyUrlToSlot(trimmedUrl, row.label, slots);
        if (sid && !assignments.has(sid)) {
          assignments.set(sid, {
            url: row.url,
            isPrimary: false,
            specLinksIndex: idx,
          });
          return;
        }
      }
      custom.push({
        index: idx,
        label: row.label,
        url: row.url,
        isPrimary: false,
      });
    });

    if (trimmedPrimary && !primaryAssignedToSlot) {
      custom.unshift({
        index: -1,
        label: inferSourceLabel(trimmedPrimary, 'Primary Spec'),
        url: specUrl,
        isPrimary: true,
      });
    }

    return { slotAssignments: assignments, customRows: custom };
  }, [specUrl, specLinks, slots]);

  const linkedSlotCount = Array.from(slotAssignments.values()).filter((v) =>
    Boolean(v.url.trim()),
  ).length;
  const searchQuery = query.trim() || brand.trim();

  const updateSlotUrl = (slot: SmartLinkSlotDefinition, nextUrl: string) => {
    const existing = slotAssignments.get(slot.id);

    if (existing?.isPrimary) {
      onChange({
        specUrl: nextUrl,
        specLinks,
      });
      return;
    }

    if (existing && existing.specLinksIndex !== null) {
      const idx = existing.specLinksIndex;
      if (!nextUrl.trim()) {
        onChange({
          specUrl,
          specLinks: specLinks.filter((_, i) => i !== idx),
        });
      } else {
        onChange({
          specUrl,
          specLinks: specLinks.map((row, i) =>
            i === idx ? { label: row.label || slot.label, url: nextUrl } : row,
          ),
        });
      }
      return;
    }

    if (!nextUrl.trim()) return;

    if (!specUrl.trim()) {
      onChange({
        specUrl: nextUrl,
        specLinks,
      });
    } else {
      onChange({
        specUrl,
        specLinks: [...specLinks, { label: slot.label, url: nextUrl }],
      });
    }
  };

  const promoteSlotToPrimary = (slot: SmartLinkSlotDefinition) => {
    const existing = slotAssignments.get(slot.id);
    if (!existing || !existing.url.trim() || existing.isPrimary) return;

    const nextLinks = specLinks.filter((_, i) => i !== existing.specLinksIndex);
    const oldPrimary = specUrl.trim();
    if (oldPrimary) {
      const oldSlotId = classifyUrlToSlot(oldPrimary, undefined, slots);
      const oldLabel =
        slots.find((s) => s.id === oldSlotId)?.label ??
        inferSourceLabel(oldPrimary, 'Spec Link');
      nextLinks.push({ label: oldLabel, url: oldPrimary });
    }

    onChange({
      specUrl: existing.url.trim(),
      specLinks: nextLinks,
    });
  };

  const promoteCustomToPrimary = (entry: CustomLinkEntry) => {
    if (entry.isPrimary || !entry.url.trim() || entry.index < 0) return;
    const nextLinks = specLinks.filter((_, i) => i !== entry.index);
    const oldPrimary = specUrl.trim();
    if (oldPrimary) {
      const oldSlotId = classifyUrlToSlot(oldPrimary, undefined, slots);
      const oldLabel =
        slots.find((s) => s.id === oldSlotId)?.label ??
        inferSourceLabel(oldPrimary, 'Spec Link');
      nextLinks.push({ label: oldLabel, url: oldPrimary });
    }
    onChange({
      specUrl: entry.url.trim(),
      specLinks: nextLinks,
    });
  };

  const hasMissingFreeVendorSlot =
    searchProvider === 'free' &&
    slots.some((slot) => {
      const assigned = slotAssignments.get(slot.id);
      const res = slotResults[slot.id];
      return (
        !assigned?.url.trim() &&
        res?.status === 'not_found' &&
        (slot.id === 'amd_official' ||
          slot.id === 'nvidia_official' ||
          slot.id === 'manufacturer' ||
          slot.id === 'manual_support' ||
          slot.id === 'cybenetics')
      );
    });

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">
            Spec &amp; Research Links
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300">
            {linkedSlotCount}/{slots.length} core
            {customRows.length > 0 ? ` + ${customRows.length} custom` : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onRunAutoLookup ? (
            <button
              type="button"
              onClick={onRunAutoLookup}
              disabled={!searchQuery || lookupLoading}
              title={
                searchQuery
                  ? 'Search known databases & official pages for direct links'
                  : 'Enter Brand or Model Name first'
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/45 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lookupLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {lookupLoading ? 'Searching...' : autoFindLabel}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() =>
              onChange({
                specUrl,
                specLinks: [...specLinks, { label: '', url: '' }],
              })
            }
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-cyan-500/50 hover:text-white"
          >
            <Plus className="h-3 w-3 text-cyan-400" />
            Custom Link
          </button>

          {onClearAll && (specUrl.trim() || specLinks.length > 0) ? (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-lg border border-slate-800 px-2 py-1 text-[11px] text-slate-400 transition hover:border-rose-500/40 hover:text-rose-300"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Lookup Note / Error Banner */}
      {lookupError ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span>{lookupError}</span>
        </div>
      ) : lookupNote ? (
        <p className="text-[11px] text-slate-400">{lookupNote}</p>
      ) : null}

      {/* Brand-Aware Smart Slots */}
      <div className="space-y-2">
        {slots.map((slot) => {
          const assignment = slotAssignments.get(slot.id);
          const currentUrl = assignment?.url ?? '';
          const isPrimary = Boolean(assignment?.isPrimary);
          const safeUrl = getSafeHttpUrl(currentUrl);
          const slotRes = slotResults[slot.id];
          const candidates = slotRes?.candidates ?? [];
          const showCandidates =
            candidates.length > 0 &&
            (!safeUrl || slotRes?.status === 'ambiguous');
          const isNotFound =
            !currentUrl.trim() && slotRes?.status === 'not_found';
          const isAmbiguous =
            !currentUrl.trim() && slotRes?.status === 'ambiguous';
          const slotSearchUrl = searchQuery
            ? slot.buildSearchUrl(searchQuery, brand)
            : null;

          return (
            <div
              key={slot.id}
              className={`rounded-lg border p-2.5 transition ${
                isPrimary && safeUrl
                  ? 'border-cyan-500/35 bg-cyan-500/5'
                  : isAmbiguous || isNotFound
                    ? 'border-amber-500/35 bg-amber-500/5'
                    : 'border-slate-800/90 bg-slate-900/70'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!safeUrl}
                    onClick={() => promoteSlotToPrimary(slot)}
                    title={
                      isPrimary
                        ? 'Primary link (opened when clicking part name)'
                        : safeUrl
                          ? 'Set as Primary spec link'
                          : 'Enter a URL first to set as Primary'
                    }
                    className={`rounded p-0.5 transition ${
                      isPrimary && safeUrl
                        ? 'text-amber-300'
                        : safeUrl
                          ? 'text-slate-500 hover:text-amber-300'
                          : 'cursor-not-allowed text-slate-700'
                    }`}
                  >
                    <Star
                      className="h-3.5 w-3.5"
                      fill={isPrimary && safeUrl ? 'currentColor' : 'none'}
                    />
                  </button>

                  <span className="text-xs font-medium text-slate-200">
                    {slot.label}
                  </span>

                  {lookupLoading && !currentUrl.trim() ? (
                    <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Searching
                    </span>
                  ) : isPrimary && safeUrl ? (
                    <span className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                      Primary
                    </span>
                  ) : safeUrl ? (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Linked
                    </span>
                  ) : isAmbiguous ? (
                    <span className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                      Choose match
                    </span>
                  ) : isNotFound ? (
                    <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                      Not found
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  {safeUrl ? (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-cyan-300 transition hover:border-cyan-500/50 hover:text-cyan-200"
                    >
                      Test <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : null}

                  {slotSearchUrl && (!safeUrl || isNotFound || isAmbiguous) ? (
                    <a
                      href={slotSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition ${
                        isNotFound || isAmbiguous
                          ? 'border-amber-400/45 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25'
                          : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200'
                      }`}
                    >
                      <Search className="h-2.5 w-2.5" />
                      Search
                      <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  type="url"
                  value={currentUrl}
                  onChange={(e) => updateSlotUrl(slot, e.target.value)}
                  placeholder={`Paste ${slot.label} URL (optional)...`}
                  className="w-full rounded-md border border-slate-700/90 bg-slate-950 px-2.5 py-1.5 font-mono text-[11px] text-cyan-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                />
                {currentUrl.trim() ? (
                  <button
                    type="button"
                    onClick={() => updateSlotUrl(slot, '')}
                    title={`Clear ${slot.label} URL`}
                    className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {/* Candidate Chips when multiple or selectable matches returned */}
              {showCandidates ? (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-medium text-amber-200/90">
                    {isAmbiguous
                      ? `Multiple matches found for ${slot.label} — click one to use:`
                      : 'Suggested match:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.map((cand) => (
                      <button
                        key={cand.url}
                        type="button"
                        onClick={() => {
                          updateSlotUrl(slot, cand.url);
                          if (
                            typeof cand.passmark_score === 'number' &&
                            cand.passmark_score > 0 &&
                            onPassmarkMatched
                          ) {
                            onPassmarkMatched(cand.passmark_score);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/35 bg-slate-950 px-2 py-1 text-left text-[11px] text-slate-200 transition hover:border-cyan-400 hover:bg-cyan-500/15 hover:text-white"
                      >
                        <span className="max-w-[220px] truncate font-medium">
                          {cand.title}
                        </span>
                        {typeof cand.passmark_score === 'number' &&
                        cand.passmark_score > 0 ? (
                          <span className="rounded bg-cyan-500/15 px-1 py-0.2 font-mono text-[10px] text-cyan-300">
                            {cand.passmark_score.toLocaleString()}
                          </span>
                        ) : null}
                        <span className="font-mono text-[10px] text-slate-500">
                          {formatUrlHost(cand.url)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : isNotFound ? (
                <p className="mt-1.5 text-[10px] text-amber-300/80">
                  Couldn&apos;t find {slot.label} automatically — click{' '}
                  <strong>Search</strong> to grab it, paste above, or leave blank
                  to skip.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Custom Additional Links */}
      {customRows.length > 0 ? (
        <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
          <span className="block text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Custom Links
          </span>
          {customRows.map((entry) => {
            const safeCustom = getSafeHttpUrl(entry.url);
            return (
              <div
                key={entry.index === -1 ? 'custom-primary' : `custom-${entry.index}`}
                className="grid items-center gap-2 sm:grid-cols-12"
              >
                <div className="flex items-center gap-1.5 sm:col-span-4">
                  <button
                    type="button"
                    disabled={!safeCustom}
                    onClick={() => promoteCustomToPrimary(entry)}
                    title={
                      entry.isPrimary
                        ? 'Primary spec link'
                        : safeCustom
                          ? 'Set as Primary spec link'
                          : 'Enter a URL first'
                    }
                    className={`shrink-0 rounded p-0.5 transition ${
                      entry.isPrimary && safeCustom
                        ? 'text-amber-300'
                        : safeCustom
                          ? 'text-slate-500 hover:text-amber-300'
                          : 'cursor-not-allowed text-slate-700'
                    }`}
                  >
                    <Star
                      className="h-3.5 w-3.5"
                      fill={entry.isPrimary && safeCustom ? 'currentColor' : 'none'}
                    />
                  </button>
                  <input
                    type="text"
                    value={entry.label}
                    disabled={entry.isPrimary}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange({
                        specUrl,
                        specLinks: specLinks.map((item, i) =>
                          i === entry.index ? { ...item, label: val } : item,
                        ),
                      });
                    }}
                    placeholder="Label (e.g. Review)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white disabled:opacity-75"
                  />
                </div>
                <input
                  type="url"
                  value={entry.url}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (entry.isPrimary) {
                      onChange({ specUrl: val, specLinks });
                    } else {
                      onChange({
                        specUrl,
                        specLinks: specLinks.map((item, i) =>
                          i === entry.index ? { ...item, url: val } : item,
                        ),
                      });
                    }
                  }}
                  placeholder="https://..."
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-cyan-200 sm:col-span-6"
                />
                <div className="flex items-center justify-end gap-1 sm:col-span-2">
                  {safeCustom ? (
                    <a
                      href={safeCustom}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Test link"
                      className="rounded-lg p-1.5 text-cyan-300 hover:bg-slate-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (entry.isPrimary) {
                        onChange({ specUrl: '', specLinks });
                      } else {
                        onChange({
                          specUrl,
                          specLinks: specLinks.filter(
                            (_, i) => i !== entry.index,
                          ),
                        });
                      }
                    }}
                    title="Remove link"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {hasMissingFreeVendorSlot ? (
        <p className="border-t border-slate-800/70 pt-2 text-[10px] text-slate-500">
          Tip: Official vendor &amp; datasheet auto-discovery works best when a
          free <code className="text-slate-400">BRAVE_SEARCH_API_KEY</code> or{' '}
          <code className="text-slate-400">SERPER_API_KEY</code> secret is set on
          the Supabase Edge Function.
        </p>
      ) : null}
    </div>
  );
}
