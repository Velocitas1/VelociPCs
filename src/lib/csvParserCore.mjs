/**
 * Shared transposed CSV parser and hardware enrichment module used by both
 * the browser CSV Importer UI and the Node seed SQL generator.
 */

export const CPU_ENRICHMENT = {
  'intel|ryzen 9 8945hs': null,
  'amd|ryzen 9 8945hs': {
    socket: 'FP8',
    codename: 'Hawk Point (Zen 4)',
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Ryzen%209%208945HS',
  },
  'amd|ryzen 9 4900hs': {
    socket: 'FP6',
    codename: 'Renoir (Zen 2)',
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Ryzen%209%204900HS',
  },
  'intel|core i7 7700hq': {
    socket: 'FCBGA1440',
    codename: 'Kaby Lake',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i7-7700HQ',
  },
  'intel|core i7 6700hq': {
    socket: 'FCBGA1440',
    codename: 'Skylake',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i7-6700HQ',
  },
  'intel|core i7-4700mq': {
    socket: 'FCPGA946',
    codename: 'Haswell',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i7-4700MQ',
  },
  'intel|core i5 3230m': {
    socket: 'FCPGA988',
    codename: 'Ivy Bridge',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i5-3230M',
  },
  'intel|core i7 4800mq': {
    socket: 'FCPGA946',
    codename: 'Haswell',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i7-4800MQ',
  },
  'intel|core i7 720qm': {
    socket: 'PGA988',
    codename: 'Clarksfield',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i7-720QM',
  },
  'intel|core 2 duo t9550': {
    socket: 'Socket P',
    codename: 'Penryn',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+2+Duo+T9550',
  },
  'intel|core i9 9900k': {
    socket: 'LGA1151',
    codename: 'Coffee Lake',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i9-9900K',
  },
  'amd|ryzen 5 5600x': {
    socket: 'AM4',
    codename: 'Vermeer (Zen 3)',
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Ryzen%205%205600X',
  },
  'amd|ryzen 3 2200g': {
    socket: 'AM4',
    codename: 'Raven Ridge',
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Ryzen%203%202200G',
  },
  'intel|core i5-4690': {
    socket: 'LGA1150',
    codename: 'Haswell',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i5-4690',
  },
  'amd|phenom ii x4 965': {
    socket: 'AM3',
    codename: 'Deneb',
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Phenom%20II%20X4%20965',
  },
  'amd|phenom ii x4 830': {
    socket: 'AM3',
    codename: 'Deneb',
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Phenom%20II%20X4%20830',
  },
  'amd|athlon ii x4 620': {
    socket: 'AM3',
    codename: 'Propus',
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Athlon%20II%20X4%20620',
  },
  'intel|core 2 quad q8200': {
    socket: 'LGA775',
    codename: 'Yorkfield',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+2+Quad+Q8200',
  },
  'intel|core i5-3470': {
    socket: 'LGA1155',
    codename: 'Ivy Bridge',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Core+i5-3470',
  },
  'intel|xeon x5260': {
    socket: 'LGA771',
    codename: 'Wolfdale',
    spec_url: 'https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=Xeon+X5260',
  },
  'amd|fx-8350 black edition': {
    socket: 'AM3+',
    codename: 'Vishera (Piledriver)',
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=FX-8350',
  },
};

export const GPU_ENRICHMENT = {
  // Mobile GPUs
  'nvidia|geforce rtx 4070|mobile': {
    architecture: 'Ada Lovelace',
    directx_version: '12',
    directx_feature_level: '12_2',
    bus_interface: 'PCIe 4.0 x8',
    process_nm: 5,
    tdp_w: 115,
    category: 'High-End Mobile',
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+RTX+4070+Mobile',
  },
  'nvidia|geforce rtx 2060 max-q|mobile': {
    architecture: 'Turing',
    directx_version: '12',
    directx_feature_level: '12_2',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 12,
    tdp_w: 65,
    category: 'Upper-Mid Mobile',
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+RTX+2060+Max-Q',
  },
  'nvidia|geforce gtx 1050|mobile': {
    architecture: 'Pascal',
    directx_version: '12',
    directx_feature_level: '12_1',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 14,
    tdp_w: 75,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+GTX+1050+Mobile',
  },
  'nvidia|geforce gtx 960m|mobile': {
    architecture: 'Maxwell',
    directx_version: '12',
    directx_feature_level: '11_0',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 28,
    tdp_w: 60,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+GTX+960M',
  },
  'nvidia|geforce gt 755m|mobile': {
    architecture: 'Kepler',
    directx_version: '12',
    directx_feature_level: '11_0',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 28,
    tdp_w: 50,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+GT+755M',
  },
  'nvidia|geforce gtx 660m|mobile': {
    architecture: 'Kepler',
    directx_version: '12',
    directx_feature_level: '11_0',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 28,
    tdp_w: 50,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+GTX+660M',
  },
  'amd|radeon hd 8790m|mobile': {
    architecture: 'GCN 1.0 (Mars)',
    directx_version: '12',
    directx_feature_level: '11_1',
    bus_interface: 'PCIe 3.0 x8',
    process_nm: 28,
    tdp_w: 50,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=Radeon+HD+8790M',
  },
  'nvidia|geforce gtx 260m|mobile': {
    architecture: 'Tesla 2.0 (G92B)',
    directx_version: '10.0',
    directx_feature_level: '10_0',
    bus_interface: 'MXM-III (PCIe 2.0 x16)',
    process_nm: 55,
    tdp_w: 75,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+GTX+260M',
  },
  'nvidia|quadro nvs 160m|mobile': {
    architecture: 'Tesla (G98)',
    directx_version: '10.0',
    directx_feature_level: '10_0',
    bus_interface: 'PCIe 2.0 x16',
    process_nm: 65,
    tdp_w: 12,
    vram_gb: 0.25,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=Quadro+NVS+160M',
  },

  // Desktop GPUs
  'nvidia|geforce rtx 2080 ti|desktop': {
    architecture: 'Turing',
    directx_version: '12',
    directx_feature_level: '12_2',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 12,
    tdp_w: 250,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+RTX+2080+Ti',
  },
  'amd|radeon rx 580|desktop': {
    architecture: 'Polaris 20',
    directx_version: '12',
    directx_feature_level: '12_0',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 14,
    tdp_w: 185,
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Radeon%20RX%20580',
  },
  'nvidia|geforce gtx 465|desktop': {
    architecture: 'Fermi (GF100)',
    directx_version: '12',
    directx_feature_level: '11_0',
    bus_interface: 'PCIe 2.0 x16',
    process_nm: 40,
    tdp_w: 200,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+GTX+465',
  },
  'nvidia|geforce gtx 660|desktop': {
    architecture: 'Kepler (GK106)',
    directx_version: '12',
    directx_feature_level: '11_0',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 28,
    tdp_w: 140,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+GTX+660',
  },
  'nvidia|geforce gtx 970|desktop': {
    architecture: 'Maxwell 2.0 (GM204)',
    directx_version: '12',
    directx_feature_level: '12_1',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 28,
    tdp_w: 145,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=GeForce+GTX+970',
  },
  'amd|radeon hd 7770 vapor-x oc|desktop': {
    architecture: 'GCN 1.0 (Cape Verde)',
    directx_version: '12',
    directx_feature_level: '11_1',
    bus_interface: 'PCIe 3.0 x16',
    process_nm: 28,
    tdp_w: 80,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=Radeon+HD+7770',
  },
  'amd|radeon hd 6670|desktop': {
    architecture: 'TeraScale 2 (Turks)',
    directx_version: '11.2',
    directx_feature_level: '11_0',
    bus_interface: 'PCI Express 2.1 x16',
    process_nm: 40,
    tdp_w: 66,
    spec_url: 'https://www.techpowerup.com/gpu-specs/?q=Radeon+HD+6670',
  },
  'amd|radeon rx 6400|desktop': {
    architecture: 'RDNA 2 (Navi 24)',
    directx_version: '12',
    directx_feature_level: '12_2',
    bus_interface: 'PCIe 4.0 x4',
    process_nm: 6,
    tdp_w: 53,
    spec_url: 'https://www.amd.com/en/search/site-search.html#q=Radeon%20RX%206400',
  },
};

export function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

function cleanStr(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

function parseIntNum(val) {
  const s = cleanStr(val);
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/-?\d+/);
  return m ? Number.parseInt(m[0], 10) : null;
}

function parseFloatNum(val) {
  const s = cleanStr(val);
  if (!s) return null;
  const normalized = s.replace(/,/g, '.');
  const m = normalized.match(/-?\d+(?:\.\d+)?/);
  return m ? Number.parseFloat(m[0]) : null;
}

function parseYesNo(val) {
  const s = cleanStr(val);
  if (!s) return null;
  if (/^yes$/i.test(s) || /^true$/i.test(s)) return true;
  if (/^no$/i.test(s) || /^false$/i.test(s)) return false;
  return null;
}

function normalizeBrand(val) {
  const s = cleanStr(val);
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'hp') return 'HP';
  if (lower === 'powercolor') return 'PowerColor';
  if (lower === 'mushkin') return 'Mushkin';
  if (lower === 'adat xpg') return 'ADATA XPG';
  if (lower === 'samsung') return 'SAMSUNG';
  return s;
}

function normalizeCodename(val) {
  const s = cleanStr(val);
  if (!s) return null;
  if (s === 'Kabby Lake') return 'Kaby Lake';
  if (s === 'Denab') return 'Deneb';
  if (s === 'Coffee') return 'Coffee Lake';
  return s;
}

function normalizeLaunchQuarter(val) {
  const s = cleanStr(val);
  if (!s) return null;
  const m = s.match(/^(\d{4})\.([1-4])$/);
  if (m) return `${m[1]}.Q${m[2]}`;
  return s;
}

function normalizeBuildDate(val) {
  const s = cleanStr(val);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = m[1].padStart(2, '0');
  const day = m[2].padStart(2, '0');
  return `${m[3]}-${month}-${day}`;
}

function normalizeResolution(val) {
  const s = cleanStr(val);
  if (!s) return null;
  if (s === '1980 x 1080') return '1920 x 1080';
  return s;
}

function normalizeDirectX(raw) {
  const s = cleanStr(raw);
  if (!s) return { version: null, featureLevel: null };
  const m = s.match(/^([\d.]+)\s*\(([^)]+)\)$/);
  if (m) {
    return { version: m[1].trim(), featureLevel: m[2].trim() };
  }
  return { version: s, featureLevel: null };
}

function normalizeBenchmarkSuite(label) {
  const lower = label.trim().toLowerCase();
  if (lower === 'skydiver') return 'Sky Diver';
  if (lower === 'firestrike') return 'Fire Strike';
  if (lower === 'timespy') return 'Time Spy';
  if (lower === 'cloud gate') return 'Cloud Gate';
  return label.trim();
}

function buildFallbackCpuSpecUrl(brand, name) {
  const q = encodeURIComponent(name);
  if (brand.toLowerCase() === 'intel') {
    return `https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=${q}`;
  }
  if (brand.toLowerCase() === 'amd') {
    return `https://www.amd.com/en/search/site-search.html#q=${q}`;
  }
  return `https://www.google.com/search?q=${q}+specifications`;
}

function buildFallbackGpuSpecUrl(brand, name) {
  const q = encodeURIComponent(name);
  if (brand.toLowerCase() === 'amd') {
    return `https://www.amd.com/en/search/site-search.html#q=${q}`;
  }
  return `https://www.techpowerup.com/gpu-specs/?q=${q}`;
}

export function parseTransposedInventoryCsv(csvText, forcedDeviceType) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error('CSV appears empty or missing header columns.');
  }

  const headerRow = rows[0];
  const rigIndices = [];
  for (let col = 1; col < headerRow.length; col += 1) {
    if (cleanStr(headerRow[col])) {
      rigIndices.push(col);
    }
  }

  if (rigIndices.length === 0) {
    throw new Error('No computer columns found in CSV header row.');
  }

  // Auto-detect Desktop vs Laptop unless forced
  let detectedDeviceType = forcedDeviceType ?? null;
  if (!detectedDeviceType) {
    const labels = new Set(rows.slice(1).map((r) => (r[0] ?? '').trim().toLowerCase()));
    const hasLaptopCols =
      labels.has('screen size') ||
      rows.some(
        (r) =>
          (r[0] ?? '').trim().toLowerCase() === 'brand' &&
          r.slice(1).some((v) => cleanStr(v) !== null),
      );
    detectedDeviceType = hasLaptopCols ? 'Laptop' : 'Desktop';
  }

  const isMobileDefault = detectedDeviceType === 'Laptop';
  const cleanupsApplied = new Set();
  const warnings = [];

  const rigs = rigIndices.map((colIndex) => ({
    name: headerRow[colIndex].trim(),
    device_type: detectedDeviceType,
    brand: null,
    model: null,
    build_date: null,
    overall_rank: null,
    status: 'Active',
    notes: null,
    cpu_count: 1,
    cpu: null,
    gpu: null,
    gpu_aib_manufacturer: null,
    gpu_aib_model: null,
    motherboard_name: null,
    motherboard_brand: null,
    motherboard_launch: null,
    ram_gb: null,
    ram_speed_mhz: null,
    ram_type: null,
    ram_pc_rating: null,
    psu_wattage: null,
    psu_brand: null,
    psu_has_8pin_cpu: null,
    psu_has_6pin_pcie: null,
    screen_size_inches: null,
    screen_resolution: null,
    weight_lbs: null,
    wifi_brand: null,
    wifi_product: null,
    wifi_model: null,
    wifi_codename: null,
    wifi_launch_date: null,
    wifi_antenna: null,
    wifi_bands: null,
    wifi_max_speed: null,
    wifi_standard: null,
    bluetooth_version: null,
    wifi_form_factor: null,
    drive: null,
    benchmarks: [],
  }));

  let section = 'root';

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    const rawLabel = (row[0] ?? '').trim();

    if (!rawLabel) {
      if (row.every((c) => !cleanStr(c))) {
        section = 'root';
      }
      continue;
    }

    if (/^https?:\/\//i.test(rawLabel)) {
      cleanupsApplied.add('Skipped embedded NotebookCheck URL row');
      continue;
    }

    const label = rawLabel.replace(/\s+/g, ' ');
    const lower = label.toLowerCase();

    // Top-level section switches
    if (lower === 'brand') {
      section = 'device_meta';
      rigIndices.forEach((col, idx) => {
        rigs[idx].brand = normalizeBrand(row[col]);
      });
      continue;
    }

    if (lower === 'model') {
      section = 'device_meta';
      rigIndices.forEach((col, idx) => {
        rigs[idx].model = cleanStr(row[col]);
      });
      continue;
    }

    if (lower === 'motherboard') {
      section = 'motherboard';
      rigIndices.forEach((col, idx) => {
        rigs[idx].motherboard_name = cleanStr(row[col]);
      });
      continue;
    }

    if (lower === 'processor') {
      section = 'processor';
      rigIndices.forEach((col, idx) => {
        const rawCpu = cleanStr(row[col]);
        if (!rawCpu) return;
        let cpuCount = 1;
        let name = rawCpu;
        const multiMatch = rawCpu.match(/^(\d+)\s*x\s+(.+)$/i);
        if (multiMatch) {
          cpuCount = Number.parseInt(multiMatch[1], 10) || 1;
          name = multiMatch[2].trim();
          cleanupsApplied.add(`Normalized "${rawCpu}" -> ${cpuCount}x "${name}"`);
        }
        if (name === 'Core2 Quad Q8200') {
          name = 'Core 2 Quad Q8200';
          cleanupsApplied.add('Core2 Quad Q8200 -> Core 2 Quad Q8200');
        }
        rigs[idx].cpu_count = cpuCount;
        rigs[idx].cpu = {
          name,
          brand: 'Unknown',
          codename: null,
          socket: null,
          base_clock_ghz: null,
          turbo_clock_ghz: null,
          cache_mb: null,
          cores: null,
          threads: null,
          tdp_w: null,
          process_nm: null,
          max_memory_gb: null,
          memory_type: null,
          memory_speed_mhz: null,
          launch_date: null,
          rank: null,
          is_mobile: isMobileDefault,
          spec_url: null,
        };
      });
      continue;
    }

    if (lower === 'memory') {
      section = 'memory';
      rigIndices.forEach((col, idx) => {
        rigs[idx].ram_gb = parseIntNum(row[col]);
      });
      continue;
    }

    if (lower === 'hard drive') {
      section = 'hard_drive';
      rigIndices.forEach((col, idx) => {
        const cap = parseIntNum(row[col]);
        rigs[idx].drive = {
          capacity_gb: cap,
          form_factor: null,
          brand: null,
          model: null,
          model_number: null,
          nand_type: null,
          read_mb_s: null,
          write_mb_s: null,
          rank: null,
          is_primary: true,
        };
      });
      continue;
    }

    if (lower === 'graphics card') {
      section = 'gpu';
      rigIndices.forEach((col, idx) => {
        let gpuName = cleanStr(row[col]);
        if (!gpuName) return;
        if (gpuName === 'GeForcce GTX 260M') {
          gpuName = 'GeForce GTX 260M';
          cleanupsApplied.add('GeForcce GTX 260M -> GeForce GTX 260M');
        } else if (gpuName === 'RTX 2080 TI') {
          gpuName = 'GeForce RTX 2080 Ti';
          cleanupsApplied.add('RTX 2080 TI -> GeForce RTX 2080 Ti');
        } else if (gpuName === 'Radeon HD RX 6400') {
          gpuName = 'Radeon RX 6400';
          cleanupsApplied.add('Radeon HD RX 6400 -> Radeon RX 6400');
        }
        rigs[idx].gpu = {
          name: gpuName,
          brand: 'Unknown',
          architecture: null,
          vram_gb: null,
          vram_type: null,
          bus_interface: null,
          process_nm: null,
          tdp_w: null,
          directx_version: null,
          directx_feature_level: null,
          category: null,
          rank: null,
          is_mobile: isMobileDefault,
          spec_url: null,
        };
      });
      continue;
    }

    if (lower === 'screen size') {
      section = 'screen';
      rigIndices.forEach((col, idx) => {
        const rawScreen = cleanStr(row[col]);
        if (rawScreen && rawScreen.includes(',')) {
          cleanupsApplied.add(`Screen "${rawScreen}" -> ${rawScreen.replace(',', '.')}`);
        }
        rigs[idx].screen_size_inches = parseFloatNum(rawScreen);
      });
      continue;
    }

    if (lower === 'wireless') {
      section = 'wireless';
      continue;
    }

    if (lower === 'weight') {
      section = 'weight';
      rigIndices.forEach((col, idx) => {
        rigs[idx].weight_lbs = parseFloatNum(row[col]);
      });
      continue;
    }

    if (lower === 'build date') {
      section = 'build_date';
      rigIndices.forEach((col, idx) => {
        rigs[idx].build_date = normalizeBuildDate(row[col]);
      });
      continue;
    }

    if (lower === 'rank') {
      section = 'rank';
      rigIndices.forEach((col, idx) => {
        rigs[idx].overall_rank = parseIntNum(row[col]);
      });
      continue;
    }

    if (lower === 'benchmarks') {
      section = 'benchmarks';
      continue;
    }

    if (lower === 'power supply') {
      section = 'psu';
      continue;
    }

    // Sub-fields per section
    if (section === 'motherboard') {
      rigIndices.forEach((col, idx) => {
        if (lower === '- brand') rigs[idx].motherboard_brand = normalizeBrand(row[col]);
        if (lower === '- launch') rigs[idx].motherboard_launch = cleanStr(row[col]);
      });
      continue;
    }

    if (section === 'processor') {
      rigIndices.forEach((col, idx) => {
        const cpu = rigs[idx].cpu;
        if (!cpu) return;
        const val = row[col];
        if (lower === '- brand') cpu.brand = normalizeBrand(val) ?? 'Unknown';
        else if (lower === '- codename') {
          const rawCode = cleanStr(val);
          const cleanedCode = normalizeCodename(rawCode);
          if (rawCode && cleanedCode && rawCode !== cleanedCode) {
            cleanupsApplied.add(`Codename "${rawCode}" -> "${cleanedCode}"`);
          }
          cpu.codename = cleanedCode;
        } else if (lower === '- speed') cpu.base_clock_ghz = parseFloatNum(val);
        else if (lower === '- turbo') cpu.turbo_clock_ghz = parseFloatNum(val);
        else if (lower === '- cache') cpu.cache_mb = parseFloatNum(val);
        else if (lower === '- cores') cpu.cores = parseIntNum(val);
        else if (lower === '- threads') cpu.threads = parseIntNum(val);
        else if (lower === '- power') cpu.tdp_w = parseIntNum(val);
        else if (lower === '- process') cpu.process_nm = parseIntNum(val);
        else if (lower === '- max memory') cpu.max_memory_gb = parseIntNum(val);
        else if (lower === '- memory type') cpu.memory_type = cleanStr(val);
        else if (lower === '- memory speed') cpu.memory_speed_mhz = parseIntNum(val);
        else if (lower === '- launch') cpu.launch_date = normalizeLaunchQuarter(val);
        else if (lower === '- rank') cpu.rank = parseIntNum(val);
      });
      continue;
    }

    if (section === 'memory') {
      rigIndices.forEach((col, idx) => {
        if (lower === '- speed') rigs[idx].ram_speed_mhz = parseIntNum(row[col]);
        else if (lower === '- pc') rigs[idx].ram_pc_rating = cleanStr(row[col]);
      });
      continue;
    }

    if (section === 'hard_drive') {
      rigIndices.forEach((col, idx) => {
        const drive = rigs[idx].drive;
        if (!drive) return;
        const val = row[col];
        if (lower === '- form factor') drive.form_factor = cleanStr(val);
        else if (lower === '- brand') {
          const rawBrand = cleanStr(val);
          const normBrand = normalizeBrand(rawBrand);
          if (rawBrand && normBrand && rawBrand !== normBrand) {
            cleanupsApplied.add(`Drive brand "${rawBrand}" -> "${normBrand}"`);
          }
          drive.brand = normBrand;
        } else if (lower === '- model') drive.model = cleanStr(val);
        else if (lower === '- model number') drive.model_number = cleanStr(val);
        else if (lower === '- type') drive.nand_type = cleanStr(val);
        else if (lower === '- rank') drive.rank = parseIntNum(val);
        else if (lower === '- read') drive.read_mb_s = parseIntNum(val);
        else if (lower === '- write') drive.write_mb_s = parseIntNum(val);
      });
      continue;
    }

    if (section === 'gpu') {
      rigIndices.forEach((col, idx) => {
        const rig = rigs[idx];
        const gpu = rig.gpu;
        const val = row[col];
        if (lower === '- manufacturer') rig.gpu_aib_manufacturer = normalizeBrand(val);
        else if (lower === '- model') rig.gpu_aib_model = cleanStr(val);
        if (!gpu) return;
        if (lower === '- brand') gpu.brand = normalizeBrand(val) ?? 'Unknown';
        else if (lower === '- bus') gpu.bus_interface = cleanStr(val);
        else if (lower === '- memory size') gpu.vram_gb = parseFloatNum(val);
        else if (lower === '- memory type') gpu.vram_type = cleanStr(val);
        else if (lower === '- process') gpu.process_nm = parseIntNum(val);
        else if (lower === '- directx') {
          const dx = normalizeDirectX(val);
          gpu.directx_version = dx.version;
          gpu.directx_feature_level = dx.featureLevel;
        } else if (lower === '- power') gpu.tdp_w = parseIntNum(val);
        else if (lower === '- rank') gpu.rank = parseIntNum(val);
        else if (lower === '- category') {
          const cat = cleanStr(val);
          if (cat === 'Low-Midrange') {
            gpu.category = 'Low-Mid-Range';
            cleanupsApplied.add('Category "Low-Midrange" -> "Low-Mid-Range"');
          } else {
            gpu.category = cat;
          }
        }
      });
      continue;
    }

    if (section === 'screen') {
      rigIndices.forEach((col, idx) => {
        if (lower === '- resolution') {
          const rawRes = cleanStr(row[col]);
          const normRes = normalizeResolution(rawRes);
          if (rawRes && normRes && rawRes !== normRes) {
            cleanupsApplied.add(`Resolution "${rawRes}" -> "${normRes}"`);
          }
          rigs[idx].screen_resolution = normRes;
        }
      });
      continue;
    }

    if (section === 'wireless') {
      rigIndices.forEach((col, idx) => {
        const val = cleanStr(row[col]);
        if (lower === '- brand') rigs[idx].wifi_brand = val;
        else if (lower === '- product') rigs[idx].wifi_product = val;
        else if (lower === '- model') rigs[idx].wifi_model = val;
        else if (lower === '- code name') rigs[idx].wifi_codename = val;
        else if (lower === '- launch date') rigs[idx].wifi_launch_date = val;
        else if (lower === '- antenna') rigs[idx].wifi_antenna = val;
        else if (lower === '- bands') rigs[idx].wifi_bands = val;
        else if (lower === '- max speed') rigs[idx].wifi_max_speed = val;
        else if (lower === '- wi-fi') rigs[idx].wifi_standard = val;
        else if (lower === '- bluetooth') rigs[idx].bluetooth_version = val;
        else if (lower === '- form factor') rigs[idx].wifi_form_factor = val;
      });
      continue;
    }

    if (section === 'benchmarks') {
      const suite = normalizeBenchmarkSuite(label);
      rigIndices.forEach((col, idx) => {
        const score = parseIntNum(row[col]);
        if (score !== null) {
          rigs[idx].benchmarks.push({
            suite_name: suite,
            score,
          });
        }
      });
      continue;
    }

    if (section === 'psu') {
      rigIndices.forEach((col, idx) => {
        const val = row[col];
        if (lower === '- power') rigs[idx].psu_wattage = parseIntNum(val);
        else if (lower === '- brand') rigs[idx].psu_brand = normalizeBrand(val);
        else if (lower.includes('8pin cpu')) rigs[idx].psu_has_8pin_cpu = parseYesNo(val);
        else if (lower.includes('6pin pcie')) rigs[idx].psu_has_6pin_pcie = parseYesNo(val);
      });
    }
  }

  // Final pass: normalize multi-CPU per-chip specs, infer RAM type, filter empty placeholder drives, enrich CPUs & GPUs
  for (const rig of rigs) {
    if (rig.cpu) {
      if (rig.cpu_count > 1) {
        if (rig.cpu.cores) rig.cpu.cores = Math.max(1, Math.round(rig.cpu.cores / rig.cpu_count));
        if (rig.cpu.threads) rig.cpu.threads = Math.max(1, Math.round(rig.cpu.threads / rig.cpu_count));
        if (rig.cpu.tdp_w) rig.cpu.tdp_w = Math.max(1, Math.round(rig.cpu.tdp_w / rig.cpu_count));
      }
      if (!rig.ram_type && rig.cpu.memory_type && rig.ram_gb) {
        rig.ram_type = rig.cpu.memory_type;
      }

      const cpuKey = `${rig.cpu.brand.toLowerCase()}|${rig.cpu.name.toLowerCase()}`;
      const enrichedCpu = CPU_ENRICHMENT[cpuKey];
      if (enrichedCpu) {
        rig.cpu.socket = rig.cpu.socket ?? enrichedCpu.socket;
        rig.cpu.codename = enrichedCpu.codename ?? rig.cpu.codename;
        rig.cpu.spec_url = enrichedCpu.spec_url;
      } else {
        rig.cpu.spec_url = buildFallbackCpuSpecUrl(rig.cpu.brand, rig.cpu.name);
      }
    }

    if (rig.gpu) {
      const gpuKey = `${rig.gpu.brand.toLowerCase()}|${rig.gpu.name.toLowerCase()}|${
        rig.gpu.is_mobile ? 'mobile' : 'desktop'
      }`;
      const enrichedGpu = GPU_ENRICHMENT[gpuKey];
      if (enrichedGpu) {
        rig.gpu.architecture = rig.gpu.architecture ?? enrichedGpu.architecture;
        rig.gpu.bus_interface = rig.gpu.bus_interface ?? enrichedGpu.bus_interface ?? null;
        rig.gpu.process_nm = rig.gpu.process_nm ?? enrichedGpu.process_nm ?? null;
        rig.gpu.tdp_w = rig.gpu.tdp_w ?? enrichedGpu.tdp_w ?? null;
        if (!rig.gpu.directx_version && enrichedGpu.directx_version) {
          rig.gpu.directx_version = enrichedGpu.directx_version;
          rig.gpu.directx_feature_level = enrichedGpu.directx_feature_level ?? null;
          cleanupsApplied.add(`Pre-filled DirectX for ${rig.gpu.name}`);
        }
        if (enrichedGpu.vram_gb !== undefined && (!rig.gpu.vram_gb || rig.gpu.vram_gb === 0)) {
          rig.gpu.vram_gb = enrichedGpu.vram_gb;
          cleanupsApplied.add(`${rig.gpu.name} VRAM 0 GB -> ${enrichedGpu.vram_gb} GB`);
        }
        if ((!rig.gpu.category || rig.gpu.category === 'Unknown') && enrichedGpu.category) {
          rig.gpu.category = enrichedGpu.category;
        }
        rig.gpu.spec_url = enrichedGpu.spec_url;
      } else {
        rig.gpu.spec_url = buildFallbackGpuSpecUrl(rig.gpu.brand, rig.gpu.name);
      }
    }

    // Discard placeholder-only Hard Drive rows (where capacity, form factor, brand, and model are all null)
    if (rig.drive) {
      const hasRealDrive =
        rig.drive.capacity_gb !== null ||
        rig.drive.form_factor !== null ||
        rig.drive.brand !== null ||
        rig.drive.model !== null;
      if (!hasRealDrive) {
        rig.drive = null;
      }
    }
  }

  return {
    deviceType: detectedDeviceType,
    rigs,
    warnings,
    cleanupsApplied: Array.from(cleanupsApplied),
  };
}
