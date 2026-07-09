import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { spotsToGeoJson } from '@/components/map/spotsToGeoJson';
import { waypointsToGeoJson } from '@/components/map/waypointsToGeoJson';
import { MapLegend, getMapContainerStyle } from '@/components/map/MapLegend';
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  clusterCirclePaintJson,
  clusterPropertiesJson,
  spotCirclePaintJson,
} from '@/components/map/clusterLayerStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { FishingMapProps, getVectorStyleUrl, MAP_FLY_TO_DURATION_MS, type FlyToTarget } from '@/components/map/types';
import { toFlyCommand } from '@/components/map/mapFly';
import { BBox } from '@/lib/api/endpoints/spatialSpots';
import {
  logMapRegionChanging,
  reportMapRegionChangeComplete,
} from '@/lib/mapViewport';
import { postToMapView } from '@/components/map/mapBridge';
import { NearbySpot } from '@/utils/osmFishingSpots';
import {
  DEPTH_MAX_ZOOM,
  DEPTH_MIN_ZOOM,
  DEPTH_TILE_URL,
  RADAR_TILE_MAX_ZOOM,
} from '@/lib/mapLayers/config';
import type { WaypointRecord } from '@/lib/types/waypoint';

function buildMapLibreHtml(
  latitude: number,
  longitude: number,
  initialSpots: ReturnType<typeof spotsToGeoJson>,
  isDark: boolean,
  emphasizeCommunity = false,
  isOutdoor = false
): string {
  const styleUrl = getVectorStyleUrl(isDark, isOutdoor);
  const clusterPaint = clusterCirclePaintJson(isDark, emphasizeCommunity, isOutdoor);
  const spotPaint = spotCirclePaintJson(isDark, emphasizeCommunity, isOutdoor);
  const clusterProps = clusterPropertiesJson();
  const pinBorder = isOutdoor || !isDark ? '#ffffff' : '#94A3B8';
  const depthTileUrl = DEPTH_TILE_URL;

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
      style: '${styleUrl}',
      center: [${longitude}, ${latitude}],
      zoom: 13,
      attributionControl: { compact: true }
    });

    function send(message) {
      var payload = JSON.stringify(message);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(payload);
      } else if (window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    }

    // Updates can arrive before map 'load' creates the sources/layers.
    // Buffer them and replay once the map is ready.
    var pendingSpots = null;
    var pendingSelectedSpotId = null;
    var pendingFly = null;
    var pendingWaypoints = null;
    var pendingMapLayers = null;
    var pendingHeatmap = null;
    var mapReady = false;
    var mapPressState = null;
    var LONG_PRESS_MS = 700;
    var MOVE_TOLERANCE_SQ = 14 * 14;
    var depthTileUrl = '${depthTileUrl}';

    function clearMapPressState() {
      if (mapPressState && mapPressState.timer) clearTimeout(mapPressState.timer);
      mapPressState = null;
    }

    function movedTooFar(startPoint, nextPoint) {
      if (!startPoint || !nextPoint) return true;
      var dx = startPoint.x - nextPoint.x;
      var dy = startPoint.y - nextPoint.y;
      return (dx * dx + dy * dy) > MOVE_TOLERANCE_SQ;
    }

    function maybeSendLongPress(state) {
      if (!state || !state.lngLat || state.cancelled) return;
      var elapsed = Date.now() - state.startedAt;
      if (elapsed < LONG_PRESS_MS) return;
      state.cancelled = true;
      send({ type: 'mapLongPress', lng: state.lngLat.lng, lat: state.lngLat.lat });
    }

    function beginMapPress(point, lngLat) {
      clearMapPressState();
      if (!lngLat) return;
      var state = {
        startedAt: Date.now(),
        point: point,
        lngLat: lngLat,
        cancelled: false,
        timer: null,
      };
      state.timer = setTimeout(function () {
        maybeSendLongPress(state);
      }, LONG_PRESS_MS);
      mapPressState = state;
    }

    function endMapPress(point) {
      if (!mapPressState) return;
      if (mapPressState.timer) clearTimeout(mapPressState.timer);
      if (!mapPressState.cancelled && !movedTooFar(mapPressState.point, point)) {
        var elapsed = Date.now() - mapPressState.startedAt;
        if (elapsed >= LONG_PRESS_MS) {
          maybeSendLongPress(mapPressState);
        }
      }
      clearMapPressState();
    }

    function cancelMapPress() {
      if (mapPressState) mapPressState.cancelled = true;
      clearMapPressState();
    }

    function runFlyTo(lng, lat, zoom, duration) {
      map.flyTo({
        center: [lng, lat],
        zoom: zoom || 13,
        duration: duration || ${MAP_FLY_TO_DURATION_MS},
        essential: true,
      });
      map.once('moveend', function () {
        var b = map.getBounds();
        send({ type: 'regionChange', bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
      });
    }

    window.__flyToCenter = function (lng, lat, zoom, duration) {
      if (!map.loaded()) {
        pendingFly = { lng: lng, lat: lat, zoom: zoom, duration: duration };
        return;
      }
      runFlyTo(lng, lat, zoom, duration);
    };

    window.__updateSpots = function (geojson) {
      var data = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
      var source = map.getSource('spots');
      if (source) {
        source.setData(data);
      } else {
        pendingSpots = data;
      }
    };

    window.__flyToSpot = function (lng, lat, zoom, duration) {
      window.__flyToCenter(lng, lat, zoom || 14, duration);
    };

    window.__updateUserLocation = function (lng, lat) {
      if (!map.loaded()) return;
      var source = map.getSource('user');
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {}
        }]
      });
    };

    window.__setSelectedSpotId = function (spotId) {
      if (!mapReady) {
        pendingSelectedSpotId = spotId || null;
        return;
      }
      if (map.getLayer('spot-selected')) map.removeLayer('spot-selected');
      if (!spotId) return;
      map.addLayer({
        id: 'spot-selected',
        type: 'circle',
        source: 'spots',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], spotId]],
        paint: {
          'circle-radius': 16,
          'circle-color': 'rgba(16, 185, 129, 0.25)',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#10b981'
        }
      });
    };

    function addWaypointsSource(data) {
      if (map.getSource('waypoints')) {
        map.getSource('waypoints').setData(data);
        return;
      }
      map.addSource('waypoints', { type: 'geojson', data: data });
      map.addLayer({
        id: 'waypoint-circles',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 10,
          'circle-color': '#EAB308',
          'circle-stroke-width': 2,
          'circle-stroke-color': '${pinBorder}'
        }
      });
      map.on('click', 'waypoint-circles', function (e) {
        var id = e.features[0].properties.id;
        send({ type: 'waypointPress', id: id });
      });
    }

    window.__updateWaypoints = function (geojson) {
      var data = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
      if (!mapReady) {
        pendingWaypoints = data;
        return;
      }
      if (!data.features || data.features.length === 0) {
        if (map.getLayer('waypoint-circles')) map.removeLayer('waypoint-circles');
        if (map.getSource('waypoints')) map.removeSource('waypoints');
        return;
      }
      addWaypointsSource(data);
    };

    function applyMapLayers(config) {
      if (config.depth) {
        if (!map.getSource('depth')) {
          map.addSource('depth', {
            type: 'raster',
            tiles: [depthTileUrl],
            tileSize: 256,
            minzoom: ${DEPTH_MIN_ZOOM},
            maxzoom: ${DEPTH_MAX_ZOOM},
            attribution: 'NOAA'
          });
          map.addLayer({
            id: 'depth-layer',
            type: 'raster',
            source: 'depth',
            minzoom: ${DEPTH_MIN_ZOOM},
            maxzoom: ${DEPTH_MAX_ZOOM},
            paint: { 'raster-opacity': 0.55 }
          }, 'cluster-circles');
        }
      } else {
        if (map.getLayer('depth-layer')) map.removeLayer('depth-layer');
        if (map.getSource('depth')) map.removeSource('depth');
      }

      if (config.radar && config.radarTileUrl) {
        if (map.getLayer('radar-layer')) map.removeLayer('radar-layer');
        if (map.getSource('radar')) map.removeSource('radar');
        map.addSource('radar', {
          type: 'raster',
          tiles: [config.radarTileUrl],
          tileSize: 256,
          maxzoom: ${RADAR_TILE_MAX_ZOOM}
        });
        map.addLayer({
          id: 'radar-layer',
          type: 'raster',
          source: 'radar',
          paint: {
            'raster-opacity': 0.75,
            'raster-fade-duration': 0
          }
        }, 'cluster-circles');
      } else {
        if (map.getLayer('radar-layer')) map.removeLayer('radar-layer');
        if (map.getSource('radar')) map.removeSource('radar');
      }

      if (config.communitySpotPaint && map.getLayer('spot-circles')) {
        var spotPaint = JSON.parse(config.communitySpotPaint);
        Object.keys(spotPaint).forEach(function (key) {
          map.setPaintProperty('spot-circles', key, spotPaint[key]);
        });
      }
      if (config.communityClusterPaint && map.getLayer('cluster-circles')) {
        var clusterPaint = JSON.parse(config.communityClusterPaint);
        Object.keys(clusterPaint).forEach(function (key) {
          map.setPaintProperty('cluster-circles', key, clusterPaint[key]);
        });
      }
    }

    function applyHeatmapLayer(geojson) {
      if (!geojson || !geojson.features || geojson.features.length === 0) {
        if (map.getLayer('heatmap-circles')) map.removeLayer('heatmap-circles');
        if (map.getSource('bite-heatmap')) map.removeSource('bite-heatmap');
        return;
      }

      if (map.getSource('bite-heatmap')) {
        map.getSource('bite-heatmap').setData(geojson);
      } else {
        map.addSource('bite-heatmap', { type: 'geojson', data: geojson });
        map.addLayer({
          id: 'heatmap-circles',
          type: 'circle',
          source: 'bite-heatmap',
          paint: {
            'circle-radius': 22,
            'circle-color': [
              'interpolate', ['linear'], ['get', 'score'],
              1, '#94a3b8',
              3, '#f59e0b',
              5, '#10b981',
              6, '#059669'
            ],
            'circle-opacity': ['get', 'opacity'],
            'circle-blur': 0.6
          }
        }, 'cluster-circles');
      }
    }

    window.__updateHeatmap = function (geojson) {
      if (!mapReady) {
        pendingHeatmap = geojson;
        return;
      }
      applyHeatmapLayer(geojson);
    };

    window.__updateMapLayers = function (config) {
      if (!mapReady) {
        pendingMapLayers = config;
        return;
      }
      applyMapLayers(config || {});
    };

    function handleInboundMessage(event) {
      try {
        var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg && msg.type === 'updateSpots') window.__updateSpots(msg.geojson);
        if (msg && msg.type === 'flyTo') window.__flyToCenter(msg.lng, msg.lat, msg.zoom, msg.duration);
        if (msg && msg.type === 'flyToSpot') window.__flyToSpot(msg.lng, msg.lat, msg.zoom, msg.duration);
        if (msg && msg.type === 'updateUser') window.__updateUserLocation(msg.lng, msg.lat);
        if (msg && msg.type === 'setSelectedSpot') window.__setSelectedSpotId(msg.id || null);
        if (msg && msg.type === 'updateWaypoints') window.__updateWaypoints(msg.geojson);
        if (msg && msg.type === 'updateMapLayers') window.__updateMapLayers(msg.config);
        if (msg && msg.type === 'updateHeatmap') window.__updateHeatmap(msg.geojson);
      } catch (e) { /* ignore */ }
    }

    // Android WebView delivers RN postMessage on document; iOS/web use window.
    document.addEventListener('message', handleInboundMessage);
    window.addEventListener('message', handleInboundMessage);

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
          'circle-stroke-color': '${pinBorder}'
        }
      });

      map.addSource('spots', {
        type: 'geojson',
        data: ${JSON.stringify(initialSpots)},
        cluster: true,
        clusterRadius: ${CLUSTER_RADIUS},
        clusterMaxZoom: ${CLUSTER_MAX_ZOOM},
        clusterProperties: ${clusterProps}
      });
      map.addLayer({
        id: 'cluster-circles',
        type: 'circle',
        source: 'spots',
        filter: ['has', 'point_count'],
        paint: ${clusterPaint}
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'spots',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 13,
          'text-font': ['Noto Sans Regular']
        },
        paint: { 'text-color': '#ffffff' }
      });
      map.addLayer({
        id: 'spot-circles',
        type: 'circle',
        source: 'spots',
        filter: ['!', ['has', 'point_count']],
        paint: ${spotPaint}
      });

      mapReady = true;
      if (pendingSpots) {
        map.getSource('spots').setData(pendingSpots);
        pendingSpots = null;
      }
      if (pendingSelectedSpotId != null) {
        window.__setSelectedSpotId(pendingSelectedSpotId);
        pendingSelectedSpotId = null;
      }
      if (pendingFly) {
        runFlyTo(pendingFly.lng, pendingFly.lat, pendingFly.zoom, pendingFly.duration);
        pendingFly = null;
      }
      if (pendingWaypoints) {
        window.__updateWaypoints(pendingWaypoints);
        pendingWaypoints = null;
      }
      if (pendingMapLayers) {
        window.__updateMapLayers(pendingMapLayers);
        pendingMapLayers = null;
      }
      if (pendingHeatmap) {
        window.__updateHeatmap(pendingHeatmap);
        pendingHeatmap = null;
      }

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
        send({ type: 'spotPress', id: p.id });
      });

      map.on('click', function (e) {
        cancelMapPress();
        var features = map.queryRenderedFeatures(e.point, { layers: ['cluster-circles', 'spot-circles', 'waypoint-circles'] });
        if (features.length === 0) send({ type: 'mapPress' });
      });

      map.on('mousedown', function (e) {
        beginMapPress(e.point, e.lngLat);
      });
      map.on('mouseup', function (e) {
        endMapPress(e.point);
      });
      map.on('mousemove', function (e) {
        if (mapPressState && movedTooFar(mapPressState.point, e.point)) {
          cancelMapPress();
        }
      });

      map.on('touchstart', function (e) {
        if (e.originalEvent && e.originalEvent.preventDefault) {
          e.originalEvent.preventDefault();
        }
        beginMapPress(e.point, e.lngLat);
      });
      map.on('touchend', function (e) {
        endMapPress(e.point);
      });
      map.on('touchcancel', function () {
        cancelMapPress();
      });
      map.on('touchmove', function (e) {
        if (mapPressState && movedTooFar(mapPressState.point, e.point)) {
          cancelMapPress();
        }
      });

      map.on('contextmenu', function (e) {
        if (e.originalEvent && e.originalEvent.preventDefault) {
          e.originalEvent.preventDefault();
        }
      });

      function reportViewport() {
        var b = map.getBounds();
        send({ type: 'regionChange', bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
      }

      function logViewport() {
        var b = map.getBounds();
        send({ type: 'regionChanging', bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
      }

      map.on('move', logViewport);
      map.on('moveend', reportViewport);
      reportViewport();
      send({ type: 'mapReady' });
    });
  </script>
</body>
</html>`;
}

interface MapMessage {
  type:
    | 'spotPress'
    | 'regionChange'
    | 'regionChanging'
    | 'mapPress'
    | 'mapReady'
    | 'mapLongPress'
    | 'waypointPress';
  id?: string;
  bbox?: BBox;
  lng?: number;
  lat?: number;
}

function handleMessage(
  raw: string,
  nearbySpots: NearbySpot[],
  waypoints: WaypointRecord[],
  onSpotPress?: (spot: NearbySpot) => void,
  onRegionChange?: (bbox: BBox) => void,
  onMapPress?: () => void,
  onMapReady?: () => void,
  onMapLongPress?: FishingMapProps['onMapLongPress'],
  onWaypointPress?: FishingMapProps['onWaypointPress']
) {
  try {
    const message: MapMessage = JSON.parse(raw);
    if (message.type === 'mapReady') {
      onMapReady?.();
      return;
    }
    if (message.type === 'spotPress' && message.id && onSpotPress) {
      const spot = nearbySpots.find((s) => s.id === message.id);
      if (spot) onSpotPress(spot);
    }
    if (message.type === 'waypointPress' && message.id && onWaypointPress) {
      const waypoint = waypoints.find((item) => item.id === message.id);
      if (waypoint) onWaypointPress(waypoint);
    }
    if (message.type === 'regionChanging' && message.bbox) {
      logMapRegionChanging(message.bbox);
    }
    if (message.type === 'regionChange' && message.bbox) {
      reportMapRegionChangeComplete(message.bbox, onRegionChange);
    }
    if (message.type === 'mapPress') {
      onMapPress?.();
    }
    if (
      message.type === 'mapLongPress' &&
      message.lng != null &&
      message.lat != null &&
      onMapLongPress
    ) {
      onMapLongPress({ latitude: message.lat, longitude: message.lng });
    }
  } catch {
    // Ignore malformed messages
  }
}

export default function FishingMapVector({
  latitude,
  longitude,
  userLatitude,
  userLongitude,
  nearbySpots,
  spotScores,
  onSpotPress,
  onRegionChange,
  recenterOnLocationChange = true,
  centerRequestKey = 0,
  selectedSpotId = null,
  flyToTarget = null,
  onMapPress,
  showLegend = true,
  legendTopOffset = 0,
  waypoints = [],
  onWaypointPress,
  onMapLongPress,
  mapLayers,
  radarTileUrl = null,
  biteHeatmapGeoJson = null,
}: FishingMapProps) {
  const { colors, isDark, isOutdoor } = useTheme();
  const mapThemeKey = isOutdoor ? 'outdoor' : isDark ? 'dark' : 'light';
  const webviewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const flyRetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasMountedRef = useRef(false);
  const pendingFlyRef = useRef<FlyToTarget | null>(null);
  const mapReadyRef = useRef(false);
  const onSpotPressRef = useRef(onSpotPress);
  const onRegionChangeRef = useRef(onRegionChange);
  const onMapPressRef = useRef(onMapPress);
  const onMapReadyRef = useRef<(() => void) | null>(null);
  const onMapLongPressRef = useRef(onMapLongPress);
  const onWaypointPressRef = useRef(onWaypointPress);
  const nearbySpotsRef = useRef(nearbySpots);
  const waypointsRef = useRef(waypoints);

  const initialHtml = useMemo(
    () =>
      buildMapLibreHtml(
        latitude,
        longitude,
        spotsToGeoJson(nearbySpots, spotScores),
        isDark,
        mapLayers?.community ?? false,
        isOutdoor
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, isOutdoor, mapLayers?.community]
  );

  const spotsGeoJson = useMemo(
    () => spotsToGeoJson(nearbySpots, spotScores),
    [nearbySpots, spotScores]
  );
  const spotsGeoJsonRef = useRef(spotsGeoJson);
  spotsGeoJsonRef.current = spotsGeoJson;

  const waypointsGeoJson = useMemo(() => waypointsToGeoJson(waypoints), [waypoints]);
  const waypointsGeoJsonRef = useRef(waypointsGeoJson);
  waypointsGeoJsonRef.current = waypointsGeoJson;

  const pushWaypointsToMap = useCallback(() => {
    postToMapView(webviewRef, iframeRef, {
      type: 'updateWaypoints',
      geojson: waypointsGeoJsonRef.current,
    });
  }, []);

  const pushMapLayersToMap = useCallback(() => {
    const emphasizeCommunity = mapLayers?.community ?? false;
    postToMapView(webviewRef, iframeRef, {
      type: 'updateMapLayers',
      config: {
        depth: mapLayers?.depth ?? false,
        radar: mapLayers?.radar ?? false,
        radarTileUrl: mapLayers?.radar ? (radarTileUrl ?? null) : null,
        communitySpotPaint: spotCirclePaintJson(isDark, emphasizeCommunity, isOutdoor),
        communityClusterPaint: clusterCirclePaintJson(isDark, emphasizeCommunity, isOutdoor),
      },
    });
  }, [mapLayers?.depth, mapLayers?.radar, mapLayers?.community, radarTileUrl, isDark, isOutdoor]);

  const pushSpotsToMap = useCallback(() => {
    postToMapView(webviewRef, iframeRef, {
      type: 'updateSpots',
      geojson: spotsGeoJsonRef.current,
    });
  }, []);

  const sendFlyTo = useCallback((command: { lng: number; lat: number; zoom?: number }) => {
    postToMapView(webviewRef, iframeRef, {
      type: 'flyToSpot',
      lng: command.lng,
      lat: command.lat,
      zoom: command.zoom ?? 14,
      duration: MAP_FLY_TO_DURATION_MS,
    });
  }, []);

  const performFlyTo = useCallback(
    (command: { lng: number; lat: number; zoom?: number }) => {
      pendingFlyRef.current = {
        lng: command.lng,
        lat: command.lat,
        key: Date.now(),
        zoom: command.zoom,
      };
      sendFlyTo(command);

      if (Platform.OS === 'web') return;

      for (const timer of flyRetryTimers.current) clearTimeout(timer);
      flyRetryTimers.current = [250, 600, 1200].map((delay) =>
        setTimeout(() => {
          if (pendingFlyRef.current) sendFlyTo(pendingFlyRef.current);
        }, delay)
      );
    },
    [sendFlyTo]
  );

  useEffect(
    () => () => {
      for (const timer of flyRetryTimers.current) clearTimeout(timer);
    },
    []
  );

  const pushHeatmapToMap = useCallback(() => {
    if (!mapLayers?.heatmap) {
      postToMapView(webviewRef, iframeRef, { type: 'updateHeatmap', geojson: null });
      return;
    }
    postToMapView(webviewRef, iframeRef, {
      type: 'updateHeatmap',
      geojson: biteHeatmapGeoJson ?? null,
    });
  }, [mapLayers?.heatmap, biteHeatmapGeoJson]);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    pushSpotsToMap();
    pushWaypointsToMap();
    pushMapLayersToMap();
    pushHeatmapToMap();
    if (pendingFlyRef.current) {
      sendFlyTo(pendingFlyRef.current);
    }
  }, [pushSpotsToMap, pushWaypointsToMap, pushMapLayersToMap, pushHeatmapToMap, sendFlyTo]);

  const notifyMapReady = useCallback(() => {
    handleMapReady();
  }, [handleMapReady]);

  onSpotPressRef.current = onSpotPress;
  onRegionChangeRef.current = onRegionChange;
  onMapPressRef.current = onMapPress;
  onMapLongPressRef.current = onMapLongPress;
  onWaypointPressRef.current = onWaypointPress;
  onMapReadyRef.current = notifyMapReady;
  nearbySpotsRef.current = nearbySpots;
  waypointsRef.current = waypoints;

  useEffect(() => {
    mapReadyRef.current = false;
  }, [isDark, isOutdoor]);

  useEffect(() => {
    pushSpotsToMap();
  }, [spotsGeoJson, pushSpotsToMap]);

  useEffect(() => {
    pushWaypointsToMap();
  }, [waypointsGeoJson, pushWaypointsToMap]);

  useEffect(() => {
    pushMapLayersToMap();
  }, [pushMapLayersToMap]);

  useEffect(() => {
    pushHeatmapToMap();
  }, [pushHeatmapToMap]);

  useEffect(() => {
    postToMapView(webviewRef, iframeRef, { type: 'setSelectedSpot', id: selectedSpotId });
  }, [selectedSpotId]);

  const markerLatitude = userLatitude ?? latitude;
  const markerLongitude = userLongitude ?? longitude;

  const pushUserMarker = useCallback(() => {
    postToMapView(webviewRef, iframeRef, {
      type: 'updateUser',
      lng: markerLongitude,
      lat: markerLatitude,
    });
  }, [markerLatitude, markerLongitude]);

  useEffect(() => {
    pushUserMarker();
  }, [pushUserMarker]);

  useEffect(() => {
    if (!flyToTarget) return;
    performFlyTo(toFlyCommand(flyToTarget));
    // Keyed on flyToTarget fields so camera moves only when the target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToTarget?.key, flyToTarget?.lat, flyToTarget?.lng, flyToTarget?.zoom, performFlyTo]);

  useEffect(() => {
    if (!recenterOnLocationChange) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      if (centerRequestKey === 0) return;
    }

    pushUserMarker();
    performFlyTo({ lng: longitude, lat: latitude, zoom: 13 });
  }, [
    latitude,
    longitude,
    recenterOnLocationChange,
    centerRequestKey,
    performFlyTo,
    pushUserMarker,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        handleMessage(
          event.data,
          nearbySpotsRef.current,
          waypointsRef.current,
          onSpotPressRef.current,
          onRegionChangeRef.current,
          onMapPressRef.current,
          () => onMapReadyRef.current?.(),
          onMapLongPressRef.current,
          onWaypointPressRef.current
        );
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={getMapContainerStyle(colors)}>
        <iframe
          key={mapThemeKey}
          ref={iframeRef}
          srcDoc={initialHtml}
          style={{ width: '100%', height: '100%', border: 0, display: 'block', flex: 1 }}
          title="Fishing map"
        />
        <MapLegend visible={showLegend} topOffset={legendTopOffset} />
      </View>
    );
  }

  return (
    <View style={getMapContainerStyle(colors)}>
      <WebView
        key={mapThemeKey}
        ref={webviewRef}
        source={{ html: initialHtml }}
        style={styles.webview}
        originWhitelist={['*']}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onMessage={(event) => {
          handleMessage(
            event.nativeEvent.data,
            nearbySpotsRef.current,
            waypointsRef.current,
            onSpotPressRef.current,
            onRegionChangeRef.current,
            onMapPressRef.current,
            () => onMapReadyRef.current?.(),
            onMapLongPressRef.current,
            onWaypointPressRef.current
          );
          try {
            const message = JSON.parse(event.nativeEvent.data) as MapMessage;
            if (message.type === 'regionChange') {
              pendingFlyRef.current = null;
            }
          } catch {
            // ignore
          }
        }}
        androidLayerType="hardware"
        mixedContentMode="always"
        onLoadEnd={() => {
          pushSpotsToMap();
          pushWaypointsToMap();
          pushMapLayersToMap();
          pushHeatmapToMap();
        }}
      />
      <MapLegend visible={showLegend} topOffset={legendTopOffset} />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    ...StyleSheet.absoluteFillObject,
  },
});
