/** Approximate peek height used to position FABs above the bottom sheet handle. */
export const BOTTOM_SHEET_PEEK_HEIGHT = 92;

export const BOTTOM_SHEET_SNAP_POINTS = ['12%', '32%', '88%'] as const;

/** Pixel height for a snap index, derived from the shared snap-point percentages. */
export function getSheetHeightForIndex(
  index: number,
  windowHeight: number,
  topInset = 0
): number {
  const snapIndex = Math.max(0, Math.min(index, BOTTOM_SHEET_SNAP_POINTS.length - 1));
  const percent = parseFloat(BOTTOM_SHEET_SNAP_POINTS[snapIndex]) / 100;
  const availableHeight = Math.max(windowHeight - topInset, windowHeight * 0.4);
  return Math.round(availableHeight * percent);
}
