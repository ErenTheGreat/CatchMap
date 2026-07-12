import speciesData from '@/data/species.json';
import { findSpeciesCatalogEntry } from '@/utils/speciesGuide';
import { getPrimaryRigForName } from '@/utils/speciesRigs';
import type { CatchRecord } from '@/utils/storage';
import type { SpeciesPrediction } from '@/lib/types/speciesPrediction';
import type { CatchCoachAdvice } from '@/lib/types/catchCoach';
import type { BestTimeNowResult } from '@/utils/bestTimeNow';

export interface FishingContextInput {
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  waterType?: string | null;
  speciesName?: string | null;
  weather?: {
    temperature?: number | null;
    windSpeed?: number | null;
    conditions?: string | null;
  } | null;
  prediction?: SpeciesPrediction | null;
  bestTime?: BestTimeNowResult | null;
  catches?: CatchRecord[];
  coachAdvice?: CatchCoachAdvice | null;
}

function formatCatchSummary(catches: CatchRecord[], limit = 5): string {
  if (catches.length === 0) return 'No logged catches yet.';
  const recent = catches.slice(0, limit);
  return recent
    .map((c) => {
      const parts = [c.species];
      if (c.weight) parts.push(c.weight);
      if (c.lure) parts.push(`on ${c.lure}`);
      if (c.locationName) parts.push(`at ${c.locationName}`);
      return parts.join(', ');
    })
    .join('\n');
}

function formatSpeciesGuide(name: string | null | undefined): string {
  if (!name) return '';
  const entry = findSpeciesCatalogEntry(name);
  if (!entry) return `Species: ${name} (not in catalog — general fishing advice only).`;
  return [
    `Species: ${entry.name} (${entry.scientificName})`,
    `Habitat: ${entry.habitat}`,
    `Season: ${entry.season}`,
    `Tips: ${entry.tips}`,
    `Lures: ${entry.lures.join(', ')}`,
    `Bait: ${(entry.bait ?? []).join(', ')}`,
  ].join('\n');
}

function formatRigContext(name: string | null | undefined): string {
  if (!name) return '';
  const primary = getPrimaryRigForName(name);
  if (!primary) return '';
  return [
    `Primary rig: ${primary.name}`,
    `Components: ${primary.components.map((c) => c.label).join(' → ')}`,
    primary.retrieve ? `Retrieve: ${primary.retrieve}` : '',
    primary.tip ? `Tip: ${primary.tip}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildFishingSystemPrompt(): string {
  return `You are Catch AI, the fishing assistant inside CatchMap — a mobile app for discovering spots, logging catches, and planning trips.

Rules:
- Give practical, safety-conscious fishing advice.
- Always remind users to verify local regulations, licenses, and size/bag limits.
- Use the provided app context (location, weather, species, catch history) when available.
- Be concise and actionable. Prefer bullet points for rigs and techniques.
- If unsure about species ID, say so and suggest manual confirmation.
- Never claim to replace official regulations or navigation.`;
}

export function buildFishingContextBlock(input: FishingContextInput): string {
  const sections: string[] = [];

  if (input.locationName || (input.latitude != null && input.longitude != null)) {
    const loc = input.locationName ?? `${input.latitude?.toFixed(4)}, ${input.longitude?.toFixed(4)}`;
    sections.push(`Location: ${loc}${input.waterType ? ` (${input.waterType})` : ''}`);
  }

  if (input.weather) {
    const w = input.weather;
    const parts: string[] = [];
    if (w.temperature != null) parts.push(`${w.temperature}°`);
    if (w.windSpeed != null) parts.push(`wind ${w.windSpeed}`);
    if (w.conditions) parts.push(w.conditions);
    if (parts.length > 0) sections.push(`Weather: ${parts.join(', ')}`);
  }

  if (input.prediction) {
    sections.push(
      `Species prediction: ${input.prediction.name} — activity ${input.prediction.activityRating}, score ${input.prediction.score ?? 'n/a'}`
    );
    if (input.prediction.factors?.length) {
      const factors = input.prediction.factors
        .slice(0, 4)
        .map((f) => `${f.name}: ${f.detail}`)
        .join('; ');
      sections.push(`Factors: ${factors}`);
    }
  }

  if (input.bestTime?.label) {
    sections.push(`Best time now: ${input.bestTime.label}`);
  }

  if (input.speciesName) {
    sections.push(formatSpeciesGuide(input.speciesName));
    const rigBlock = formatRigContext(input.speciesName);
    if (rigBlock) sections.push(rigBlock);
  }

  if (input.coachAdvice) {
    sections.push(
      [
        `Catch Coach headline: ${input.coachAdvice.headline}`,
        `Setup: ${input.coachAdvice.setup.rigName} — ${input.coachAdvice.setup.lureLabel}`,
        input.coachAdvice.technique ? `Technique: ${input.coachAdvice.technique}` : '',
        input.coachAdvice.personal?.message ? `Personal: ${input.coachAdvice.personal.message}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  if (input.catches?.length) {
    sections.push(`Recent catches:\n${formatCatchSummary(input.catches)}`);
  }

  if (sections.length === 0) {
    return 'No location or catch context available. Give general fishing guidance.';
  }

  return sections.join('\n\n');
}

export function buildCoachEnhancePrompt(
  advice: CatchCoachAdvice,
  context: FishingContextInput
): string {
  return `${buildFishingContextBlock(context)}

Rewrite this Catch Coach advice in friendly, natural language (2-3 short paragraphs). Keep all factual details. Add one actionable tip.

Headline: ${advice.headline}
Setup: ${advice.setup.rigName} — use ${advice.setup.lureLabel}
Technique: ${advice.technique}
Why now: ${advice.whyNow.map((f) => `${f.name} (${f.impact}): ${f.detail}`).join('; ')}`;
}

export function getSuggestedChatPrompts(speciesName?: string | null): string[] {
  const species = speciesName?.trim();
  if (species) {
    return [
      `What rig should I use for ${species} here?`,
      `Best time to fish for ${species} today?`,
      `What lures work for ${species} in these conditions?`,
    ];
  }
  return [
    'What should I fish for right now?',
    'How do I read bite scores on the map?',
    'Tips for logging catches faster?',
  ];
}

/** Compact species list for prompts — avoids sending full JSON. */
export function getCatalogSpeciesNames(limit = 50): string[] {
  return speciesData.slice(0, limit).map((s) => s.name);
}
