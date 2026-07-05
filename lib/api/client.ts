import { API_CONFIG } from '@/lib/api/config';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/**
 * Single HTTP client for the mobile app.
 * All external data (spots, weather, tides, species) should route through the BFF.
 */
export async function bffRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  if (!API_CONFIG.bffUrl) {
    throw new ApiError('BFF URL is not configured', 0);
  }

  const url = new URL(path.startsWith('/') ? path : `/${path}`, API_CONFIG.bffUrl);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiError(`BFF request failed: ${response.status}`, response.status, body);
  }

  return response.json() as Promise<T>;
}
