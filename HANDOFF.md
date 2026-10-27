# Duckpeon working handoff — 2026-10-07

## Resume here

Continue refining the scroll-driven "What we do" helix in the current worktree. The most recent change removes the separate settling/entrance animation: the actual six-service sequence now advances on ONE continuous scroll timeline through entry, pinning, and departure. The user has NOT yet evaluated that latest revision. Ask for/act on their next visual feedback rather than redesigning unrelated sections.

## Workspace and branches

- Worktree: `E:\duckpeon_copy\.worktrees\hero-section` (PowerShell).
- Current branch: `codex/scroll-helix`.
- Preserved manual/drag/button helix: `codex/hero-section`, commit `ca06ac7` ("Save manual helix showcase"). Do not overwrite it.
- Earlier checkpoint: `27aea74` (hero + why choose section).
- Current scroll experiment is UNCOMMITTED. Modified files: `duckpeon_latest.html`, `asset/services/service-helix.css`, `asset/services/service-helix.js`, `scripts/check-service-helix.cjs`.
- Original Claude work stays in `E:\duckpeon_copy`, branch `redesign/network-sections`. Do not edit that checkout.
- Git may need `git -c safe.directory=E:/duckpeon_copy/.worktrees/hero-section ...`. Under current managed permissions, Git metadata outside the worktree is unwritable; user made previous commits/branch changes in their terminal. Check current permissions before assuming this is still blocked. Do not bypass restrictions.

## Entry page / stack

- Canonical page: `duckpeon_latest.html`. Older `duckpeon.html` is not being updated for these experiments.
- Vanilla HTML, CSS, JavaScript. Keep this stack; no React/framework migration or added animation dependency.
- Huge inline base64 logo near the start of HTML: avoid dumping the entire file.
- Locally bundled font `asset/fonts/inter-tight-latin.woff2`, registered as `Inter Tight Local` by `asset/hero/desktop-hero.css`.
- Page already has a global `Scroll` controller with wheel easing. Helix uses normal page scroll + CSS sticky, NOT another wheel-preventDefault trap. Keyboard uses `Scroll.to()` so the existing easing doesn't fight it.
- Global loader, reveal observers, fixed header, and palette animation exist. Leave those intact.

## Helix requirements and current implementation

- Inspiration: Active Theory's vertical spiral cards, NOT its complete dark/anatomical-spine experience. Screenshots in `active_theory_inspo/` (many duplicates). Site `https://activetheory.net` only exposed a JS-required shell to the web reader.
- Duckpeon theme: cream, purple, ochre, existing pixel artwork; event card is a CSS/text poster.
- Six original services and descriptions preserved: Creative Studio, Production House, Creator Network, Social Media Management, Event & Campaign Execution, Meme Network.
- User liked manual version, explicitly requested a separate scroll branch. Cards should advance while the section holds in the viewport, then page continues; reversing scroll reverses the show.
- Large "what we do" heading is OUTSIDE `.helix-track` / `.helix-pin`. It scrolls away; only the showcase + CTA pin. This avoids squeezing heading, cards, text and controls into one viewport.
- Manual buttons/drag removed from scroll branch. Left service index, active service copy, progress line remain.
- User found laptop cramped and big monitor too empty. Fixed shared scene scaling: `min(space.clientWidth / 900, space.clientHeight / 650)`. Card width 400 * scale, artwork 225 * scale, radius 270 * scale, pitch 136 * scale, depth 240 * scale, perspective 1100 * scale, foreground Z 45 * scale. Card fonts/padding scale together. Removed old 420px card/290px radius caps.
- Sidebar width is `clamp(230px, 23vw, 430px)`. Pin max width 2600px. Short/narrow screens get a compact six-number service index to free vertical room.
- Enhancement requires width >=961px, height >=640px, no reduced-motion preference. Otherwise full static service list, no extra scroll track height.
- User repeatedly rejected the feeling of "spiral settles first, THEN show begins." Earlier hold intervals and Hermite settling have been REMOVED.
- LATEST timeline: entry distance = .65 * viewport height; exit distance = .3 * viewport height. `progress = clamp((entry - trackTop) / (entry + travel + exit), 0, 1)`; `position = progress * 5`. At pin entry the first service is already advancing toward the second. At release the last service is already selected but still moving; it reaches its endpoint shortly into departure.
- Pinned travel = round(max(380, viewportHeight * .55) * 5.4). CSS track height = viewport + travel. Pin has 82px top clearance for existing fixed header.
- Card neighbors wrap geometrically for a full spiral, but the service timeline is finite (0..5).
- Home/End keyboard targets include entry/exit distances. Animation only responds to scroll/resize/visibility; no autoplay/perpetual rendering.

## Other accepted design decisions — preserve

### Hero

- Desktop/laptop first; tablet/mobile detailed art direction deferred.
- Purple preview background `asset/hero/purple_version.png` is TEMPORARY, original `hero_art_full.png` retained.
- Two image references in latest HTML (img src + CSS --hero-img) both point to purple.
- Equal thin cream frame on top/left/right/bottom. Larger cream area in original mockup was the NEXT section, not a thick hero footer.
- Inter Tight text. SVG DUCKPEON blends into frame; viewBox `0 0 1512 188`, text x=-19 y=221.
- E looked like F because lower bar was clipped. Only E is lifted via `<tspan baseline-shift="15">E</tspan>`. Keep this user-requested adjustment.

### Why choose us

- Five provided PNGs in `asset/why_choose_us/`; `this_png_has_copy_subcopy.png` is reference, NOT sixth artwork.
- Six image cards: THREE above original middle block, THREE below it. Do not change to two-column reference layout.
- Confirmed order: top = Ideas / Volume / Creators; original middle block; bottom = Industries / Chronically Online / Every Audience.
- Middle block MUST remain: Real-time progress / 33+ creator statistic / 128% reach statistic / Tools & Integration, with original styling and counters.
- Industries card is a temporary gradient + real copy awaiting sixth artwork.
- Live editable title/body overlays, bottom-left. Font closest visual match is Inter Tight, not definitively identified from raster.
- CSS `asset/why_choose_us/why-choose.css`.

## Preview / verification

- Wi-Fi URL last verified: `http://192.168.0.193:4173/duckpeon_latest.html#services` (same Wi-Fi required). Local: `http://127.0.0.1:4173/`.
- `scripts/preview.py` serves this worktree on 0.0.0.0:4173, root maps to latest HTML; blocks dotpaths, traversal, directory listing.
- On Oct 7 preview died; restarted as hidden background Python process (PID17172 at that time). Logs `.artifacts/preview/server.out.log`, `.artifacts/preview/server.err.log`. Verify listener/IP if link dies, restart `python scripts/preview.py`; don't assume PID survives.
- `node scripts/check-service-helix.cjs` passes: actual JS run with DOM/observer doubles, forward/reverse sequence, endpoint release, continuous entry/pin/exit, no settling at pin, keyboard, visibility, reduced-motion/narrow fallback, responsive geometry.
- These are LOGIC/GEOMETRY tests, NOT rendered browser tests. `node --check asset/services/service-helix.js` and `git diff --check` also passed. All CSS/JS assets served HTTP200.
- Repeated automated Edge launches failed in managed environment (GPU subprocess access errors, renderer/newPage timeouts). `waitForInitialPage:false` connects browser but cannot create a usable tab. Don't claim visual verification; user is checking actual laptop + Mac mini monitor. Reattempt only if environment changes; avoid endless retries.
- `puppeteer-core` installed (via parent node_modules), Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Node22, Python3.13, Pillow available.
- Existing hero test `scripts/check-desktop-hero.cjs` predates purple preview and assumes original image; don't run unchanged expecting it to validate latest.
- Screenshot pitfall from earlier work: Puppeteer screenshot with BOTH `encoding:'base64'` and `path` did not write the path. Use binary screenshot when saving, then convert returned bytes if needed. Old `.artifacts/hero` screenshots predate current hero.

## Collaboration preferences

- User wants autonomous changes and dislikes unnecessary confirmation.
- Preserve manual branch and established hero/why-choose sections while refining scroll variant.
- No subagents unless explicitly requested by user/applicable instructions.
- Relevant frontend skill already applied; user theme/Inter Tight/vanilla stack override generic skill defaults.
- User supplied `ssh duckpeon@192.168.0.247` once, then returned to visual issue. No connection was made; purpose not established. Don't assume this is deployment authorization.
- After compaction/new chat: read this file, check git status, and continue from the user's next feedback. Latest scroll timeline still awaits user evaluation.
