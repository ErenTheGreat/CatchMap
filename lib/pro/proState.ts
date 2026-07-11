/**
 * Module-level Pro entitlement mirror (like lib/authState.ts) so non-React code
 * can gate features synchronously. ProProvider keeps this up to date.
 */
let proEntitled = false;

export function setProEntitled(entitled: boolean): void {
  proEntitled = entitled;
}

export function getProEntitled(): boolean {
  if (process.env.EXPO_PUBLIC_PRO_DEV_UNLOCK === 'true') {
    return true;
  }
  return proEntitled;
}
