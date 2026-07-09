import { describe, expect, it } from 'vitest';
import { parseAuthParamsFromUrl } from '@/lib/auth/parseAuthParams';

describe('parseAuthParamsFromUrl', () => {
  it('parses tokens from hash fragment', () => {
    const params = parseAuthParamsFromUrl(
      'catchmap://auth#access_token=abc&refresh_token=def&type=recovery'
    );
    expect(params).toEqual({
      access_token: 'abc',
      refresh_token: 'def',
      type: 'recovery',
    });
  });

  it('parses tokens from query string', () => {
    const params = parseAuthParamsFromUrl(
      'catchmap://auth?access_token=abc&refresh_token=def'
    );
    expect(params.access_token).toBe('abc');
    expect(params.refresh_token).toBe('def');
  });

  it('parses PKCE code from query string', () => {
    const params = parseAuthParamsFromUrl('catchmap://auth?code=auth-code-123');
    expect(params.code).toBe('auth-code-123');
  });

  it('parses token_hash for email confirmation', () => {
    const params = parseAuthParamsFromUrl(
      'catchmap://auth?token_hash=hash123&type=signup'
    );
    expect(params).toEqual({
      access_token: undefined,
      refresh_token: undefined,
      type: 'signup',
      code: undefined,
      token_hash: 'hash123',
      error: undefined,
      error_description: undefined,
    });
  });

  it('parses redirect errors', () => {
    const params = parseAuthParamsFromUrl(
      'catchmap://auth#error=access_denied&error_description=Email+link+is+invalid+or+has+expired'
    );
    expect(params.error).toBe('access_denied');
    expect(params.error_description).toBe('Email link is invalid or has expired');
  });

  it('returns empty object when no tokens present', () => {
    expect(parseAuthParamsFromUrl('catchmap://auth')).toEqual({});
  });
});
