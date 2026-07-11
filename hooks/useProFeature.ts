import { usePro } from '@/providers/ProProvider';
import { isProMonetizationEnabled, type ProFeature } from '@/constants/features';

/** React hook — re-renders when Pro entitlement loads or changes. */
export function useProFeature(feature: ProFeature): boolean {
  const { isPro } = usePro();
  if (!isProMonetizationEnabled()) {
    return true;
  }
  void feature;
  return isPro;
}
