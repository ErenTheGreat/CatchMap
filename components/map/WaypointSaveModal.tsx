import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MapPin, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { Button, TextField } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface WaypointSaveModalProps {
  visible: boolean;
  latitude: number | null;
  longitude: number | null;
  saving?: boolean;
  onSave: (values: { name: string; notes: string }) => void;
  onClose: () => void;
}

export default function WaypointSaveModal({
  visible,
  latitude,
  longitude,
  saving = false,
  onSave,
  onClose,
}: WaypointSaveModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState('My spot');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setName('My spot');
      setNotes('');
    }
  }, [visible, latitude, longitude]);

  const coordsLabel =
    latitude != null && longitude != null
      ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      : 'Unknown location';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <MapPin color={colors.accent} size={18} />
                <Text style={styles.title}>Save private waypoint</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X color={colors.textMuted} size={20} />
              </Pressable>
            </View>

            <Text style={styles.subtitle}>
              Only you can see this pin{coordsLabel ? ` at ${coordsLabel}` : ''}. Syncs when signed in.
            </Text>

            <TextField label="Name" value={name} onChangeText={setName} placeholder="Secret hole, dock, etc." />
            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Structure, depth, access tips…"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={styles.notesField}
            />

            <View style={styles.actions}>
              <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.actionButton} />
              <Button
                title="Save waypoint"
                onPress={() => onSave({ name, notes })}
                loading={saving}
                disabled={saving || !name.trim()}
                style={styles.actionButton}
              />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdropPress: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    notesField: {
      minHeight: 80,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      flex: 1,
    },
  });
}
