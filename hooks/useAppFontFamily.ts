import { FontFamily } from '@/constants/theme';
import { useFontsReady } from '@/providers/FontProvider';

export type AppFontWeight = 'regular' | 'medium' | 'bold';

export function useAppFontFamily(weight: AppFontWeight = 'regular'): string | undefined {
  const fontsReady = useFontsReady();
  if (!fontsReady) return undefined;

  switch (weight) {
    case 'bold':
      return FontFamily.brand;
    case 'medium':
      return FontFamily.medium;
    default:
      return FontFamily.regular;
  }
}
