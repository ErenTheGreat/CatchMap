import { getMapActivityPinColors } from '@/constants/theme';

/**
 * Shared MapLibre cluster / spot layer styling for native and WebView maps.
 * Tuned for FishAngler-like readability at country → city zoom levels.
 */
export const CLUSTER_RADIUS = 45;
export const CLUSTER_MAX_ZOOM = 13;

export const CLUSTER_PROPERTIES = {
  maxActivity: ['max', ['get', 'activityRating']],
  maxCommunity: ['max', ['get', 'communityCatchCount']],
} as const;

export interface ActivityPinColors {
  slow: string;
  fair: string;
  good: string;
  hot: string;
  excellent: string;
}

/** Pin fill colors — keep in sync with getActivityPinColorExpression step thresholds. */
export function getActivityPinColors(isDark: boolean, isOutdoor = false): ActivityPinColors {
  const palette = getMapActivityPinColors(isDark, isOutdoor);
  return {
    slow: palette.slow,
    fair: palette.fair,
    good: palette.good,
    hot: palette.hot,
    excellent: palette.excellent,
  };
}

export const ACTIVITY_PIN_LEGEND = [
  { rating: 1, label: 'Slow' },
  { rating: 2, label: 'Fair' },
  { rating: 3, label: 'Good' },
  { rating: 4, label: 'Hot' },
  { rating: 5, label: 'Excellent' },
] as const;

export function getActivityPinColorExpression(isDark: boolean, isOutdoor = false) {
  const { slow, fair, good, hot, excellent } = getActivityPinColors(isDark, isOutdoor);

  return [
    'step',
    ['get', 'activityRating'],
    slow,
    2,
    fair,
    3,
    good,
    4,
    hot,
    5,
    excellent,
  ] as const;
}

export function getSpotPinColorExpression(isDark: boolean, emphasizeCommunity = false, isOutdoor = false) {
  const activity = getActivityPinColorExpression(isDark, isOutdoor);
  const palette = getMapActivityPinColors(isDark, isOutdoor);
  if (!emphasizeCommunity) {
    return [
      'case',
      ['==', ['get', 'poiType'], 'access_ramp'],
      '#F97316',
      ['==', ['get', 'poiType'], 'marina'],
      '#3B82F6',
      activity,
    ] as const;
  }
  return [
    'case',
    ['==', ['get', 'poiType'], 'access_ramp'],
    '#F97316',
    ['==', ['get', 'poiType'], 'marina'],
    '#3B82F6',
    ['>', ['coalesce', ['get', 'communityCatchCount'], 0], 0],
    palette.community,
    activity,
  ] as const;
}

export function getWaypointPinColorExpression() {
  return '#EAB308';
}

export function getClusterActivityColorExpression(
  isDark: boolean,
  emphasizeCommunity = false,
  isOutdoor = false
) {
  const { slow, fair, good, hot, excellent } = getActivityPinColors(isDark, isOutdoor);
  const palette = getMapActivityPinColors(isDark, isOutdoor);

  if (emphasizeCommunity) {
    return [
      'case',
      ['>', ['coalesce', ['get', 'maxCommunity'], 0], 0],
      palette.community,
      [
        'step',
        ['coalesce', ['get', 'maxActivity'], 0],
        slow,
        2,
        fair,
        3,
        good,
        4,
        hot,
        5,
        excellent,
      ],
    ] as const;
  }

  return [
    'step',
    ['coalesce', ['get', 'maxActivity'], 0],
    slow,
    2,
    fair,
    3,
    good,
    4,
    hot,
    5,
    excellent,
  ] as const;
}

export function getClusterStyles(isDark: boolean, emphasizeCommunity = false, isOutdoor = false) {
  const palette = getMapActivityPinColors(isDark, isOutdoor);
  const pinBorder = palette.pinBorder;
  const countText = palette.countText;
  const peakFill = palette.peakFill;

  const clusterCirclePaint = {
    'circle-color': getClusterActivityColorExpression(isDark, emphasizeCommunity, isOutdoor),
    'circle-radius': ['step', ['get', 'point_count'], 20, 10, 24, 50, 30, 200, 36],
    'circle-opacity': 0.92,
    'circle-stroke-width': 2,
    'circle-stroke-color': pinBorder,
  } as const;

  const clusterCountLayout = {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-size': 13,
  } as const;

  const clusterCountPaint = {
    'text-color': countText,
  } as const;

  const spotCirclePaint = {
    'circle-radius': 10,
    'circle-color': getSpotPinColorExpression(isDark, emphasizeCommunity, isOutdoor),
    'circle-stroke-width': [
      'case',
      ['>', ['coalesce', ['get', 'communityCatchCount'], 0], 0],
      3.5,
      2,
    ],
    'circle-stroke-color': [
      'case',
      ['>', ['coalesce', ['get', 'communityCatchCount'], 0], 0],
      palette.community,
      pinBorder,
    ],
  } as const;

  const selectedSpotCirclePaint = {
    'circle-radius': 16,
    'circle-color': isOutdoor || !isDark ? 'rgba(4, 120, 87, 0.28)' : 'rgba(52, 211, 153, 0.3)',
    'circle-stroke-width': 3,
    'circle-stroke-color': peakFill,
  } as const;

  return {
    clusterCirclePaint,
    clusterCountLayout,
    clusterCountPaint,
    spotCirclePaint,
    selectedSpotCirclePaint,
  };
}

/** Serialize paint objects for embedding in MapLibre GL JS HTML. */
export function clusterCirclePaintJson(isDark: boolean, emphasizeCommunity = false, isOutdoor = false) {
  return JSON.stringify(getClusterStyles(isDark, emphasizeCommunity, isOutdoor).clusterCirclePaint);
}

export function spotCirclePaintJson(isDark: boolean, emphasizeCommunity = false, isOutdoor = false) {
  return JSON.stringify(getClusterStyles(isDark, emphasizeCommunity, isOutdoor).spotCirclePaint);
}

export function clusterPropertiesJson() {
  return JSON.stringify(CLUSTER_PROPERTIES);
}
