import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Map, Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { spotsToGeoJson } from '@/components/map/spotsToGeoJson';
import { MapLegend, MAP_HEIGHT, mapContainerStyle } from '@/components/map/MapLegend';
import { FishingMapProps, VECTOR_STYLE_URL } from '@/components/map/types';

/**
 * Native vector map — MapLibre GL renders tiles and clustered pins on the GPU.
 * Requires a dev build (`npx expo prebuild && npx expo run:android|ios`).
 * This file uses the `.native` suffix so Metro never bundles it for web.
 */
export default function FishingMapMapLibreNative({
  latitude,
  longitude,
  nearbySpots,
  onSpotPress,
  onRegionChange,
}: FishingMapProps) {
  const spotsGeoJson = useMemo(() => spotsToGeoJson(nearbySpots), [nearbySpots]);

  const userGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [longitude, latitude] },
          properties: {},
        },
      ],
    }),
    [latitude, longitude]
  );

  return (
    <View style={mapContainerStyle}>
      <Map
        style={styles.map}
        mapStyle={VECTOR_STYLE_URL}
        onRegionDidChange={(event) => {
          // bounds is [west, south, east, north] — same order as our BBox
          const bounds = event.nativeEvent?.bounds;
          if (bounds && onRegionChange) onRegionChange(bounds);
        }}
      >
        <Camera
          initialViewState={{
            center: [longitude, latitude],
            zoom: 10,
          }}
        />

        <GeoJSONSource id="user-location" data={userGeoJson}>
          <Layer
            id="user-dot"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': '#ef4444',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>

        <GeoJSONSource
          id="fishing-spots"
          data={spotsGeoJson}
          cluster
          clusterRadius={50}
          clusterMaxZoom={14}
          onPress={(event) => {
            const feature = event.nativeEvent?.features?.[0];
            const spotId = feature?.properties?.id;
            if (!spotId || !onSpotPress) return;
            const spot = nearbySpots.find((s) => s.id === spotId);
            if (spot) onSpotPress(spot);
          }}
        >
          <Layer
            id="cluster-circles"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': '#111111',
              'circle-radius': ['step', ['get', 'point_count'], 18, 5, 22, 15, 28],
              'circle-opacity': 0.92,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-size': 12,
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="spot-circles"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': 10,
              'circle-color': ['case', ['==', ['get', 'isPeak'], 1], '#10b981', '#111111'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>
      </Map>
      <MapLegend />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    width: '100%',
    height: MAP_HEIGHT,
  },
});
