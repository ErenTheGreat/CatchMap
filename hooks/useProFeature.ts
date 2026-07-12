import { usePro } from '@/providers/ProProvider';
import { isProMonetizationEnabled, type ProFeature } from '@/constants/features';

export interface ProFeatureState {
  enabled: boolean;
  loading: boolean;
}

/** React hook — re-renders when Pro entitlement loads or changes. */
export function useProFeature(feature: ProFeature): ProFeatureState {
  const { isPro, loading } = usePro();
  if (!isProMonetizationEnabled()) {
    return { enabled: true, loading: false };
  }
  void feature;
  return { enabled: isPro, loading };
}
