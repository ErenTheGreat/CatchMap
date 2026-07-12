import type { ExpoConfig, ConfigContext } from 'expo/config';

/** Change before your first Play Store upload — package IDs cannot be renamed later. */
const ANDROID_PACKAGE = 'app.catchmap';
const IOS_BUNDLE_ID = 'app.catchmap';
const APP_NAME = 'CatchMap: Fishing Spots & Log';

const isDevClientBuild =
  process.env.EAS_BUILD_PROFILE === 'development' ||
  process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  // Keep in sync with native dev-client scheme: exp+bolt-expo-nativewind
  slug: 'bolt-expo-nativewind',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'catchmap',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0f1f3d',
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    ...(isDevClientBuild ? (['expo-dev-client'] as const) : []),
    'expo-font',
    'expo-web-browser',
    [
      '@maplibre/maplibre-react-native',
      {
        android: {},
        ios: {},
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow CatchMap to use your location to find nearby fishing spots on the map.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow CatchMap to access your photos to attach a picture to your catch.',
        cameraPermission:
          'Allow CatchMap to use your camera to take a photo of your catch.',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#0f1f3d',
      },
    ],
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Your location is used to show nearby fishing spots on the map.',
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#0f1f3d',
    },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
      'READ_MEDIA_IMAGES',
      'READ_EXTERNAL_STORAGE',
    ],
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'fdefc711-a0c9-4cdd-ba91-1e11b4692991',
    },
  },
});
