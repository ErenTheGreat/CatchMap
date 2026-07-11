/** Optional crash reporting stub — Sentry is not required to run the app. */

export function initSentry(): void {
  // no-op until you intentionally add a DSN + rebuild with Sentry
}

export function captureException(_error: unknown, _context?: Record<string, unknown>): void {
  // no-op
}

/** Identity wrap so root layout does not depend on @sentry/react-native at launch. */
export function wrapRoot<T>(component: T): T {
  return component;
}
