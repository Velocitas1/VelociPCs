export interface DirectXBadgeStyle {
  label: string;
  eraLabel: string;
  badgeClass: string;
  dotClass: string;
  rank: number;
}

export function formatDirectX(
  version: string | null | undefined,
  featureLevel?: string | null,
): string {
  if (!version || !version.trim()) return 'No Dedicated GPU';
  const cleanVer = version.trim().replace(/^dx\s*/i, '');
  if (featureLevel && featureLevel.trim()) {
    return `DX ${cleanVer} (${featureLevel.trim()})`;
  }
  return `DX ${cleanVer}`;
}

export function getDirectXTierRank(
  version: string | null | undefined,
  featureLevel?: string | null,
): number {
  if (!version || !version.trim()) return 0;
  const v = version.trim();
  const fl = (featureLevel ?? '').trim();

  if (fl === '12_2') return 1220;
  if (fl === '12_1') return 1210;
  if (fl === '12_0') return 1200;
  if (v.startsWith('12') && fl === '11_1') return 1190;
  if (v.startsWith('12') && fl === '11_0') return 1180;
  if (v.startsWith('12')) return 1200;
  if (v.startsWith('11.2')) return 1120;
  if (v.startsWith('11.1')) return 1110;
  if (v.startsWith('11')) return 1100;
  if (v.startsWith('10.1')) return 1010;
  if (v.startsWith('10')) return 1000;
  if (v.startsWith('9')) return 900;
  return 500;
}

export function getDirectXBadgeStyle(
  version: string | null | undefined,
  featureLevel?: string | null,
): DirectXBadgeStyle {
  if (!version || !version.trim()) {
    return {
      label: 'No Discrete GPU',
      eraLabel: 'Integrated / Basic Display',
      badgeClass: 'bg-slate-800/80 text-slate-400 border-slate-700',
      dotClass: 'bg-slate-500',
      rank: 0,
    };
  }

  const rank = getDirectXTierRank(version, featureLevel);
  const label = formatDirectX(version, featureLevel);

  if (rank >= 1220) {
    return {
      label,
      eraLabel: 'DX12 Ultimate (Modern AAA + Mesh Shaders / DXR)',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      dotClass: 'bg-emerald-400',
      rank,
    };
  }

  if (rank >= 1200) {
    return {
      label,
      eraLabel: 'DirectX 12 Native (2015–Present Games)',
      badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
      dotClass: 'bg-cyan-400',
      rank,
    };
  }

  if (rank >= 1180) {
    return {
      label,
      eraLabel: 'DX12 API / FL 11_x (Blocks strict FL 12_0+ titles)',
      badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
      dotClass: 'bg-sky-400',
      rank,
    };
  }

  if (rank >= 1100) {
    return {
      label,
      eraLabel: 'DirectX 11 Era (2010–2016 Classics)',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      dotClass: 'bg-amber-400',
      rank,
    };
  }

  if (rank >= 1000) {
    return {
      label,
      eraLabel: 'DirectX 10 Legacy (Vista / Win7 Era 2007–2010)',
      badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
      dotClass: 'bg-orange-400',
      rank,
    };
  }

  return {
    label,
    eraLabel: 'DirectX 9 Retro (XP Era Classics)',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    dotClass: 'bg-rose-400',
    rank,
  };
}
