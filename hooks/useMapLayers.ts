import { useEffect, useState } from 'react';
import {
  buildRadarTileUrl,
  DEFAULT_MAP_LAYER_STATE,
  fetchLatestRadarFrame,
  type MapLayerState,
} from '@/lib/mapLayers/config';

const RADAR_REFRESH_MS = 5 * 60 * 1000;

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayerState>(DEFAULT_MAP_LAYER_STATE);
  const [radarTileUrl, setRadarTileUrl] = useState<string | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);

  useEffect(() => {
    if (layers.radar) return;

    setRadarTileUrl(null);
    setRadarError(null);
    setRadarLoading(false);
  }, [layers.radar]);

  useEffect(() => {
    if (!layers.radar) return;

    const controller = new AbortController();
    let isInitialFetch = true;

    const loadRadar = () => {
      if (isInitialFetch) {
        setRadarLoading(true);
      }

      void fetchLatestRadarFrame(controller.signal)
        .then((frame) => {
          if (controller.signal.aborted) return;
          if (frame) {
            setRadarTileUrl(buildRadarTileUrl(frame.path, frame.host));
            setRadarError(null);
          } else {
            setRadarError('Could not load radar data');
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            error instanceof Error ? error.message : 'Failed to load radar data';
          setRadarError(message);
        })
        .finally(() => {
          if (isInitialFetch) {
            setRadarLoading(false);
            isInitialFetch = false;
          }
        });
    };

    loadRadar();

    const interval = setInterval(loadRadar, RADAR_REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [layers.radar]);

  const toggleLayer = (layer: keyof MapLayerState) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  return {
    layers,
    radarTileUrl,
    radarLoading,
    radarError,
    toggleLayer,
    setLayers,
  };
}
