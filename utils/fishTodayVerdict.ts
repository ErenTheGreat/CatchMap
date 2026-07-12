import type { TodaySpeciesTarget } from '@/utils/rankTodaySpeciesTargets';
import { formatTripWindowRange } from '@/utils/tripPlanner';

export type FishTodayVerdict = 'go_now' | 'wait' | 'marginal';

export interface FishTodayVerdictResult {
  verdict: FishTodayVerdict;
  headline: string;
  detail: string;
}

const GO_NOW_MIN_MATCH = 55;
const MARGINAL_MAX_MATCH = 35;

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function computeFishTodayVerdict(
  targets: TodaySpeciesTarget[],
  now: Date = new Date()
): FishTodayVerdictResult {
  if (targets.length === 0) {
    return {
      verdict: 'marginal',
      headline: 'Conditions are marginal today',
      detail: 'Pan the map over fishing waters for species scoring.',
    };
  }

  const top = targets[0];
  const inActiveWindow = top.goNowLabel.startsWith('Go now');
  const windowLaterToday =
    top.bestWindow != null &&
    top.bestWindow.startTime.getTime() > now.getTime() &&
    isSameCalendarDay(top.bestWindow.startTime, now);

  if (top.matchScore >= GO_NOW_MIN_MATCH && inActiveWindow) {
    return {
      verdict: 'go_now',
      headline: 'GO NOW',
      detail: `Target ${top.speciesName} at ${top.bestSpot.name} — bite window is active.`,
    };
  }

  if (windowLaterToday && top.bestWindow) {
    const range = formatTripWindowRange(top.bestWindow);
    return {
      verdict: 'wait',
      headline: `WAIT until ${range.split('–')[0]?.trim() ?? range}`,
      detail: `Best pick: ${top.speciesName} at ${top.bestSpot.name} (${top.matchScore}% match).`,
    };
  }

  if (top.matchScore < MARGINAL_MAX_MATCH) {
    return {
      verdict: 'marginal',
      headline: 'Conditions are marginal today',
      detail: 'Try another area or check back near dawn or dusk.',
    };
  }

  if (top.bestWindow && top.bestWindow.endTime.getTime() <= now.getTime()) {
    return {
      verdict: 'marginal',
      headline: 'Conditions are marginal today',
      detail: "Today's best windows may have passed — try tomorrow morning.",
    };
  }

  return {
    verdict: 'wait',
    headline: top.goNowLabel || 'Check bite windows below',
    detail: `Top target: ${top.speciesName} at ${top.bestSpot.name}.`,
  };
}
