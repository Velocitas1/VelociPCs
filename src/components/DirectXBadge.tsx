import { getDirectXBadgeStyle } from '../lib/directx';

interface DirectXBadgeProps {
  version: string | null | undefined;
  featureLevel?: string | null;
  compact?: boolean;
}

export function DirectXBadge({
  version,
  featureLevel,
  compact = false,
}: DirectXBadgeProps) {
  const style = getDirectXBadgeStyle(version, featureLevel);

  return (
    <span
      title={style.eraLabel}
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-medium whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      } ${style.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} />
      {style.label}
    </span>
  );
}
