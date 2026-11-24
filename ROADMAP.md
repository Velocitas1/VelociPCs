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

## 1. Phase 2 Roadmap — Core Research, Compare & Benchmark Upgrades
Fastest everyday wins with minimal schema churn, establishing unified scoring, research links, and a rich side-by-side comparison experience.
- [x] **3DMark Result Links & Benchmark Editing:**
  - Add nullable `result_url` column to `public.benchmarks` (per-run links across Time Spy, Fire Strike, Sky Diver, Cloud Gate, and upgrade runs; zero RLS change).
  - Add a `3DMark Result URL` input with automatic suite detection from `3dmark.com/spy/`, `/fs/`, `/sd/`, and `/cg/` URLs in `src/components/BenchmarkModal.tsx`.
  - Add **Edit** support for existing benchmark runs in `src/components/ComputerDetailModal.tsx` so result URLs can be backfilled without re-entering scores, and make 3DMark score badges clickable across Inventory, Detail, and Compare views.
- [x] **Unified PassMark Scoring & Dynamic Fleet Rank:**
  - Store stable absolute `passmark_score` (PassMark CPU Mark / G3D Mark, higher = better) and optional `score_updated_at` on `cpus` and `gpus` instead of drifting global ordinal ranks (resolving mismatched Desktop vs. Notebookcheck Laptop rank scales so cross-device comparisons stay accurate and scores do not go stale as new hardware launches).
  - Compute per-inventory **"Fleet Rank"** (`#1 of N`) dynamically in the UI from `passmark_score` (and 3DMark scores), keeping/deprecating the legacy `rank` column while migrating.
- [x] **Detailed Draggable & Sortable Compare View:**
  - Upgrade `src/components/ComparisonMatrixView.tsx` with full collapsible spec rows (CPU, GPU, Memory & Board, Storage, Power/Wireless, 3DMark), a sticky spec label column, and remove the 4-rig cap.
  - Add drag-and-drop left/right column reordering plus `←` / `→` buttons on column headers for keyboard and touch accessibility.
  - Add compare sort presets: `Manual` (auto-selected when dragging), `CPU` (PassMark CPU Mark), `GPU` (PassMark G3D Mark), `DirectX`, and `3DMark` (by suite), plus optional **"Differences Only"** toggle and row-winner highlights.
  - Persist selected rig IDs, column order, and sort mode in shareable URL query parameters (`?compare=...&sort=...`).
- [x] **Split-Button Spec & Research Links Across All Parts:**
  - Upgrade `src/components/SpecLink.tsx` into a split-button pattern (`[ ASUS GTX 970 | ▾ ]`) where the primary click opens the preferred canonical datasheet and the dropdown (`▾`) lists secondary research links:
    - **GPUs:** TechPowerUp chip spec · AIB board partner datasheet · PassMark G3D page
    - **CPUs:** Official Intel ARK / AMD page · TechPowerUp CPU DB · PassMark CPU page
    - **Motherboards:** Manufacturer product/support page · The Retro Web (legacy boards)
    - **Storage / RAM / PSUs / Wi-Fi / Laptops:** Manufacturer datasheet · TechPowerUp SSD DB / Intel ARK (Wi-Fi) / Notebookcheck (Laptops), with search-URL fallbacks when direct URLs are not saved yet.
  - Store primary `spec_url` plus optional `spec_links jsonb` (`[{ label, url }]`), validate URLs to `http(s)://` only, and upgrade `supabase/functions/lookup-hardware-spec/index.ts` to resolve direct canonical product-page URLs (direct Intel ARK SKU pages, AMD product pages, TechPowerUp GPU pages) and richer spec extraction for legacy/obscure hardware instead of search-results URLs.

---

## 2. Phase 3 Roadmap — Full Parts Inventory, Open-Dataset Autofill & HWiNFO Import
Foundational parts-tracking architecture and automated hardware import to replace manual data entry and clear inventory gaps.
- [ ] **Full Desktop Parts Inventory (Installed vs. Spare) + Inline "+ Add New":**
  - Use a two-tier hybrid model: keep canonical silicon specs in `cpus` and `gpus`, and track owned model/variant records with `spare_count` and `spec_url` across **GPU Cards** (AIB models referencing `gpus.id` so e.g. `ASUS GTX 970` and `Gigabyte GTX 970` are distinct), **Motherboards**, **RAM Kits**, **Storage Drives**, **PSUs**, **Cases/Coolers**, and **Wi-Fi Cards** (`total owned = installed + spare_count`).
  - Expand `src/components/PartsCatalogView.tsx` with category tabs and `All | Installed | Spare` filters.
  - Roll out the searchable combobox + inline **"+ Add New"** pattern (`src/components/PartCombobox.tsx`) across all build slots in `src/components/ComputerFormModal.tsx`, offering swap-to-spare (`+1` old / `-1` replacement) when swapping desktop parts and excluding soldered laptop parts from desktop spare pickers by default.
  - *Privacy consideration:* Keep any future sensitive fields (purchase price, serial numbers, storage bin locations) strictly owner-only or explicitly marked public-read.
- [ ] **Open-Source Hardware Dataset Dropdown Auto-Fill:**
  - Replace brittle live web scraping with a synced read-only reference catalog sourced from free open-source GitHub JSON datasets (`buildcores/buildcores-open-db`, `docyx/pc-part-dataset`, `RightNow-AI/RightNow-GPU-Database`, `painebenjamin/dbgpu`) via a periodic GitHub Action into static JSON (GitHub Pages) or a read-only Supabase lookup table with trigram/FTS indexing—enabling instant, zero-rate-limit dropdown autofill across all component categories.
- [ ] **HWiNFO XML Hardware Report Importer:**
  - Build a client-side `DOMParser` importer for `HWiNFO32` / `HWiNFO64` XML reports (`Save Report -> XML` or CLI `-r`) covering Win 98 → Win 11 rigs (accessible in the Import tab and directly from `src/components/ComputerDetailModal.tsx`; supports direct owner login on modern rigs or USB/NAS XML file upload from retro rigs, while the 2 Linux machines remain manual).
  - Include fuzzy matching against existing `cpus`/`gpus`/variants (including PCI Subsystem IDs for AIB GPUs), an interactive diff/merge preview modal that preserves manual fields software cannot detect (PSU, build date, notes), and optional swap-to-spare updates when hardware changes are detected (zero RLS changes needed).
- [ ] **AI Export Payload Enrichment:**
  - Update `src/lib/aiExport.ts` and `src/components/AiExportModal.tsx` to include spare parts inventory, integrated GPUs (`igpu`), and PSU connector flags (3DMark `result_url` links are already included) so exported JSON/Markdown gives Gemini complete context for upgrade advice.

---

## 3. Phase 4 Roadmap — Live Steam Library Integration
Structural tables (`steam_library`, `build_game_compatibility`), UI tab (`src/components/SteamCompatibilityView.tsx`), and stub Edge Function (`supabase/functions/sync-steam-library/index.ts`) are already provisioned. Placed after Phases 2–3 so compatibility checks evaluate complete, HWiNFO-verified rig data.
- [ ] Add `STEAM_WEB_API_KEY` secret in Supabase Edge Function secrets.
- [ ] Implement live Steam sync in `supabase/functions/sync-steam-library/index.ts` (`IPlayerService/GetOwnedGames/v1` + rate-limited `store.steampowered.com/api/appdetails` parsing for min/rec DirectX, VRAM, RAM, and storage into `public.steam_library`).
- [ ] Implement compatibility evaluator comparing `steam_library` requirements against every saved computer's DirectX version/feature level, VRAM, RAM, and storage into `public.build_game_compatibility` (`playable`, `minimum`, `blocked_directx`, `blocked_vram`, `blocked_ram`).
- [ ] Add SteamID64 input, live sync progress UI, and optional manual requirement overrides for legacy titles in `SteamCompatibilityView.tsx`.

---

## 4. Phase 5 — Technical Polish & Nice-to-Haves
- [ ] **Advanced Laptop Wireless Editing:** Expose the remaining wireless columns (`wifi_antenna`, `wifi_bands`, `wifi_max_speed`, `wifi_codename`, `wifi_form_factor`, `wifi_launch_date`) in an expandable section inside `src/components/ComputerFormModal.tsx`.
- [ ] **3DMark Sub-Score & Upgrade Trend Charts:** Visualize `graphics_score`, `cpu_score`, and multi-run history across hardware upgrades using the `benchmarks` table's `cpu_id`/`gpu_id` snapshots.
- [ ] **Automated Tests:** Add unit tests for the transposed CSV parser (`src/lib/csvParserCore.mjs`) and DirectX tier/ranking logic (`src/lib/directx.ts`).
- [ ] **Optional Supabase Auth Hardening:** Enable Leaked Password Protection in Supabase Auth settings (only informational notice from Security Advisor).

---

## 5. Inventory Data Gaps (Fill In Directly via Live App or HWiNFO Import)
Fields that were blank or placeholder values in the original spreadsheets (HWiNFO XML import in Phase 3 will clear most hardware blanks automatically):
- [ ] Assign GPU or iGPU for `VelociSchool` and `HP Workstation xv8600`.
- [ ] Populate integrated GPUs (`igpu_id`) where relevant (e.g., `VelociStein`, `VelociG14-2024`).
- [ ] Add missing RAM specs for `VelociStein`, `VelociSchool`, `VelociPlexG`, and `HP Workstation xv8600`.
- [ ] Add PSU specs for remaining desktops (only `SpiderTrap` had PSU data in CSV).
- [ ] Log 3DMark runs (and result URLs) for laptops and remaining desktops.
- [x] Replace `3000`/`1000` placeholder ranks on newer laptops (`VelociG14-2024`, `VelociG14`) and backfill unified PassMark scores (`passmark_score`) across `cpus` and `gpus`.

---

## 6. Future / Long-Term Backlog
*Add new ideas here during brainstorming sessions:*
- [ ] **In-App AI Advisor:** Owner-only Supabase Edge Function (`verify_jwt = true` + `private.is_owner()` check) calling the Gemini API to answer upgrade and compatibility questions directly in-app (low priority; continue using `AiExportModal` JSON/Markdown export to Gemini for now).
- [ ] Extra build fields: OS version (Win 98 / XP / 7 / 10 / 11 / Linux), Case & Cooler, BIOS/driver versions, purchase date/price.
- [ ] Rig photos gallery backed by Supabase Storage.
- [ ] Inline quick-editing in the Comparison Matrix.

---

## 7. Probably Won't Do (High Complexity / Out of Scope)
- [ ] **Multi-Inventory Support with Record Locator Number** (Nippon-style locator code to view distinct inventories with per-inventory login/ownership):
  - *Why out of scope:* Moving from a single-owner public showcase to multi-tenant inventories introduces significant auth, RLS, and routing complexity:
    - Requires re-enabling Supabase public signups, adding an `inventories` table (`record_locator`, `owner_id`), scoping `inventory_id` across every user-owned table, and resolving whether spec catalogs (`cpus`, `gpus`, `steam_library`) are globally shared or per-inventory.
    - Requires replacing public `SELECT using (true)` RLS policies with RPC/Edge-Function-gated locator lookups so direct Supabase REST API queries cannot enumerate inventories or brute-force short locator codes.
    - Requires per-user Edge Function quota/rate limits (`lookup-hardware-spec`, `sync-steam-library`, future AI advisor) and hash-based routing (`#/inv/<code>`) on GitHub Pages.
