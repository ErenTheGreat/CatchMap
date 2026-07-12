import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildRadarTileUrl,
  DEFAULT_MAP_LAYER_STATE,
  fetchLatestRadarFrame,
  fetchLatestRadarPath,
  RADAR_TILE_MAX_ZOOM,
} from '@/lib/mapLayers/config';

describe('map layer config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults overlays off until user opts in', () => {
    expect(DEFAULT_MAP_LAYER_STATE).toEqual({ depth: false, radar: false, heatmap: false, community: false });
  });

  it('builds RainViewer tile URL from radar path and host', () => {
    expect(buildRadarTileUrl('/v2/radar/123')).toBe(
      'https://tilecache.rainviewer.com/v2/radar/123/256/{z}/{x}/{y}/2/1_1.png'
    );
    expect(buildRadarTileUrl('/v2/radar/123', 'https://custom.host')).toBe(
      'https://custom.host/v2/radar/123/256/{z}/{x}/{y}/2/1_1.png'
    );
  });

  it('limits native radar tiles to RainViewer free-tier zoom', () => {
    expect(RADAR_TILE_MAX_ZOOM).toBe(7);
  });

  it('returns latest radar frame from RainViewer API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          host: 'https://tilecache.rainviewer.com',
          radar: {
            past: [{ path: '/v2/radar/older', time: 1 }, { path: '/v2/radar/latest', time: 2 }],
          },
        }),
      })
    );

    await expect(fetchLatestRadarFrame()).resolves.toEqual({
      host: 'https://tilecache.rainviewer.com',
      path: '/v2/radar/latest',
    });
    await expect(fetchLatestRadarPath()).resolves.toBe('/v2/radar/latest');
  });

  it('returns null when radar API response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      })
    );

    await expect(fetchLatestRadarFrame()).resolves.toBeNull();
  });

  it('returns null when radar API has no frames', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ radar: { past: [] } }),
      })
    );

    await expect(fetchLatestRadarFrame()).resolves.toBeNull();
  });

  it('propagates fetch failures to callers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));

    await expect(fetchLatestRadarFrame()).rejects.toThrow('Network unavailable');
  });
});
