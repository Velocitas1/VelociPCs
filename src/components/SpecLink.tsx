import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ExternalLink, Pencil, Search } from 'lucide-react';
import {
  formatUrlHost,
  getSafeHttpUrl,
  inferSourceLabel,
  isSearchFallbackUrl,
  type ResolvedResearchLink,
} from '../lib/specLinks';

interface SpecLinkProps {
  label: string;
  specUrl?: string | null;
  links?: ResolvedResearchLink[];
  prefix?: string;
  className?: string;
  compact?: boolean;
  stopPropagation?: boolean;
  onEditLinks?: () => void;
  menuTitle?: string;
}

interface MenuCoords {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
}

export function SpecLink({
  label,
  specUrl,
  links,
  prefix,
  className = '',
  compact = false,
  stopPropagation = false,
  onEditLinks,
  menuTitle,
}: SpecLinkProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const caretRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const resolvedLinks = useMemo<ResolvedResearchLink[]>(() => {
    if (links && links.length > 0) return links;
    const safeUrl = getSafeHttpUrl(specUrl);
    if (!safeUrl) return [];
    return [
      {
        label: inferSourceLabel(safeUrl),
        url: safeUrl,
        isFallback: isSearchFallbackUrl(safeUrl),
        host: formatUrlHost(safeUrl),
      },
    ];
  }, [links, specUrl]);

  const primary = resolvedLinks[0] ?? null;
  const showCaret = Boolean(
    primary && (resolvedLinks.length > 1 || onEditLinks),
  );

  const updatePosition = useCallback(() => {
    const anchor = wrapperRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const menuWidth = Math.min(300, Math.max(230, window.innerWidth - 16));
    const measuredHeight = menuRef.current?.offsetHeight ?? 0;
    const estimatedHeight =
      measuredHeight > 0
        ? measuredHeight
        : 44 + resolvedLinks.length * 46 + (onEditLinks ? 40 : 0);

    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = rect.right - menuWidth;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    if (openUpward) {
      setCoords({
        left,
        bottom: Math.max(8, window.innerHeight - rect.top + 6),
        width: menuWidth,
      });
    } else {
      setCoords({
        left,
        top: Math.min(
          rect.bottom + 6,
          Math.max(8, window.innerHeight - estimatedHeight - 8),
        ),
        width: menuWidth,
      });
    }
  }, [resolvedLinks.length, onEditLinks]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        (wrapperRef.current && wrapperRef.current.contains(target)) ||
        (menuRef.current && menuRef.current.contains(target))
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        caretRef.current?.focus();
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleResize = () => setOpen(false);

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  const handleMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const container = menuRef.current;
    if (!container) return;
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>('[data-speclink-menuitem]'),
    );
    if (focusables.length === 0) return;

    e.preventDefault();
    const currentIdx = focusables.indexOf(
      document.activeElement as HTMLElement,
    );
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const nextIdx =
      currentIdx === -1
        ? delta > 0
          ? 0
          : focusables.length - 1
        : (currentIdx + delta + focusables.length) % focusables.length;
    focusables[nextIdx]?.focus();
  };

  const labelContent = (
    <>
      {prefix ? (
        <span className="font-mono text-[10px] opacity-80">{prefix}</span>
      ) : null}
      <span className="truncate">{label}</span>
    </>
  );

  if (!primary) {
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 text-slate-200 ${className}`}
      >
        <span className="inline-flex min-w-0 items-center gap-1">
          {labelContent}
        </span>
        {onEditLinks ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditLinks();
            }}
            title={`Add spec or research links for ${label}`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded border border-slate-700/80 bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-cyan-500/50 hover:text-cyan-300"
          >
            <Pencil className="h-2.5 w-2.5" />
            <span>Links</span>
          </button>
        ) : null}
      </span>
    );
  }

  const isFallbackPrimary = primary.isFallback;
  const wrapperTone = isFallbackPrimary
    ? 'border-slate-700/90 bg-slate-900/90 text-slate-200 hover:border-slate-500'
    : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400/50';
  const dividerTone = isFallbackPrimary
    ? 'border-slate-700/90 text-slate-400 hover:bg-slate-800 hover:text-white'
    : 'border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 hover:text-white';
  const primaryHoverTone = isFallbackPrimary
    ? 'hover:bg-slate-800/80 hover:text-white'
    : 'hover:bg-cyan-500/15 hover:text-cyan-100';

  return (
    <>
      <span
        ref={wrapperRef}
        className={`inline-flex max-w-full items-stretch overflow-hidden rounded-md border align-middle transition ${wrapperTone} ${
          compact ? 'text-[11px] leading-tight' : 'text-xs'
        } ${className}`}
      >
        <a
          href={primary.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
          }}
          title={
            isFallbackPrimary
              ? `Search ${primary.label} for ${label}`
              : `Open ${primary.label} for ${label}`
          }
          className={`inline-flex min-w-0 items-center gap-1 font-medium transition ${primaryHoverTone} ${
            compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
          }`}
        >
          {labelContent}
          {isFallbackPrimary ? (
            <Search className="h-2.5 w-2.5 shrink-0 opacity-65" />
          ) : (
            <ExternalLink
              className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} shrink-0 opacity-75`}
            />
          )}
        </a>

        {showCaret ? (
          <button
            ref={caretRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`Research links for ${label}`}
            title="More spec & research links"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className={`inline-flex shrink-0 items-center justify-center border-l transition ${dividerTone} ${
              compact ? 'px-1' : 'px-1.5'
            }`}
          >
            <ChevronDown
              className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : null}
      </span>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Research links for ${label}`}
              onKeyDown={handleMenuKeyDown}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: coords?.left ?? -9999,
                top: coords?.top,
                bottom: coords?.bottom,
                width: coords?.width ?? 270,
              }}
              className="z-[80] overflow-hidden rounded-xl border border-slate-700/90 bg-slate-900 shadow-2xl shadow-slate-950/90 backdrop-blur-sm"
            >
              <div className="border-b border-slate-800 bg-slate-950/80 px-3 py-2">
                <p className="truncate text-[11px] font-semibold text-slate-200">
                  {menuTitle ?? label}
                </p>
              </div>

              <div className="max-h-72 divide-y divide-slate-800/60 overflow-y-auto p-1">
                {resolvedLinks.map((item, idx) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    data-speclink-menuitem
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                    }}
                    className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-800/80 focus:bg-slate-800/80 focus:outline-none"
                  >
                    <span className="mt-0.5 shrink-0 text-slate-400 group-hover:text-cyan-300">
                      {item.isFallback ? (
                        <Search className="h-3.5 w-3.5" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5 text-cyan-400/80 group-hover:text-cyan-300" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-slate-100 group-hover:text-white">
                          {item.label}
                        </span>
                        {idx === 0 && !item.isFallback ? (
                          <span className="rounded border border-cyan-500/35 bg-cyan-500/10 px-1 py-0.2 text-[9px] font-semibold text-cyan-300 uppercase">
                            Primary
                          </span>
                        ) : null}
                        {item.isFallback ? (
                          <span className="rounded border border-slate-700 bg-slate-950 px-1 py-0.2 text-[9px] font-medium text-slate-400 uppercase">
                            Search
                          </span>
                        ) : null}
                      </span>
                      {item.host ? (
                        <span className="block truncate font-mono text-[10px] text-slate-500">
                          {item.host}
                        </span>
                      ) : null}
                    </span>
                  </a>
                ))}
              </div>

              {onEditLinks ? (
                <div className="border-t border-slate-800 bg-slate-950/70 p-1">
                  <button
                    type="button"
                    role="menuitem"
                    data-speclink-menuitem
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onEditLinks();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/15 focus:bg-cyan-500/15 focus:outline-none"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit links...
                  </button>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
