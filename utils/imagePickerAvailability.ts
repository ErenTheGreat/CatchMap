import { Platform } from 'react-native';

export type ImagePickerResult = {
  canceled: boolean;
  assets?: Array<{ uri?: string; base64?: string | null }>;
};

export type ImagePickerModule = {
  requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchCameraAsync: (options: Record<string, unknown>) => Promise<ImagePickerResult>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<ImagePickerResult>;
  getPendingResultAsync?: () => Promise<ImagePickerResult | null>;
};

let cachedImagePicker: ImagePickerModule | null | undefined;

function isUsableImagePicker(module: unknown): module is ImagePickerModule {
  if (!module || typeof module !== 'object') return false;
  const picker = module as ImagePickerModule;
  return (
    typeof picker.launchCameraAsync === 'function' &&
    typeof picker.launchImageLibraryAsync === 'function' &&
    typeof picker.requestCameraPermissionsAsync === 'function' &&
    typeof picker.requestMediaLibraryPermissionsAsync === 'function'
  );
}

/**
 * Returns expo-image-picker when the native module is compiled into the app shell.
 * Photo features do not work in Expo Go or in dev clients built before image-picker was added.
 */
export function getImagePicker(): ImagePickerModule | null {
  if (Platform.OS === 'web') return null;
  if (cachedImagePicker !== undefined) return cachedImagePicker;

  try {
    const ImagePicker = require('expo-image-picker') as ImagePickerModule;
    if (isUsableImagePicker(ImagePicker)) {
      cachedImagePicker = ImagePicker;
      return cachedImagePicker;
    }
  } catch {
    // Native module missing from this APK shell.
  }

  cachedImagePicker = null;
  return null;
}

export function isImagePickerAvailable(): boolean {
  return getImagePicker() != null;
}
