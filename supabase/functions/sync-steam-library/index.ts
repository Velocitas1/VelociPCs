import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SyncSteamRequest {
  steamId?: string;
  dryRun?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SyncSteamRequest;
    const hasSteamKey = Boolean(Deno.env.get("STEAM_WEB_API_KEY"));

    return new Response(
      JSON.stringify({
        status: "stub",
        phase: "Phase 2 Roadmap (Stubbed)",
        steamIdReceived: body.steamId ?? null,
        dryRun: body.dryRun ?? true,
        steamWebApiConfigured: hasSteamKey,
        requiredSecrets: ["STEAM_WEB_API_KEY"],
        targetTables: ["public.steam_library", "public.build_game_compatibility"],
        plannedPipeline: [
          "1. Call Steam Web API IPlayerService/GetOwnedGames/v1 for the configured SteamID64.",
          "2. Fetch PC system requirements via store.steampowered.com/api/appdetails (min/rec DirectX, VRAM, RAM, storage).",
          "3. Upsert parsed titles into public.steam_library.",
          "4. Evaluate each saved computer in public.computers (using joined gpus.directx_version, gpus.directx_feature_level, gpus.vram_gb, and computers.ram_gb) into public.build_game_compatibility (playable | minimum | blocked_directx | blocked_vram | blocked_ram).",
        ],
        message:
          "sync-steam-library Edge Function stub is deployed and reachable. Set STEAM_WEB_API_KEY in Supabase Edge Function secrets when ready to enable live Steam library syncing.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ status: "error", error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
