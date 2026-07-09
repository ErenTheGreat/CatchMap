# Rig Guide Plan — Recommended Tackle & Visual Presentation

Plan for adding structured, visually presented fishing rigs for every species in the catalog.

---

## Goal

For each of the **26 species** in `data/species.json`, define one or more **recommended rigs** (complete tackle setups — not just lure names) and show them in the app with a clear visual layout (icons, component strip, optional diagram).

---

## Current state

### Data (`data/species.json`)

Every species already has flat tackle hints:

| Field | Example (Largemouth Bass) |
|-------|---------------------------|
| `lures` | `["Crankbaits", "Soft plastics", "Jigs", "Topwater lures"]` |
| `bait` | `["Live shiners", "Nightcrawlers", "Crawfish"]` |
| `hookSize` | `"2/0–4/0"` |

**Missing:** line weight, rod/reel class, leader, sinker/slider, knot, retrieve style, depth target, rig type (Texas rig, Carolina rig, drop shot, etc.), primary vs alternate setups, visual assets.

### Types (`lib/types/speciesGuide.ts`)

`SpeciesCatalogEntry` mirrors JSON fields. `LocationSpeciesGuide` passes `lures`, `bait`, `hookSize` to the map species sheet — chips only, no rig structure.

### UI surfaces (text chips today)

| Surface | File | What it shows |
|---------|------|----------------|
| Species tab | `app/(tabs)/species.tsx` | Lure chips when card expanded |
| Map species guide | `components/map/SpeciesGuideSheet.tsx` | Bait + lure chips, hook size text |
| Log quick-fill | `utils/recommendations.ts` | Random `lures[n]` as `recommendedLure` |
| Catch form | `components/catch/LogCatchForm.tsx` | Free-text lure field |

### App foundation (done — Phases 1–8)

- ThemeProvider / dark mode / responsive layout
- Species images (Pexels URLs in JSON)
- UI kit: `Button`, `Skeleton`, chips pattern in `SpeciesGuideSheet`
- Roadmap: `docs/UX_ROADMAP.md`

---

## Proposed data model

Add structured rigs — either extend `species.json` or create `data/speciesRigs.json` keyed by species `id`.

```ts
export type RigType =
  | 'spinning'
  | 'baitcasting'
  | 'fly'
  | 'surf'
  | 'bottom'
  | 'trolling'
  | 'float'
  | 'jigging';

export interface RigComponent {
  role: 'rod' | 'reel' | 'line' | 'leader' | 'hook' | 'weight' | 'lure' | 'bait' | 'float' | 'swivel' | 'other';
  label: string;       // e.g. "10 lb mono"
  detail?: string;     // e.g. "6–7 ft medium action"
}

export interface SpeciesRig {
  id: string;
  name: string;              // e.g. "Texas Rig — Soft Plastic"
  rigType: RigType;
  isPrimary: boolean;        // default rig for quick-fill / hero card
  targetDepth?: 'surface' | 'mid' | 'bottom';
  retrieve?: string;         // e.g. "Slow drag with pauses"
  components: RigComponent[];
  steps?: string[];        // 2–4 rigging steps
  tip?: string;
  /** Lucide icon name or local asset key for visual header */
  visualKey?: string;
}
```

Example for Largemouth Bass primary rig:

```json
{
  "speciesId": "1",
  "rigs": [
    {
      "id": "lmb-texas-rig",
      "name": "Texas Rig — Worm",
      "rigType": "spinning",
      "isPrimary": true,
      "targetDepth": "bottom",
      "retrieve": "Lift-and-fall along structure",
      "components": [
        { "role": "rod", "label": "6'6\"–7' medium", "detail": "Fast action" },
        { "role": "reel", "label": "2500–3000 spinning" },
        { "role": "line", "label": "12–15 lb fluorocarbon" },
        { "role": "hook", "label": "3/0 EWG worm hook" },
        { "role": "weight", "label": "1/4–3/8 oz bullet sinker" },
        { "role": "lure", "label": "Soft plastic worm — green pumpkin" }
      ],
      "steps": [
        "Slide bullet sinker on main line",
        "Tie EWG hook; Texas-rig the worm",
        "Cast to cover; let sink to bottom"
      ],
      "tip": "Best on weed edges and submerged timber."
    }
  ]
}
```

---

## Visual presentation (recommended)

### `RigDiagramCard` component

Horizontal **component strip** with role icons (reuse Lucide: `Fish`, `Anchor`, `Circle`, `Minus`, etc.) + labels. Works on phone and tablet.

```
┌─────────────────────────────────────┐
│ ★ Texas Rig — Worm          [SPIN]  │
├─────────────────────────────────────┤
│ [rod] → [reel] → [line] → [hook]   │
│         ↓                           │
│      [weight] + [lure]              │
├─────────────────────────────────────┤
│ Retrieve: Lift-and-fall…            │
│ ① Slide bullet sinker…              │
└─────────────────────────────────────┘
```

### Optional phase 2

- Simple SVG rig silhouettes per `rigType`
- Collapsible alternate rigs (2–3 per species max for MVP)

### Theming

Use `useThemedStyles` + existing tokens. Primary rig gets accent border; alternates use `cardLight`.

---

## Where to surface rigs

| Priority | Surface | Behavior |
|----------|---------|----------|
| P0 | Species tab expanded card | Hero `RigDiagramCard` (primary) + "More rigs" list |
| P0 | `SpeciesGuideSheet` (map) | Replace/supplement lure chips with primary rig |
| P1 | Log tab quick-fill | Use primary rig `lure` component label instead of random `lures[n]` |
| P1 | `LogCatchForm` | Optional "Apply rig" button → prefill lure + notes |
| P2 | Species detail modal / dedicated rig screen | Full rig library per species |

---

## Implementation phases

### Phase A — Data & types

1. Define `lib/types/speciesRigs.ts`
2. Author rigs for all **26 species** (at least 1 primary each; 2–3 for popular species)
3. `utils/speciesRigs.ts` — `getRigsForSpecies(id)`, `getPrimaryRig(id)`
4. Wire `findSpeciesCatalogEntry` alias map for bundled species names

### Phase B — Visual component

1. `components/rigs/RigDiagramCard.tsx` — component strip + steps
2. `components/rigs/RigComponentIcon.tsx` — role → icon mapping
3. Export from `components/ui/index.ts` if reused widely

### Phase C — Integrate surfaces

1. `species.tsx` — show rig card in expanded content
2. `SpeciesGuideSheet.tsx` — rig section above bait/lure chips (or replace chips)
3. `recommendations.ts` — `recommendedLure` from primary rig lure component
4. `speciesGuide.ts` — add `primaryRig` to `LocationSpeciesGuide`

### Phase D — Polish

1. a11y labels on rig cards
2. Wide layout: rig card side-by-side with species image
3. Empty/fallback when species has no rig data

---

## Species checklist (26)

All entries in `data/species.json` need at least one primary rig:

- [ ] Largemouth Bass
- [ ] Rainbow Trout
- [ ] Walleye
- [ ] Northern Pike
- [ ] Channel Catfish
- [ ] Bluegill
- [ ] Crappie
- [ ] Smallmouth Bass
- [ ] Yellow Perch
- [ ] Muskellunge
- [ ] Striped Bass
- [ ] Common Carp
- [ ] Steelhead
- [ ] Chinook Salmon
- [ ] Coho Salmon
- [ ] Redfish
- [ ] Spotted Seatrout
- [ ] Largemouth Bass - Trophy
- [ ] Lake Trout
- [ ] Flathead Catfish
- [ ] Kokanee Salmon
- [ ] Black Crappie
- [ ] Green Sunfish
- [ ] California Halibut
- [ ] Bat Ray
- [ ] Leopard Shark

---

## Key files

| Area | Files |
|------|--------|
| Species catalog | `data/species.json` |
| Rig data (new) | `data/speciesRigs.json` or extended JSON |
| Types | `lib/types/speciesRigs.ts`, `lib/types/speciesGuide.ts` |
| Lookup | `utils/speciesRigs.ts`, `utils/speciesGuide.ts` |
| Species UI | `app/(tabs)/species.tsx`, `components/map/SpeciesGuideSheet.tsx` |
| Recommendations | `utils/recommendations.ts` |
| Theme/layout | `constants/theme.ts`, `hooks/useResponsiveLayout.ts` |

---

## Handoff for next chat

Paste this block:

```text
Fishing app (Expo/React Native) at project/

Done (Phases 1–8):
- Full UX foundation, dark mode, tablet/web layout, insights, regulations
- Roadmap: docs/UX_ROADMAP.md

New task: Recommended rigs + visual presentation
- Plan: docs/RIG_GUIDE_PLAN.md
- 26 species in data/species.json — each has lures[], bait[], hookSize (flat text only)
- No structured rig data or visual rig UI yet

Build:
1. Structured rig schema + data for all 26 species (primary + optional alternates)
2. RigDiagramCard visual component (component strip, steps, themed)
3. Integrate in Species tab + SpeciesGuideSheet; wire primary rig to Log quick-fill

Start with data model + 2–3 example species, then roll out to full catalog.
```

---

## Success criteria

1. Every species in the catalog has a **primary recommended rig** with rod/line/hook/lure or bait components
2. User sees a **visual rig card** (not just text chips) in Species tab and map species guide
3. Log tab quick-fill uses the **primary rig lure label** instead of a random lure name
4. Layout works in light/dark mode and on tablet/web
