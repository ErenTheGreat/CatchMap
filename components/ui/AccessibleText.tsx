import React from 'react';
import { Text, type TextProps } from 'react-native';
import { MAX_FONT_SIZE_MULTIPLIER } from '@/constants/accessibility';

/**
 * Text primitive for fixed-layout cards that should respect system font scaling
 * without blowing up compact map/dashboard layouts.
 */
export default function AccessibleText({
  maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER,
  ...props
}: TextProps) {
  return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />;
}
