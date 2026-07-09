import { Linking, Platform } from 'react-native';
import { buildSpotMapsUrls, type SpotMapsUrlOptions } from '@/utils/spotMapsUrls';

export type { SpotMapsUrlOptions as OpenSpotInMapsOptions };

/**
 * Opens turn-by-turn directions to a fishing spot in the platform maps app.
 */
export async function openSpotInMaps(options: SpotMapsUrlOptions): Promise<boolean> {
  const urls = buildSpotMapsUrls(options);

  if (Platform.OS === 'ios') {
    const opened = await Linking.canOpenURL(urls.appleDirections);
    if (opened) {
      await Linking.openURL(urls.appleDirections);
      return true;
    }
  }

  if (Platform.OS === 'android') {
    try {
      const canNavigate = await Linking.canOpenURL(urls.googleNavigation);
      if (canNavigate) {
        await Linking.openURL(urls.googleNavigation);
        return true;
      }
    } catch {
      // Fall through to universal Google Maps URL.
    }
  }

  const fallback = urls.googleUniversal;
  const canOpen = await Linking.canOpenURL(fallback);
  if (!canOpen && Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(fallback, '_blank');
      return true;
    }
    return false;
  }

  if (!canOpen) {
    await Linking.openURL(urls.googleSearch);
    return true;
  }

  await Linking.openURL(fallback);
  return true;
}
