import { ExternalLink } from 'lucide-react';

interface SpecLinkProps {
  label: string;
  specUrl: string | null | undefined;
  prefix?: string;
  className?: string;
  stopPropagation?: boolean;
}

export function SpecLink({
  label,
  specUrl,
  prefix,
  className = '',
  stopPropagation = false,
}: SpecLinkProps) {
  const content = (
    <>
      {prefix ? (
        <span className="mr-1 font-mono text-xs text-cyan-300">{prefix}</span>
      ) : null}
      <span>{label}</span>
    </>
  );

  if (!specUrl) {
    return <span className={`text-slate-200 ${className}`}>{content}</span>;
  }

  return (
    <a
      href={specUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
      }}
      title={`Open official specifications for ${label}`}
      className={`group inline-flex items-center gap-1 font-medium text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 transition hover:text-cyan-200 hover:decoration-cyan-300 ${className}`}
    >
      {content}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-65 transition group-hover:opacity-100" />
    </a>
  );
}
