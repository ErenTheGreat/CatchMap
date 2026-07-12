export const Platform = { OS: 'web' as const, select: <T>(spec: { web?: T; default?: T }) => spec.web ?? spec.default };
export const NativeModules = {};
