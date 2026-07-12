import React, { useState } from 'react';
import { View, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Moon, Sunrise, Sun, Cloud, Sunset, Fish } from 'lucide-react-native';
import { Spacing, type ThemeColors } from '@/constants/theme';
import type { DailyBiteCurve, DailyCurveIcon } from '@/utils/bestTimeNow';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface BiteTimeChartProps {
  curve: DailyBiteCurve;
  selectedIndex: number | null;
  onSelectHour: (index: number | null) => void;
}

const PLOT_HEIGHT = 150;
const ICON_ROW_HEIGHT = 22;
const AXIS_HEIGHT = 18;
const RIGHT_SCALE_WIDTH = 34;
const PAD_LEFT = 4;
const PAD_TOP = 22;
const PAD_BOTTOM = 6;

const SCORE_MIN = 1;
const SCORE_MAX = 5;

const SCALE_LABELS: Record<number, string> = {
  1: 'Slow',
  2: 'Fair',
  3: 'Good',
  4: 'Hot',
  5: 'Peak',
};

const AXIS_TICKS = [
  { hour: 0, label: '12AM' },
  { hour: 6, label: '6AM' },
  { hour: 12, label: '12PM' },
  { hour: 18, label: '6PM' },
];

const ICON_COMPONENTS: Record<
  DailyCurveIcon,
  React.ComponentType<{ color: string; size: number }>
> = {
  night: Moon,
  dawn: Sunrise,
  day: Sun,
  cloudy: Cloud,
  dusk: Sunset,
  prime: Fish,
};

interface Point {
  x: number;
  y: number;
}

/** Catmull-Rom spline converted to cubic beziers for a smooth curve. */
function buildSmoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function BiteTimeChart({
  curve,
  selectedIndex,
  onSelectHour,
}: BiteTimeChartProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [width, setWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const plotWidth = Math.max(0, width - RIGHT_SCALE_WIDTH - PAD_LEFT);
  const lastIndex = curve.points.length - 1;

  const xFor = (hour: number) => PAD_LEFT + (hour / lastIndex) * plotWidth;
  const yFor = (score: number) =>
    PAD_TOP +
    ((SCORE_MAX - score) / (SCORE_MAX - SCORE_MIN)) *
      (PLOT_HEIGHT - PAD_TOP - PAD_BOTTOM);

  const points: Point[] = curve.points.map((point, index) => ({
    x: xFor(index),
    y: yFor(point.score),
  }));

  const linePath = buildSmoothPath(points);
  const areaPath =
    linePath &&
    `${linePath} L ${points[lastIndex].x} ${PLOT_HEIGHT} L ${points[0].x} ${PLOT_HEIGHT} Z`;

  // Hit slots centered on each hour: half a step of overhang on each side.
  const hourStep = lastIndex > 0 ? plotWidth / lastIndex : 0;
  const hitAreaLeft = PAD_LEFT - hourStep / 2;
  const hitAreaWidth = plotWidth + hourStep;

  const best = points[curve.bestHourIndex];
  const worst = points[curve.worstHourIndex];
  const nowPoint = points[curve.nowIndex];
  const selectedPoint = selectedIndex != null ? points[selectedIndex] : null;

  return (
    <View onLayout={handleLayout} style={styles.container}>
      {width > 0 && (
        <>
          <View style={[styles.iconRow, { height: ICON_ROW_HEIGHT }]}>
            {curve.points
              .filter((_, index) => index % 2 === 0)
              .map((point) => {
                const IconComponent = ICON_COMPONENTS[point.icon];
                const iconColor =
                  point.icon === 'prime' ? colors.success : colors.textMuted;
                return (
                  <View
                    key={point.hour}
                    style={[styles.iconSlot, { left: xFor(point.hour) - 7 }]}
                  >
                    <IconComponent color={iconColor} size={13} />
                  </View>
                );
              })}
          </View>

          <View
            accessibilityRole="adjustable"
            accessibilityLabel="Daily bite activity chart. Tap to inspect an hour."
          >
            <Svg width={width} height={PLOT_HEIGHT + AXIS_HEIGHT}>
              <Defs>
                <LinearGradient id="biteAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FBBF24" stopOpacity="0.85" />
                  <Stop offset="0.45" stopColor="#34D399" stopOpacity="0.5" />
                  <Stop offset="1" stopColor="#0D9488" stopOpacity="0.05" />
                </LinearGradient>
              </Defs>

              {/* Horizontal gridlines + right-side activity scale */}
              {[1, 2, 3, 4, 5].map((score) => (
                <React.Fragment key={`grid-${score}`}>
                  <Line
                    x1={PAD_LEFT}
                    y1={yFor(score)}
                    x2={PAD_LEFT + plotWidth}
                    y2={yFor(score)}
                    stroke={colors.border}
                    strokeWidth={StyleSheet.hairlineWidth || 0.5}
                    opacity={0.7}
                  />
                  <SvgText
                    x={PAD_LEFT + plotWidth + 6}
                    y={yFor(score) + 3}
                    fill={colors.textMuted}
                    fontSize={9}
                  >
                    {SCALE_LABELS[score]}
                  </SvgText>
                </React.Fragment>
              ))}

              {/* Dashed vertical gridlines at 6AM / 12PM / 6PM */}
              {AXIS_TICKS.filter((tick) => tick.hour > 0).map((tick) => (
                <Line
                  key={`vgrid-${tick.hour}`}
                  x1={xFor(tick.hour)}
                  y1={PAD_TOP - 8}
                  x2={xFor(tick.hour)}
                  y2={PLOT_HEIGHT}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  opacity={0.8}
                />
              ))}

              {/* Gradient area + curve */}
              {areaPath ? <Path d={areaPath} fill="url(#biteAreaGradient)" /> : null}
              {linePath ? (
                <Path
                  d={linePath}
                  stroke="#FDE68A"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                />
              ) : null}

              {/* Now marker */}
              {nowPoint && (
                <>
                  <Line
                    x1={nowPoint.x}
                    y1={nowPoint.y + 4}
                    x2={nowPoint.x}
                    y2={PLOT_HEIGHT}
                    stroke={colors.brandAccent}
                    strokeWidth={1.5}
                    opacity={0.8}
                  />
                  <Circle
                    cx={nowPoint.x}
                    cy={nowPoint.y}
                    r={4.5}
                    fill={colors.brandAccent}
                    stroke={colors.card}
                    strokeWidth={1.5}
                  />
                </>
              )}

              {/* Selected hour marker */}
              {selectedPoint && selectedIndex !== curve.nowIndex && (
                <>
                  <Line
                    x1={selectedPoint.x}
                    y1={selectedPoint.y + 4}
                    x2={selectedPoint.x}
                    y2={PLOT_HEIGHT}
                    stroke={colors.text}
                    strokeWidth={1}
                    opacity={0.6}
                  />
                  <Circle
                    cx={selectedPoint.x}
                    cy={selectedPoint.y}
                    r={4}
                    fill={colors.text}
                    stroke={colors.card}
                    strokeWidth={1.5}
                  />
                </>
              )}

              {/* H (best) and L (worst) markers */}
              {best && (
                <>
                  <SvgText
                    x={Math.max(8, Math.min(PAD_LEFT + plotWidth - 8, best.x))}
                    y={Math.max(10, best.y - 12)}
                    fill={colors.text}
                    fontSize={12}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    H
                  </SvgText>
                  <Circle
                    cx={best.x}
                    cy={best.y}
                    r={3.5}
                    fill="none"
                    stroke={colors.text}
                    strokeWidth={1.5}
                  />
                </>
              )}
              {worst && curve.worstHourIndex !== curve.bestHourIndex && (
                <>
                  <SvgText
                    x={Math.max(8, Math.min(PAD_LEFT + plotWidth - 8, worst.x))}
                    y={Math.max(10, worst.y - 12)}
                    fill={colors.text}
                    fontSize={12}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    L
                  </SvgText>
                  <Circle
                    cx={worst.x}
                    cy={worst.y}
                    r={3.5}
                    fill="none"
                    stroke={colors.text}
                    strokeWidth={1.5}
                  />
                </>
              )}

              {/* Bottom time axis */}
              <Line
                x1={PAD_LEFT}
                y1={PLOT_HEIGHT}
                x2={PAD_LEFT + plotWidth}
                y2={PLOT_HEIGHT}
                stroke={colors.border}
                strokeWidth={1}
              />
              {AXIS_TICKS.map((tick) => (
                <SvgText
                  key={`axis-${tick.hour}`}
                  x={xFor(tick.hour)}
                  y={PLOT_HEIGHT + 13}
                  fill={colors.textMuted}
                  fontSize={10}
                  textAnchor={tick.hour === 0 ? 'start' : 'middle'}
                >
                  {tick.label}
                </SvgText>
              ))}
            </Svg>

            {/* Invisible per-hour tap targets over the plot */}
            <View
              style={[
                styles.hitRow,
                { left: hitAreaLeft, width: hitAreaWidth, height: PLOT_HEIGHT },
              ]}
            >
              {curve.points.map((point, index) => (
                <Pressable
                  key={`hit-${point.hour}`}
                  style={styles.hitSlot}
                  onPress={() =>
                    onSelectHour(selectedIndex === index ? null : index)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${point.hourLabel}, activity ${point.rating} out of 5`}
                  accessibilityState={{ selected: selectedIndex === index }}
                />
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: '100%',
      marginTop: Spacing.xs,
    },
    iconRow: {
      position: 'relative',
      width: '100%',
    },
    iconSlot: {
      position: 'absolute',
      top: 2,
      width: 14,
      alignItems: 'center',
    },
    hitRow: {
      position: 'absolute',
      top: 0,
      flexDirection: 'row',
    },
    hitSlot: {
      flex: 1,
      height: '100%',
    },
  });
}
