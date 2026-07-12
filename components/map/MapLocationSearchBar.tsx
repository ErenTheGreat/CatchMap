import React, { useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, X, Waves } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useLocationSearch } from '@/hooks/useLocationSearch';
import type { LocationSearchResult } from '@/lib/types/mapCoordinates';
import { formatWaterTypeLabel } from '@/lib/types/fishingEngine';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

export interface MapLocationSearchBarHandle {
  dismiss: () => void;
  isFocused: () => boolean;
}

interface MapLocationSearchBarProps {
  onSelectLocation: (location: LocationSearchResult) => void;
  onDismiss?: () => void;
  /** When true, renders inline without absolute top positioning (for hero header). */
  embedded?: boolean;
  onFocusChange?: (focused: boolean) => void;
}

const MapLocationSearchBar = forwardRef<MapLocationSearchBarHandle, MapLocationSearchBarProps>(
  ({ onSelectLocation, onDismiss, embedded = false, onFocusChange }, ref) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const { results, isSearching, isFetched, error, hasQuery } = useLocationSearch(query);

    const showResults = focused && hasQuery;
    const showEmpty = showResults && isFetched && !isSearching && results.length === 0 && !error;

    const dismiss = useCallback(() => {
      setFocused(false);
      onFocusChange?.(false);
      Keyboard.dismiss();
      onDismiss?.();
    }, [onDismiss, onFocusChange]);

    useImperativeHandle(ref, () => ({ dismiss, isFocused: () => focused }), [dismiss, focused]);

    const handleFocus = useCallback(() => {
      setFocused(true);
      onFocusChange?.(true);
    }, [onFocusChange]);

    const handleBlur = useCallback(() => {
      setTimeout(() => {
        setFocused(false);
        onFocusChange?.(false);
      }, 150);
    }, [onFocusChange]);

    const handleSelect = useCallback(
      (location: LocationSearchResult) => {
        setQuery(location.name);
        dismiss();
        onSelectLocation(location);
      },
      [dismiss, onSelectLocation]
    );

    const handleSubmit = useCallback(() => {
      if (isSearching || results.length === 0) return;
      handleSelect(results[0]);
    }, [handleSelect, isSearching, results]);

    const handleClear = useCallback(() => {
      setQuery('');
      dismiss();
    }, [dismiss]);

    return (
      <View
        style={[
          styles.wrapper,
          embedded ? styles.wrapperEmbedded : { top: insets.top + Spacing.sm },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.searchContainer}>
          <Search color={colors.textMuted} size={18} />
          <TextInput
            style={styles.input}
            placeholder="Search lakes, rivers, bays…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
          />
          {isSearching && <ActivityIndicator color={colors.textMuted} size="small" />}
          {query.length > 0 && !isSearching && (
            <Pressable onPress={handleClear} hitSlop={8} accessibilityLabel="Clear search">
              <X color={colors.textMuted} size={18} />
            </Pressable>
          )}
        </View>

        {showResults && (
          <View style={styles.resultsPanel}>
            {error ? (
              <Text style={styles.errorText}>Search failed: {error.message}</Text>
            ) : showEmpty ? (
              <Text style={styles.emptyText}>No locations match “{query.trim()}”</Text>
            ) : results.length > 0 ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                style={styles.resultsScroll}
                showsVerticalScrollIndicator={false}
              >
                {results.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.resultRow,
                      pressed && styles.resultRowPressed,
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={styles.resultIcon}>
                      <MapPin color={colors.brandAccent} size={16} />
                    </View>
                    <View style={styles.resultBody}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.resultMeta}>
                        <Waves color={colors.textMuted} size={12} />
                        <Text style={styles.resultMetaText}>
                          {formatWaterTypeLabel(item.waterType)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.textMuted} size="small" />
                <Text style={styles.loadingText}>Searching…</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }
);

MapLocationSearchBar.displayName = 'MapLocationSearchBar';

export default MapLocationSearchBar;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: Spacing.sm,
      right: Spacing.sm,
      zIndex: 20,
    },
    wrapperEmbedded: {
      position: 'relative',
      left: 0,
      right: 0,
      zIndex: 0,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
    },
    input: {
      flex: 1,
      fontSize: FontSizes.md,
      color: colors.text,
      paddingVertical: 4,
    },
    resultsPanel: {
      marginTop: Spacing.xs,
      backgroundColor: colors.surfaceElevated,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 220,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 8,
    },
    resultsScroll: {
      maxHeight: 220,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    resultRowPressed: {
      backgroundColor: colors.cardLight,
    },
    resultIcon: {
      backgroundColor: colors.accentDark,
      padding: Spacing.xs,
      borderRadius: BorderRadius.md,
    },
    resultBody: {
      flex: 1,
    },
    resultName: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    resultMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    resultMetaText: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
    },
    emptyText: {
      padding: Spacing.md,
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    errorText: {
      padding: Spacing.md,
      fontSize: FontSizes.sm,
      color: colors.error,
      textAlign: 'center',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
    },
    loadingText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
  });
}
