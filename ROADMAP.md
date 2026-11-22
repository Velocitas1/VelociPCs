# VelociPCs Roadmap & Project Quick Reference

## Project Quick Reference
- **Live Site:** https://velocitas1.github.io/VelociPCs/ (auto-deploys on push to `main` via `.github/workflows/deploy.yml`)
- **Repository:** https://github.com/Velocitas1/VelociPCs
- **Stack:** Static React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Supabase
- **Supabase Project:** `VelociPCs` (ref `ojqwhbnlwknggootovtb`, region `us-east-2`)
- **Security / RLS Model:** Public read-only (`anon` + `authenticated` `SELECT`), strictly owner-only writes gated by `private.app_admins` / `private.is_owner()` (`velocitas@gmail.com`), public signups disabled.
- **Database Tables:** `cpus`, `gpus`, `computers` (both `Desktop` & `Laptop`, FK `cpu_id`, `gpu_id`, `igpu_id`), `storage_drives`, `benchmarks`, `steam_library`, `build_game_compatibility`
- **Edge Functions:** `lookup-hardware-spec`, `sync-steam-library` (both `verify_jwt = true`)
- **Local Verification:** `npm run typecheck && npm run build`

---

## 1. Phase 2 Roadmap — Live Steam Library Integration
Structural tables (`steam_library`, `build_game_compatibility`), UI tab (`src/components/SteamCompatibilityView.tsx`), and stub Edge Function (`supabase/functions/sync-steam-library/index.ts`) are already provisioned.
- [ ] Add `STEAM_WEB_API_KEY` secret in Supabase Edge Function secrets.
- [ ] Implement live Steam sync in `supabase/functions/sync-steam-library/index.ts` (`IPlayerService/GetOwnedGames/v1` + rate-limited `store.steampowered.com/api/appdetails` parsing for min/rec DirectX, VRAM, RAM, and storage into `public.steam_library`).
- [ ] Implement compatibility evaluator comparing `steam_library` requirements against every saved computer's DirectX version/feature level, VRAM, RAM, and storage into `public.build_game_compatibility` (`playable`, `minimum`, `blocked_directx`, `blocked_vram`, `blocked_ram`).
- [ ] Add SteamID64 input, live sync progress UI, and optional manual requirement overrides for legacy titles in `SteamCompatibilityView.tsx`.

---

## 2. App Enhancements & Technical Polish
- [ ] **Upgrade `lookup-hardware-spec`:** Resolve exact canonical product-page URLs (direct Intel ARK SKU pages, AMD product pages, TechPowerUp GPU pages) and richer spec extraction for legacy/obscure hardware in `supabase/functions/lookup-hardware-spec/index.ts`.
- [ ] **Advanced Laptop Wireless Editing:** Expose the remaining wireless columns (`wifi_antenna`, `wifi_bands`, `wifi_max_speed`, `wifi_codename`, `wifi_form_factor`, `wifi_launch_date`) in an expandable section inside `src/components/ComputerFormModal.tsx`.
- [ ] **3DMark Sub-Score & Upgrade Trend Charts:** Visualize `graphics_score`, `cpu_score`, and multi-run history across hardware upgrades using the `benchmarks` table's `cpu_id`/`gpu_id` snapshots.
- [ ] **Automated Tests:** Add unit tests for the transposed CSV parser (`src/lib/csvParserCore.mjs`) and DirectX tier/ranking logic (`src/lib/directx.ts`).
- [ ] **Optional Supabase Auth Hardening:** Enable Leaked Password Protection in Supabase Auth settings (only informational notice from Security Advisor).

---

## 3. Inventory Data Gaps (Fill In Directly via Live App)
Fields that were blank or placeholder values in the original spreadsheets:
- [ ] Assign GPU or iGPU for `VelociSchool` and `HP Workstation xv8600`.
- [ ] Populate integrated GPUs (`igpu_id`) where relevant (e.g., `VelociStein`, `VelociG14-2024`).
- [ ] Add missing RAM specs for `VelociStein`, `VelociSchool`, `VelociPlexG`, and `HP Workstation xv8600`.
- [ ] Add PSU specs for remaining desktops (only `SpiderTrap` had PSU data in CSV).
- [ ] Log 3DMark runs for laptops and remaining desktops.
- [ ] Replace `3000`/`1000` placeholder ranks on newer laptops (`VelociG14-2024`, `VelociG14`).

---

## 4. Feature Ideas Backlog
*Add new ideas here during brainstorming sessions:*
- [ ] Extra build fields: OS version (Win 98 / XP / 7 / 10 / 11 / Linux), Case & Cooler, BIOS/driver versions, purchase date/price.
- [ ] Rig photos gallery backed by Supabase Storage.
- [ ] Inline quick-editing in the Comparison Matrix.
