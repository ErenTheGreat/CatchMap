import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  BREAKPOINTS,
  CONTENT_MAX_WIDTH,
  CONTENT_WIDE_MAX_WIDTH,
  MAP_SIDE_PANEL_WIDTH,
  MAP_SIDE_PANEL_WIDTH_DESKTOP,
  MODAL_MAX_WIDTH,
  MODAL_WIDE_MAX_WIDTH,
} from '@/constants/layout';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= BREAKPOINTS.tablet;
    const isDesktop = width >= BREAKPOINTS.desktop;
    const isWide = isTablet;
    const isCompact = !isWide;

    return {
      width,
      height,
      isCompact,
      isTablet,
      isDesktop,
      isWide,
      /** True when tabs should render as a left sidebar (wide web only). */
      useSideTabs: isWide && Platform.OS === 'web',
      contentMaxWidth: isDesktop ? CONTENT_WIDE_MAX_WIDTH : CONTENT_MAX_WIDTH,
      mapPanelWidth: isDesktop ? MAP_SIDE_PANEL_WIDTH_DESKTOP : MAP_SIDE_PANEL_WIDTH,
      modalMaxWidth: isDesktop ? MODAL_WIDE_MAX_WIDTH : MODAL_MAX_WIDTH,
      listColumnCount: isDesktop ? 2 : 1,
    };
  }, [width, height]);
}
