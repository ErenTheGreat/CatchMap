import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, NativeModules } from 'react-native';
import { CalendarClock, RotateCcw } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

type DateTimePickerEvent = {
  type: string;
};

type DateTimePickerComponent = React.ComponentType<{
  value: Date;
  mode: 'date' | 'time' | 'datetime';
  display?: 'default' | 'spinner' | 'clock' | 'calendar';
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
}>;

function hasDateTimePickerModule(): boolean {
  const modules = NativeModules as {
    RNCDatePicker?: unknown;
    RNDateTimePicker?: unknown;
  };
  return Boolean(modules.RNCDatePicker ?? modules.RNDateTimePicker);
}

function getDateTimePicker(): DateTimePickerComponent | null {
  if (!hasDateTimePickerModule()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-community/datetimepicker').default as DateTimePickerComponent;
  } catch {
    return null;
  }
}

interface CatchDateTimeFieldProps {
  value: number;
  onChange: (timestamp: number) => void;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CatchDateTimeField({ value, onChange }: CatchDateTimeFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [mode, setMode] = useState<'date' | 'time' | 'datetime' | null>(null);
  const DateTimePicker = mode ? getDateTimePicker() : null;

  const openPicker = () => {
    if (!getDateTimePicker()) {
      return;
    }
    setMode(Platform.OS === 'ios' ? 'datetime' : 'date');
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'ios') {
      if (event.type === 'set' && selected) onChange(selected.getTime());
      return;
    }

    if (event.type === 'dismissed' || !selected) {
      setMode(null);
      return;
    }

    if (mode === 'date') {
      const merged = new Date(value);
      merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      onChange(merged.getTime());
      setMode('time');
      return;
    }

    const merged = new Date(value);
    merged.setHours(selected.getHours(), selected.getMinutes());
    onChange(merged.getTime());
    setMode(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Date &amp; time caught</Text>
      <View style={styles.row}>
        <Pressable
          style={styles.field}
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={`Caught at ${formatDateTime(value)}. Tap to change.`}
        >
          <CalendarClock color={colors.accent} size={18} />
          <Text style={styles.fieldText}>{formatDateTime(value)}</Text>
        </Pressable>
        <Pressable
          style={styles.resetButton}
          onPress={() => onChange(Date.now())}
          accessibilityRole="button"
          accessibilityLabel="Reset to now"
        >
          <RotateCcw color={colors.textSecondary} size={16} />
        </Pressable>
      </View>
      {DateTimePicker ? (
        <DateTimePicker value={new Date(value)} mode={mode!} onChange={handleChange} />
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.md,
    },
    label: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    field: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.cardLight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    fieldText: {
      flex: 1,
      fontSize: FontSizes.md,
      color: colors.text,
    },
    resetButton: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.cardLight,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
