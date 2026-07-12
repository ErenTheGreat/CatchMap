import * as Linking from 'expo-linking';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  parseAuthParamsFromUrl,
  type SupabaseAuthParams,
} from '@/lib/auth/parseAuthParams';

export type { SupabaseAuthParams };

const DEV_CLIENT_SCHEME = 'exp+bolt-expo-nativewind';

/** Extract Supabase auth tokens from a deep link or redirect URL. */
export function getSupabaseAuthParams(url: string): SupabaseAuthParams {
  const parsed = parseAuthParamsFromUrl(url);
  if (
    parsed.access_token ||
    parsed.code ||
    parsed.token_hash ||
    parsed.error
  ) {
    return parsed;
  }

  const linkingParsed = Linking.parse(url);
  const queryParams = linkingParsed.queryParams ?? {};
  const read = (key: string): string | undefined => {
    const value = queryParams[key];
    return typeof value === 'string' ? value : undefined;
  };

  const accessToken = read('access_token');
  const refreshToken = read('refresh_token');
  const type = read('type');
  const code = read('code');
  const tokenHash = read('token_hash');
  const error = read('error');
  const errorDescription = read('error_description');

  if (accessToken || code || tokenHash || error) {
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      type,
      code,
      token_hash: tokenHash,
      error,
      error_description: errorDescription,
    };
  }

  return {};
}

function toVerifyOtpType(type?: string): EmailOtpType {
  switch (type) {
    case 'signup':
    case 'magiclink':
    case 'recovery':
    case 'invite':
    case 'email_change':
      return type;
    default:
      return 'email';
  }
}

export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = getSupabaseAuthParams(url);

  if (params.error) {
    if (__DEV__) {
      console.warn(
        '[auth] redirect error:',
        params.error,
        params.error_description ?? ''
      );
    }
    return false;
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });

    if (error) {
      if (__DEV__) console.warn('[auth] setSession from URL failed:', error.message);
      return false;
    }

    return true;
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      if (__DEV__) console.warn('[auth] exchangeCodeForSession failed:', error.message);
      return false;
    }
    return true;
  }

  if (params.token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: toVerifyOtpType(params.type),
    });
    if (error) {
      if (__DEV__) console.warn('[auth] verifyOtp failed:', error.message);
      return false;
    }
    return true;
  }

  return false;
}

/** Deep link used in password-reset and email-confirmation emails. */
export function getAuthRedirectUrl(): string {
  return Linking.createURL('auth');
}

/** Add every URL here in Supabase Dashboard → Auth → URL Configuration → Redirect URLs. */
export function getAuthRedirectAllowlist(): string[] {
  const primary = getAuthRedirectUrl();
  const urls = new Set<string>([
    primary,
    'catchmap://auth',
    `${DEV_CLIENT_SCHEME}://auth`,
  ]);
  return [...urls];
}
