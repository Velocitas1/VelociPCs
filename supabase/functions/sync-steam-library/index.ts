import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CompatibilityStatus =
  | "playable"
  | "minimum"
  | "blocked_directx"
  | "blocked_vram"
  | "blocked_ram"
  | "blocked_storage"
  | "unknown";

type RequirementsStatus = "pending" | "parsed" | "missing" | "error";

interface SyncSteamRequest {
  action?: "status" | "fetch_library" | "sync_batch" | "evaluate_all";
  steamInput?: string;
  steamId?: string;
  includeFreeGames?: boolean;
  batchSize?: number;
  forceResync?: boolean;
  cursorSyncBefore?: string;
  appIds?: number[];
  computerId?: number;
  dryRun?: boolean;
}

interface OwnedGameApiItem {
  appid: number;
  name?: string;
  playtime_forever?: number;
  img_icon_url?: string;
}

interface GpuRow {
  id: number;
  name: string;
  brand: string;
  vram_gb: number | null;
  vram_type: string | null;
  directx_version: string | null;
  directx_feature_level: string | null;
}

interface ComputerEvalRow {
  id: number;
  name: string;
  ram_gb: number | null;
  gpu: GpuRow | null;
  igpu: GpuRow | null;
  ram_kit: { capacity_gb: number | null } | null;
  storage_drives: Array<{
    capacity_gb: number | null;
    storage_drive_model: { capacity_gb: number | null } | null;
  }>;
}

interface SteamLibraryEvalRow {
  app_id: number;
  title: string;
  min_directx: string | null;
  rec_directx: string | null;
  min_vram_gb: number | null;
  rec_vram_gb: number | null;
  min_ram_gb: number | null;
  rec_ram_gb: number | null;
  storage_gb: number | null;
  manual_override: boolean;
  requirements_status: RequirementsStatus;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&reg;": "®",
  "&trade;": "™",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&quot;": '"',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractHtmlLines(html: string | null | undefined): string[] {
  if (!html || typeof html !== "string") return [];
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:li|p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ");

  const decoded = withBreaks.replace(
    /&(?:amp|nbsp|reg|trade|lt|gt|apos|quot|#39|#x27);/gi,
    (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity,
  );

  return decoded
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseMemoryToGb(
  rawNum: string,
  unit: string,
  minGb: number,
  maxGb: number,
): number | null {
  const numeric = Number.parseFloat(rawNum.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const upperUnit = unit.toUpperCase();
  const gb =
    upperUnit === "TB"
      ? numeric * 1024
      : upperUnit === "MB"
        ? numeric / 1024
        : numeric;
  if (gb < minGb || gb > maxGb) return null;
  return roundTwoDecimals(gb);
}

function extractDirectXFromLines(lines: string[]): string | null {
  const dxLines = lines.filter((line) => /\b(?:directx|dx)\b/i.test(line));
  const targets = dxLines.length > 0 ? dxLines : lines;

  for (const line of targets) {
    const flMatch = line.match(
      /\bdirectx\b[^0-9]*(12)[^\n]*?(?:feature\s*level|fl)\s*(12_[012])/i,
    );
    if (flMatch) return flMatch[2];

    if (/\bdirectx\b[^0-9]*12\s*ultimate\b/i.test(line)) {
      return "12_2";
    }

    const match =
      line.match(
        /\bdirectx(?:\s*version)?\s*:?\s*(?:version\s*)?(1[0-2](?:\.[0-9])?|9(?:\.0[a-c]?)?|8(?:\.[01])?|7)\b/i,
      ) ?? line.match(/\bdx\s*(1[0-2](?:\.[0-9])?|9(?:\.0[a-c]?)?)\b/i);

    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}

function extractRamGbFromLines(lines: string[]): number | null {
  const ramLines = lines.filter((line) =>
    /\b(?:memory|ram|system\s*memory)\s*:/i.test(line),
  );
  for (const line of ramLines) {
    const values: number[] = [];
    for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(GB|MB)\b/gi)) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.03, 512);
      if (parsed !== null) values.push(parsed);
    }
    if (values.length > 0) return Math.min(...values);
  }

  for (const line of lines) {
    const m = line.match(/(\d+(?:[.,]\d+)?)\s*(GB|MB)\s*(?:of\s*)?RAM\b/i);
    if (m) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.03, 512);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function extractVramGbFromLines(lines: string[]): number | null {
  const gpuLines = lines.filter((line) =>
    /\b(?:graphics|video(?:\s*card)?|gpu|display)\s*:/i.test(line),
  );
  if (gpuLines.length === 0) return null;

  for (const line of gpuLines) {
    const values: number[] = [];
    for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(GB|MB)\b/gi)) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.03, 64);
      if (parsed !== null) values.push(parsed);
    }
    if (values.length > 0) return Math.min(...values);
  }
  return null;
}

function extractStorageGbFromLines(lines: string[]): number | null {
  const storageLines = lines.filter((line) =>
    /\b(?:storage|hard\s*(?:disk|drive)|disk\s*space|hd\s*space)\s*:/i.test(
      line,
    ),
  );
  for (const line of storageLines) {
    const values: number[] = [];
    for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)\b/gi)) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.01, 2000);
      if (parsed !== null) values.push(parsed);
    }
    if (values.length > 0) return Math.min(...values);
  }

  for (const line of lines) {
    const m = line.match(
      /(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)\s*(?:of\s*)?(?:available|free)\s*(?:hard\s*(?:disk|drive)\s*)?space\b/i,
    );
    if (m) {
      const parsed = parseMemoryToGb(m[1], m[2], 0.01, 2000);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function parseSteamPcRequirements(
  raw: Record<string, unknown> | null | undefined,
) {
  const minHtml =
    raw && typeof raw === "object" && typeof raw.minimum === "string"
      ? raw.minimum
      : null;
  const recHtml =
    raw && typeof raw === "object" && typeof raw.recommended === "string"
      ? raw.recommended
      : null;

  const minLines = extractHtmlLines(minHtml);
  const recLines = extractHtmlLines(recHtml);

  const min_directx = extractDirectXFromLines(minLines);
  const rec_directx = extractDirectXFromLines(recLines);
  const min_vram_gb = extractVramGbFromLines(minLines);
  const rec_vram_gb = extractVramGbFromLines(recLines);
  const min_ram_gb = extractRamGbFromLines(minLines);
  const rec_ram_gb = extractRamGbFromLines(recLines);
  const minStorage = extractStorageGbFromLines(minLines);
  const recStorage = extractStorageGbFromLines(recLines);
  const storage_gb = minStorage ?? recStorage;

  const hasAnyRequirement =
    min_directx !== null ||
    rec_directx !== null ||
    min_vram_gb !== null ||
    rec_vram_gb !== null ||
    min_ram_gb !== null ||
    rec_ram_gb !== null ||
    storage_gb !== null;

  return {
    min_directx,
    rec_directx,
    min_vram_gb,
    rec_vram_gb,
    min_ram_gb,
    rec_ram_gb,
    storage_gb,
    hasAnyRequirement,
  };
}

function getDirectXTierRank(
  version: string | null | undefined,
  featureLevel?: string | null,
): number {
  if (!version || !version.trim()) return 0;
  const v = version.trim();
  const fl = (featureLevel ?? "").trim();

  if (fl === "12_2") return 1220;
  if (fl === "12_1") return 1210;
  if (fl === "12_0") return 1200;
  if (v.startsWith("12") && fl === "11_1") return 1190;
  if (v.startsWith("12") && fl === "11_0") return 1180;
  if (v.startsWith("12")) return 1200;
  if (v.startsWith("11.2")) return 1120;
  if (v.startsWith("11.1")) return 1110;
  if (v.startsWith("11")) return 1100;
  if (v.startsWith("10.1")) return 1010;
  if (v.startsWith("10")) return 1000;
  if (v.startsWith("9")) return 900;
  return 500;
}

function getRequiredDirectXRank(version: string | null | undefined): number {
  if (!version || !version.trim()) return 0;
  const normalized = version.trim().toLowerCase().replace(/^dx\s*/i, "");

  if (normalized.includes("12_2") || normalized.includes("ultimate")) {
    return 1220;
  }
  if (normalized.includes("12_1")) return 1210;
  if (normalized.includes("12_0") || normalized.startsWith("12")) return 1200;
  if (normalized.startsWith("11.2") || normalized.includes("11_2")) return 1120;
  if (normalized.startsWith("11.1") || normalized.includes("11_1")) return 1110;
  if (normalized.startsWith("11")) return 1100;
  if (normalized.startsWith("10.1")) return 1010;
  if (normalized.startsWith("10")) return 1000;
  if (normalized.startsWith("9")) return 900;
  if (normalized.startsWith("8")) return 800;
  if (normalized.startsWith("7")) return 700;
  return 0;
}

function formatGbSpec(gb: number | null | undefined): string {
  if (gb === null || gb === undefined) return "—";
  if (gb < 1) {
    return `${Math.round(gb * 1024)} MB`;
  }
  return `${Number.isInteger(gb) ? gb : Number(gb.toFixed(2))} GB`;
}

function evaluateRigGameCompatibility(
  rig: ComputerEvalRow,
  game: SteamLibraryEvalRow,
): { status: CompatibilityStatus; blocking_reason: string | null } {
  const hasAnyReq =
    game.min_directx !== null ||
    game.rec_directx !== null ||
    game.min_vram_gb !== null ||
    game.rec_vram_gb !== null ||
    game.min_ram_gb !== null ||
    game.rec_ram_gb !== null ||
    game.storage_gb !== null;

  if (!hasAnyReq) {
    return {
      status: "unknown",
      blocking_reason: "No parsed PC requirements available yet.",
    };
  }

  const effectiveGpu = rig.gpu ?? rig.igpu ?? null;
  const isIntegratedOnly = !rig.gpu && Boolean(rig.igpu);
  const directxVersion = effectiveGpu?.directx_version ?? null;
  const directxFeatureLevel = effectiveGpu?.directx_feature_level ?? null;
  const directxRank = getDirectXTierRank(directxVersion, directxFeatureLevel);
  const vramGb = effectiveGpu?.vram_gb ?? null;
  const ramGb = rig.ram_gb ?? rig.ram_kit?.capacity_gb ?? null;

  const driveCapacities = (rig.storage_drives ?? [])
    .map((d) => d.capacity_gb ?? d.storage_drive_model?.capacity_gb ?? null)
    .filter((cap): cap is number => cap !== null && cap > 0);
  const largestDriveGb =
    driveCapacities.length > 0 ? Math.max(...driveCapacities) : null;

  const blockReasons: string[] = [];
  let primaryBlock: CompatibilityStatus | null = null;

  const assignBlock = (status: CompatibilityStatus, reason: string) => {
    if (!primaryBlock) primaryBlock = status;
    blockReasons.push(reason);
  };

  const minDxRank = getRequiredDirectXRank(game.min_directx);
  if (minDxRank > 0) {
    if (!effectiveGpu) {
      assignBlock(
        "blocked_directx",
        `Requires DirectX ${game.min_directx} (no GPU or iGPU recorded)`,
      );
    } else if (directxRank > 0 && directxRank < minDxRank) {
      assignBlock(
        "blocked_directx",
        `Requires DX ${game.min_directx}; rig supports ${
          directxVersion ?? "unknown"
        }${directxFeatureLevel ? ` (${directxFeatureLevel})` : ""}`,
      );
    }
  }

  if (game.min_vram_gb !== null && game.min_vram_gb > 0) {
    if (!effectiveGpu) {
      assignBlock(
        "blocked_vram",
        `Requires ${formatGbSpec(game.min_vram_gb)} VRAM (no GPU recorded)`,
      );
    } else if (vramGb !== null && vramGb < game.min_vram_gb) {
      assignBlock(
        "blocked_vram",
        `Requires ${formatGbSpec(game.min_vram_gb)} VRAM; rig has ${formatGbSpec(
          vramGb,
        )}`,
      );
    }
  }

  if (
    game.min_ram_gb !== null &&
    game.min_ram_gb > 0 &&
    ramGb !== null &&
    ramGb < game.min_ram_gb
  ) {
    assignBlock(
      "blocked_ram",
      `Requires ${formatGbSpec(game.min_ram_gb)} RAM; rig has ${formatGbSpec(
        ramGb,
      )}`,
    );
  }

  if (
    game.storage_gb !== null &&
    game.storage_gb > 0 &&
    largestDriveGb !== null &&
    largestDriveGb < game.storage_gb
  ) {
    assignBlock(
      "blocked_storage",
      `Needs ${formatGbSpec(game.storage_gb)} storage; largest drive is ${formatGbSpec(
        largestDriveGb,
      )}`,
    );
  }

  if (primaryBlock !== null) {
    return {
      status: primaryBlock,
      blocking_reason: blockReasons.join(" · "),
    };
  }

  const shortfalls: string[] = [];

  const recDxRank = getRequiredDirectXRank(game.rec_directx);
  if (recDxRank > 0 && directxRank > 0 && directxRank < recDxRank) {
    shortfalls.push(
      `Recommended DX ${game.rec_directx} (rig has DX ${directxVersion})`,
    );
  }

  if (
    game.rec_vram_gb !== null &&
    game.rec_vram_gb > 0 &&
    vramGb !== null &&
    vramGb < game.rec_vram_gb
  ) {
    shortfalls.push(
      `Recommended ${formatGbSpec(game.rec_vram_gb)} VRAM (rig has ${formatGbSpec(
        vramGb,
      )})`,
    );
  }

  if (
    isIntegratedOnly &&
    vramGb === null &&
    (game.rec_vram_gb ?? game.min_vram_gb ?? 0) >= 2
  ) {
    const targetVram = game.rec_vram_gb ?? game.min_vram_gb;
    shortfalls.push(
      `Integrated GPU shares system RAM (game asks ${formatGbSpec(targetVram)} VRAM)`,
    );
  }

  if (
    game.rec_ram_gb !== null &&
    game.rec_ram_gb > 0 &&
    ramGb !== null &&
    ramGb < game.rec_ram_gb
  ) {
    shortfalls.push(
      `Recommended ${formatGbSpec(game.rec_ram_gb)} RAM (rig has ${formatGbSpec(
        ramGb,
      )})`,
    );
  }

  if (shortfalls.length > 0) {
    return {
      status: "minimum",
      blocking_reason: shortfalls.join(" · "),
    };
  }

  return {
    status: "playable",
    blocking_reason: null,
  };
}

async function resolveSteamId64(
  rawInput: string,
  steamApiKey: string,
): Promise<string> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error(
      "Enter a SteamID64, custom vanity URL name, or Steam profile URL.",
    );
  }

  if (/^7656\d{13}$/.test(trimmed)) {
    return trimmed;
  }

  const profileMatch = trimmed.match(
    /steamcommunity\.com\/profiles\/(7656\d{13})/i,
  );
  if (profileMatch?.[1]) {
    return profileMatch[1];
  }

  const vanityUrlMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  const vanityName = (vanityUrlMatch?.[1] ?? trimmed).replace(/\/+$/, "");

  const resolveUrl = new URL(
    "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/",
  );
  resolveUrl.searchParams.set("key", steamApiKey);
  resolveUrl.searchParams.set("vanityurl", vanityName);

  const res = await fetch(resolveUrl.toString());
  if (!res.ok) {
    throw new Error(
      `Steam ResolveVanityURL failed (${res.status}). Try entering your 17-digit SteamID64 directly.`,
    );
  }
  const data = (await res.json()) as {
    response?: { success?: number; steamid?: string; message?: string };
  };

  if (data.response?.success === 1 && data.response.steamid) {
    return data.response.steamid;
  }

  throw new Error(
    `Could not resolve Steam profile "${vanityName}" (${
      data.response?.message ?? "not found"
    }). Try pasting your full Steam profile URL or 17-digit SteamID64.`,
  );
}

async function fetchAllSteamGames(
  supabase: SupabaseClient,
  appIds?: number[],
): Promise<SteamLibraryEvalRow[]> {
  const all: SteamLibraryEvalRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from("steam_library")
      .select(
        "app_id, title, min_directx, rec_directx, min_vram_gb, rec_vram_gb, min_ram_gb, rec_ram_gb, storage_gb, manual_override, requirements_status",
      )
      .order("app_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (appIds && appIds.length > 0) {
      query = query.in("app_id", appIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as SteamLibraryEvalRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function fetchEvaluationComputers(
  supabase: SupabaseClient,
  computerId?: number,
): Promise<ComputerEvalRow[]> {
  let query = supabase
    .from("computers")
    .select(
      `
      id,
      name,
      ram_gb,
      gpu:gpus!computers_gpu_id_fkey(id, name, brand, vram_gb, vram_type, directx_version, directx_feature_level),
      igpu:gpus!computers_igpu_id_fkey(id, name, brand, vram_gb, vram_type, directx_version, directx_feature_level),
      ram_kit:ram_kits!computers_ram_kit_id_fkey(capacity_gb),
      storage_drives(capacity_gb, storage_drive_model:storage_drive_models!storage_drives_storage_drive_model_id_fkey(capacity_gb))
    `,
    )
    .order("id", { ascending: true });

  if (computerId) {
    query = query.eq("id", computerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ComputerEvalRow[];
}

async function evaluateAndPersistCompatibility(
  supabase: SupabaseClient,
  options: { computerId?: number; appIds?: number[] },
): Promise<{
  computersEvaluated: number;
  gamesEvaluated: number;
  rowsUpserted: number;
}> {
  const [computers, games] = await Promise.all([
    fetchEvaluationComputers(supabase, options.computerId),
    fetchAllSteamGames(supabase, options.appIds),
  ]);

  if (computers.length === 0 || games.length === 0) {
    return {
      computersEvaluated: computers.length,
      gamesEvaluated: games.length,
      rowsUpserted: 0,
    };
  }

  const nowIso = new Date().toISOString();
  const payload: Array<{
    computer_id: number;
    steam_app_id: number;
    status: CompatibilityStatus;
    blocking_reason: string | null;
    evaluated_at: string;
  }> = [];

  for (const rig of computers) {
    for (const game of games) {
      const result = evaluateRigGameCompatibility(rig, game);
      payload.push({
        computer_id: rig.id,
        steam_app_id: game.app_id,
        status: result.status,
        blocking_reason: result.blocking_reason,
        evaluated_at: nowIso,
      });
    }
  }

  const chunkSize = 500;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("build_game_compatibility")
      .upsert(chunk, { onConflict: "computer_id,steam_app_id" });
    if (error) throw error;
  }

  return {
    computersEvaluated: computers.length,
    gamesEvaluated: games.length,
    rowsUpserted: payload.length,
  };
}

async function fetchLibraryStats(supabase: SupabaseClient) {
  const [totalRes, pendingRes, overrideRes] = await Promise.all([
    supabase
      .from("steam_library")
      .select("app_id", { count: "exact", head: true }),
    supabase
      .from("steam_library")
      .select("app_id", { count: "exact", head: true })
      .eq("manual_override", false)
      .in("requirements_status", ["pending", "error"]),
    supabase
      .from("steam_library")
      .select("app_id", { count: "exact", head: true })
      .eq("manual_override", true),
  ]);

  if (totalRes.error) throw totalRes.error;
  if (pendingRes.error) throw pendingRes.error;
  if (overrideRes.error) throw overrideRes.error;

  return {
    totalGames: totalRes.count ?? 0,
    pendingCount: pendingRes.count ?? 0,
    manualOverrideCount: overrideRes.count ?? 0,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(
        { status: "error", error: "Supabase environment is not configured." },
        500,
      );
    }

    if (!authHeader) {
      return jsonResponse(
        { status: "error", error: "Missing Authorization header." },
        401,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
    if (adminErr) {
      return jsonResponse({ status: "error", error: adminErr.message }, 401);
    }
    if (isAdmin !== true) {
      return jsonResponse(
        { status: "error", error: "Owner authentication required." },
        403,
      );
    }

    const body = (await req.json().catch(() => ({}))) as SyncSteamRequest;
    const action = body.action ?? (body.dryRun ? "status" : "status");
    const steamApiKey = Deno.env.get("STEAM_WEB_API_KEY") ?? "";

    // 1. Status check
    if (action === "status") {
      const stats = await fetchLibraryStats(supabase);
      return jsonResponse({
        status: "ready",
        steamWebApiConfigured: Boolean(steamApiKey),
        ...stats,
      });
    }

    // 2. Fetch owned games list from Steam Web API
    if (action === "fetch_library") {
      if (!steamApiKey) {
        return jsonResponse(
          {
            status: "error",
            error:
              "STEAM_WEB_API_KEY secret is not configured in Supabase Edge Function secrets.",
          },
          500,
        );
      }

      const rawSteamInput = (body.steamInput ?? body.steamId ?? "").trim();
      const steamId64 = await resolveSteamId64(rawSteamInput, steamApiKey);

      const ownedUrl = new URL(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
      );
      ownedUrl.searchParams.set("key", steamApiKey);
      ownedUrl.searchParams.set("steamid", steamId64);
      ownedUrl.searchParams.set("include_appinfo", "true");
      ownedUrl.searchParams.set("include_played_free_games", "true");
      if (body.includeFreeGames) {
        ownedUrl.searchParams.set("include_free_sub", "true");
      }

      const ownedRes = await fetch(ownedUrl.toString());
      if (!ownedRes.ok) {
        return jsonResponse(
          {
            status: "error",
            error: `Steam GetOwnedGames failed with HTTP ${ownedRes.status}.`,
          },
          502,
        );
      }

      const ownedJson = (await ownedRes.json()) as {
        response?: { game_count?: number; games?: OwnedGameApiItem[] };
      };
      const games = ownedJson.response?.games ?? [];

      if (games.length === 0) {
        return jsonResponse(
          {
            status: "error",
            error:
              "Steam returned 0 games. Ensure your Steam Profile > Game details privacy setting is set to Public.",
          },
          400,
        );
      }

      const dedupedByAppId = new Map<number, OwnedGameApiItem>();
      for (const g of games) {
        if (typeof g.appid === "number" && g.appid > 0) {
          dedupedByAppId.set(g.appid, g);
        }
      }

      const existingIds = new Set<number>();
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("steam_library")
          .select("app_id")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as Array<{ app_id: number }>;
        for (const r of rows) existingIds.add(r.app_id);
        if (rows.length < pageSize) break;
        from += pageSize;
      }

      const nowIso = new Date().toISOString();
      const newRows: Array<Record<string, unknown>> = [];
      const existingRows: Array<Record<string, unknown>> = [];

      for (const g of dedupedByAppId.values()) {
        const title = (g.name ?? `App ${g.appid}`).trim() || `App ${g.appid}`;
        const playtimeMinutes = Math.max(
          0,
          Math.round(g.playtime_forever ?? 0),
        );
        const headerUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`;
        const storeUrl = `https://store.steampowered.com/app/${g.appid}/`;

        if (existingIds.has(g.appid)) {
          existingRows.push({
            app_id: g.appid,
            title,
            playtime_minutes: playtimeMinutes,
            header_image_url: headerUrl,
            store_url: storeUrl,
            last_synced_at: nowIso,
          });
        } else {
          newRows.push({
            app_id: g.appid,
            title,
            playtime_minutes: playtimeMinutes,
            header_image_url: headerUrl,
            store_url: storeUrl,
            requirements_status: "pending",
            manual_override: false,
            last_synced_at: nowIso,
          });
        }
      }

      const chunkSize = 500;
      for (let i = 0; i < newRows.length; i += chunkSize) {
        const { error } = await supabase
          .from("steam_library")
          .upsert(newRows.slice(i, i + chunkSize), { onConflict: "app_id" });
        if (error) throw error;
      }

      for (let i = 0; i < existingRows.length; i += chunkSize) {
        const { error } = await supabase
          .from("steam_library")
          .upsert(existingRows.slice(i, i + chunkSize), {
            onConflict: "app_id",
          });
        if (error) throw error;
      }

      const stats = await fetchLibraryStats(supabase);
      return jsonResponse({
        status: "ok",
        steamId64,
        totalOwned: dedupedByAppId.size,
        newGamesCount: newRows.length,
        existingGamesCount: existingRows.length,
        ...stats,
      });
    }

    // 3. Sync next batch of store appdetails + evaluate compatibility
    if (action === "sync_batch") {
      const batchSize = Math.min(
        20,
        Math.max(1, Math.round(body.batchSize ?? 10)),
      );
      const forceResync = Boolean(body.forceResync);

      let batchQuery = supabase
        .from("steam_library")
        .select("app_id, title, playtime_minutes")
        .eq("manual_override", false);

      if (body.appIds && body.appIds.length > 0) {
        batchQuery = batchQuery.in("app_id", body.appIds);
      } else if (forceResync) {
        if (body.cursorSyncBefore) {
          batchQuery = batchQuery.or(
            `requirements_synced_at.is.null,requirements_synced_at.lt.${body.cursorSyncBefore}`,
          );
        }
        batchQuery = batchQuery
          .order("requirements_synced_at", {
            ascending: true,
            nullsFirst: true,
          })
          .order("playtime_minutes", { ascending: false });
      } else {
        batchQuery = batchQuery
          .in("requirements_status", ["pending", "error"])
          .order("playtime_minutes", { ascending: false })
          .order("app_id", { ascending: true });
      }

      const { data: batchRows, error: batchErr } = await batchQuery.limit(
        batchSize,
      );
      if (batchErr) throw batchErr;

      const queue = (batchRows ?? []) as Array<{
        app_id: number;
        title: string;
        playtime_minutes: number;
      }>;

      if (queue.length === 0) {
        const stats = await fetchLibraryStats(supabase);
        return jsonResponse({
          status: "ok",
          processed: 0,
          parsed: 0,
          missing: 0,
          errors: 0,
          rateLimited: false,
          retryAfterMs: 0,
          remainingPending: stats.pendingCount,
          batchTitles: [],
        });
      }

      let parsedCount = 0;
      let missingCount = 0;
      let errorCount = 0;
      let rateLimited = false;
      const syncedAppIds: number[] = [];
      const batchTitles: string[] = [];
      const updatePayloads: Array<Record<string, unknown>> = [];

      for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];
        if (i > 0) {
          await sleep(320);
        }

        const appUrl = `https://store.steampowered.com/api/appdetails?appids=${item.app_id}&l=english&cc=us`;
        let res = await fetch(appUrl, {
          headers: { "User-Agent": "VelociPCs/1.0" },
        });

        if (res.status === 429) {
          await sleep(3000);
          res = await fetch(appUrl, {
            headers: { "User-Agent": "VelociPCs/1.0" },
          });
        }

        if (res.status === 429) {
          rateLimited = true;
          break;
        }

        const syncedAt = new Date().toISOString();

        if (!res.ok) {
          errorCount += 1;
          updatePayloads.push({
            app_id: item.app_id,
            title: item.title,
            requirements_status: "error",
            requirements_synced_at: syncedAt,
            last_synced_at: syncedAt,
          });
          syncedAppIds.push(item.app_id);
          batchTitles.push(item.title);
          continue;
        }

        const rawJson = (await res.json()) as Record<
          string,
          {
            success?: boolean;
            data?: {
              name?: string;
              header_image?: string;
              pc_requirements?: Record<string, unknown> | unknown[];
            };
          }
        >;

        const entry = rawJson[String(item.app_id)];
        if (!entry || entry.success !== true || !entry.data) {
          missingCount += 1;
          updatePayloads.push({
            app_id: item.app_id,
            title: item.title,
            requirements_status: "missing",
            requirements_synced_at: syncedAt,
            last_synced_at: syncedAt,
          });
          syncedAppIds.push(item.app_id);
          batchTitles.push(item.title);
          continue;
        }

        const pcReqRaw =
          entry.data.pc_requirements &&
          !Array.isArray(entry.data.pc_requirements) &&
          typeof entry.data.pc_requirements === "object"
            ? entry.data.pc_requirements
            : null;

        const parsed = parseSteamPcRequirements(pcReqRaw);
        if (parsed.hasAnyRequirement) {
          parsedCount += 1;
        } else {
          missingCount += 1;
        }

        const resolvedTitle =
          (entry.data.name ?? item.title).trim() || item.title;

        updatePayloads.push({
          app_id: item.app_id,
          title: resolvedTitle,
          min_directx: parsed.min_directx,
          rec_directx: parsed.rec_directx,
          min_vram_gb: parsed.min_vram_gb,
          rec_vram_gb: parsed.rec_vram_gb,
          min_ram_gb: parsed.min_ram_gb,
          rec_ram_gb: parsed.rec_ram_gb,
          storage_gb: parsed.storage_gb,
          header_image_url:
            entry.data.header_image ??
            `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.app_id}/header.jpg`,
          store_url: `https://store.steampowered.com/app/${item.app_id}/`,
          raw_requirements: pcReqRaw,
          requirements_status: parsed.hasAnyRequirement ? "parsed" : "missing",
          requirements_synced_at: syncedAt,
          last_synced_at: syncedAt,
        });
        syncedAppIds.push(item.app_id);
        batchTitles.push(resolvedTitle);
      }

      if (updatePayloads.length > 0) {
        const { error: upsertErr } = await supabase
          .from("steam_library")
          .upsert(updatePayloads, { onConflict: "app_id" });
        if (upsertErr) throw upsertErr;

        await evaluateAndPersistCompatibility(supabase, {
          appIds: syncedAppIds,
        });
      }

      let remainingCount = 0;
      if (forceResync && body.cursorSyncBefore) {
        const { count, error: remErr } = await supabase
          .from("steam_library")
          .select("app_id", { count: "exact", head: true })
          .eq("manual_override", false)
          .or(
            `requirements_synced_at.is.null,requirements_synced_at.lt.${body.cursorSyncBefore}`,
          );
        if (remErr) throw remErr;
        remainingCount = count ?? 0;
      } else {
        const stats = await fetchLibraryStats(supabase);
        remainingCount = stats.pendingCount;
      }

      return jsonResponse({
        status: "ok",
        processed: updatePayloads.length,
        parsed: parsedCount,
        missing: missingCount,
        errors: errorCount,
        rateLimited,
        retryAfterMs: rateLimited ? 15000 : 0,
        remainingPending: remainingCount,
        batchTitles,
      });
    }

    // 4. Re-evaluate compatibility across all (or filtered) computers & games
    if (action === "evaluate_all") {
      const evalSummary = await evaluateAndPersistCompatibility(supabase, {
        computerId: body.computerId,
        appIds: body.appIds,
      });

      return jsonResponse({
        status: "ok",
        ...evalSummary,
      });
    }

    return jsonResponse(
      { status: "error", error: `Unsupported action "${String(action)}".` },
      400,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ status: "error", error: message }, 500);
  }
});
