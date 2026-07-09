import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/components/ui';
import { hapticLight } from '@/utils/haptics';

interface PhotoPickerProps {
  value?: string | null;
  onChange: (uri: string | null) => void;
}

export default function PhotoPicker({ value, onChange }: PhotoPickerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const readFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast({
        message: 'Please choose an image file',
        variant: 'warning',
      });
      return;
    }

    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const uri = typeof reader.result === 'string' ? reader.result : null;
      if (uri) onChange(uri);
      setBusy(false);
    };
    reader.onerror = () => {
      showToast({
        message: 'Could not read the selected photo',
        variant: 'error',
      });
      setBusy(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    readFile(file);
  };

  const takePhoto = () => {
    hapticLight();
    cameraInputRef.current?.click();
  };

  const pickFromLibrary = () => {
    hapticLight();
    libraryInputRef.current?.click();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photo</Text>
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {value ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" />
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => {
              hapticLight();
              onChange(null);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <X color={colors.accentForeground} size={16} />
          </TouchableOpacity>
          {busy && (
            <View style={styles.previewOverlay}>
              <ActivityIndicator color={colors.accentForeground} />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={takePhoto}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Take a photo of your catch"
          >
            <Camera color={colors.accent} size={22} />
            <Text style={styles.actionText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={pickFromLibrary}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
          >
            {busy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <ImagePlus color={colors.accent} size={22} />
            )}
            <Text style={styles.actionText}>Choose Photo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.md,
    },
    label: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
      marginBottom: Spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    actionText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    previewWrap: {
      position: 'relative',
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    preview: {
      width: '100%',
      height: 200,
      backgroundColor: colors.cardLight,
    },
    previewOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.overlay,
    },
    removeButton: {
      position: 'absolute',
      top: Spacing.sm,
      right: Spacing.sm,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
