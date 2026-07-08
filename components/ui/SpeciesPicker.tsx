import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { Fish } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import speciesData from '@/data/species.json';
import { sortCatalogSpeciesByPreference } from '@/lib/species/spotLogSpecies';
import { getSpeciesImageUrl } from '@/utils/speciesLookup';

interface SpeciesPickerProps {
  value: string;
  onChange: (speciesName: string) => void;
  error?: string;
  label?: string;
  /** When set, the picker starts filtered to these spot-specific species. */
  speciesOptions?: string[];
  speciesOptionsHint?: string;
}

export default function SpeciesPicker({
  value,
  onChange,
  error,
  label = 'Fish Species',
  speciesOptions,
  speciesOptionsHint,
}: SpeciesPickerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const [showAllSpecies, setShowAllSpecies] = useState(false);
  const selectedImage = value ? getSpeciesImageUrl(value) : null;

  const hasSpotFilter = Boolean(speciesOptions && speciesOptions.length > 0);
  const usingSpotFilter = hasSpotFilter && !showAllSpecies;

  useEffect(() => {
    setShowAllSpecies(false);
  }, [speciesOptions]);

  const visibleSpecies = useMemo(() => {
    if (!usingSpotFilter || !speciesOptions) {
      return speciesData;
    }

    const allowed = new Set(speciesOptions);
    const filtered = speciesData.filter((species) => allowed.has(species.name));
    return sortCatalogSpeciesByPreference(filtered, speciesOptions);
  }, [speciesOptions, usingSpotFilter]);

  const pickerLabel = usingSpotFilter ? 'Species at this spot' : label;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{pickerLabel} *</Text>
      {usingSpotFilter && speciesOptionsHint ? (
        <Text style={styles.filterHint}>{speciesOptionsHint}</Text>
      ) : null}
      <TouchableOpacity
        style={[styles.dropdownButton, error ? styles.dropdownError : null]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        accessibilityRole="combobox"
        accessibilityLabel={pickerLabel}
        accessibilityState={{ expanded }}
        accessibilityHint="Opens species list"
      >
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={styles.selectedThumb} />
        ) : value ? (
          <View style={styles.selectedThumbPlaceholder}>
            <Fish color={colors.accent} size={16} />
          </View>
        ) : null}
        <Text style={value ? styles.dropdownText : styles.dropdownPlaceholder}>
          {value || 'Select species…'}
        </Text>
        <Text style={styles.dropdownArrow}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {expanded && (
        <View style={styles.dropdownPanel}>
          {hasSpotFilter ? (
            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() => setShowAllSpecies((current) => !current)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                usingSpotFilter ? 'Show all species in catalog' : 'Show only species at this spot'
              }
            >
              <Text style={styles.filterToggleText}>
                {usingSpotFilter ? 'Show all species' : 'Show species at this spot'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <ScrollView
            style={styles.dropdownList}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {visibleSpecies.map((species) => {
              const imageUrl = species.image ?? null;
              return (
                <TouchableOpacity
                  key={species.id}
                  style={[styles.dropdownItem, value === species.name && styles.dropdownItemSelected]}
                  onPress={() => {
                    onChange(species.name);
                    setExpanded(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: value === species.name }}
                >
                  <View style={styles.itemThumb}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.itemImage} />
                    ) : (
                      <Fish color={colors.accent} size={18} />
                    )}
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.dropdownItemText}>{species.name}</Text>
                    <Text style={styles.dropdownItemHabitat} numberOfLines={1}>
                      {species.habitat}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const THUMB_SIZE = 32;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.md,
    },
    label: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
      marginBottom: Spacing.xs,
    },
    filterHint: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      marginBottom: Spacing.xs,
    },
    dropdownButton: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    dropdownError: {
      borderColor: colors.error,
    },
    selectedThumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: BorderRadius.sm,
    },
    selectedThumbPlaceholder: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.accentDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdownText: {
      color: colors.text,
      fontSize: FontSizes.md,
      flex: 1,
    },
    dropdownPlaceholder: {
      color: colors.textMuted,
      fontSize: FontSizes.md,
      flex: 1,
    },
    dropdownArrow: {
      color: colors.accent,
      fontSize: FontSizes.sm,
    },
    dropdownPanel: {
      marginTop: Spacing.xs,
    },
    filterToggle: {
      alignSelf: 'flex-start',
      marginBottom: Spacing.xs,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.accentDark,
    },
    filterToggleText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    dropdownList: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      maxHeight: 240,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItemSelected: {
      backgroundColor: colors.cardLight,
    },
    itemThumb: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.accentDark,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    itemImage: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.sm,
    },
    itemText: {
      flex: 1,
    },
    dropdownItemText: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
    },
    dropdownItemHabitat: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: 2,
    },
    error: {
      color: colors.error,
      fontSize: FontSizes.sm,
      marginTop: Spacing.xs,
    },
  });
}
