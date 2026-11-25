import type { DeviceType } from '../types/database';

export interface ParsedHwinfoCpu {
  rawName: string;
  brand: string;
  name: string;
  codename: string | null;
  socket: string | null;
  cores: number | null;
  threads: number | null;
  baseClockGhz: number | null;
  turboClockGhz: number | null;
  cacheMb: number | null;
  tdpW: number | null;
  processNm: number | null;
  isMobile: boolean;
}

export interface ParsedHwinfoGpu {
  rawChipset: string;
  rawCardName: string | null;
  brand: string;
  name: string;
  architecture: string | null;
  vramGb: number | null;
  vramType: string | null;
  busInterface: string | null;
  processNm: number | null;
  tdpW: number | null;
  pciVendorId: string | null;
  pciDeviceId: string | null;
  pciSubsysVendorId: string | null;
  pciSubsysDeviceId: string | null;
  aibManufacturer: string | null;
  aibModel: string | null;
  isIntegrated: boolean;
  isMobile: boolean;
}

export interface ParsedHwinfoMotherboard {
  rawModel: string;
  brand: string;
  model: string;
  chipset: string | null;
  socket: string | null;
  biosVersion: string | null;
  biosDate: string | null;
}

export interface ParsedHwinfoRamModule {
  capacityGb: number | null;
  brand: string | null;
  partNumber: string | null;
  ramType: string | null;
  speedMhz: number | null;
  pcRating: string | null;
  isMobile: boolean;
}

export interface ParsedHwinfoRam {
  totalGb: number | null;
  ramType: string | null;
  speedMhz: number | null;
  pcRating: string | null;
  modulesCount: number | null;
  brand: string | null;
  partNumber: string | null;
  isMobile: boolean;
  modules: ParsedHwinfoRamModule[];
}

export interface ParsedHwinfoDrive {
  rawModel: string;
  brand: string | null;
  model: string;
  modelNumber: string | null;
  capacityGb: number | null;
  formFactor: string | null;
  interfaceType: string | null;
  isRemovableOrOptical: boolean;
  filterReason: string | null;
  isPrimary: boolean;
}

export interface ParsedHwinfoWifi {
  rawName: string;
  brand: string;
  product: string | null;
  model: string;
  wifiStandard: string | null;
  formFactor: string | null;
}

export interface ParsedHwinfoDisplay {
  name: string | null;
  screenSizeInches: number | null;
  screenResolution: string | null;
}

export interface ParsedHwinfoReport {
  fileName: string | null;
  hwinfoVersion: string | null;
  computerName: string | null;
  osName: string | null;
  systemManufacturer: string | null;
  systemModel: string | null;
  chassisType: string | null;
  biosVersion: string | null;
  biosDate: string | null;
  hasBattery: boolean;
  detectedDeviceType: DeviceType;
  deviceTypeReason: string;
  cpu: ParsedHwinfoCpu | null;
  cpuCount: number;
  gpus: ParsedHwinfoGpu[];
  discreteGpu: ParsedHwinfoGpu | null;
  integratedGpu: ParsedHwinfoGpu | null;
  motherboard: ParsedHwinfoMotherboard | null;
  ram: ParsedHwinfoRam | null;
  drives: ParsedHwinfoDrive[];
  wifi: ParsedHwinfoWifi | null;
  display: ParsedHwinfoDisplay | null;
  warnings: string[];
}

export const PCI_SUBSYS_VENDOR_MAP: Record<string, string> = {
  '1043': 'ASUS',
  '1458': 'Gigabyte',
  '1462': 'MSI',
  '3842': 'EVGA',
  '1DA2': 'Sapphire',
  '1682': 'XFX',
  '19DA': 'ZOTAC',
  '196E': 'PNY',
  '10B0': 'Gainward',
  '1569': 'Palit',
  '148C': 'PowerColor',
  '174B': 'PC Partner',
  '1B4C': 'GALAX',
  '7377': 'Colorful',
  '196D': 'Club 3D',
  '1545': 'VisionTek',
  '12AB': 'BFG',
  '107D': 'Leadtek',
  '1642': 'Leadtek',
  '14AF': 'Hercules',
  '1102': 'Creative',
  '1028': 'Dell',
  '103C': 'HP',
  '17AA': 'Lenovo',
  '1025': 'Acer',
  '104D': 'Sony',
  '1849': 'ASRock',
  '1565': 'Biostar',
  '10DE': 'NVIDIA',
  '1002': 'AMD',
  '8086': 'Intel',
  '121A': '3dfx',
  '102B': 'Matrox',
  '5333': 'S3',
  '1039': 'SiS',
  '1106': 'VIA',
  '10B9': 'ALi',
  '1414': 'Microsoft',
  '1558': 'Clevo',
  '144D': 'Samsung',
  '1179': 'Toshiba',
  '10CF': 'Fujitsu',
  '17C0': 'Wistron',
  '1A58': 'Razer',
};

const VIRTUAL_GPU_PATTERNS = [
  'microsoft basic display',
  'microsoft basic render',
  'virtual display',
  'parsec',
  'rdpdd',
  'remote desktop',
  'teamviewer',
  'citrix',
  'meta virtual',
  'oculus virtual',
  'mirage driver',
  'vnc',
  'splashtop',
  'moonlight',
  'spacedesk',
  'iddcx',
  'uminon',
  'vga compatible',
];

const IGNORED_NETWORK_PATTERNS = [
  'ethernet',
  'gigabit',
  'gbe',
  'realtek pcie',
  'realtek gaming',
  'intel(r) i2',
  'intel(r) 825',
  'intel(r) pro/100',
  'intel(r) pro/1000',
  'broadcom netxtreme',
  'broadcom netlink',
  'marvell',
  'aquantia',
  'killer e2',
  'killer e3',
  'loopback',
  'wan miniport',
  'hyper-v',
  'virtualbox',
  'vmware',
  'tap-windows',
  'wintun',
  'wireguard',
  'openvpn',
  'tailscale',
  'zerotier',
  'nordlynx',
  'hamachi',
  'teredo',
  'isatap',
  '6to4',
  'bluetooth device (personal area network)',
  'ras async',
  'kernel debug',
];

const OPTICAL_OR_REMOVABLE_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(cd-rom|cd-rw|dvd-rom|dvd-rw|dvd\+rw|dvdrw|bd-rom|bd-re|blu-ray|atapi\s+dvd|atapi\s+cd|hl-dt-st|tsstcorp|optiarc|pioneer\s+bd|pioneer\s+dvd|asus\s+drw|lg\s+gh2|lite-on\s+ihas|plextor\s+px-)\b/i,
    reason: 'Optical drive',
  },
  {
    re: /\b(usb\s+flash|flash\s+drive|thumb\s+drive|card\s+reader|sdhc|sdxc|compactflash|memory\s+stick|sandisk\s+cruzer|sandisk\s+ultra\s+usb|kingston\s+datatraveler|lexar\s+jumpdrive|pny\s+usb|corsair\s+voyager|generic-\s*sd|multi-card)\b/i,
    reason: 'USB / card reader',
  },
  {
    re: /\b(floppy|3\.5"\s*1\.44|ls-120|zip\s*100|zip\s*250|virtual\s+disk|msft\s+virtual|ramdisk|imdisk|iscsi)\b/i,
    reason: 'Removable / virtual media',
  },
];

function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function cleanText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ').trim();
}

function isPlaceholderValue(val: string | null | undefined): boolean {
  if (!val) return true;
  const v = val.trim().toLowerCase();
  return (
    v === '' ||
    v === 'n/a' ||
    v === 'none' ||
    v === 'unknown' ||
    v === 'not available' ||
    v === 'not present' ||
    v === 'to be filled by o.e.m.' ||
    v === 'default string' ||
    v === 'system product name' ||
    v === 'system manufacturer'
  );
}

/**
 * Decode raw HWiNFO XML file bytes, handling UTF-8, UTF-16 BOM, and Windows-1252.
 */
export async function decodeHwinfoXmlFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes);
    }
  }

  let utf8Text = '';
  try {
    utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }

  const head = utf8Text.slice(0, 260).toLowerCase();
  if (
    head.includes('encoding="iso-8859-1"') ||
    head.includes("encoding='iso-8859-1'") ||
    head.includes('encoding="windows-1252"') ||
    head.includes("encoding='windows-1252'")
  ) {
    return new TextDecoder('windows-1252').decode(bytes);
  }

  return utf8Text;
}

function sanitizeXmlString(raw: string): string {
  let s = raw.replace(/^\uFEFF/, '');
  // Strip invalid XML 1.0 control characters
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  // Escape stray ampersands that aren't valid XML entities
  s = s.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
  return s;
}

interface PropBag {
  rawMap: Map<string, string[]>;
}

function createPropBag(): PropBag {
  return { rawMap: new Map<string, string[]>() };
}

function addProp(bag: PropBag, key: string, value: string): void {
  const k = normalizeKey(key);
  const v = cleanText(value);
  if (!k || !v) return;
  const list = bag.rawMap.get(k);
  if (list) {
    if (!list.includes(v)) list.push(v);
  } else {
    bag.rawMap.set(k, [v]);
  }
}

function getProp(bag: PropBag, ...keys: string[]): string | null {
  for (const key of keys) {
    const list = bag.rawMap.get(normalizeKey(key));
    if (list) {
      for (const item of list) {
        if (!isPlaceholderValue(item)) return item;
      }
    }
  }
  return null;
}

function getAllPropsMatching(bag: PropBag, fragment: string): string[] {
  const frag = normalizeKey(fragment);
  const out: string[] = [];
  for (const [k, vals] of bag.rawMap.entries()) {
    if (k.includes(frag)) {
      for (const v of vals) {
        if (!isPlaceholderValue(v)) out.push(v);
      }
    }
  }
  return out;
}

function extractNodeProps(el: Element, includeNestedSubnodes = false): PropBag {
  const bag = createPropBag();

  const walk = (node: Element, depth: number) => {
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.toLowerCase() !== 'name' && attr.value) {
        addProp(bag, attr.name, attr.value);
      }
    }

    const tag = node.tagName;
    const lowerTag = tag.toLowerCase();

    if (lowerTag === 'property') {
      const entryEl = Array.from(node.children).find((c) => {
        const ct = c.tagName.toLowerCase();
        return ct === 'entry' || ct === 'name' || ct === 'key';
      });
      const valEl = Array.from(node.children).find((c) => {
        const ct = c.tagName.toLowerCase();
        return ct === 'value' || ct === 'data';
      });
      const attrName =
        node.getAttribute('name') ||
        node.getAttribute('Name') ||
        entryEl?.textContent;
      const valText =
        valEl?.textContent ??
        node.getAttribute('value') ??
        node.getAttribute('Value');
      if (attrName && valText) {
        addProp(bag, attrName, valText);
      }
      return;
    }

    if (lowerTag === 'entry') {
      const attrName = node.getAttribute('name') || node.getAttribute('Name');
      if (attrName && node.children.length === 0 && node.textContent) {
        addProp(bag, attrName, node.textContent);
        return;
      }
    }

    if (node.children.length === 0) {
      if (node.textContent) {
        addProp(bag, tag, node.textContent);
      }
      return;
    }

    for (const child of Array.from(node.children)) {
      const ct = child.tagName.toLowerCase();
      if (
        !includeNestedSubnodes &&
        depth > 0 &&
        (ct === 'subnode' || ct === 'node')
      ) {
        continue;
      }
      walk(child, depth + 1);
    }
  };

  walk(el, 0);
  return bag;
}

function collectSubNodes(root: Element): Array<{
  element: Element;
  nodeName: string;
  tagName: string;
  props: PropBag;
}> {
  const nodes: Array<{
    element: Element;
    nodeName: string;
    tagName: string;
    props: PropBag;
  }> = [];

  const visit = (el: Element) => {
    const props = extractNodeProps(el, false);
    const nodeNameChild = Array.from(el.children).find((c) => {
      const ct = c.tagName.toLowerCase();
      return ct === 'nodename' || ct === 'title' || ct === 'caption';
    });
    const nodeName = cleanText(
      nodeNameChild?.textContent ||
        el.getAttribute('name') ||
        el.getAttribute('Name') ||
        el.tagName,
    );
    nodes.push({
      element: el,
      nodeName,
      tagName: el.tagName.toLowerCase(),
      props,
    });
    for (const child of Array.from(el.children)) {
      visit(child);
    }
  };

  visit(root);
  return nodes;
}

function parseNumber(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function parseClockGhz(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseNumber(raw);
  if (n === null || n <= 0) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('ghz') || n < 15) {
    return Math.round(n * 100) / 100;
  }
  // MHz -> GHz
  return Math.round((n / 1000) * 100) / 100;
}

function parseCacheMb(raw: string | null): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  // Support "8 x 2 MB" or "16 MB" or "16384 KB"
  const multMatch = raw.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(mb|kb|mbytes|kbytes)/i);
  if (multMatch) {
    const count = Number.parseFloat(multMatch[1]);
    const size = Number.parseFloat(multMatch[2]);
    const unit = multMatch[3].toLowerCase();
    const totalMb = unit.startsWith('k') ? (count * size) / 1024 : count * size;
    return Math.round(totalMb * 100) / 100;
  }
  const n = parseNumber(raw);
  if (n === null || n <= 0) return null;
  if (lower.includes('kb') || lower.includes('kbyte')) {
    return Math.round((n / 1024) * 100) / 100;
  }
  return Math.round(n * 100) / 100;
}

function parseVramGb(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseNumber(raw);
  if (n === null || n <= 0) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('gb') || lower.includes('gbyte')) {
    return Math.round(n * 100) / 100;
  }
  if (lower.includes('kb') || lower.includes('kbyte')) {
    return Math.round((n / (1024 * 1024)) * 100) / 100;
  }
  // Default MB / MBytes (e.g. 8192 MBytes, 4096 MB, 512 MB, 256 MB)
  if (n >= 64) {
    return Math.round((n / 1024) * 100) / 100;
  }
  return Math.round(n * 100) / 100;
}

function normalizeManufacturer(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = cleanText(raw);
  const lower = s.toLowerCase();
  if (/asustek|asus/i.test(lower)) return 'ASUS';
  if (/micro-star|\bmsi\b/i.test(lower)) return 'MSI';
  if (/gigabyte/i.test(lower)) return 'Gigabyte';
  if (/asrock/i.test(lower)) return 'ASRock';
  if (/\bevga\b/i.test(lower)) return 'EVGA';
  if (/sapphire/i.test(lower)) return 'Sapphire';
  if (/\bxfx\b/i.test(lower)) return 'XFX';
  if (/zotac/i.test(lower)) return 'ZOTAC';
  if (/powercolor|tul/i.test(lower)) return 'PowerColor';
  if (/palit/i.test(lower)) return 'Palit';
  if (/gainward/i.test(lower)) return 'Gainward';
  if (/\bpny\b/i.test(lower)) return 'PNY';
  if (/galax|kfa2/i.test(lower)) return 'GALAX';
  if (/colorful/i.test(lower)) return 'Colorful';
  if (/dell/i.test(lower)) return 'Dell';
  if (/hewlett-packard|\bhp\b|compaq/i.test(lower)) return 'HP';
  if (/lenovo/i.test(lower)) return 'Lenovo';
  if (/acer/i.test(lower)) return 'Acer';
  if (/toshiba/i.test(lower)) return 'Toshiba';
  if (/sony/i.test(lower)) return 'Sony';
  if (/samsung/i.test(lower)) return 'Samsung';
  if (/supermicro/i.test(lower)) return 'Supermicro';
  if (/biostar/i.test(lower)) return 'Biostar';
  if (/ecs|elitegroup/i.test(lower)) return 'ECS';
  if (/foxconn/i.test(lower)) return 'Foxconn';
  if (/abit/i.test(lower)) return 'ABIT';
  if (/dfi/i.test(lower)) return 'DFI';
  if (/epox/i.test(lower)) return 'EPoX';
  if (/shuttle/i.test(lower)) return 'Shuttle';
  if (/intel/i.test(lower)) return 'Intel';
  if (/nvidia/i.test(lower)) return 'NVIDIA';
  if (/\bamd\b|advanced micro devices|\bati\b/i.test(lower)) return 'AMD';
  if (/g\.skill|gskill/i.test(lower)) return 'G.Skill';
  if (/corsair/i.test(lower)) return 'Corsair';
  if (/kingston|hyperx|fury/i.test(lower)) return 'Kingston';
  if (/crucial|micron/i.test(lower)) return 'Crucial';
  if (/team\s*group/i.test(lower)) return 'TeamGroup';
  if (/patriot/i.test(lower)) return 'Patriot';
  if (/mushkin/i.test(lower)) return 'Mushkin';
  if (/adata/i.test(lower)) return 'ADATA';
  if (/sk\s*hynix|hynix|hyundai/i.test(lower)) return 'SK hynix';
  if (/western\s*digital|\bwdc\b|\bwd\b/i.test(lower)) return 'Western Digital';
  if (/seagate/i.test(lower)) return 'Seagate';
  if (/sandisk/i.test(lower)) return 'SanDisk';
  if (/kioxia/i.test(lower)) return 'Kioxia';
  if (/sabrent/i.test(lower)) return 'Sabrent';
  if (/solidigm/i.test(lower)) return 'Solidigm';
  if (/hitachi|\bhgst\b/i.test(lower)) return 'HGST';
  if (/maxtor/i.test(lower)) return 'Maxtor';
  if (/qualcomm|atheros/i.test(lower)) return 'Qualcomm Atheros';
  if (/mediatek/i.test(lower)) return 'MediaTek';
  if (/realtek/i.test(lower)) return 'Realtek';
  if (/broadcom/i.test(lower)) return 'Broadcom';
  return s
    .replace(/\b(inc\.|corp\.|corporation|co\.,?\s*ltd\.?|ltd\.?|llc|gmbh)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCpuBrandAndName(raw: string): { brand: string; name: string } {
  const cleaned = cleanText(raw)
    .replace(/\(R\)/gi, '')
    .replace(/\(TM\)/gi, '')
    .replace(/\(C\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = cleaned.toLowerCase();
  let brand = 'Unknown';
  if (lower.includes('intel')) brand = 'Intel';
  else if (lower.includes('amd') || lower.includes('ryzen') || lower.includes('phenom') || lower.includes('athlon') || lower.includes('fx-') || lower.includes('epyc') || lower.includes('threadripper') || lower.includes('sempron') || lower.includes('opteron')) brand = 'AMD';
  else if (lower.includes('via')) brand = 'VIA';
  else if (lower.includes('cyrix')) brand = 'Cyrix';

  let name = cleaned
    .replace(/^(intel|amd|via|cyrix)\s+/i, '')
    .replace(/@\s*\d+(?:\.\d+)?\s*[gm]hz.*$/i, '')
    .replace(/\b\d+-core\s+processor\b/i, '')
    .replace(/\bwith\s+radeon\s+.*$/i, '')
    .replace(/\bw\/\s*radeon\s+.*$/i, '')
    .replace(/\bprocessor\b/gi, '')
    .replace(/\bcpu\b/gi, '')
    .replace(/\bapu\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize "Core2 Duo" -> "Core 2 Duo"
  name = name.replace(/\bCore2\b/gi, 'Core 2');
  return { brand, name: name || cleaned };
}

function cleanSocket(raw: string | null): string | null {
  if (!raw) return null;
  const s = cleanText(raw);
  const parenLga = s.match(/\b(LGA\s*\d+|AM[2345]\+?|FM[12]\+?|TR4|sTRX4|sWRX8|FP\d+|FT\d+|BGA\s*\d+|PGA\s*\d+|FCPGA\s*\d+|Socket\s+[A-Z0-9]+)\b/i);
  if (parenLga) {
    return parenLga[1].replace(/\s+/g, '');
  }
  const numOnly = s.match(/Socket\s+(\d{3,4})\b/i);
  if (numOnly) return `Socket ${numOnly[1]}`;
  return s;
}

function isMobileCpuName(name: string, socket: string | null): boolean {
  const upper = name.toUpperCase();
  const sock = (socket ?? '').toUpperCase();
  if (/\b(BGA|FCBGA|FP[4-8]|FT[1-6]|PGA\d+|FCPGA|SOCKET\s*P|SOCKET\s*M|SOCKET\s*G\d)\b/.test(sock)) {
    return true;
  }
  if (
    /\b(CORE\s+I[3579]-?\d{3,5}(HQ|HK|HX|HS|MQ|QM|U|P|Y|G[147]|H)|RYZEN\s+\d\s+\d{4}(HS|HX|U|H)|PENTIUM\s+M|CELERON\s+M|CORE\s+2\s+DUO\s+[PTL]\d{4}|CORE\s+DUO\s+T\d{4}|TURION|MOBILE\s+ATHLON)\b/.test(
      upper,
    )
  ) {
    return true;
  }
  return false;
}

function cleanGpuBrandAndName(raw: string): { brand: string; name: string } {
  const cleaned = cleanText(raw)
    .replace(/\(R\)/gi, '')
    .replace(/\(TM\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = cleaned.toLowerCase();
  let brand = 'Unknown';
  if (lower.includes('nvidia') || lower.includes('geforce') || lower.includes('quadro') || lower.includes('rtx') || lower.includes('gtx') || lower.includes('gts') || lower.includes('nvs') || lower.includes('tesla') || lower.includes('riva') || lower.includes('tnt')) {
    brand = 'NVIDIA';
  } else if (lower.includes('amd') || lower.includes('ati') || lower.includes('radeon') || lower.includes('firepro') || lower.includes('rage')) {
    brand = 'AMD';
  } else if (lower.includes('intel') || lower.includes('arc ') || lower.includes('uhd') || lower.includes('iris') || lower.includes('hd graphics') || lower.includes('gma')) {
    brand = 'Intel';
  } else if (lower.includes('3dfx') || lower.includes('voodoo')) {
    brand = '3dfx';
  } else if (lower.includes('matrox')) {
    brand = 'Matrox';
  } else if (lower.includes('s3') || lower.includes('savage') || lower.includes('virge')) {
    brand = 'S3';
  }

  let name = cleaned
    .replace(/^(nvidia|amd\/ati|ati\/amd|amd|ati|intel|3dfx|matrox)\s+/i, '')
    .replace(/\b(laptop\s+gpu|mobile\s+gpu|graphics\s+adapter|pci-e|agp)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip trailing "(TU104)" or "[Dell]" codename/OEM brackets from chipset name
  name = name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();
  return { brand, name: name || cleaned };
}

function isIntegratedGpu(brand: string, name: string, rawCard: string | null): boolean {
  const combined = `${brand} ${name} ${rawCard ?? ''}`.toLowerCase();
  if (brand === 'Intel') {
    // Arc discrete vs HD/UHD/Iris/GMA integrated
    return !/\barc\s+[ab]\d{3}\b/i.test(combined);
  }
  if (brand === 'AMD') {
    if (/radeon\(tm\)\s+graphics$/i.test(combined.trim()) || /\bradeon\s+graphics\b$/i.test(combined.trim())) {
      return true;
    }
    if (/\b(vega\s+[3-9]|vega\s+1[01]|radeon\s+[678]\d0m|radeon\s+r[2-7]\s+graphics|radeon\s+hd\s+[3456]\d{3}g|radeon\s+hd\s+[78]\d{3}d|mobility\s+radeon\s+hd\s+42\d{2})\b/i.test(combined)) {
      return true;
    }
  }
  if (brand === 'NVIDIA') {
    if (/\b(nforce|geforce\s+(6100|6150|7025|7050|7100|8200|9100m|9400m)|ion)\b/i.test(combined)) {
      return true;
    }
  }
  if (/\b(integrated|onboard|igp)\b/i.test(combined)) return true;
  return false;
}

export function inferDirectXFromGpu(
  brand: string,
  name: string,
  architecture?: string | null,
): { directx_version: string | null; directx_feature_level: string | null } {
  const s = `${brand} ${name} ${architecture ?? ''}`.toLowerCase();

  // NVIDIA
  if (brand.toLowerCase() === 'nvidia' || /\b(geforce|quadro|rtx|gtx|gts|gt\s+\d|nvs|tnt|riva)\b/.test(s)) {
    if (/\b(rtx\s*[2345]\d{3}|ada\s+lovelace|blackwell|ampere|turing|gtx\s*16[356]\d)\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '12_2' };
    }
    if (/\b(gtx\s*(9[5-8]\d|10[3-8]\d)|titan\s*(x|xp|v)|gt\s*1030|mx[12345]\d0|pascal|maxwell\s*2|gm20[046]|gp10[24678]|volta)\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '12_1' };
    }
    if (/\b(gtx\s*[45678]\d{2}|gt\s*[4567]\d{2}|gts\s*[4]\d{2}|fermi|kepler|maxwell\s*1|gm107|gk\d{3}|gf\d{3}|quadro\s*[kmp]\d{3,4}|nvs\s*[345]\d{2})\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '11_0' };
    }
    if (/\b(gtx\s*2\d{2}|gts\s*2\d{2}|gt\s*2\d{2}|geforce\s*[89]\d{3}|geforce\s*g?1\d{2}|geforce\s*g?2\d{2}|tesla|g8\d|g9\d|gt2\d{2}|quadro\s*(nvs\s*1\d{2}|fx\s*[345]\d{3}))\b/.test(s)) {
      return { directx_version: '10.0', directx_feature_level: '10_0' };
    }
    if (/\b(geforce\s*[67]\d{3}|geforce\s*fx|5[2-9]\d{2}|curie|rankine|nv3\d|nv4\d)\b/.test(s)) {
      return { directx_version: '9.0c', directx_feature_level: '9_3' };
    }
    if (/\b(geforce\s*[34]\d{2,3}|ti\s*4\d{3}|kelvin|nv2\d)\b/.test(s)) {
      return { directx_version: '8.1', directx_feature_level: null };
    }
    if (/\b(geforce\s*256|geforce\s*2|tnt|riva)\b/.test(s)) {
      return { directx_version: '7.0', directx_feature_level: null };
    }
  }

  // AMD / ATI
  if (brand.toLowerCase() === 'amd' || brand.toLowerCase() === 'ati' || /\b(radeon|rx\s*\d|firepro|vega|rdna)\b/.test(s)) {
    if (/\b(rx\s*[6789]\d{3}|rdna\s*[234]|navi\s*[234]|radeon\s*[78]\d0m)\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '12_2' };
    }
    if (/\b(rx\s*5[567]\d{2}|vega|rdna\s*1|navi\s*1\d)\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '12_1' };
    }
    if (/\b(rx\s*[45]\d{2}|r9\s*(285|290|295|380|390|fury|nano)|r7\s*(260|360)|gcn\s*[234]|polaris|fiji|hawaii|tonga|bonaire)\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '12_0' };
    }
    if (/\b(hd\s*[78]\d{3}|r[579]\s*[23]\d{2}|gcn\s*1|tahiti|pitcairn|cape\s*verde|oland)\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '11_1' };
    }
    if (/\b(hd\s*[56]\d{3}|terascale\s*[23]|evergreen|cypress|juniper|redwood|cayman|barts|turks)\b/.test(s)) {
      return { directx_version: '11.0', directx_feature_level: '11_0' };
    }
    if (/\b(hd\s*[234]\d{3}|x1\d{3}|terascale\s*1|r6\d{2}|rv[67]\d{2})\b/.test(s)) {
      return /\bx1\d{3}\b/.test(s)
        ? { directx_version: '9.0c', directx_feature_level: '9_3' }
        : { directx_version: '10.1', directx_feature_level: '10_1' };
    }
    if (/\b(radeon\s*9[5-8]\d{2}|x[3678]\d{2})\b/.test(s)) {
      return { directx_version: '9.0b', directx_feature_level: '9_2' };
    }
    if (/\b(radeon\s*8500|9[012]\d{2})\b/.test(s)) {
      return { directx_version: '8.1', directx_feature_level: null };
    }
  }

  // Intel
  if (brand.toLowerCase() === 'intel') {
    if (/\b(arc\s*[ab]\d{3}|alchemist|battlemage)\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '12_2' };
    }
    if (/\b(uhd\s*7\d{2}|iris\s*xe|iris\s*plus\s*g[47]|xe\s*graphics|uhd\s*graphics\s*6\d{2}|uhd\s*6\d{2}|hd\s*6\d{2}|hd\s*5\d{2}|radeon\s*graphics)\b/.test(s)) {
      return { directx_version: '12', directx_feature_level: '12_1' };
    }
    if (/\b(hd\s*(4\d{3}|5\d{3}|graphics\s*4\d{3})|iris\s*(pro\s*)?[56]\d{3})\b/.test(s)) {
      return { directx_version: '11.1', directx_feature_level: '11_1' };
    }
    if (/\b(hd\s*3000|hd\s*2000|gma\s*(hd|4500|x4500))\b/.test(s)) {
      return { directx_version: '10.1', directx_feature_level: '10_1' };
    }
    if (/\b(gma\s*(9\d{2}|3\d{3}|x3\d{3}))\b/.test(s)) {
      return { directx_version: '9.0c', directx_feature_level: '9_2' };
    }
  }

  return { directx_version: null, directx_feature_level: null };
}

function parsePciIds(props: PropBag): {
  vendorId: string | null;
  deviceId: string | null;
  subsysVendorId: string | null;
  subsysDeviceId: string | null;
} {
  let vendorId: string | null = null;
  let deviceId: string | null = null;
  let subsysVendorId: string | null = null;
  let subsysDeviceId: string | null = null;

  const pnpStrings = [
    ...getAllPropsMatching(props, 'pnpdevice'),
    ...getAllPropsMatching(props, 'hardwareid'),
    ...getAllPropsMatching(props, 'deviceid'),
    ...getAllPropsMatching(props, 'pcidevice'),
    ...getAllPropsMatching(props, 'subsystem'),
    ...getAllPropsMatching(props, 'subvendor'),
  ];

  for (const str of pnpStrings) {
    const venMatch = str.match(/VEN_([0-9A-F]{4})/i);
    const devMatch = str.match(/DEV_([0-9A-F]{4})/i);
    const subMatch = str.match(/SUBSYS_([0-9A-F]{4})([0-9A-F]{4})/i);
    if (venMatch && !vendorId) vendorId = venMatch[1].toUpperCase();
    if (devMatch && !deviceId) deviceId = devMatch[1].toUpperCase();
    if (subMatch) {
      // Windows PNP SUBSYS_<dev4><ven4>
      if (!subsysDeviceId) subsysDeviceId = subMatch[1].toUpperCase();
      if (!subsysVendorId) subsysVendorId = subMatch[2].toUpperCase();
    }
    const pairMatch = str.match(/([0-9A-F]{4})\s*[\/:]\s*([0-9A-F]{4})/i);
    if (pairMatch) {
      const a = pairMatch[1].toUpperCase();
      const b = pairMatch[2].toUpperCase();
      if (str.toLowerCase().includes('sub') || str.toLowerCase().includes('vendor')) {
        if (!subsysVendorId && PCI_SUBSYS_VENDOR_MAP[a]) {
          subsysVendorId = a;
          subsysDeviceId = b;
        } else if (!subsysVendorId && PCI_SUBSYS_VENDOR_MAP[b]) {
          subsysVendorId = b;
          subsysDeviceId = a;
        } else if (!subsysVendorId) {
          subsysVendorId = a;
          subsysDeviceId = b;
        }
      }
    }
  }

  const directSubVen = getProp(
    props,
    'SubvendorID',
    'SubsystemVendorID',
    'PCI Subsystem Vendor ID',
    'Video Card Subvendor',
  );
  if (directSubVen && !subsysVendorId) {
    const m = directSubVen.match(/([0-9A-F]{4})/i);
    if (m) subsysVendorId = m[1].toUpperCase();
  }

  return { vendorId, deviceId, subsysVendorId, subsysDeviceId };
}

function normalizeRamSpeed(
  rawFreq: string | null,
  ramType: string | null,
  pcRating: string | null,
  moduleDesc: string | null,
): number | null {
  // Prefer explicit DDR4-3200 / DDR5-6000 / DDR3-1600 / PC4-25600 in module description
  const combined = `${moduleDesc ?? ''} ${pcRating ?? ''}`;
  const ddrRateMatch = combined.match(/\b(?:LP)?DDR[2345]X?-(\d{3,5})\b/i);
  if (ddrRateMatch) {
    const rate = Number.parseInt(ddrRateMatch[1], 10);
    if (Number.isFinite(rate) && rate >= 200) return rate;
  }
  const pcMatch = combined.match(/\bPC\d?[L]?-(\d{4,6})\b/i);
  if (pcMatch) {
    const bw = Number.parseInt(pcMatch[1], 10);
    if (Number.isFinite(bw) && bw >= 1600) {
      return Math.round(bw / 8);
    }
  }

  const n = parseNumber(rawFreq);
  if (n === null || n <= 0) return null;
  const speed = Math.round(n);
  const type = (ramType ?? '').toUpperCase();

  // HWiNFO often reports true I/O bus clock (half of DDR effective MT/s)
  if (type.includes('DDR5')) {
    return speed < 3600 ? speed * 2 : speed;
  }
  if (type.includes('DDR4')) {
    return speed <= 1800 ? speed * 2 : speed;
  }
  if (type.includes('DDR3')) {
    return speed <= 1100 ? speed * 2 : speed;
  }
  if (type.includes('DDR2')) {
    return speed <= 550 ? speed * 2 : speed;
  }
  if (type === 'DDR') {
    return speed <= 250 ? speed * 2 : speed;
  }
  return speed;
}

function computePcRating(
  ramType: string | null,
  speedMhz: number | null,
): string | null {
  if (!ramType || !speedMhz) return null;
  const upper = ramType.toUpperCase();
  const bw = Math.round(speedMhz * 8);
  if (upper.includes('DDR5')) return `PC5-${bw}`;
  if (upper.includes('DDR4')) return `PC4-${bw}`;
  if (upper.includes('DDR3')) return `PC3-${bw}`;
  if (upper.includes('DDR2')) return `PC2-${bw}`;
  if (upper === 'DDR') return `PC-${bw}`;
  return null;
}

const KNOWN_DRIVE_BRANDS: Array<{ re: RegExp; brand: string }> = [
  { re: /^(samsung|mz-?v|mz-?7)/i, brand: 'Samsung' },
  { re: /^(western\s*digital|wdc|wd[\s_-]|wd\d)/i, brand: 'Western Digital' },
  { re: /^(crucial|ct\d{3,}|micron)/i, brand: 'Crucial' },
  { re: /^(seagate|st\d{3,})/i, brand: 'Seagate' },
  { re: /^(sk\s*hynix|hynix|hfs|hfm|bc7|bc9)/i, brand: 'SK hynix' },
  { re: /^(intel|ssdpe|ssdsc)/i, brand: 'Intel' },
  { re: /^(kingston|snv|skc|sa400|suv)/i, brand: 'Kingston' },
  { re: /^(sandisk|sdss)/i, brand: 'SanDisk' },
  { re: /^(kioxia|bg[456]|xg[5678]|exceria)/i, brand: 'Kioxia' },
  { re: /^(toshiba|mq0|hdwd|dt0|thns)/i, brand: 'Toshiba' },
  { re: /^(sabrent|sb-rocket)/i, brand: 'Sabrent' },
  { re: /^(team\s*group|t-force|tm8|t253)/i, brand: 'TeamGroup' },
  { re: /^(adata|xpg|asx|su\d{3})/i, brand: 'ADATA' },
  { re: /^(hitachi|hgst|hts|hua|hds)/i, brand: 'HGST' },
  { re: /^(maxtor|stm\d)/i, brand: 'Maxtor' },
  { re: /^(quantum|fireball)/i, brand: 'Quantum' },
  { re: /^(solidigm|ssdpf)/i, brand: 'Solidigm' },
  { re: /^(lexar|lnm)/i, brand: 'Lexar' },
  { re: /^(corsair|force|mp[4567]\d0)/i, brand: 'Corsair' },
  { re: /^(pny|cs[123]\d{3})/i, brand: 'PNY' },
  { re: /^(fujitsu|mht|mhv|mhw|mhz)/i, brand: 'Fujitsu' },
  { re: /^(ibm|deskstar|travelstar)/i, brand: 'IBM' },
  { re: /^(asus|rog)/i, brand: 'ASUS' },
  { re: /^(silicon\s*power|spcc)/i, brand: 'Silicon Power' },
  { re: /^(patriot|viper|p300|p210)/i, brand: 'Patriot' },
  { re: /^(inland)/i, brand: 'Inland' },
];

const STANDARD_CAPACITIES_GB = [
  16, 20, 30, 32, 40, 60, 64, 80, 100, 120, 128, 160, 200, 240, 250, 256, 300,
  320, 400, 480, 500, 512, 600, 640, 750, 960, 1000, 1024, 1500, 1920, 2000,
  2048, 3000, 4000, 4096, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000,
  24000,
];

function parseDriveCapacityGb(raw: string | null): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  // Prefer decimal GB if HWiNFO outputs "953,869 MBytes (1000 GB)"
  const parenGb = raw.match(/\((\d+(?:[.,]\d+)?)\s*(TB|GB)\)/i);
  let gb: number | null = null;
  if (parenGb) {
    const val = Number.parseFloat(parenGb[1].replace(/,/g, ''));
    gb = parenGb[2].toUpperCase() === 'TB' ? val * 1000 : val;
  } else {
    const n = parseNumber(raw);
    if (n === null || n <= 0) return null;
    if (lower.includes('tb') || lower.includes('tbyte')) {
      gb = n * 1000;
    } else if (lower.includes('mb') || lower.includes('mbyte')) {
      // MBytes in HWiNFO are MiB (e.g. 953869 MBytes = 1000.2 GB)
      gb = (n * 1024 * 1024) / 1_000_000_000;
    } else if (lower.includes('gib')) {
      gb = (n * 1024 * 1024 * 1024) / 1_000_000_000;
    } else {
      gb = n;
    }
  }
  if (!gb || gb <= 0) return null;

  for (const std of STANDARD_CAPACITIES_GB) {
    if (Math.abs(gb - std) / std <= 0.045) {
      return std;
    }
  }
  return Math.round(gb);
}

function inferDriveBrandAndModel(rawModel: string): {
  brand: string | null;
  model: string;
  modelNumber: string | null;
} {
  let clean = cleanText(rawModel)
    .replace(/\b(scsi\s+disk\s+device|ata\s+device|nvme|disk\s+drive)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  let brand: string | null = null;
  for (const entry of KNOWN_DRIVE_BRANDS) {
    if (entry.re.test(clean)) {
      brand = entry.brand;
      break;
    }
  }

  let model = clean;
  if (brand) {
    const prefixRe = new RegExp(`^${brand.replace(/\s+/g, '\\s*')}\\s+`, 'i');
    model = model.replace(prefixRe, '').trim() || clean;
    if (brand === 'Western Digital') {
      model = model.replace(/^WDC\s+/i, '').trim() || model;
    }
  }

  const tokens = clean.split(/\s+/);
  const codeToken =
    tokens.find((t) => /[A-Z0-9]{2,}-[A-Z0-9]{2,}|^[A-Z]{2,4}\d{3,}[A-Z0-9]*$/i.test(t)) ??
    (tokens.length === 1 ? tokens[0] : null);

  return {
    brand,
    model: model || rawModel,
    modelNumber: codeToken && codeToken.length >= 5 ? codeToken : null,
  };
}

function inferWifiStandard(raw: string): string | null {
  const s = raw.toLowerCase();
  if (/\b(be\d{3}|wi-?fi\s*7|802\.11be)\b/.test(s)) return 'Wi-Fi 7 (802.11be)';
  if (/\b(ax210|ax211|ax411|ax1675|ax1690|mt7922|rz616|qcnfa765|wi-?fi\s*6e|802\.11ax.*6e)\b/.test(s)) {
    return 'Wi-Fi 6E (802.11ax)';
  }
  if (/\b(ax\d{3}|wi-?fi\s*6|802\.11ax)\b/.test(s)) return 'Wi-Fi 6 (802.11ax)';
  if (/\b(ac\s*-?\d{4}|wi-?fi\s*5|802\.11ac|dual\s+band\s+wireless-ac)\b/.test(s)) {
    return 'Wi-Fi 5 (802.11ac)';
  }
  if (/\b(802\.11n|wireless-n|centrino.*n|wi-?fi\s*4)\b/.test(s)) {
    return 'Wi-Fi 4 (802.11n)';
  }
  if (/\b802\.11g\b/.test(s)) return '802.11g';
  if (/\b802\.11b\b/.test(s)) return '802.11b';
  if (/\b802\.11a\b/.test(s)) return '802.11a';
  return null;
}

/**
 * Parse an HWiNFO32 or HWiNFO64 XML report string into structured rig hardware specs.
 */
export function parseHwinfoXml(
  xmlText: string,
  fileName: string | null = null,
): ParsedHwinfoReport {
  const sanitized = sanitizeXmlString(xmlText);
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(
      `Invalid XML file${fileName ? ` (${fileName})` : ''}: ${cleanText(parseError.textContent).slice(0, 160)}`,
    );
  }

  const root = doc.documentElement;
  if (!root) {
    throw new Error('XML document has no root element.');
  }

  const rootTag = root.tagName.toLowerCase();
  const hasHwinfoStructure =
    rootTag.includes('hwinfo') ||
    rootTag === 'computer' ||
    Boolean(doc.querySelector('SubNode, NodeName, CPU, MOBO, VIDEO, MEMORY, DRIVES'));
  if (!hasHwinfoStructure) {
    throw new Error(
      `Unrecognized XML root <${root.tagName}>. Export via HWiNFO32/HWiNFO64 -> Save Report -> XML.`,
    );
  }

  const warnings: string[] = [];
  const allNodes = collectSubNodes(root);
  const rootProps = extractNodeProps(root, true);

  const hwinfoVersion = getProp(
    rootProps,
    'HWiNFOVersion',
    'ProgramVersion',
    'Version',
    'HWiNFO',
  );
  const computerName = getProp(
    rootProps,
    'ComputerName',
    'Computer Name',
    'HostName',
    'SystemName',
  );
  const osName = getProp(
    rootProps,
    'OperatingSystem',
    'Operating System',
    'OS',
    'OSVersion',
  );
  const systemManufacturer = getProp(
    rootProps,
    'SystemManufacturer',
    'System Manufacturer',
    'Manufacturer',
    'ComputerBrand',
  );
  const systemModel = getProp(
    rootProps,
    'SystemProductName',
    'System Product Name',
    'SystemModel',
    'System Model',
    'ProductName',
  );
  const chassisType = getProp(
    rootProps,
    'ChassisType',
    'Chassis Type',
    'EnclosureType',
    'SystemType',
  );

  // Battery detection
  const hasBattery = allNodes.some((n) => {
    const t = n.tagName;
    const nm = n.nodeName.toLowerCase();
    return (
      t === 'battery' ||
      t === 'smartbattery' ||
      nm.includes('smart battery') ||
      (nm.includes('battery') && !nm.includes('cmos'))
    );
  });

  // 1. CPU parsing (deduplicate physical sockets; skip Core #0 / Thread nodes)
  const cpuNodes = allNodes.filter((n) => {
    const t = n.tagName;
    const nm = n.nodeName.toLowerCase();
    if (
      nm.includes('core #') ||
      nm.includes('thread #') ||
      nm.includes('cache') ||
      nm.includes('feature') ||
      nm.includes('tlb')
    ) {
      return false;
    }
    const hasCpuProp = Boolean(
      getProp(
        n.props,
        'ProcessorName',
        'CPUBrandName',
        'CPU Brand Name',
        'Processor Brand Name',
        'Processor',
      ),
    );
    return (
      (t === 'cpu' || t === 'processor' || nm.startsWith('cpu #') || nm.includes('central processor')) &&
      hasCpuProp
    );
  });

  const cpuPropsList =
    cpuNodes.length > 0
      ? cpuNodes.map((n) => n.props)
      : (() => {
          const directCpuName = getProp(
            rootProps,
            'ProcessorName',
            'CPUBrandName',
            'CPU Brand Name',
            'Processor Brand Name',
          );
          return directCpuName ? [rootProps] : [];
        })();

  let parsedCpu: ParsedHwinfoCpu | null = null;
  let cpuCount = 0;

  if (cpuPropsList.length > 0) {
    // Deduplicate identical physical CPU nodes if nested XML repeated them
    const seenCpuKeys = new Set<string>();
    const uniqueCpuProps: PropBag[] = [];
    for (const bag of cpuPropsList) {
      const rawName = getProp(
        bag,
        'CPUBrandName',
        'CPU Brand Name',
        'ProcessorName',
        'Processor Brand Name',
        'Processor',
      );
      if (!rawName) continue;
      const pkgKey =
        getProp(bag, 'Package', 'Socket', 'CPUSocket', 'CPU ID', 'CPUID') ??
        `${rawName}#${uniqueCpuProps.length}`;
      const compositeKey = `${rawName}|${pkgKey}|${uniqueCpuProps.length}`;
      if (!seenCpuKeys.has(compositeKey)) {
        seenCpuKeys.add(compositeKey);
        uniqueCpuProps.push(bag);
      }
    }

    cpuCount = Math.max(1, uniqueCpuProps.length);
    const primary = uniqueCpuProps[0];
    const rawName =
      getProp(
        primary,
        'CPUBrandName',
        'CPU Brand Name',
        'ProcessorName',
        'Processor Brand Name',
        'Processor',
      ) ?? '';
    const { brand, name } = cleanCpuBrandAndName(rawName);
    const codename = getProp(
      primary,
      'CPUCodename',
      'CPU Code Name',
      'CodeName',
      'Codename',
    );
    const socket = cleanSocket(
      getProp(
        primary,
        'CPUSocket',
        'CPU Socket',
        'CPUPlatform',
        'CPU Platform',
        'Socket',
      ),
    );
    const cores = parseNumber(
      getProp(
        primary,
        'NumberOfProcessorCores',
        'Number of Processor Cores',
        'PhysicalCores',
        'Cores',
      ),
    );
    const threads = parseNumber(
      getProp(
        primary,
        'NumberOfLogicalProcessors',
        'Number of Logical CPUs',
        'LogicalProcessors',
        'Threads',
      ),
    );
    const baseClockGhz = parseClockGhz(
      getProp(
        primary,
        'OriginalProcessorFrequency',
        'Original Processor Frequency',
        'BaseClock',
        'CPUClock',
        'Clock',
      ),
    );
    const turboClockGhz = parseClockGhz(
      getProp(
        primary,
        'MaximumProcessorFrequency',
        'Maximum Turbo Core Clock',
        'TurboClock',
        'MaxClock',
      ),
    );
    const cacheMb = parseCacheMb(
      getProp(
        primary,
        'L3CacheSize',
        'L3 Cache',
        'L2CacheSize',
        'L2 Cache',
        'CacheSize',
      ),
    );
    const tdpW = parseNumber(
      getProp(primary, 'TDP', 'ThermalDesignPower', 'Thermal Design Power'),
    );
    const processNm = parseNumber(
      getProp(primary, 'Process', 'ProcessTechnology', 'Lithography'),
    );

    parsedCpu = {
      rawName,
      brand,
      name,
      codename,
      socket,
      cores: cores !== null ? Math.round(cores) : null,
      threads: threads !== null ? Math.round(threads) : null,
      baseClockGhz,
      turboClockGhz,
      cacheMb,
      tdpW: tdpW !== null ? Math.round(tdpW) : null,
      processNm: processNm !== null ? Math.round(processNm) : null,
      isMobile: isMobileCpuName(name, socket),
    };
  } else {
    warnings.push('No CPU node found in XML.');
  }

  // 2. Motherboard parsing
  const moboNode = allNodes.find((n) => {
    const t = n.tagName;
    const nm = n.nodeName.toLowerCase();
    return (
      t === 'mobo' ||
      t === 'motherboard' ||
      t === 'mainboard' ||
      nm === 'motherboard' ||
      nm.includes('motherboard')
    );
  });
  const moboProps = moboNode?.props ?? rootProps;
  const rawMoboModel = getProp(
    moboProps,
    'MotherboardModel',
    'Motherboard Model',
    'MainboardModel',
    'BaseBoardProduct',
    'SystemProductName',
  );
  const rawMoboBrand = getProp(
    moboProps,
    'MotherboardManufacturer',
    'Motherboard Manufacturer',
    'BaseBoardManufacturer',
    'SystemManufacturer',
  );
  const biosVersion = getProp(
    moboProps,
    'BIOSVersion',
    'BIOS Version',
    'SMBIOSBIOSVersion',
  ) ?? getProp(rootProps, 'BIOSVersion', 'BIOS Version');
  const biosDate = getProp(moboProps, 'BIOSDate', 'BIOS Date') ?? getProp(rootProps, 'BIOSDate', 'BIOS Date');
  const moboChipset = getProp(
    moboProps,
    'MotherboardChipset',
    'Motherboard Chipset',
    'Chipset',
  );

  let parsedMotherboard: ParsedHwinfoMotherboard | null = null;
  if (rawMoboModel) {
    let brand = normalizeManufacturer(rawMoboBrand);
    if (!brand) {
      const inferred = normalizeManufacturer(rawMoboModel);
      if (inferred !== rawMoboModel) brand = inferred;
    }
    let model = cleanText(rawMoboModel);
    if (brand) {
      const brandRe = new RegExp(`^${brand}\\s+`, 'i');
      model = model.replace(brandRe, '').trim() || model;
    }
    parsedMotherboard = {
      rawModel: rawMoboModel,
      brand: brand || 'Unknown',
      model,
      chipset: moboChipset,
      socket: parsedCpu?.socket ?? null,
      biosVersion,
      biosDate,
    };
  }

  // 3. GPU parsing
  const videoNodes = allNodes.filter((n) => {
    const t = n.tagName;
    const nm = n.nodeName.toLowerCase();
    if (
      nm.includes('monitor') ||
      nm.includes('display') && !nm.includes('adapter')
    ) {
      return false;
    }
    const hasGpuProp = Boolean(
      getProp(
        n.props,
        'VideoChipset',
        'Video Chipset',
        'GPUName',
        'GraphicsProcessor',
        'VideoCard',
        'Video Card',
        'AdapterString',
      ),
    );
    return (
      hasGpuProp &&
      (t === 'video' ||
        t === 'gpu' ||
        t === 'videoadapter' ||
        nm.includes('video adapter') ||
        nm.includes('video chipset') ||
        nm.startsWith('gpu') ||
        nm.includes('nvidia') ||
        nm.includes('radeon') ||
        nm.includes('intel'))
    );
  });

  const gpuPropBags =
    videoNodes.length > 0
      ? videoNodes.map((n) => n.props)
      : getProp(rootProps, 'VideoChipset', 'Video Chipset', 'VideoCard', 'Video Card')
        ? [rootProps]
        : [];

  const parsedGpus: ParsedHwinfoGpu[] = [];
  const seenGpuKeys = new Set<string>();

  for (const bag of gpuPropBags) {
    const rawChipset =
      getProp(
        bag,
        'VideoChipset',
        'Video Chipset',
        'GraphicsProcessor',
        'GPUName',
        'VideoCard',
        'Video Card',
      ) ?? '';
    const rawCardName = getProp(bag, 'VideoCard', 'Video Card', 'AdapterString');
    const combinedRaw = `${rawChipset} ${rawCardName ?? ''}`.toLowerCase();

    if (!rawChipset || VIRTUAL_GPU_PATTERNS.some((p) => combinedRaw.includes(p))) {
      continue;
    }

    const { brand, name } = cleanGpuBrandAndName(rawChipset);
    const pci = parsePciIds(bag);
    const subsysBrand = pci.subsysVendorId
      ? (PCI_SUBSYS_VENDOR_MAP[pci.subsysVendorId] ?? null)
      : null;

    let aibManufacturer: string | null = subsysBrand;
    let aibModel: string | null = null;
    if (rawCardName) {
      const cardNorm = cleanText(rawCardName);
      const inferredFromCard = normalizeManufacturer(cardNorm);
      if (
        !aibManufacturer &&
        inferredFromCard &&
        inferredFromCard !== cardNorm &&
        inferredFromCard !== brand
      ) {
        aibManufacturer = inferredFromCard;
      }
      if (aibManufacturer && aibManufacturer !== brand) {
        aibModel = cardNorm
          .replace(new RegExp(`^${aibManufacturer}\\s+`, 'i'), '')
          .trim();
        if (!aibModel || aibModel.toLowerCase() === name.toLowerCase()) {
          aibModel = cardNorm;
        }
      } else if (cardNorm.toLowerCase() !== rawChipset.toLowerCase()) {
        aibModel = cardNorm;
      }
    }

    const vramGb = parseVramGb(
      getProp(
        bag,
        'VideoMemory',
        'Video Memory',
        'MemorySize',
        'DedicatedVideoMemory',
      ),
    );
    const vramType = getProp(
      bag,
      'VideoMemoryType',
      'MemoryType',
      'Memory Type',
    );
    const busInterface = getProp(
      bag,
      'VideoBus',
      'Video Bus',
      'BusInterface',
      'Interface',
    );
    const architecture = getProp(
      bag,
      'VideoChipsetCodename',
      'GPUCodename',
      'CodeName',
      'Architecture',
    );
    const processNm = parseNumber(getProp(bag, 'Process', 'Lithography'));
    const tdpW = parseNumber(getProp(bag, 'TDP', 'BoardPower'));

    const integrated = isIntegratedGpu(brand, name, rawCardName);
    const isMobile = /\b(mobile|laptop|max-q|\d{3,4}m)\b/i.test(
      `${rawChipset} ${rawCardName ?? ''}`,
    );

    const key = `${brand}|${name}|${pci.deviceId ?? ''}|${vramGb ?? ''}`.toLowerCase();
    if (seenGpuKeys.has(key)) continue;
    seenGpuKeys.add(key);

    parsedGpus.push({
      rawChipset,
      rawCardName,
      brand,
      name,
      architecture,
      vramGb,
      vramType,
      busInterface,
      processNm: processNm !== null ? Math.round(processNm) : null,
      tdpW: tdpW !== null ? Math.round(tdpW) : null,
      pciVendorId: pci.vendorId,
      pciDeviceId: pci.deviceId,
      pciSubsysVendorId: pci.subsysVendorId,
      pciSubsysDeviceId: pci.subsysDeviceId,
      aibManufacturer,
      aibModel,
      isIntegrated: integrated,
      isMobile,
    });
  }

  const discreteGpu = parsedGpus.find((g) => !g.isIntegrated) ?? null;
  const integratedGpu = parsedGpus.find((g) => g.isIntegrated) ?? null;

  // 4. Memory parsing
  const memNode = allNodes.find(
    (n) =>
      n.tagName === 'memory' ||
      n.nodeName.toLowerCase() === 'memory' ||
      n.nodeName.toLowerCase().includes('system memory'),
  );
  const memProps = memNode?.props ?? rootProps;
  const totalMemRaw =
    getProp(
      memProps,
      'TotalMemorySize',
      'Total Memory Size',
      'MemorySize',
      'TotalPhysicalMemory',
    ) ?? getProp(rootProps, 'TotalMemorySize', 'Total Memory Size');
  let totalRamGb = parseVramGb(totalMemRaw);
  if (totalRamGb !== null) {
    totalRamGb = Math.max(1, Math.round(totalRamGb));
  }

  const dimmNodes = allNodes.filter((n) => {
    const nm = n.nodeName.toLowerCase();
    const t = n.tagName;
    return (
      t === 'memorymodule' ||
      t === 'dimm' ||
      nm.includes('row:') ||
      nm.includes('dimm') ||
      nm.includes('so-dimm') ||
      nm.includes('memory module') ||
      Boolean(
        getProp(
          n.props,
          'ModuleSize',
          'Module Size',
          'MemoryType',
          'ModulePartNumber',
          'Module Part Number',
        ),
      )
    );
  });

  const modules: ParsedHwinfoRamModule[] = [];
  for (const dn of dimmNodes) {
    const sizeGb = parseVramGb(
      getProp(dn.props, 'ModuleSize', 'Module Size', 'Size', 'Capacity'),
    );
    const modTypeRaw = getProp(
      dn.props,
      'MemoryType',
      'Memory Type',
      'ModuleType',
      'Type',
    );
    const modFreqRaw = getProp(
      dn.props,
      'MemorySpeed',
      'Memory Speed',
      'MemoryClock',
      'Memory Clock',
      'MaxClock',
    );
    const modDesc = getProp(
      dn.props,
      'MemorySpeed',
      'Memory Speed',
      'ModuleDescription',
      'Module Name',
    );
    const modBrandRaw = getProp(
      dn.props,
      'ModuleManufacturer',
      'Module Manufacturer',
      'Manufacturer',
    );
    const modPart = getProp(
      dn.props,
      'ModulePartNumber',
      'Module Part Number',
      'PartNumber',
      'Part Number',
    );
    const modForm = getProp(dn.props, 'FormFactor', 'Form Factor', 'ModuleType');

    const ramTypeMatch = `${modTypeRaw ?? ''} ${modDesc ?? ''} ${dn.nodeName}`.match(
      /\b(LPDDR5X|LPDDR5|LPDDR4X|LPDDR4|DDR5|DDR4|DDR3L|DDR3|DDR2|DDR|SDRAM)\b/i,
    );
    const ramType = ramTypeMatch ? ramTypeMatch[1].toUpperCase() : null;
    const speedMhz = normalizeRamSpeed(modFreqRaw, ramType, null, modDesc);
    const pcRating = computePcRating(ramType, speedMhz);
    const isSodimm = /\b(so-?dimm|lpddr|micro-?dimm)\b/i.test(
      `${modForm ?? ''} ${modTypeRaw ?? ''} ${dn.nodeName}`,
    );

    if (sizeGb || ramType || speedMhz || modPart) {
      modules.push({
        capacityGb: sizeGb ? Math.round(sizeGb) : null,
        brand: modBrandRaw ? normalizeManufacturer(modBrandRaw) : null,
        partNumber: modPart,
        ramType,
        speedMhz,
        pcRating,
        isMobile: isSodimm,
      });
    }
  }

  const aggType =
    modules.find((m) => m.ramType)?.ramType ??
    (() => {
      const tRaw = getProp(memProps, 'MemoryType', 'Memory Type');
      const m = tRaw?.match(/\b(LPDDR5X|LPDDR5|LPDDR4X|LPDDR4|DDR5|DDR4|DDR3L|DDR3|DDR2|DDR|SDRAM)\b/i);
      return m ? m[1].toUpperCase() : null;
    })();
  const aggSpeed =
    modules.find((m) => m.speedMhz)?.speedMhz ??
    normalizeRamSpeed(
      getProp(memProps, 'CurrentMemoryClock', 'MemoryClock', 'Memory Clock', 'MemorySpeed'),
      aggType,
      null,
      null,
    );
  const aggPc = modules.find((m) => m.pcRating)?.pcRating ?? computePcRating(aggType, aggSpeed);

  if (totalRamGb === null && modules.length > 0) {
    const sum = modules.reduce((acc, m) => acc + (m.capacityGb ?? 0), 0);
    if (sum > 0) totalRamGb = sum;
  }

  const parsedRam: ParsedHwinfoRam | null =
    totalRamGb || aggType || aggSpeed || modules.length > 0
      ? {
          totalGb: totalRamGb,
          ramType: aggType,
          speedMhz: aggSpeed,
          pcRating: aggPc,
          modulesCount: modules.length > 0 ? modules.length : null,
          brand: modules.find((m) => m.brand)?.brand ?? null,
          partNumber: modules.find((m) => m.partNumber)?.partNumber ?? null,
          isMobile: modules.some((m) => m.isMobile),
          modules,
        }
      : null;

  // 5. Storage Drives parsing
  const driveNodes = allNodes.filter((n) => {
    const t = n.tagName;
    const nm = n.nodeName.toLowerCase();
    const hasDriveProp = Boolean(
      getProp(
        n.props,
        'DriveModel',
        'Drive Model',
        'DeviceModel',
        'DiskModel',
        'Model',
      ),
    );
    return (
      hasDriveProp &&
      (t === 'drive' ||
        t === 'disk' ||
        t === 'atadrive' ||
        t === 'nvmedrive' ||
        t === 'scsidrive' ||
        nm.includes('drive #') ||
        nm.includes('nvme') ||
        nm.includes('s-ata') ||
        nm.includes('sata') ||
        nm.includes('eide') ||
        nm.includes('atapi') ||
        nm.includes('scsi'))
    );
  });

  const parsedDrives: ParsedHwinfoDrive[] = [];
  const seenDrives = new Set<string>();

  for (const dn of driveNodes) {
    const rawModel =
      getProp(
        dn.props,
        'DriveModel',
        'Drive Model',
        'DeviceModel',
        'DiskModel',
        'Model',
      ) ?? '';
    if (!rawModel) continue;
    const capRaw = getProp(
      dn.props,
      'DriveCapacity',
      'Drive Capacity',
      'Capacity',
      'Size',
    );
    const controller = getProp(
      dn.props,
      'DriveController',
      'Drive Controller',
      'Interface',
      'BusType',
    );
    const mediaType = getProp(
      dn.props,
      'MediaRotationRate',
      'MediaType',
      'NominalMediaRotationRate',
      'FormFactor',
      'DriveFormFactor',
    );
    const serial = getProp(dn.props, 'DriveSerialNumber', 'SerialNumber');

    const dedupeKey = `${rawModel}|${serial ?? capRaw ?? ''}`.toLowerCase();
    if (seenDrives.has(dedupeKey)) continue;
    seenDrives.add(dedupeKey);

    const combinedStr = `${rawModel} ${controller ?? ''} ${dn.nodeName} ${mediaType ?? ''}`;
    let filterReason: string | null = null;
    for (const pat of OPTICAL_OR_REMOVABLE_PATTERNS) {
      if (pat.re.test(combinedStr)) {
        filterReason = pat.reason;
        break;
      }
    }
    if (!filterReason && /\busb\b/i.test(controller ?? '')) {
      filterReason = 'USB storage';
    }

    const { brand, model, modelNumber } = inferDriveBrandAndModel(rawModel);
    const capacityGb = parseDriveCapacityGb(capRaw);

    let formFactor: string | null = null;
    if (/nvme/i.test(combinedStr)) {
      formFactor = 'M.2 NVMe';
    } else if (/m\.2/i.test(combinedStr)) {
      formFactor = 'M.2 SATA';
    } else if (/solid\s*state|ssd|non-rotating/i.test(mediaType ?? '') || /\bssd\b/i.test(rawModel)) {
      formFactor = '2.5" SATA SSD';
    } else if (/\b(5400|7200|10000|15000)\s*rpm\b/i.test(mediaType ?? '')) {
      formFactor = '3.5" SATA HDD';
    } else if (/\b(ide|pata|eide|udma)\b/i.test(controller ?? '')) {
      formFactor = 'IDE HDD';
    } else if (/\bsata\b/i.test(controller ?? '')) {
      formFactor = 'SATA';
    } else if (/\bscsi|sas\b/i.test(controller ?? '')) {
      formFactor = 'SCSI / SAS';
    }

    parsedDrives.push({
      rawModel,
      brand,
      model,
      modelNumber,
      capacityGb,
      formFactor,
      interfaceType: controller,
      isRemovableOrOptical: filterReason !== null,
      filterReason,
      isPrimary: false,
    });
  }

  const firstFixed = parsedDrives.find((d) => !d.isRemovableOrOptical);
  if (firstFixed) firstFixed.isPrimary = true;

  // 6. Wi-Fi parsing
  const netNodes = allNodes.filter((n) => {
    const t = n.tagName;
    const nm = n.nodeName.toLowerCase();
    return (
      t === 'network' ||
      t === 'nic' ||
      t === 'networkadapter' ||
      nm.includes('network card') ||
      nm.includes('wi-fi') ||
      nm.includes('wifi') ||
      nm.includes('wireless') ||
      nm.includes('802.11') ||
      nm.includes('wlan')
    );
  });

  let parsedWifi: ParsedHwinfoWifi | null = null;
  for (const nn of netNodes) {
    const rawName =
      getProp(
        nn.props,
        'NetworkCard',
        'Network Card',
        'AdapterName',
        'Description',
        'DeviceName',
      ) ?? nn.nodeName;
    if (!rawName) continue;
    const lower = rawName.toLowerCase();
    if (IGNORED_NETWORK_PATTERNS.some((p) => lower.includes(p))) continue;

    const looksWireless =
      /\b(wi-?fi|wifi|wireless|wlan|802\.11|ax\d{3}|be\d{3}|ac\s*-?\d{4}|centrino|killer\s+(1[56]\d{2}|ax)|mediatek\s+rz\d{3}|mt79\d{2})\b/i.test(
        rawName,
      );
    if (!looksWireless) continue;

    const brand = normalizeManufacturer(rawName) || 'Unknown';
    const stripped = rawName
      .replace(/\(R\)/gi, '')
      .replace(/\(TM\)/gi, '')
      .replace(/^(intel|qualcomm\s*atheros|qualcomm|atheros|mediatek|realtek|broadcom|killer)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const modelMatch = stripped.match(
      /\b(BE\d{3}|AX\d{3,4}|AC[\s-]?\d{4}|MT\d{4}|RZ\d{3}|QCNFA\d{3}|RTL\d{4}[A-Z]*|BCM\d{4,5}|AR\d{4}|N\s*\d{4})\b/i,
    );
    const model = modelMatch ? modelMatch[1].toUpperCase() : stripped;

    parsedWifi = {
      rawName,
      brand,
      product: stripped !== model ? stripped : null,
      model,
      wifiStandard: inferWifiStandard(rawName),
      formFactor: /\busb\b/i.test(rawName) ? 'USB' : null,
    };
    break;
  }

  // 7. Monitor / Display parsing
  const monitorNodes = allNodes.filter((n) => {
    const t = n.tagName;
    const nm = n.nodeName.toLowerCase();
    return (
      t === 'monitor' ||
      nm.startsWith('monitor') ||
      Boolean(
        getProp(
          n.props,
          'MonitorName',
          'Monitor Name',
          'MaximumResolution',
          'MaxResolution',
          'SupportedResolution',
        ),
      )
    );
  });

  let parsedDisplay: ParsedHwinfoDisplay | null = null;
  for (const mn of monitorNodes) {
    const monName = getProp(mn.props, 'MonitorName', 'Monitor Name', 'Name');
    const resRaw = getProp(
      mn.props,
      'MaximumResolution',
      'Maximum Resolution',
      'NativeResolution',
      'Native Resolution',
      'CurrentResolution',
      'MaxResolution',
    );
    const sizeRaw = getProp(
      mn.props,
      'MonitorSize',
      'DiagonalSize',
      'ScreenSize',
      'MaxImageSize',
    );
    const resMatch = resRaw?.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
    const screenResolution = resMatch ? `${resMatch[1]}x${resMatch[2]}` : null;

    let screenSizeInches: number | null = null;
    if (sizeRaw) {
      const inchMatch = sizeRaw.match(/(\d+(?:\.\d+)?)\s*(?:inch|in|")/i);
      const cmPairMatch = sizeRaw.match(/(\d+(?:\.\d+)?)\s*cm\s*[x×]\s*(\d+(?:\.\d+)?)\s*cm/i);
      if (inchMatch) {
        screenSizeInches = Math.round(Number.parseFloat(inchMatch[1]) * 10) / 10;
      } else if (cmPairMatch) {
        const w = Number.parseFloat(cmPairMatch[1]);
        const h = Number.parseFloat(cmPairMatch[2]);
        const diagInches = Math.sqrt(w * w + h * h) / 2.54;
        if (diagInches > 8 && diagInches < 60) {
          screenSizeInches = Math.round(diagInches * 10) / 10;
        }
      }
    }

    if (screenResolution || screenSizeInches || monName) {
      parsedDisplay = {
        name: monName,
        screenSizeInches,
        screenResolution,
      };
      break;
    }
  }

  // 8. Device Type Heuristic
  let detectedDeviceType: DeviceType = 'Desktop';
  let deviceTypeReason = 'No battery or mobile chassis/CPU indicators detected';
  const chassisLower = (chassisType ?? '').toLowerCase();
  if (hasBattery) {
    detectedDeviceType = 'Laptop';
    deviceTypeReason = 'Smart Battery node detected';
  } else if (
    /\b(laptop|notebook|portable|sub\s*notebook|convertible|handheld|tablet|clamshell)\b/.test(
      chassisLower,
    )
  ) {
    detectedDeviceType = 'Laptop';
    deviceTypeReason = `Chassis type "${chassisType}"`;
  } else if (parsedCpu?.isMobile) {
    detectedDeviceType = 'Laptop';
    deviceTypeReason = `Mobile CPU detected (${parsedCpu.name})`;
  } else if (discreteGpu?.isMobile) {
    detectedDeviceType = 'Laptop';
    deviceTypeReason = `Mobile GPU detected (${discreteGpu.name})`;
  }

  // Align isMobile flags on parsed GPUs/CPU if Laptop was detected
  if (detectedDeviceType === 'Laptop') {
    if (parsedCpu) parsedCpu.isMobile = true;
    for (const g of parsedGpus) {
      g.isMobile = true;
    }
  }

  return {
    fileName,
    hwinfoVersion,
    computerName,
    osName,
    systemManufacturer: systemManufacturer ? normalizeManufacturer(systemManufacturer) : null,
    systemModel,
    chassisType,
    biosVersion,
    biosDate,
    hasBattery,
    detectedDeviceType,
    deviceTypeReason,
    cpu: parsedCpu,
    cpuCount,
    gpus: parsedGpus,
    discreteGpu,
    integratedGpu,
    motherboard: parsedMotherboard,
    ram: parsedRam,
    drives: parsedDrives,
    wifi: parsedWifi,
    display: parsedDisplay,
    warnings,
  };
}
