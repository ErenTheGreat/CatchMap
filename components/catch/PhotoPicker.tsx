import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/components/ui';
import { hapticLight } from '@/utils/haptics';
import {
  getImagePicker,
  type ImagePickerResult,
} from '@/utils/imagePickerAvailability';

interface PhotoPickerProps {
  value?: string | null;
  onChange: (uri: string | null) => void;
}

const PHOTO_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}catch-photos/`
  : null;

const PICKER_OPTIONS = {
  mediaTypes: ['images'] as const,
  allowsEditing: true,
  quality: 0.4,
  base64: true,
};

async function persistPhoto(
  sourceUri: string,
  base64?: string | null
): Promise<string> {
  if (Platform.OS === 'web' || !PHOTO_DIR) return sourceUri;

  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    }

    const dest = `${PHOTO_DIR}${Date.now()}.jpg`;
    if (base64) {
      await FileSystem.writeAsStringAsync(dest, base64, { encoding: 'base64' });
      return dest;
    }

    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch (error) {
    if (__DEV__) console.warn('Failed to persist photo, using original URI:', error);
    return sourceUri;
  }
}

export default function PhotoPicker({ value, onChange }: PhotoPickerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleResult = useCallback(async (result: ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setBusy(true);
    try {
      const asset = result.assets[0] as { uri?: string; base64?: string | null };
      const persisted = await persistPhoto(asset.uri!, asset.base64 ?? null);
      onChange(persisted);
    } catch (error) {
      if (__DEV__) console.warn('[photoPicker] persist photo failed:', error);
      showToast({
        message: 'Could not save the selected photo',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }, [onChange, showToast]);

  const unavailableMessage =
    'Camera needs the CatchMap development app (not Expo Go). Install the latest development APK from your EAS builds, then run npm run dev and open the project from that app.';

  const takePhoto = async () => {
    hapticLight();
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      showToast({ message: unavailableMessage, variant: 'warning' });
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showToast({
          message: 'Camera access is needed to take a photo',
          variant: 'warning',
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
      await handleResult(result);
    } catch (error) {
      if (__DEV__) console.warn('takePhoto failed:', error);
      showToast({
        message: 'Could not open the camera',
        variant: 'error',
      });
    }
  };

  const pickFromLibrary = async () => {
    hapticLight();
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      showToast({ message: unavailableMessage, variant: 'warning' });
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast({
          message: 'Photo library access is needed to choose a photo',
          variant: 'warning',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      await handleResult(result);
    } catch (error) {
      if (__DEV__) console.warn('pickFromLibrary failed:', error);
      showToast({
        message: 'Could not open your photo library',
        variant: 'error',
      });
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android' || value) return;

    const ImagePicker = getImagePicker();
    if (!ImagePicker?.getPendingResultAsync) return;

    void ImagePicker.getPendingResultAsync()
      .then((pending) => {
        if (pending && !pending.canceled) {
          void handleResult(pending);
        }
      })
      .catch(() => {
        // No pending picker result — ignore.
      });
  }, [value, handleResult]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photo</Text>

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
