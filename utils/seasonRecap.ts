import type { CatchRecord } from '@/lib/api/fishingApi';
import { buildCatchInsights } from '@/utils/catchInsights';
import { isProFeatureEnabled } from '@/constants/features';

/** Pro season recap as shareable plain text. */
export function buildSeasonRecapText(catches: CatchRecord[]): string | null {
  if (!isProFeatureEnabled('personal_insights') || catches.length === 0) {
    return null;
  }

  const insights = buildCatchInsights(catches);
  const year = new Date().getFullYear();
  const lines = [
    `CatchMap Pro — ${year} Season Recap`,
    `Total catches: ${insights.totalCatches}`,
  ];

  if (insights.topSpecies[0]) {
    lines.push(`Top species: ${insights.topSpecies[0].species} (${insights.topSpecies[0].count})`);
  }
  if (insights.topSpots[0]) {
    lines.push(`Best spot: ${insights.topSpots[0].label} (${insights.topSpots[0].count} catches)`);
  }
  if (insights.bestMonths[0]) {
    lines.push(`Best month: ${insights.bestMonths[0].label}`);
  }
  if (insights.bestHours[0]) {
    lines.push(`Best hour: ${insights.bestHours[0].label}`);
  }
  if (insights.topLures[0]) {
    lines.push(`Go-to lure: ${insights.topLures[0].lure}`);
  }

  lines.push('', 'Tight lines — CatchMap Pro');
  return lines.join('\n');
}
