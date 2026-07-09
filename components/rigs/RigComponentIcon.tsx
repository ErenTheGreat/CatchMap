import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Anchor,
  Circle,
  CircleDot,
  Fish,
  Link,
  Minus,
  Package,
  Waves,
} from 'lucide-react-native';
import type { RigComponentRole } from '@/lib/types/speciesRigs';
import { FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/providers/ThemeProvider';

interface RigComponentIconProps {
  role: RigComponentRole;
  size?: number;
  color?: string;
}

const ROLE_LABELS: Record<RigComponentRole, string> = {
  rod: 'Rod',
  reel: 'Reel',
  line: 'Line',
  leader: 'Lead',
  hook: 'Hook',
  weight: 'Wt',
  lure: 'Lure',
  bait: 'Bait',
  float: 'Float',
  swivel: 'Swvl',
  other: 'Gear',
};

function RoleIcon({
  role,
  size,
  color,
}: {
  role: RigComponentRole;
  size: number;
  color: string;
}) {
  switch (role) {
    case 'hook':
      return <Anchor color={color} size={size} />;
    case 'reel':
    case 'float':
      return <Circle color={color} size={size} />;
    case 'weight':
      return <CircleDot color={color} size={size} />;
    case 'lure':
    case 'bait':
      return <Fish color={color} size={size} />;
    case 'swivel':
      return <Link color={color} size={size} />;
    case 'line':
    case 'rod':
      return <Minus color={color} size={size} />;
    case 'leader':
      return <Waves color={color} size={size} />;
    default:
      return <Package color={color} size={size} />;
  }
}

export default function RigComponentIcon({ role, size = 16, color }: RigComponentIconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.accent;

  return (
    <View
      style={[styles.badge, { backgroundColor: colors.cardLight, borderColor: colors.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <RoleIcon role={role} size={size} color={iconColor} />
      <Text style={[styles.label, { color: colors.textMuted }]}>{ROLE_LABELS[role]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 44,
  },
  label: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    marginTop: 2,
  },
});
