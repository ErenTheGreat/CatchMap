export interface SupabaseAuthParams {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  code?: string;
  token_hash?: string;
  error?: string;
  error_description?: string;
}

function parseParamString(paramString: string): SupabaseAuthParams {
  const params = new URLSearchParams(paramString);
  return {
    access_token: params.get('access_token') ?? undefined,
    refresh_token: params.get('refresh_token') ?? undefined,
    type: params.get('type') ?? undefined,
    code: params.get('code') ?? undefined,
    token_hash: params.get('token_hash') ?? undefined,
    error: params.get('error') ?? undefined,
    error_description: params.get('error_description') ?? undefined,
  };
}

/** Pure URL parser for Supabase auth redirect/deep-link tokens. */
export function parseAuthParamsFromUrl(url: string): SupabaseAuthParams {
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const fromHash = parseParamString(url.slice(hashIndex + 1));
    if (
      fromHash.access_token ||
      fromHash.code ||
      fromHash.token_hash ||
      fromHash.error
    ) {
      return fromHash;
    }
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0) {
    const queryEnd = hashIndex >= 0 ? hashIndex : url.length;
    const fromQuery = parseParamString(url.slice(queryIndex + 1, queryEnd));
    if (
      fromQuery.access_token ||
      fromQuery.code ||
      fromQuery.token_hash ||
      fromQuery.error
    ) {
      return fromQuery;
    }
  }

  return {};
}
