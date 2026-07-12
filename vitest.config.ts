import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'utils/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/utils/speciesGuide': path.resolve(__dirname, 'lib/species/__tests__/speciesGuideStub.ts'),
      'react-native': path.resolve(__dirname, 'vitest.react-native.stub.ts'),
    },
  },
});
