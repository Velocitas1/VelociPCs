import type { Benchmark, ComputerWithRelations } from '../types/database';

export const BENCHMARK_PRESET_SUITES = [
  'Time Spy',
  'Fire Strike',
  'Sky Diver',
  'Cloud Gate',
  'Steel Nomad',
  'Steel Nomad Light',
  'Speed Way',
  'Port Royal',
  'Night Raid',
  'Wild Life',
  'Wild Life Extreme',
  'Time Spy Extreme',
  'Fire Strike Extreme',
  'Fire Strike Ultra',
  'Ice Storm',
  '3DMark 11',
  '3DMark Vantage',
  '3DMark06',
  '3DMark05',
  '3DMark03',
  '3DMark2001 SE',
  'Custom',
] as const;

const THREEDMARK_PATH_SUITE_MAP: Record<string, string> = {
  spy: 'Time Spy',
  spye: 'Time Spy Extreme',
  fs: 'Fire Strike',
  fse: 'Fire Strike Extreme',
  fsu: 'Fire Strike Ultra',
  sd: 'Sky Diver',
  cg: 'Cloud Gate',
  sn: 'Steel Nomad',
  snl: 'Steel Nomad Light',
  sw: 'Speed Way',
  pr: 'Port Royal',
  nr: 'Night Raid',
  wl: 'Wild Life',
  wle: 'Wild Life Extreme',
  is: 'Ice Storm',
  ise: 'Ice Storm',
  isu: 'Ice Storm',
  '3dm11': '3DMark 11',
  '3dmv': '3DMark Vantage',
  '3dm06': '3DMark06',
  '3dm05': '3DMark05',
  '3dm03': '3DMark03',
  '3dm2k1': '3DMark2001 SE',
};

const INVALID_URL_MESSAGE =
  'Enter a valid 3dmark.com result URL (e.g. https://www.3dmark.com/spy/...).';

export interface ParsedThreeDMarkUrl {
  valid: boolean;
  normalizedUrl: string | null;
  detectedSuite: string | null;
  error: string | null;
}

export function isPresetBenchmarkSuite(suiteName: string): boolean {
  return (
    suiteName !== 'Custom' &&
    (BENCHMARK_PRESET_SUITES as readonly string[]).includes(suiteName)
  );
}

export function parseThreeDMarkUrl(raw: string): ParsedThreeDMarkUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: true,
      normalizedUrl: null,
      detectedSuite: null,
      error: null,
    };
  }

  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      normalizedUrl: null,
      detectedSuite: null,
      error: INVALID_URL_MESSAGE,
    };
  }

  const candidate = /^(www\.)?3dmark\.com\//i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      valid: false,
      normalizedUrl: null,
      detectedSuite: null,
      error: INVALID_URL_MESSAGE,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.port !== '' ||
    (hostname !== '3dmark.com' && hostname !== 'www.3dmark.com')
  ) {
    return {
      valid: false,
      normalizedUrl: null,
      detectedSuite: null,
      error: INVALID_URL_MESSAGE,
    };
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return {
      valid: false,
      normalizedUrl: null,
      detectedSuite: null,
      error: INVALID_URL_MESSAGE,
    };
  }

  parsed.protocol = 'https:';
  const detectedSuite =
    THREEDMARK_PATH_SUITE_MAP[segments[0].toLowerCase()] ?? null;

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    detectedSuite,
    error: null,
  };
}

export function getSafeThreeDMarkUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const parsed = parseThreeDMarkUrl(url);
  return parsed.valid ? parsed.normalizedUrl : null;
}

export function compareBenchmarksNewestFirst(
  a: Benchmark,
  b: Benchmark,
): number {
  const byDate = b.recorded_at.localeCompare(a.recorded_at);
  return byDate !== 0 ? byDate : b.id - a.id;
}

export function getLatestBenchmarksMap(
  rig: ComputerWithRelations,
): Record<string, Benchmark> {
  const sorted = [...rig.benchmarks].sort(compareBenchmarksNewestFirst);
  const map: Record<string, Benchmark> = {};
  for (const b of sorted) {
    if (map[b.suite_name] === undefined) {
      map[b.suite_name] = b;
    }
  }
  return map;
}
