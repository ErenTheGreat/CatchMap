# UX Roadmap — Fishing App

Living document for user-experience work on the Expo/React Native fishing app. Update this file when a phase ships or priorities change.

---

## Guiding priorities

Work is organized around four pillars (chosen during the initial audit):

| Pillar | Focus |
|--------|--------|
| **Reliability & trust** | Errors, offline, sync status, retries |
| **Feedback & flows** | Toasts, forms, catch logging, fewer blocking Alerts |
| **Visual polish** | Skeletons, species images, animations |
| **Accessibility** | Screen readers, labels, font scaling |

---

## Phase 1 — Shared UI kit ✅

**Goal:** Stop ad-hoc per-screen patterns; introduce reusable primitives.

| Deliverable | Status |
|-------------|--------|
| `components/ui/ToastProvider` + `useToast()` | ✅ |
| `EmptyState`, `ErrorState`, `LoadingState` | ✅ |
| `Button`, `TextField`, `SpeciesPicker` | ✅ |
| `Skeleton` | ✅ |
| Mount `ToastProvider` in `app/_layout.tsx` | ✅ |
| Theme tokens (`skeleton`, toast colors) | ✅ |

---

## Phase 2 — Reliability & trust ✅

**Goal:** Users always know what's happening when the network or GPS fails.

| Deliverable | Status |
|-------------|--------|
| Offline / permission / retry banners in `MapBottomSheet` | ✅ |
| Retry in `MapSpotDetail` for predictions & catch times | ✅ |
| History: `isError` vs empty (`ErrorState` + pull-to-refresh) | ✅ |
| `SaveResult.synced` + warning toast on local-only save | ✅ |
| User-facing copy cleanup (no PostGIS / Supabase jargon) | ✅ |

---

## Phase 3 — Unified catch logging + feedback ✅

**Goal:** One form, non-blocking feedback, instant History updates.

| Deliverable | Status |
|-------------|--------|
| Shared `components/catch/LogCatchForm.tsx` (Map + Log tab) | ✅ |
| Inline validation (species, weight) | ✅ |
| Toasts replace success/error Alerts | ✅ |
| Alert kept only for destructive delete confirm | ✅ |
| Dirty-form guard on Map modal dismiss | ✅ |
| Optimistic insert/delete in `hooks/useCatches.ts` | ✅ |

---

## Phase 4 — Accessibility + copy polish ✅

**Goal:** Baseline a11y on primary actions; light visual consistency.

| Deliverable | Status |
|-------------|--------|
| a11y labels: FAB, delete, modals, SpeciesPicker, FishingNowCard | ✅ |
| Species images in Species tab | ✅ |
| Styled `+not-found.tsx` | ✅ |
| Skeleton placeholders (History, map sheet peek) | ✅ |

---

## Continuation pass ✅

Items originally deferred from Phase 1–4, completed afterward:

| Deliverable | Status |
|-------------|--------|
| Haptics on save / delete (`utils/haptics.ts`) | ✅ |
| Toast **View in History** action after save | ✅ |
| Bottom sheet peek no longer clears selected spot | ✅ |
| `MapRecenterButton` uses `mapSheetConstants` | ✅ |

---

## Phase 5 — Consistency & loop-closing ✅

**Goal:** Close gaps between tabs; make offline/sync state visible everywhere.

| Deliverable | Status |
|-------------|--------|
| History: species thumbnails + sync badges | ✅ |
| History empty state → **Log a Catch** CTA | ✅ |
| Species tab / 404 / Log loading → shared UI components | ✅ |
| `getSheetHeightForIndex()` for FAB offset consistency | ✅ |
| `utils/catchStatus.ts`, `utils/speciesLookup.ts` | ✅ |
| SpeciesPicker thumbnails | ✅ |
| History **View on Map** (coords → fly-to) | ✅ |
| Log tab dirty-form guard on quick-fill | ✅ |
| Background sync retry for local-only catches | ✅ |
| Log tab dirty-form guard on tab leave | ✅ |

---

## Phase 6 — Dark mode ✅

**Goal:** System-aware light/dark themes across all primary surfaces.

| Deliverable | Status |
|-------------|--------|
| `LightColors` / `DarkColors` palettes + semantic tokens | ✅ |
| `ThemeProvider` (system / light / dark, persisted) | ✅ |
| `useTheme()` + `useThemedStyles()` | ✅ |
| All tab screens + UI kit migrated | ✅ |
| Map overlays, bottom sheet, cluster pins | ✅ |
| `ThemeToggleButton` (Map, History, Species headers) | ✅ |
| StatusBar follows theme | ✅ |
| Dark map basemap (`getVectorStyleUrl` — liberty / dark) | ✅ |
| Remove deprecated `LocalSpeciesSheet.tsx` | ✅ |

---

## Phase 7 — Tablet & web layout ✅

**Goal:** Use wide viewports effectively — side panel on map, centered modals, readable content width.

| Deliverable | Status |
|-------------|--------|
| `constants/layout.ts` + `useResponsiveLayout()` | ✅ |
| Map: side panel replaces bottom sheet at ≥768px | ✅ |
| Modals: centered dialog on wide (log catch, species guide) | ✅ |
| `ResponsiveScreen` max-width wrapper (History, Species, Log) | ✅ |
| Web sidebar tabs at ≥768px (`ResponsiveTabBar`) | ✅ |
| Multi-column lists on wide (species, history catches, log recs) | ✅ |

---

## Phase 8 — Personal insights & regulations ✅

**Goal:** Surface catch patterns and fishing rules where anglers need them.

| Deliverable | Status |
|-------------|--------|
| Insights: best months, unlock progress, species-at-spot | ✅ |
| `PersonalInsightsCard` on Log + Map dashboard | ✅ |
| History: tappable productive spots → map fly-to | ✅ |
| `getAreaRegulationNotices()` + map area banner | ✅ |
| Spot detail: your species caught nearby | ✅ |
| Expanded `fishingRegulations.json` species rules | ✅ |

---

## Phase 9 — Discovery-first ranking ✅

**Goal:** Help users find the best spot right now using trustworthy bite scores across the viewport.

| Deliverable | Status |
|-------------|--------|
| `utils/spotDiscoveryScore.ts` batch scoring via `getBestTimeNow` | ✅ |
| `hooks/useViewportSpotScores.ts` with hourly React Query cache | ✅ |
| Discovery dashboard: Best right now hero, filters, activity bars | ✅ |
| Activity-colored map pins + cluster max-activity styling | ✅ |
| Go to best spot CTA + close contenders compare row | ✅ |
| Progressive enrichment for top 3 spots (species predictions) | ✅ |

---

## Future phases (not scheduled)

| Item | Notes |
|------|--------|
| Outdoor high-contrast theme variant | Optional third palette |
| Full design-system documentation | Storybook or similar |
| `maxFontSizeMultiplier` on all fixed-layout cards | Partial (FishingNowCard) |
| Toast **Retry sync** action on offline save | Optional enhancement |

---

## Handoff for next chat

Paste this block to continue:

```text
Fishing app (Expo/React Native) at project/

Done:
- UX Phases 1–5 (UI kit, reliability, catch logging, a11y, sync, History↔Map)
- Phase 6 dark mode: ThemeProvider, useThemedStyles, ThemeToggleButton
- Dark map basemap tiles (liberty ↔ dark via getVectorStyleUrl)
- Removed deprecated LocalSpeciesSheet (MapBottomSheet is the replacement)
- Phase 7 tablet/web layout: side map panel, centered modals, ResponsiveScreen
- Phase 8 personal insights & regulations: patterns, area rules, species-at-spot
- Roadmap: docs/UX_ROADMAP.md

Theme toggle: tap icon on Map (overlay), History, or Species — cycles system → light → dark

Next candidates:
- Outdoor high-contrast theme
- Full design-system documentation
```

---

## Success criteria (foundation)

After Phases 1–4, a user should be able to:

1. See a clear offline/retry path on the map when the network fails
2. Never confuse a network error with "no catches yet"
3. Know when a catch saved locally vs synced to cloud
4. Log a catch from Map or Log tab with identical validation and toast feedback
5. Use VoiceOver/TalkBack on primary actions (log, delete, search, recenter)

Phase 5 adds: visible sync state in History, species visuals in the picker, and Map ↔ History navigation.

---

## Key files

| Area | Files |
|------|--------|
| UI kit | `components/ui/*` |
| Catch logging | `components/catch/LogCatchForm.tsx`, `hooks/useCatches.ts`, `utils/storage.ts` |
| Map sheet | `components/map/MapBottomSheet.tsx`, `mapSheetConstants.ts` |
| Feedback | `components/ui/ToastProvider.tsx`, `utils/haptics.ts` |
| Sync helpers | `utils/catchStatus.ts`, `utils/speciesLookup.ts` |
| Theme | `providers/ThemeProvider.tsx`, `constants/theme.ts`, `hooks/useThemedStyles.ts`, `components/map/types.ts` (`getVectorStyleUrl`) |
| Layout | `constants/layout.ts`, `hooks/useResponsiveLayout.ts`, `components/ui/ResponsiveScreen.tsx` |
| Insights | `utils/catchInsights.ts`, `hooks/useCatchInsights.ts`, `components/history/CatchInsightsPanel.tsx` |
| Regulations | `data/fishingRegulations.json`, `utils/fishingRegulations.ts`, `components/map/RegulationNoticeCard.tsx` |
| Screens | `app/(tabs)/index.tsx`, `log.tsx`, `history.tsx`, `species.tsx` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-06 | UX Foundation Pass planned & implemented (Phases 1–4) |
| 2026-07-06 | Continuation pass: haptics, toast actions, sheet peek fix |
| 2026-07-06 | Phase 5 completed: sync engine, History sync banner, Log tab leave guard |
| 2026-07-06 | Phase 6 dark mode: ThemeProvider, full UI migration, theme toggle |
| 2026-07-06 | Dark map basemap: OpenFreeMap liberty/dark style swap on theme change |
| 2026-07-06 | Removed deprecated LocalSpeciesSheet; MapBottomSheet is sole map sheet |
| 2026-07-06 | Phase 7 tablet/web layout: side map panel, ResponsiveScreen, web sidebar tabs |
| 2026-07-06 | Phase 8 insights & regulations: patterns, area banner, species-at-spot |
