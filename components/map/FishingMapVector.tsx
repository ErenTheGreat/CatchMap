import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { spotsToGeoJson } from '@/components/map/spotsToGeoJson';
import { MapLegend, MAP_HEIGHT, mapContainerStyle } from '@/components/map/MapLegend';
import { FishingMapProps, VECTOR_STYLE_URL } from '@/components/map/types';
import { BBox } from '@/lib/api/endpoints/spatialSpots';
import { NearbySpot } from '@/utils/osmFishingSpots';

function buildMapLibreHtml(
  latitude: number,
  longitude: number,
  initialSpots: ReturnType<typeof spotsToGeoJson>
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #map { width: 100%; height: 100%; }
    .maplibregl-popup-content { border-radius: 12px; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.4; padding: 8px 12px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>
    window.__errs = [];
    window.onerror = function (msg, src, line) { window.__errs.push(msg + ' @' + (src || '') + ':' + line); };
    window.onunhandledrejection = function (e) { window.__errs.push('rejection: ' + (e.reason && e.reason.message || e.reason)); };

    var map = new maplibregl.Map({
      container: 'map',
      style: '${VECTOR_STYLE_URL}',
      center: [${longitude}, ${latitude}],
      zoom: 10,
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', function (e) { window.__errs.push('map: ' + (e.error && e.error.message || e.error)); });

    function send(message) {
      var payload = JSON.stringify(message);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(payload);
      } else if (window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    }

    // Called from React Native / parent frame when new spatial data arrives
    window.__updateSpots = function (geojson) {
      var source = map.getSource('spots');
      if (source) source.setData(typeof geojson === 'string' ? JSON.parse(geojson) : geojson);
    };

    // Parent frame (web) delivers updates via postMessage
    window.addEventListener('message', function (event) {
      try {
        var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg && msg.type === 'updateSpots') window.__updateSpots(msg.geojson);
      } catch (e) { /* ignore */ }
    });

    map.on('load', function () {
      map.addSource('user', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [${longitude}, ${latitude}] }, properties: {} }] }
      });
      map.addLayer({
        id: 'user-dot',
        type: 'circle',
        source: 'user',
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addSource('spots', {
        type: 'geojson',
        data: ${JSON.stringify(initialSpots)},
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14
      });
      map.addLayer({
        id: 'cluster-circles',
        type: 'circle',
        source: 'spots',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#111111',
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28, 200, 34],
          'circle-opacity': 0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'spots',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          'text-font': ['Noto Sans Regular']
        },
        paint: { 'text-color': '#ffffff' }
      });
      map.addLayer({
        id: 'spot-circles',
        type: 'circle',
        source: 'spots',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 10,
          'circle-color': ['case', ['==', ['get', 'isPeak'], 1], '#10b981', '#111111'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.on('click', 'cluster-circles', function (e) {
        var features = map.queryRenderedFeatures(e.point, { layers: ['cluster-circles'] });
        var clusterId = features[0].properties.cluster_id;
        map.getSource('spots').getClusterExpansionZoom(clusterId).then(function (zoom) {
          map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom });
        });
      });

      map.on('click', 'spot-circles', function (e) {
        var f = e.features[0];
        var p = f.properties;
        var html = '<b>' + p.name + '</b><br><span style="color:#666">' + Number(p.distance).toFixed(1) + ' mi · ' + p.waterType + '</span>';
        if (p.depth && p.depth !== 'null') html += '<br><span style="font-size:12px">Avg depth: ' + p.depth + ' ft</span>';
        if (p.season && p.season !== 'null') html += '<br><span style="font-size:12px">Best: ' + p.season + '</span>';
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(f.geometry.coordinates)
          .setHTML(html)
          .addTo(map);
        send({ type: 'spotPress', id: p.id });
      });

      map.on('mouseenter', 'spot-circles', function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'spot-circles', function () { map.getCanvas().style.cursor = ''; });

      // Camera settled — report the visible bbox for spatial fetching
      map.on('moveend', function () {
        var b = map.getBounds();
        send({ type: 'regionChange', bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
      });

      // Initial region so data loads without requiring a pan first
      var b = map.getBounds();
      send({ type: 'regionChange', bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
    });
  </script>
</body>
</html>`;
}

interface MapMessage {
  type: 'spotPress' | 'regionChange';
  id?: string;
  bbox?: BBox;
}

function handleMessage(
  raw: string,
  nearbySpots: NearbySpot[],
  onSpotPress?: (spot: NearbySpot) => void,
  onRegionChange?: (bbox: BBox) => void
) {
  try {
    const message: MapMessage = JSON.parse(raw);
    if (message.type === 'spotPress' && message.id && onSpotPress) {
      const spot = nearbySpots.find((s) => s.id === message.id);
      if (spot) onSpotPress(spot);
    }
    if (message.type === 'regionChange' && message.bbox && onRegionChange) {
      onRegionChange(message.bbox);
    }
  } catch {
    // Ignore malformed messages
  }
}

/**
 * Vector map fallback — MapLibre GL JS in a WebView (Expo Go) or iframe (web).
 * The HTML is built once; spot updates stream in via __updateSpots so the
 * camera position survives data refreshes while panning the globe.
 */
export default function FishingMapVector({
  latitude,
  longitude,
  nearbySpots,
  onSpotPress,
  onRegionChange,
}: FishingMapProps) {
  const webviewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Freeze initial values — rebuilding HTML on change would reset the camera
  const initialHtml = useMemo(
    () => buildMapLibreHtml(latitude, longitude, spotsToGeoJson(nearbySpots)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const spotsGeoJson = useMemo(() => spotsToGeoJson(nearbySpots), [nearbySpots]);

  // Stream data updates into the live map
  useEffect(() => {
    const payload = JSON.stringify(spotsGeoJson);
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: 'updateSpots', geojson: spotsGeoJson }),
        '*'
      );
    } else {
      webviewRef.current?.injectJavaScript(
        `window.__updateSpots(${JSON.stringify(payload)}); true;`
      );
    }
  }, [spotsGeoJson]);

  // Web: listen for messages coming out of the iframe
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        handleMessage(event.data, nearbySpots, onSpotPress, onRegionChange);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [nearbySpots, onSpotPress, onRegionChange]);

  if (Platform.OS === 'web') {
    return (
      <View style={mapContainerStyle}>
        {/* No sandbox: it blocks MapLibre's blob-URL workers, and the HTML is our own */}
        <iframe
          ref={iframeRef}
          srcDoc={initialHtml}
          style={{ width: '100%', height: MAP_HEIGHT, border: 0, display: 'block' }}
          title="Fishing map"
        />
        <MapLegend />
      </View>
    );
  }

  return (
    <View style={mapContainerStyle}>
      <WebView
        ref={webviewRef}
        source={{ html: initialHtml }}
        style={styles.webview}
        originWhitelist={['*']}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onMessage={(event) =>
          handleMessage(event.nativeEvent.data, nearbySpots, onSpotPress, onRegionChange)
        }
      />
      <MapLegend />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    width: '100%',
    height: MAP_HEIGHT,
  },
});
