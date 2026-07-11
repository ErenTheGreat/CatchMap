const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const reanimatedMock = path.resolve(__dirname, 'lib/mocks/reanimatedMock.js');
const workletsMock = path.resolve(__dirname, 'lib/mocks/workletsMock.js');

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react-native-reanimated' ||
    moduleName.startsWith('react-native-reanimated/')
  ) {
    return { type: 'sourceFile', filePath: reanimatedMock };
  }

  if (
    moduleName === 'react-native-worklets' ||
    moduleName.startsWith('react-native-worklets/')
  ) {
    return { type: 'sourceFile', filePath: workletsMock };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
