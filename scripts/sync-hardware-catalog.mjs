import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'catalog');

const DBGPU_FALLBACK_URL =
  'https://github.com/painebenjamin/dbgpu/releases/download/2025.12/2025-12.json';
const DBGPU_LATEST_API =
  'https://api.github.com/repos/painebenjamin/dbgpu/releases/latest';
const RIGHTNOW_GPU_URL =
  'https://raw.githubusercontent.com/RightNow-AI/RightNow-GPU-Database/main/data/all-gpus.json';
const DOCYX_BASE =
  'https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json';
const BUILDCORES_TARBALL_URL =
  'https://codeload.github.com/buildcores/buildcores-open-db/tar.gz/refs/heads/main';

function buildHeaders(accept = 'application/json') {
  const headers = {
    'User-Agent': 'VelociPCs-Catalog-Sync/1.0',
    Accept: accept,
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: buildHeaders('application/json') });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: buildHeaders('application/octet-stream'),
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Pure-JS POSIX ustar / PAX ('x') / GNU LongName ('L') tar.gz reader.
 * Only parses regular JSON files matching `open-db/<Category>/*.json`.
 */
function parseBuildcoresTarGz(gzBuffer) {
  const tar = zlib.gunzipSync(gzBuffer);
  const categories = new Map();
  let offset = 0;
  let nextLongName = null;
  let nextPaxPath = null;

  const parseOctal = (buf, start, len) => {
    const raw = buf
      .subarray(start, start + len)
      .toString('utf8')
      .replace(/\0.*$/, '')
      .trim();
    if (!raw) return 0;
    return Number.parseInt(raw, 8) || 0;
  };

  const parsePaxRecords = (buf) => {
    const str = buf.toString('utf8');
    let i = 0;
    let paxPath = null;
    while (i < str.length) {
      const spaceIdx = str.indexOf(' ', i);
      if (spaceIdx === -1) break;
      const recLen = Number.parseInt(str.slice(i, spaceIdx), 10);
      if (!Number.isFinite(recLen) || recLen <= 0) break;
      const record = str.slice(spaceIdx + 1, i + recLen);
      const eqIdx = record.indexOf('=');
      if (eqIdx !== -1) {
        const key = record.slice(0, eqIdx);
        const val = record.slice(eqIdx + 1).replace(/\n$/, '');
        if (key === 'path') paxPath = val;
      }
      i += recLen;
    }
    return paxPath;
  };

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    // Two consecutive zero blocks mark end of archive
    let isZero = true;
    for (let i = 0; i < 512; i += 1) {
      if (header[i] !== 0) {
        isZero = false;
        break;
      }
    }
    if (isZero) break;

    const rawName = header
      .subarray(0, 100)
      .toString('utf8')
      .replace(/\0.*$/, '');
    const prefix = header
      .subarray(345, 500)
      .toString('utf8')
      .replace(/\0.*$/, '');
    const size = parseOctal(header, 124, 12);
    const typeFlag = String.fromCharCode(header[156] || 48);

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    const paddedBlocks = Math.ceil(size / 512) * 512;
    offset = dataStart + paddedBlocks;

    if (typeFlag === 'L') {
      nextLongName = tar
        .subarray(dataStart, dataEnd)
        .toString('utf8')
        .replace(/\0.*$/, '');
      continue;
    }
    if (typeFlag === 'x') {
      nextPaxPath = parsePaxRecords(tar.subarray(dataStart, dataEnd));
      continue;
    }
    if (typeFlag === 'g') {
      continue;
    }

    const fullPath =
      nextPaxPath ??
      nextLongName ??
      (prefix ? `${prefix}/${rawName}` : rawName);
    nextLongName = null;
    nextPaxPath = null;

    // Only process regular files ('0' or '\0')
    if (typeFlag !== '0' && typeFlag !== '\0') continue;

    const match = fullPath.match(
      /(?:^|\/)open-db\/(CPU|GPU|Motherboard|RAM|Storage|PSU|PCCase|CPUCooler|NetworkCard)\/[^/]+\.json$/,
    );
    if (!match) continue;

    const cat = match[1];
    try {
      const parsed = JSON.parse(tar.subarray(dataStart, dataEnd).toString('utf8'));
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat).push(parsed);
    } catch {
      // Skip malformed individual JSON entry
    }
  }

  return categories;
}

function sanitizeHttpUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (
      (u.protocol !== 'http:' && u.protocol !== 'https:') ||
      u.username !== '' ||
      u.password !== ''
    ) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

function cleanStr(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/\s+/g, ' ').trim();
  return s ? s : null;
}

function toNum(val, decimals = null) {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (decimals === null) return n;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function toInt(val) {
  const n = toNum(val);
  if (n === null) return null;
  const r = Math.round(n);
  return r > 0 ? r : null;
}

const BRAND_ALIASES = new Map([
  ['amd', 'AMD'],
  ['intel', 'Intel'],
  ['nvidia', 'NVIDIA'],
  ['ati', 'ATI'],
  ['3dfx', '3dfx'],
  ['asus', 'ASUS'],
  ['asrock', 'ASRock'],
  ['msi', 'MSI'],
  ['gigabyte', 'Gigabyte'],
  ['evga', 'EVGA'],
  ['pny', 'PNY'],
  ['xfx', 'XFX'],
  ['zotac', 'ZOTAC'],
  ['sapphire', 'Sapphire'],
  ['powercolor', 'PowerColor'],
  ['palit', 'Palit'],
  ['gainward', 'Gainward'],
  ['inno3d', 'Inno3D'],
  ['galax', 'GALAX'],
  ['kfa2', 'KFA2'],
  ['sparkle', 'Sparkle'],
  ['biostar', 'BIOSTAR'],
  ['corsair', 'Corsair'],
  ['g.skill', 'G.Skill'],
  ['gskill', 'G.Skill'],
  ['kingston', 'Kingston'],
  ['crucial', 'Crucial'],
  ['teamgroup', 'TEAMGROUP'],
  ['team', 'TEAMGROUP'],
  ['patriot', 'Patriot'],
  ['adata', 'ADATA'],
  ['xpg', 'XPG'],
  ['silicon power', 'Silicon Power'],
  ['lexar', 'Lexar'],
  ['mushkin', 'Mushkin'],
  ['oloy', 'OLOy'],
  ['pny', 'PNY'],
  ['samsung', 'Samsung'],
  ['western digital', 'Western Digital'],
  ['wd', 'Western Digital'],
  ['wd_black', 'Western Digital'],
  ['seagate', 'Seagate'],
  ['sabrent', 'Sabrent'],
  ['sk hynix', 'SK Hynix'],
  ['solidigm', 'Solidigm'],
  ['kioxia', 'Kioxia'],
  ['toshiba', 'Toshiba'],
  ['sandisk', 'SanDisk'],
  ['intel', 'Intel'],
  ['micron', 'Micron'],
  ['inland', 'Inland'],
  ['transcend', 'Transcend'],
  ['hp', 'HP'],
  ['dell', 'Dell'],
  ['lenovo', 'Lenovo'],
  ['acer', 'Acer'],
  ['seasonic', 'Seasonic'],
  ['super flower', 'Super Flower'],
  ['be quiet!', 'be quiet!'],
  ['be quiet', 'be quiet!'],
  ['cooler master', 'Cooler Master'],
  ['thermaltake', 'Thermaltake'],
  ['thermalright', 'Thermalright'],
  ['silverstone', 'SilverStone'],
  ['fractal design', 'Fractal Design'],
  ['lian li', 'Lian Li'],
  ['phanteks', 'Phanteks'],
  ['nzxt', 'NZXT'],
  ['noctua', 'Noctua'],
  ['deepcool', 'DeepCool'],
  ['arctic', 'Arctic'],
  ['montech', 'Montech'],
  ['antec', 'Antec'],
  ['enermax', 'Enermax'],
  ['fsp', 'FSP'],
  ['fsp group', 'FSP'],
  ['rosewill', 'Rosewill'],
  ['zalman', 'Zalman'],
  ['cougar', 'Cougar'],
  ['hyte', 'HYTE'],
  ['jonsbo', 'Jonsbo'],
  ['id-cooling', 'ID-Cooling'],
  ['scythe', 'Scythe'],
  ['ek', 'EK'],
  ['ekwb', 'EK'],
  ['tp-link', 'TP-Link'],
  ['tplink', 'TP-Link'],
  ['netgear', 'NETGEAR'],
  ['d-link', 'D-Link'],
  ['linksys', 'Linksys'],
  ['edimax', 'Edimax'],
  ['fenvi', 'Fenvi'],
  ['broadcom', 'Broadcom'],
  ['qualcomm', 'Qualcomm'],
  ['realtek', 'Realtek'],
  ['mediatek', 'MediaTek'],
  ['killer', 'Killer'],
  ['startech', 'StarTech'],
  ['matrox', 'Matrox'],
  ['s3', 'S3'],
  ['via', 'VIA'],
  ['sis', 'SiS'],
  ['nxzt', 'NZXT'],
  ['nzxt', 'NZXT'],
  ['geil', 'GeIL'],
  ['klevv', 'KLEVV'],
  ['v-color', 'v-color'],
  ['apacer', 'Apacer'],
  ['netac', 'Netac'],
  ['kingbank', 'KingBank'],
  ['maxx', 'MAXX'],
  ['acer predator', 'Acer'],
  ['maxsun', 'MAXSUN'],
  ['yeston', 'Yeston'],
  ['colorful', 'Colorful'],
  ['sonnet', 'Sonnet'],
  ['his', 'HIS'],
  ['visiontek', 'VisionTek'],
  ['xfx', 'XFX'],
  ['club 3d', 'Club 3D'],
  ['diamond', 'Diamond'],
  ['bfg', 'BFG'],
  ['leadtek', 'Leadtek'],
  ['matrox', 'Matrox'],
  ['pioneer', 'Pioneer'],
  ['hitachi', 'Hitachi'],
  ['hgst', 'HGST'],
  ['maxtor', 'Maxtor'],
  ['fujitsu', 'Fujitsu'],
  ['verico', 'Verico'],
  ['addlink', 'addlink'],
  ['nextorage', 'Nextorage'],
  ['fanxiang', 'Fanxiang'],
  ['movespeed', 'MOVESPEED'],
  ['orico', 'ORICO'],
  ['ugreen', 'UGREEN'],
  ['cyorig', 'CRYORIG'],
  ['cryorig', 'CRYORIG'],
  ['raijintek', 'RAIJINTEK'],
  ['vetroo', 'Vetroo'],
  ['sama', 'SAMA'],
  ['gamemax', 'GameMax'],
  ['apevia', 'Apevia'],
  ['aresgame', 'ARESGAME'],
  ['segotep', 'Segotep'],
  ['1stplayer', '1stPlayer'],
  ['gamdias', 'GAMDIAS'],
  ['kolink', 'Kolink'],
  ['bitfenix', 'BitFenix'],
  ['in win', 'In Win'],
  ['inwin', 'In Win'],
  ['ssupd', 'SSUPD'],
  ['louqe', 'LOUQE'],
  ['ncase', 'NCASE'],
  ['dan cases', 'DAN Cases'],
  ['streacom', 'Streacom'],
  ['haven', 'HAVN'],
  ['havn', 'HAVN'],
  ['tryx', 'TRYX'],
  ['valkyrie', 'Valkyrie'],
  ['asus rog', 'ASUS'],
  ['rog', 'ASUS'],
  ['aorus', 'Gigabyte'],
]);

const SORTED_BRAND_KEYS = [...BRAND_ALIASES.keys()].sort(
  (a, b) => b.length - a.length,
);

function normalizeBrand(raw) {
  const s = cleanStr(raw);
  if (!s) return null;
  const lower = s.toLowerCase();
  if (BRAND_ALIASES.has(lower)) return BRAND_ALIASES.get(lower);
  return s;
}

function splitBrandAndModel(fullName, explicitBrand = null) {
  const rawName = cleanStr(fullName) ?? '';
  let brand = normalizeBrand(explicitBrand);
  let model = rawName;

  if (!brand && rawName) {
    const lower = rawName.toLowerCase();
    for (const key of SORTED_BRAND_KEYS) {
      if (lower === key || lower.startsWith(`${key} `) || lower.startsWith(`${key}-`)) {
        brand = BRAND_ALIASES.get(key);
        model = rawName.slice(key.length).replace(/^[\s-]+/, '').trim();
        break;
      }
    }
    if (!brand) {
      const firstSpace = rawName.indexOf(' ');
      if (firstSpace > 0) {
        brand = normalizeBrand(rawName.slice(0, firstSpace));
        model = rawName.slice(firstSpace + 1).trim();
      } else {
        brand = '';
        model = rawName;
      }
    }
  } else if (brand && model) {
    const lower = model.toLowerCase();
    const bLower = brand.toLowerCase();
    if (lower.startsWith(`${bLower} `)) {
      model = model.slice(brand.length).trim();
    } else {
      // Also strip raw explicitBrand prefix if different casing/alias
      const rawB = cleanStr(explicitBrand);
      if (rawB && lower.startsWith(`${rawB.toLowerCase()} `)) {
        model = model.slice(rawB.length).trim();
      }
    }
  }

  return {
    brand: brand ?? '',
    model: model || rawName,
  };
}

function normKey(val) {
  return String(val ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function stripLeadingBrandFromKey(brand, name) {
  const b = normKey(brand);
  const n = normKey(name);
  if (b && n.startsWith(b) && n.length > b.length) {
    return `${b}:${n.slice(b.length)}`;
  }
  return `${b}:${n}`;
}

function trimRowTrailingNulls(row) {
  let end = row.length;
  while (end > 0 && (row[end - 1] === null || row[end - 1] === undefined)) {
    end -= 1;
  }
  return row.slice(0, end);
}

function mergePreferRich(existing, incoming) {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (k === 'src') continue;
    if (
      (out[k] === null || out[k] === undefined || out[k] === '') &&
      v !== null &&
      v !== undefined &&
      v !== ''
    ) {
      out[k] = v;
    }
  }
  if (existing.src && incoming.src && existing.src !== incoming.src) {
    const parts = new Set([...existing.src.split('+'), ...incoming.src.split('+')]);
    out.src = [...parts].join('+');
  }
  return out;
}

function countPopulated(obj, fields) {
  let n = 0;
  for (const f of fields) {
    const v = obj[f];
    if (v !== null && v !== undefined && v !== '') n += 1;
  }
  return n;
}

function finalizeCategory(records, fields, sortKeyFn) {
  const sorted = [...records].sort((a, b) => {
    const ka = sortKeyFn(a);
    const kb = sortKeyFn(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const rows = sorted.map((rec) =>
    trimRowTrailingNulls(fields.map((f) => rec[f] ?? null)),
  );
  return { v: 1, fields, rows };
}

/* -------------------------------------------------------------------------- */
/* Category Normalizers                                                       */
/* -------------------------------------------------------------------------- */

function buildCpus(bcCpus, dxCpus) {
  const fields = [
    'brand',
    'name',
    'codename',
    'socket',
    'base_clock_ghz',
    'turbo_clock_ghz',
    'cache_mb',
    'cores',
    'threads',
    'tdp_w',
    'process_nm',
    'max_memory_gb',
    'memory_type',
    'memory_speed_mhz',
    'launch_date',
    'is_mobile',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcCpus) {
    const fullName = cleanStr(raw.metadata?.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(
      fullName,
      raw.metadata?.manufacturer,
    );
    if (!brand) continue;

    let processNm = null;
    const lith = cleanStr(raw.specifications?.lithography);
    if (lith) {
      const m = lith.match(/(\d+(?:\.\d+)?)\s*nm/i);
      if (m) processNm = toInt(m[1]);
    }

    const memTypes = Array.isArray(raw.specifications?.memory?.types)
      ? raw.specifications.memory.types
          .map((t) => cleanStr(t))
          .filter(Boolean)
          .join(' / ')
      : null;

    const releaseYear = raw.metadata?.releaseYear;
    const launchDate =
      releaseYear && Number.isFinite(Number(releaseYear))
        ? String(releaseYear)
        : null;

    const isMobile = /\b(mobile|laptop|hx|hs|u\b|hk|hq|mq)\b/i.test(model) &&
      !/desktop/i.test(model)
      ? true
      : false;

    const rec = {
      brand,
      name: model,
      codename: cleanStr(raw.coreFamily) ?? cleanStr(raw.microarchitecture),
      socket: cleanStr(raw.socket),
      base_clock_ghz: toNum(raw.clocks?.performance?.base, 2),
      turbo_clock_ghz: toNum(raw.clocks?.performance?.boost, 2),
      cache_mb: toNum(raw.cache?.l3, 2),
      cores: toInt(raw.cores?.total),
      threads: toInt(raw.cores?.threads),
      tdp_w: toInt(raw.specifications?.tdp),
      process_nm: processNm,
      max_memory_gb: toInt(raw.specifications?.memory?.maxSupport),
      memory_type: memTypes || null,
      memory_speed_mhz: null,
      launch_date: launchDate,
      is_mobile: isMobile,
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxCpus) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);
    if (!brand) continue;

    const rec = {
      brand,
      name: model,
      codename: cleanStr(raw.microarchitecture),
      socket: null,
      base_clock_ghz: toNum(raw.core_clock, 2),
      turbo_clock_ghz: toNum(raw.boost_clock, 2),
      cache_mb: null,
      cores: toInt(raw.core_count),
      threads: null,
      tdp_w: toInt(raw.tdp),
      process_nm: null,
      max_memory_gb: null,
      memory_type: null,
      memory_speed_mhz: null,
      launch_date: null,
      is_mobile: false,
      spec_url: null,
      src: 'dx',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) => `${r.brand.toLowerCase()}\0${r.name.toLowerCase()}`,
  );
}

function parseDirectXPair(major, minor, rawDxStr = null) {
  if (major && Number.isFinite(Number(major))) {
    const maj = Number(major);
    const min = Number.isFinite(Number(minor)) ? Number(minor) : 0;
    if (maj === 12) {
      const fl = min >= 0 && min <= 2 ? `12_${min}` : '12_0';
      return { directx_version: '12', directx_feature_level: fl };
    }
    if (maj === 11) {
      return {
        directx_version: min > 0 ? `11.${min}` : '11',
        directx_feature_level: `11_${min}`,
      };
    }
    if (maj === 10) {
      return {
        directx_version: min > 0 ? `10.${min}` : '10',
        directx_feature_level: null,
      };
    }
    if (maj === 9) {
      return {
        directx_version: min > 0 ? `9.${min}` : '9',
        directx_feature_level: null,
      };
    }
    if (maj > 0) {
      return { directx_version: String(maj), directx_feature_level: null };
    }
  }

  const s = cleanStr(rawDxStr);
  if (!s) return { directx_version: null, directx_feature_level: null };
  const flMatch = s.match(/(1[12]_[012])/);
  const numMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return { directx_version: null, directx_feature_level: null };
  const [majStr, minStr] = numMatch[1].split('.');
  return parseDirectXPair(
    Number(majStr),
    minStr ? Number(minStr) : 0,
    null,
  ).directx_feature_level
    ? {
        ...parseDirectXPair(Number(majStr), minStr ? Number(minStr) : 0, null),
        ...(flMatch ? { directx_feature_level: flMatch[1] } : {}),
      }
    : parseDirectXPair(Number(majStr), minStr ? Number(minStr) : 0, null);
}

function detectGpuFlags(name, generation, busInterface) {
  const n = `${name ?? ''} ${generation ?? ''}`;
  const isMobile =
    /\b(mobile|laptop|max-q|mobility|notebook|go)\b/i.test(n) ||
    /\b(?:rtx|gtx|gt|gts|rx|hd|r[579])\s*\d{3,4}m\b/i.test(n) ||
    /\b(?:m\d{3,4}[a-z]*)\b/i.test(name ?? '') ||
    /\bgeforce\s+(?:mx\d+|go)\b/i.test(n);

  const isWorkstation =
    /\b(quadro|rtx\s+a\d+|rtx\s+\d+\s+ada|rtx\s+pro|firepro|firegl|radeon\s+pro|tesla|instinct|arc\s+pro|nvs)\b/i.test(
      n,
    );

  const isIntegrated =
    busInterface === 'IGP' ||
    /\b(igp|integrated|uhd\s+graphics|iris|hd\s+graphics\s+\d+|radeon\s+vega\s+\d+|radeon\s+graphics)\b/i.test(
      n,
    );

  const category = isMobile
    ? 'Mobile'
    : isWorkstation
      ? 'Workstation'
      : isIntegrated
        ? 'Integrated'
        : 'Desktop';

  return { isMobile, category };
}

function buildGpus(dbgpuRows, rightnowRows) {
  const fields = [
    'brand',
    'name',
    'architecture',
    'vram_gb',
    'vram_type',
    'bus_interface',
    'process_nm',
    'tdp_w',
    'directx_version',
    'directx_feature_level',
    'category',
    'is_mobile',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of dbgpuRows) {
    const brand = normalizeBrand(raw.manufacturer);
    const name = cleanStr(raw.name);
    if (!brand || !name) continue;

    const dx = parseDirectXPair(
      raw.directx_major_version,
      raw.directx_minor_version,
    );
    const bus = cleanStr(raw.bus_interface);
    const { isMobile, category } = detectGpuFlags(name, raw.generation, bus);
    const rawVram = toNum(raw.memory_size_gb);
    const vramGb =
      rawVram === null ? null : toNum(rawVram, rawVram < 1 ? 3 : 2);

    const rec = {
      brand,
      name,
      architecture: cleanStr(raw.architecture),
      vram_gb: vramGb,
      vram_type: cleanStr(raw.memory_type),
      bus_interface: bus,
      process_nm: toInt(raw.process_size_nm),
      tdp_w: toInt(raw.thermal_design_power_w),
      directx_version: dx.directx_version,
      directx_feature_level: dx.directx_feature_level,
      category,
      is_mobile: isMobile,
      spec_url: sanitizeHttpUrl(raw.tpu_url),
      src: 'dbgpu',
    };

    const key = stripLeadingBrandFromKey(brand, name);
    if (!map.has(key)) {
      map.set(key, rec);
    } else {
      // If duplicate name exists (e.g. VRAM variants), keep richer or separate by VRAM
      const existing = map.get(key);
      if (
        existing.vram_gb &&
        rec.vram_gb &&
        Math.abs(existing.vram_gb - rec.vram_gb) > 0.1
      ) {
        map.set(`${key}:${rec.vram_gb}`, rec);
      } else {
        map.set(key, mergePreferRich(existing, rec));
      }
    }
  }

  for (const raw of rightnowRows) {
    const brand = normalizeBrand(raw.manufacturer || raw.vendor);
    const name = cleanStr(raw.name);
    if (!brand || !name) continue;

    const dx = parseDirectXPair(null, null, raw.directX);
    const bus = cleanStr(raw.busInterface);
    const { isMobile, category } = detectGpuFlags(name, raw.generation, bus);
    const rawVram = toNum(raw.memorySize);
    const vramGb =
      rawVram === null ? null : toNum(rawVram, rawVram < 1 ? 3 : 2);

    const rec = {
      brand,
      name,
      architecture: cleanStr(raw.architecture),
      vram_gb: vramGb,
      vram_type: cleanStr(raw.memoryType),
      bus_interface: bus,
      process_nm: toInt(raw.processSize),
      tdp_w: toInt(raw.tdp),
      directx_version: dx.directx_version,
      directx_feature_level: dx.directx_feature_level,
      category,
      is_mobile: isMobile,
      spec_url: sanitizeHttpUrl(raw.url),
      src: 'rn',
    };

    const key = stripLeadingBrandFromKey(brand, name);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) => `${r.brand.toLowerCase()}\0${r.name.toLowerCase()}`,
  );
}

function buildGpuCards(bcGpus, dxCards) {
  const fields = [
    'brand',
    'model',
    'chipset',
    'part_number',
    'cooling_type',
    'length_mm',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcGpus) {
    const fullName = cleanStr(raw.metadata?.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(
      fullName,
      raw.metadata?.manufacturer,
    );
    if (!brand) continue;

    const chipset = cleanStr(raw.chipset);
    const partNumber = Array.isArray(raw.metadata?.part_numbers)
      ? cleanStr(raw.metadata.part_numbers[0])
      : null;

    const rec = {
      brand,
      model,
      chipset,
      part_number: partNumber,
      cooling_type: cleanStr(raw.cooling),
      length_mm: toInt(raw.length),
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = `${normKey(brand)}:${normKey(model)}:${normKey(chipset ?? '')}`;
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxCards) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);
    if (!brand) continue;

    const chipset = cleanStr(raw.chipset)
      ?.replace(/\s+\d+\s*GB$/i, '')
      .trim() || null;

    const rec = {
      brand,
      model,
      chipset,
      part_number: null,
      cooling_type: null,
      length_mm: toInt(raw.length),
      spec_url: null,
      src: 'dx',
    };

    const key = `${normKey(brand)}:${normKey(model)}:${normKey(chipset ?? '')}`;
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) => `${r.brand.toLowerCase()}\0${r.model.toLowerCase()}`,
  );
}

const CHIPSET_REGEX =
  /\b(X870E|X870|B850|B840|X670E|X670|B650E|B650|A620|TRX50|WRX90|X570|B550|A520|X470|B450|A320|X370|B350|Z890|B860|H810|Z790|B760|H770|W680|Z690|H670|B660|H610|Z590|B560|H570|H510|Z490|B460|H470|H410|Z390|Z370|B365|B360|H370|H310|Z270|B250|H270|H110|Z170|B150|H170|X299|X99|Z97|H97|Z87|H87|B85|Z77|P67|Z68|X79|X58|P45|P35|G41|G31|990FX|970|890FX|790FX)\b/i;

function buildMotherboards(bcMbs, dxMbs) {
  const fields = [
    'brand',
    'model',
    'socket',
    'chipset',
    'form_factor',
    'memory_type',
    'launch_date',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcMbs) {
    const fullName = cleanStr(raw.metadata?.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(
      fullName,
      raw.metadata?.manufacturer,
    );
    if (!brand) continue;

    let chipset = cleanStr(raw.chipset);
    if (chipset) {
      chipset = chipset.replace(/^(?:Intel|AMD)\s+/i, '').trim();
    }
    const releaseYear = raw.metadata?.releaseYear;

    const rec = {
      brand,
      model,
      socket: cleanStr(raw.socket),
      chipset: chipset || null,
      form_factor: cleanStr(raw.form_factor),
      memory_type: cleanStr(raw.memory?.ram_type),
      launch_date:
        releaseYear && Number.isFinite(Number(releaseYear))
          ? String(releaseYear)
          : null,
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxMbs) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);
    if (!brand) continue;

    const chipMatch = model.match(CHIPSET_REGEX);
    const socket = cleanStr(raw.socket);
    let inferredMem = null;
    if (socket && /AM5|LGA\s*1851/i.test(socket)) inferredMem = 'DDR5';
    else if (socket && /AM4|LGA\s*1200|LGA\s*1151/i.test(socket))
      inferredMem = 'DDR4';

    const rec = {
      brand,
      model,
      socket,
      chipset: chipMatch ? chipMatch[1].toUpperCase() : null,
      form_factor: cleanStr(raw.form_factor),
      memory_type: inferredMem,
      launch_date: null,
      spec_url: null,
      src: 'dx',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) => `${r.brand.toLowerCase()}\0${r.model.toLowerCase()}`,
  );
}

function buildRamKits(bcRam, dxRam) {
  const fields = [
    'brand',
    'model',
    'capacity_gb',
    'modules_count',
    'ram_type',
    'speed_mhz',
    'pc_rating',
    'is_mobile',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcRam) {
    const fullName = cleanStr(raw.metadata?.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(
      fullName,
      raw.metadata?.manufacturer,
    );
    const formFactor = cleanStr(raw.form_factor) ?? '';
    const isMobile =
      /\b(so-?dimm|sodimm|260-pin|262-pin|204-pin|200-pin)\b/i.test(
        `${formFactor} ${model}`,
      );

    const rec = {
      brand: brand || null,
      model,
      capacity_gb: toInt(raw.capacity),
      modules_count: toInt(raw.modules?.quantity),
      ram_type: cleanStr(raw.ram_type),
      speed_mhz: toInt(raw.speed),
      pc_rating: null,
      is_mobile: isMobile,
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = `${normKey(rec.brand)}:${normKey(model)}:${rec.capacity_gb ?? ''}:${rec.modules_count ?? ''}:${rec.ram_type ?? ''}:${rec.speed_mhz ?? ''}:${isMobile ? 1 : 0}`;
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxRam) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);

    let ramType = null;
    let speedMhz = null;
    if (Array.isArray(raw.speed) && raw.speed.length >= 2) {
      const gen = toInt(raw.speed[0]);
      if (gen && gen >= 2 && gen <= 6) ramType = `DDR${gen}`;
      speedMhz = toInt(raw.speed[1]);
    }

    let modulesCount = null;
    let capacityGb = null;
    if (Array.isArray(raw.modules) && raw.modules.length >= 2) {
      modulesCount = toInt(raw.modules[0]);
      const perStick = toNum(raw.modules[1]);
      if (modulesCount && perStick) {
        capacityGb = Math.round(modulesCount * perStick);
      }
    }

    const isMobile = /\b(so-?dimm|sodimm)\b/i.test(model);
    const modelNorm = `${model}${ramType && speedMhz ? ` ${ramType}-${speedMhz}` : ''}`;

    const rec = {
      brand: brand || null,
      model: modelNorm,
      capacity_gb: capacityGb,
      modules_count: modulesCount,
      ram_type: ramType,
      speed_mhz: speedMhz,
      pc_rating: null,
      is_mobile: isMobile,
      spec_url: null,
      src: 'dx',
    };

    const key = `${normKey(rec.brand)}:${normKey(model)}:${capacityGb ?? ''}:${modulesCount ?? ''}:${ramType ?? ''}:${speedMhz ?? ''}:${isMobile ? 1 : 0}`;
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) =>
      `${(r.brand ?? '').toLowerCase()}\0${r.model.toLowerCase()}\0${r.capacity_gb ?? 0}`,
  );
}

function normalizeDriveFormFactor(formFactor, iface, isNvme, storageType) {
  const ff = cleanStr(formFactor) ?? '';
  const ifc = cleanStr(iface) ?? '';
  const combined = `${ff} ${ifc}`.toLowerCase();
  if (isNvme || /nvme/.test(combined)) {
    return ff.toLowerCase().startsWith('m.2') ? 'M.2 NVMe' : 'NVMe';
  }
  if (/m\.2/.test(combined)) {
    return /pcie/.test(combined) ? 'M.2 NVMe' : 'M.2 SATA';
  }
  if (/2\.5/.test(combined)) return '2.5" SATA';
  if (/3\.5/.test(combined)) return '3.5" HDD';
  if (storageType === 'HDD' && !ff) return '3.5" HDD';
  return ff || null;
}

function buildStorageDrives(bcStorage, dxStorage) {
  const fields = [
    'brand',
    'model',
    'model_number',
    'capacity_gb',
    'form_factor',
    'nand_type',
    'read_mb_s',
    'write_mb_s',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcStorage) {
    const rawName = cleanStr(raw.metadata?.name);
    if (!rawName) continue;
    const { brand, model: strippedModel } = splitBrandAndModel(
      rawName,
      raw.metadata?.manufacturer,
    );

    const series = cleanStr(raw.metadata?.series);
    const capGb = toInt(raw.capacity);
    // Clean overly verbose Amazon titles when series is known
    let model = strippedModel;
    if (model.length > 70 && series) {
      const capLabel = capGb
        ? capGb >= 1000 && capGb % 1000 === 0
          ? `${capGb / 1000}TB`
          : `${capGb}GB`
        : '';
      const cleanSeries =
        brand && series.toLowerCase().startsWith(brand.toLowerCase())
          ? series.slice(brand.length).trim()
          : series;
      model = [cleanSeries, capLabel].filter(Boolean).join(' ');
    } else if (model.length > 85) {
      model = model.split(',')[0].slice(0, 80).trim();
    }

    const nandMatch = rawName.match(
      /\b(3D\s*TLC|3D\s*QLC|3D\s*NAND|V-NAND|TLC|QLC|MLC|SLC)\b/i,
    );
    const rwMatch = rawName.match(
      /(\d{3,5})\s*(?:MB\/s|MBps).*?(\d{3,5})\s*(?:MB\/s|MBps)/i,
    );

    const partNum = Array.isArray(raw.metadata?.part_numbers)
      ? cleanStr(
          raw.metadata.part_numbers.find(
            (p) => typeof p === 'string' && !/^[0-9a-f]{8}-/i.test(p),
          ),
        )
      : null;

    const formFactor = normalizeDriveFormFactor(
      raw.form_factor,
      raw.interface,
      Boolean(raw.nvme),
      raw.storage_type,
    );

    const rec = {
      brand: brand || null,
      model,
      model_number: partNum,
      capacity_gb: capGb,
      form_factor: formFactor,
      nand_type: nandMatch ? nandMatch[1].replace(/\s+/g, ' ').toUpperCase() : null,
      read_mb_s: rwMatch ? toInt(rwMatch[1]) : null,
      write_mb_s: rwMatch ? toInt(rwMatch[2]) : null,
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = `${normKey(rec.brand)}:${normKey(model)}:${capGb ?? ''}:${normKey(formFactor)}`;
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxStorage) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);
    const capGb = toInt(raw.capacity);
    const formFactor = normalizeDriveFormFactor(
      raw.form_factor,
      raw.interface,
      /nvme|pcie/i.test(String(raw.interface ?? '')),
      raw.type,
    );

    const rec = {
      brand: brand || null,
      model,
      model_number: null,
      capacity_gb: capGb,
      form_factor: formFactor,
      nand_type: null,
      read_mb_s: null,
      write_mb_s: null,
      spec_url: null,
      src: 'dx',
    };

    const key = `${normKey(rec.brand)}:${normKey(model)}:${capGb ?? ''}:${normKey(formFactor)}`;
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) =>
      `${(r.brand ?? '').toLowerCase()}\0${r.model.toLowerCase()}\0${r.capacity_gb ?? 0}`,
  );
}

function normalizeEfficiency(raw) {
  const s = cleanStr(raw);
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.includes('titanium')) return '80+ Titanium';
  if (lower.includes('platinum')) return '80+ Platinum';
  if (lower.includes('gold')) return '80+ Gold';
  if (lower.includes('silver')) return '80+ Silver';
  if (lower.includes('bronze')) return '80+ Bronze';
  if (lower === 'plus' || lower === '80+') return '80+';
  return s;
}

function normalizeModular(raw) {
  const s = cleanStr(raw);
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'full' || lower === 'fully modular') return 'Full';
  if (lower === 'semi' || lower === 'semi-modular') return 'Semi';
  if (lower === 'no' || lower === 'non-modular' || lower === 'none')
    return 'Non-Modular';
  return s;
}

function buildPsus(bcPsus, dxPsus) {
  const fields = [
    'brand',
    'model',
    'wattage',
    'efficiency_rating',
    'modular',
    'has_8pin_cpu',
    'has_6pin_pcie',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcPsus) {
    const fullName = cleanStr(raw.metadata?.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(
      fullName,
      raw.metadata?.manufacturer,
    );
    if (!brand) continue;

    const c = raw.connectors ?? {};
    const has8Pin =
      typeof c.eps_8_pin === 'number' ? c.eps_8_pin > 0 : null;
    const has6Pin =
      typeof c.pcie_6_plus_2_pin === 'number' || typeof c.pcie_6_pin === 'number'
        ? (c.pcie_6_plus_2_pin ?? 0) > 0 || (c.pcie_6_pin ?? 0) > 0
        : null;

    const rec = {
      brand,
      model,
      wattage: toInt(raw.wattage),
      efficiency_rating: normalizeEfficiency(raw.efficiency_rating),
      modular: normalizeModular(raw.modular),
      has_8pin_cpu: has8Pin,
      has_6pin_pcie: has6Pin,
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = `${normKey(brand)}:${normKey(model)}:${rec.wattage ?? ''}`;
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxPsus) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);
    if (!brand) continue;

    const rec = {
      brand,
      model,
      wattage: toInt(raw.wattage),
      efficiency_rating: normalizeEfficiency(raw.efficiency),
      modular: normalizeModular(raw.modular),
      has_8pin_cpu: null,
      has_6pin_pcie: null,
      spec_url: null,
      src: 'dx',
    };

    const key = `${normKey(brand)}:${normKey(model)}:${rec.wattage ?? ''}`;
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) => `${r.brand.toLowerCase()}\0${r.model.toLowerCase()}`,
  );
}

function formatColor(raw) {
  if (Array.isArray(raw)) {
    const joined = raw
      .map((c) => cleanStr(c))
      .filter(Boolean)
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase())
      .join(' / ');
    return joined || null;
  }
  return cleanStr(raw);
}

function buildCases(bcCases, dxCases) {
  const fields = [
    'brand',
    'model',
    'form_factor',
    'color',
    'max_gpu_length_mm',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcCases) {
    const fullName = cleanStr(raw.metadata?.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(
      fullName,
      raw.metadata?.manufacturer,
    );
    if (!brand) continue;

    const rec = {
      brand,
      model,
      form_factor: cleanStr(raw.form_factor),
      color: formatColor(raw.color),
      max_gpu_length_mm: toInt(raw.max_video_card_length),
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxCases) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);
    if (!brand) continue;

    const rec = {
      brand,
      model,
      form_factor: cleanStr(raw.type),
      color: formatColor(raw.color),
      max_gpu_length_mm: null,
      spec_url: null,
      src: 'dx',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) => `${r.brand.toLowerCase()}\0${r.model.toLowerCase()}`,
  );
}

function buildCoolers(bcCoolers, dxCoolers) {
  const fields = [
    'brand',
    'model',
    'cooler_type',
    'fan_size_mm',
    'socket_support',
    'tdp_rating_w',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcCoolers) {
    const fullName = cleanStr(raw.metadata?.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(
      fullName,
      raw.metadata?.manufacturer,
    );
    if (!brand) continue;

    const isAio = Boolean(raw.water_cooled || raw.radiator_size);
    const fanSize = toInt(raw.fan_size) ?? toInt(raw.radiator_size);
    const sockets = Array.isArray(raw.cpu_sockets)
      ? raw.cpu_sockets.map((s) => cleanStr(s)).filter(Boolean).join(', ')
      : null;

    const rec = {
      brand,
      model,
      cooler_type: isAio ? 'AIO Liquid' : 'Air',
      fan_size_mm: fanSize,
      socket_support: sockets || null,
      tdp_rating_w: null,
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxCoolers) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);
    if (!brand) continue;

    const radSize = toInt(raw.size);
    const isAio = radSize !== null && radSize >= 120;

    const rec = {
      brand,
      model,
      cooler_type: isAio ? 'AIO Liquid' : 'Air',
      fan_size_mm: radSize,
      socket_support: null,
      tdp_rating_w: null,
      spec_url: null,
      src: 'dx',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) => `${r.brand.toLowerCase()}\0${r.model.toLowerCase()}`,
  );
}

function buildWifiCards(bcNetwork, dxWifi) {
  const fields = [
    'brand',
    'product',
    'model',
    'wifi_standard',
    'bluetooth_version',
    'form_factor',
    'is_mobile',
    'spec_url',
    'src',
  ];
  const map = new Map();

  for (const raw of bcNetwork) {
    const fullName = cleanStr(raw.metadata?.name);
    if (!fullName) continue;
    if (
      !/\b(wi-?fi|wireless|802\.11|ax\d{3}|be\d{3}|ac\d{3}|bluetooth)\b/i.test(
        fullName,
      )
    ) {
      continue;
    }

    const { brand, model } = splitBrandAndModel(
      fullName,
      raw.metadata?.manufacturer,
    );
    if (!brand) continue;

    const stdMatch = fullName.match(
      /(Wi-Fi\s*(?:7|6E|6|5|4)|802\.11\s*(?:be|ax|ac|n|g|a)(?:\/[a-z]+)*)/i,
    );
    const btMatch = fullName.match(/Bluetooth\s*(\d+(?:\.\d+)?)/i);
    const ffMatch = fullName.match(
      /(PCIe\s*x\d+|M\.2(?:\s*\d{4})?|Mini\s*PCIe|USB\s*[\d.]*)/i,
    );
    const formFactor = ffMatch ? ffMatch[1].replace(/\s+/g, ' ') : null;
    const isMobile = formFactor ? /m\.2|mini/i.test(formFactor) : false;

    const rec = {
      brand,
      product: stdMatch ? stdMatch[1] : null,
      model,
      wifi_standard: stdMatch ? stdMatch[1] : null,
      bluetooth_version: btMatch ? btMatch[1] : null,
      form_factor: formFactor,
      is_mobile: isMobile,
      spec_url: sanitizeHttpUrl(raw.general_product_information?.manufacturer_url),
      src: 'bc',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  for (const raw of dxWifi) {
    const fullName = cleanStr(raw.name);
    if (!fullName) continue;
    const { brand, model } = splitBrandAndModel(fullName);
    if (!brand) continue;

    const protocol = cleanStr(raw.protocol);
    const formFactor = cleanStr(raw.interface);
    const isMobile = formFactor ? /m\.2|mini/i.test(formFactor) : false;

    const rec = {
      brand,
      product: protocol,
      model,
      wifi_standard: protocol,
      bluetooth_version: null,
      form_factor: formFactor,
      is_mobile: isMobile,
      spec_url: null,
      src: 'dx',
    };

    const key = stripLeadingBrandFromKey(brand, model);
    map.set(key, map.has(key) ? mergePreferRich(map.get(key), rec) : rec);
  }

  return finalizeCategory(
    [...map.values()],
    fields,
    (r) => `${r.brand.toLowerCase()}\0${r.model.toLowerCase()}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function resolveDbGpuAssetUrl() {
  try {
    const rel = await fetchJson(DBGPU_LATEST_API);
    const jsonAsset = Array.isArray(rel?.assets)
      ? rel.assets.find(
          (a) =>
            typeof a?.name === 'string' &&
            a.name.endsWith('.json') &&
            typeof a?.browser_download_url === 'string',
        )
      : null;
    if (jsonAsset) {
      return {
        url: jsonAsset.browser_download_url,
        tag: rel.tag_name ?? 'latest',
      };
    }
  } catch (err) {
    console.warn(
      `Warning: dbgpu latest release query failed (${err.message}); using fallback.`,
    );
  }
  return { url: DBGPU_FALLBACK_URL, tag: '2025.12' };
}

async function main() {
  console.log('Fetching open-source hardware datasets...');

  const dbgpuInfo = await resolveDbGpuAssetUrl();

  const [
    dbgpuRows,
    rightnowRows,
    dxCpu,
    dxGpuCard,
    dxMb,
    dxRam,
    dxStorage,
    dxPsu,
    dxCase,
    dxCooler,
    dxWifi,
    bcTarGz,
  ] = await Promise.all([
    fetchJson(dbgpuInfo.url),
    fetchJson(RIGHTNOW_GPU_URL),
    fetchJson(`${DOCYX_BASE}/cpu.json`),
    fetchJson(`${DOCYX_BASE}/video-card.json`),
    fetchJson(`${DOCYX_BASE}/motherboard.json`),
    fetchJson(`${DOCYX_BASE}/memory.json`),
    fetchJson(`${DOCYX_BASE}/internal-hard-drive.json`),
    fetchJson(`${DOCYX_BASE}/power-supply.json`),
    fetchJson(`${DOCYX_BASE}/case.json`),
    fetchJson(`${DOCYX_BASE}/cpu-cooler.json`),
    fetchJson(`${DOCYX_BASE}/wireless-network-card.json`),
    fetchBuffer(BUILDCORES_TARBALL_URL),
  ]);

  console.log(
    `Extracting buildcores-open-db tarball (${(bcTarGz.length / (1024 * 1024)).toFixed(2)} MB)...`,
  );
  const bc = parseBuildcoresTarGz(bcTarGz);

  const outputs = {
    cpus: buildCpus(bc.get('CPU') ?? [], dxCpu),
    gpus: buildGpus(dbgpuRows, rightnowRows),
    gpu_cards: buildGpuCards(bc.get('GPU') ?? [], dxGpuCard),
    motherboards: buildMotherboards(bc.get('Motherboard') ?? [], dxMb),
    ram_kits: buildRamKits(bc.get('RAM') ?? [], dxRam),
    storage_drive_models: buildStorageDrives(
      bc.get('Storage') ?? [],
      dxStorage,
    ),
    psus: buildPsus(bc.get('PSU') ?? [], dxPsu),
    cases: buildCases(bc.get('PCCase') ?? [], dxCase),
    coolers: buildCoolers(bc.get('CPUCooler') ?? [], dxCooler),
    wifi_cards: buildWifiCards(bc.get('NetworkCard') ?? [], dxWifi),
  };

  for (const [name, dataset] of Object.entries(outputs)) {
    if (!dataset.rows || dataset.rows.length === 0) {
      throw new Error(
        `Guardrail failed: category "${name}" produced 0 rows. Aborting without overwriting catalog.`,
      );
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const manifestCategories = {};
  console.log('\nCategory              | Items  | Raw KB  | Gzip KB');
  console.log('----------------------+--------+---------+--------');

  for (const [name, dataset] of Object.entries(outputs)) {
    const fileName = `${name}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    const serialized = JSON.stringify(dataset);
    const gzipped = zlib.gzipSync(Buffer.from(serialized, 'utf8'));
    await fs.writeFile(filePath, serialized, 'utf8');

    const rawKb = Math.round((Buffer.byteLength(serialized, 'utf8') / 1024) * 10) / 10;
    const gzKb = Math.round((gzipped.length / 1024) * 10) / 10;

    manifestCategories[name] = {
      file: fileName,
      count: dataset.rows.length,
      rawBytes: Buffer.byteLength(serialized, 'utf8'),
      gzipBytes: gzipped.length,
    };

    console.log(
      `${name.padEnd(21)} | ${String(dataset.rows.length).padStart(6)} | ${rawKb.toFixed(1).padStart(7)} | ${gzKb.toFixed(1).padStart(6)}`,
    );
  }

  const manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    sources: {
      dbgpu: dbgpuInfo.tag,
      rightnow_gpu: 'main',
      docyx_pc_part_dataset: 'main',
      buildcores_open_db: 'main',
    },
    categories: manifestCategories,
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.log(`\nWrote catalog files to ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Catalog sync failed:', err);
  process.exit(1);
});
