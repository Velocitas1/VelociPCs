import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  formatReferenceItemSubtitle,
  formatReferenceItemTitle,
  formatReferenceSourceBadge,
  loadReferenceCatalog,
  searchReferenceCatalog,
  type ReferenceCategory,
  type ReferenceItem,
  type ReferenceItemMap,
} from '../lib/referenceCatalog';

interface ReferenceCatalogSearchProps<K extends ReferenceCategory> {
  category: K;
  initialQuery?: string;
  isEditing?: boolean;
  vendorFilter?: string;
  placeholder?: string;
  queryValue?: string;
  onQueryChange?: (q: string) => void;
  extraAction?: ReactNode;
  onSelect: (
    item: ReferenceItemMap[K],
    mode: 'replace' | 'fill_blanks',
  ) => void;
}

export function ReferenceCatalogSearch<K extends ReferenceCategory>({
  category,
  initialQuery = '',
  isEditing = false,
  vendorFilter,
  placeholder = 'Search open-source hardware catalog...',
  queryValue,
  onQueryChange,
  extraAction,
  onSelect,
}: ReferenceCatalogSearchProps<K>) {
  const [expanded, setExpanded] = useState(!isEditing);
  const [applyMode, setApplyMode] = useState<'replace' | 'fill_blanks'>(
    isEditing ? 'fill_blanks' : 'replace',
  );
  const [internalQuery, setInternalQuery] = useState(initialQuery);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [results, setResults] = useState<ReferenceItemMap[K][]>([]);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const [lastSelectedTitle, setLastSelectedTitle] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const query = queryValue !== undefined ? queryValue : internalQuery;

  const setQuery = (next: string) => {
    if (onQueryChange) onQueryChange(next);
    if (queryValue === undefined) setInternalQuery(next);
  };

  useEffect(() => {
    setExpanded(!isEditing);
    setApplyMode(isEditing ? 'fill_blanks' : 'replace');
    setLastSelectedTitle(null);
  }, [isEditing, category]);

  useEffect(() => {
    if (queryValue === undefined) {
      setInternalQuery(initialQuery);
    }
  }, [initialQuery, queryValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const shouldLoad = dropdownOpen || query.trim().length > 0;
    if (!shouldLoad) return;

    let cancelled = false;
    setLoadingCatalog(true);
    setCatalogError(null);

    searchReferenceCatalog(category, query, {
      limit: 12,
      vendor: vendorFilter,
    })
      .then((items) => {
        if (cancelled) return;
        setResults(items);
        setHighlightedIdx(0);
      })
      .catch((err) => {
        if (cancelled) return;
        setCatalogError(
          err instanceof Error
            ? err.message
            : 'Unable to load reference catalog.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expanded, dropdownOpen, category, query, vendorFilter]);

  const handleSelectItem = (item: ReferenceItemMap[K]) => {
    const title = formatReferenceItemTitle(category, item);
    setLastSelectedTitle(title);
    setDropdownOpen(false);
    onSelect(item, applyMode);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      return;
    }
    if (!dropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setDropdownOpen(true);
      return;
    }
    if (!dropdownOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[highlightedIdx] ?? results[0];
      if (target) handleSelectItem(target);
    }
  };

  if (isEditing && !expanded) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            void loadReferenceCatalog(category).catch(() => {});
          }}
          className="inline-flex items-center gap-2 text-xs font-medium text-cyan-300 hover:text-cyan-200"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          <Database className="h-3.5 w-3.5" />
          Fill missing specs from Reference Catalog
        </button>
        {extraAction ? <div className="flex items-center gap-2">{extraAction}</div> : null}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3.5"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
          {isEditing ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <Database className="h-3.5 w-3.5" />
              Reference Catalog Auto-Fill
            </button>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Instant Open-Source Hardware Catalog Auto-Fill
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setApplyMode('fill_blanks')}
                className={`rounded-md px-2 py-0.5 font-medium transition ${
                  applyMode === 'fill_blanks'
                    ? 'bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fill blanks only
              </button>
              <button
                type="button"
                onClick={() => setApplyMode('replace')}
                className={`rounded-md px-2 py-0.5 font-medium transition ${
                  applyMode === 'replace'
                    ? 'bg-amber-500/20 text-amber-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Overwrite all
              </button>
            </div>
          ) : null}
          {lastSelectedTitle ? (
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              Applied: {lastSelectedTitle}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onFocus={() => setDropdownOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pr-8 pl-9 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          {loadingCatalog ? (
            <Loader2 className="absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-cyan-400" />
          ) : null}
        </div>
        {extraAction}
      </div>

      {catalogError ? (
        <p className="mt-2 text-xs text-rose-300">{catalogError}</p>
      ) : null}

      {dropdownOpen ? (
        <div className="absolute right-3.5 left-3.5 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
          {loadingCatalog && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
              Loading reference dataset...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">
              {query.trim()
                ? `No reference matches for "${query.trim()}". Enter specs manually below.`
                : 'Start typing a brand or model name to search.'}
            </div>
          ) : (
            results.map((item, idx) => {
              const title = formatReferenceItemTitle(category, item);
              const sub = formatReferenceItemSubtitle(category, item);
              const src = formatReferenceSourceBadge(
                (item as ReferenceItem).src,
              );
              const active = idx === highlightedIdx;
              return (
                <button
                  key={`${title}-${idx}`}
                  type="button"
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  onClick={() => handleSelectItem(item)}
                  className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    active
                      ? 'bg-cyan-500/20 text-white'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{title}</div>
                    {sub ? (
                      <div className="truncate font-mono text-[11px] text-slate-400">
                        {sub}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                    {src}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
