import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  RasterSource,
  type CameraRef,
  type GeoJSONSourceRef,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import FishingMapVector from '@/components/map/FishingMapVector';
import { spotsToGeoJson } from '@/components/map/spotsToGeoJson';
import { waypointsToGeoJson } from '@/components/map/waypointsToGeoJson';
import { MapLegend, getMapContainerStyle } from '@/components/map/MapLegend';
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_PROPERTIES,
  CLUSTER_RADIUS,
  getClusterStyles,
  getWaypointPinColorExpression,
} from '@/components/map/clusterLayerStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { FishingMapProps, getVectorStyleUrl, MAP_FLY_TO_DURATION_MS } from '@/components/map/types';
import { toFlyCommand } from '@/components/map/mapFly';
import {
  logMapRegionChanging,
  reportMapRegionChangeComplete,
} from '@/lib/mapViewport';
import {
  DEPTH_MAX_ZOOM,
  DEPTH_MIN_ZOOM,
  DEPTH_TILE_URL,
  RADAR_TILE_MAX_ZOOM,
} from '@/lib/mapLayers/config';

export default function FishingMapMapLibreNative({
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
  const {
    clusterCirclePaint,
    clusterCountLayout,
    clusterCountPaint,
    spotCirclePaint,
    selectedSpotCirclePaint,
  } = useMemo(
    () => getClusterStyles(isDark, mapLayers?.community ?? false, isOutdoor),
    [isDark, isOutdoor, mapLayers?.community]
  );
  const mapStyleUrl = useMemo(() => getVectorStyleUrl(isDark, isOutdoor), [isDark, isOutdoor]);
  const [mapStyleFailed, setMapStyleFailed] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const mapReadyRef = useRef(false);
  const pendingFlyRef = useRef<{ lng: number; lat: number; zoom?: number } | null>(null);
  const spotsSourceRef = useRef<GeoJSONSourceRef>(null);
  const recentNativeTapRef = useRef(false);
  const nativeTapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRegionChangeRef = useRef(onRegionChange);
  onRegionChangeRef.current = onRegionChange;

  const emitRegionChangeComplete = useCallback((raw: unknown) => {
    reportMapRegionChangeComplete(raw, onRegionChangeRef.current);
  }, []);

  const reportInitialViewport = useCallback(async () => {
    try {
      const bounds = await mapRef.current?.getBounds();
      emitRegionChangeComplete(bounds);
    } catch (error) {
      if (__DEV__) console.error('[FishingMap] getBounds after map load failed:', error);
    }
  }, [emitRegionChangeComplete]);

  const spotsGeoJson = useMemo(
    () => spotsToGeoJson(nearbySpots, spotScores),
    [nearbySpots, spotScores]
  );

  const waypointsGeoJson = useMemo(() => waypointsToGeoJson(waypoints), [waypoints]);

  const performFlyTo = useCallback((command: { lng: number; lat: number; zoom?: number }) => {
    pendingFlyRef.current = command;

    const run = () => {
      try {
        cameraRef.current?.easeTo({
          center: [command.lng, command.lat],
          zoom: command.zoom ?? 14,
          duration: MAP_FLY_TO_DURATION_MS,
          easing: 'ease',
        });
      } catch (error) {
        if (__DEV__) console.warn('[FishingMap] easeTo failed:', error);
        return false;
      }
      return true;
    };

    if (!mapReadyRef.current) return;

    if (!run() && Platform.OS === 'android') {
      setTimeout(run, 150);
      setTimeout(run, 400);
    }
  }, []);

  const flushPendingFly = useCallback(() => {
    if (!pendingFlyRef.current) return;
    const command = pendingFlyRef.current;
    pendingFlyRef.current = null;
    performFlyTo(command);
  }, [performFlyTo]);

  const markerLatitude = userLatitude ?? latitude;
  const markerLongitude = userLongitude ?? longitude;

  const userGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [markerLongitude, markerLatitude] },
          properties: {},
        },
      ],
    }),
    [markerLatitude, markerLongitude]
  );

  useEffect(() => {
    if (!recenterOnLocationChange) return;
    performFlyTo({ lng: longitude, lat: latitude, zoom: 13 });
  }, [latitude, longitude, recenterOnLocationChange, centerRequestKey, performFlyTo]);

  useEffect(() => {
    if (!flyToTarget) return;
    performFlyTo(toFlyCommand(flyToTarget));
    // Keyed on flyToTarget fields so camera moves only when the target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToTarget?.key, flyToTarget?.lat, flyToTarget?.lng, flyToTarget?.zoom, performFlyTo]);

  const handleSpotsPress = useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof GeoJSONSource>['onPress']>>[0]) => {
      const feature = event.nativeEvent?.features?.[0];
      if (!feature?.properties) return;

      const props = feature.properties as Record<string, unknown>;
      const pointCount = props.point_count;
      if (typeof pointCount === 'number' && pointCount > 0) {
        const clusterId = props.cluster_id;
        if (typeof clusterId !== 'number') return;
        const coords = (feature.geometry as { coordinates?: [number, number] })?.coordinates;
        void spotsSourceRef.current?.getClusterExpansionZoom(clusterId).then((expansionZoom) => {
          if (expansionZoom != null && coords) {
            cameraRef.current?.flyTo({
              center: coords,
              zoom: expansionZoom,
              duration: 500,
            });
          }
        });
        return;
      }

      const spotId = props.id;
      if (typeof spotId !== 'string' || !onSpotPress) return;
      const spot = nearbySpots.find((s) => s.id === spotId);
      if (spot) onSpotPress(spot);
    },
    [nearbySpots, onSpotPress]
  );

  const handleWaypointPress = useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof GeoJSONSource>['onPress']>>[0]) => {
      const feature = event.nativeEvent?.features?.[0];
      const waypointId = feature?.properties?.id;
      if (typeof waypointId !== 'string' || !onWaypointPress) return;
      const waypoint = waypoints.find((item) => item.id === waypointId);
      if (waypoint) onWaypointPress(waypoint);
    },
    [onWaypointPress, waypoints]
  );

  const selectedSpotFilter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], string]] | ['==', ['get', 'id'], ''] =
    selectedSpotId
      ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], selectedSpotId]]
      : ['==', ['get', 'id'], ''];

  const fallbackProps: FishingMapProps = {
    latitude,
    longitude,
    userLatitude,
    userLongitude,
    nearbySpots,
    spotScores,
    onSpotPress,
    onRegionChange,
    recenterOnLocationChange,
    centerRequestKey,
    selectedSpotId,
    flyToTarget,
    onMapPress,
    showLegend,
    legendTopOffset,
    waypoints,
    onWaypointPress,
    onMapLongPress,
    mapLayers,
    radarTileUrl,
    biteHeatmapGeoJson,
  };

  if (mapStyleFailed) {
    return <FishingMapVector {...fallbackProps} />;
  }

  return (
    <View style={getMapContainerStyle(colors)}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyleUrl}
        onDidFailLoadingMap={() => setMapStyleFailed(true)}
        onDidFinishLoadingMap={() => {
          mapReadyRef.current = true;
          void reportInitialViewport();
          flushPendingFly();
          setTimeout(() => flushPendingFly(), 200);
          setTimeout(() => flushPendingFly(), 600);
        }}
        onRegionIsChanging={(event) => {
          logMapRegionChanging(event.nativeEvent?.bounds);
        }}
        onRegionDidChange={(event) => {
          emitRegionChangeComplete(event.nativeEvent?.bounds);
        }}
        onPress={() => {
          recentNativeTapRef.current = true;
          if (nativeTapResetTimerRef.current) clearTimeout(nativeTapResetTimerRef.current);
          nativeTapResetTimerRef.current = setTimeout(() => {
            recentNativeTapRef.current = false;
          }, 500);
          onMapPress?.();
        }}
        onLongPress={(event) => {
          if (recentNativeTapRef.current) return;
          const lngLat = event.nativeEvent?.lngLat;
          if (!lngLat || !onMapLongPress) return;
          onMapLongPress({ latitude: lngLat[1], longitude: lngLat[0] });
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [longitude, latitude],
            zoom: 13,
          }}
        />

        {mapLayers?.depth ? (
          <RasterSource
            id="depth-source"
            tiles={[DEPTH_TILE_URL]}
            tileSize={256}
            minzoom={DEPTH_MIN_ZOOM}
            maxzoom={DEPTH_MAX_ZOOM}
          >
            <Layer
              id="depth-layer"
              type="raster"
              minzoom={DEPTH_MIN_ZOOM}
              maxzoom={DEPTH_MAX_ZOOM}
              paint={{ 'raster-opacity': 0.55 }}
            />
          </RasterSource>
        ) : null}

        {mapLayers?.radar && radarTileUrl ? (
          <RasterSource
            id="radar-source"
            tiles={[radarTileUrl]}
            tileSize={256}
            maxzoom={RADAR_TILE_MAX_ZOOM}
          >
            <Layer
              id="radar-layer"
              type="raster"
              paint={{ 'raster-opacity': 0.75 }}
            />
          </RasterSource>
        ) : null}

        {mapLayers?.heatmap && biteHeatmapGeoJson ? (
          <GeoJSONSource id="bite-heatmap" data={biteHeatmapGeoJson}>
            <Layer
              id="heatmap-circles"
              type="circle"
              style={{
                circleRadius: 22,
                circleColor: [
                  'interpolate',
                  ['linear'],
                  ['get', 'score'],
                  1,
                  '#94a3b8',
                  3,
                  '#f59e0b',
                  5,
                  '#10b981',
                  6,
                  '#059669',
                ],
                circleOpacity: ['get', 'opacity'],
                circleBlur: 0.6,
              }}
            />
          </GeoJSONSource>
        ) : null}

        <GeoJSONSource id="user-location" data={userGeoJson}>
          <Layer
            id="user-dot"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': '#ef4444',
              'circle-stroke-width': 3,
              'circle-stroke-color': colors.mapPinBorder,
            }}
          />
        </GeoJSONSource>

        <GeoJSONSource
          ref={spotsSourceRef}
          id="fishing-spots"
          data={spotsGeoJson}
          cluster
          clusterRadius={CLUSTER_RADIUS}
          clusterMaxZoom={CLUSTER_MAX_ZOOM}
          clusterProperties={CLUSTER_PROPERTIES as never}
          onPress={handleSpotsPress}
        >
          <Layer
            id="cluster-circles"
            type="circle"
            filter={['has', 'point_count']}
            paint={clusterCirclePaint as never}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={clusterCountLayout as never}
            paint={clusterCountPaint}
          />
          <Layer
            id="spot-circles"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={spotCirclePaint as never}
          />
          {selectedSpotId ? (
            <Layer
              id="spot-selected"
              type="circle"
              filter={selectedSpotFilter}
              paint={selectedSpotCirclePaint}
            />
          ) : null}
        </GeoJSONSource>

        {waypoints.length > 0 ? (
          <GeoJSONSource id="waypoints" data={waypointsGeoJson} onPress={handleWaypointPress}>
            <Layer
              id="waypoint-circles"
              type="circle"
              paint={{
                'circle-radius': 11,
                'circle-color': getWaypointPinColorExpression(),
                'circle-stroke-width': 2,
                'circle-stroke-color': colors.mapPinBorder,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
      <MapLegend visible={showLegend} topOffset={legendTopOffset} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
