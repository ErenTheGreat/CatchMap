import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { MAX_FONT_SIZE_MULTIPLIER } from '@/constants/accessibility';
import { useAppFontFamily, type AppFontWeight } from '@/hooks/useAppFontFamily';

export interface ThemedTextProps extends TextProps {
  weight?: AppFontWeight;
}

export default function ThemedText({
  weight = 'regular',
  style,
  maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER,
  ...props
}: ThemedTextProps) {
  const fontFamily = useAppFontFamily(weight);
  const fontStyle: TextStyle | undefined = fontFamily ? { fontFamily } : undefined;

  return (
    <Text
      style={[fontStyle, style]}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
    />
  );
}
