import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Save, Info, MapPin } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { Button, SpeciesPicker, TextField } from '@/components/ui';
import PhotoPicker from '@/components/catch/PhotoPicker';
import CatchDateTimeField from '@/components/catch/CatchDateTimeField';
import speciesData from '@/data/species.json';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useUnits } from '@/providers/UnitsProvider';
import {
  type CatchLocation,
  formatCatchLocationLabel,
} from '@/utils/catchLocation';

export interface LogCatchFormValues {
  species: string;
  weight: string;
  length: string;
  lure: string;
  notes: string;
  photoUri: string | null;
  caughtAt: number;
}

export interface LogCatchFormProps {
  initialValues?: Partial<LogCatchFormValues>;
  location?: CatchLocation;
  speciesOptions?: string[];
  speciesOptionsHint?: string;
  onSubmit: (values: LogCatchFormValues) => void;
  saving?: boolean;
  showSaveButton?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

const EMPTY_VALUES: LogCatchFormValues = {
  species: '',
  weight: '',
  length: '',
  lure: '',
  notes: '',
  photoUri: null,
  caughtAt: 0,
};

function isWeightValid(weight: string): boolean {
  const trimmed = weight.trim();
  if (!trimmed) return false;
  return /\d/.test(trimmed);
}

export function isLogCatchFormDirty(
  values: LogCatchFormValues,
  initialValues: Partial<LogCatchFormValues> = {}
): boolean {
  const baseline = { ...EMPTY_VALUES, ...initialValues };
  return (
    values.species !== baseline.species ||
    values.weight !== baseline.weight ||
    values.length !== baseline.length ||
    values.lure !== baseline.lure ||
    values.notes !== baseline.notes ||
    (values.photoUri ?? null) !== (baseline.photoUri ?? null)
  );
}

export default function LogCatchForm({
  initialValues = {},
  location,
  speciesOptions,
  speciesOptionsHint,
  onSubmit,
  saving = false,
  showSaveButton = true,
  onDirtyChange,
}: LogCatchFormProps) {
  const { colors } = useTheme();
  const { weightUnit } = useUnits();
  const styles = useThemedStyles(createStyles);
  const locationLabel = useMemo(
    () => formatCatchLocationLabel(location ?? { latitude: null, longitude: null, locationName: null }),
    [location]
  );
  const [species, setSpecies] = useState(initialValues.species ?? '');
  const [weight, setWeight] = useState(initialValues.weight ?? '');
  const [length, setLength] = useState(initialValues.length ?? '');
  const [lure, setLure] = useState(initialValues.lure ?? '');
  const [notes, setNotes] = useState(initialValues.notes ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(initialValues.photoUri ?? null);
  const [caughtAt, setCaughtAt] = useState<number>(initialValues.caughtAt ?? Date.now());
  const [errors, setErrors] = useState<{ species?: string; weight?: string }>({});

  const values = useMemo(
    () => ({ species, weight, length, lure, notes, photoUri, caughtAt }),
    [species, weight, length, lure, notes, photoUri, caughtAt]
  );

  React.useEffect(() => {
    onDirtyChange?.(isLogCatchFormDirty(values, initialValues));
  }, [values, initialValues, onDirtyChange]);

  const selectedSpeciesData = speciesData.find((s) => s.name === species);

  const validate = (): boolean => {
    const nextErrors: { species?: string; weight?: string } = {};
    if (!species) nextErrors.species = 'Please select a species';
    if (!weight.trim()) nextErrors.weight = 'Please enter a weight';
    else if (!isWeightValid(weight)) nextErrors.weight = 'Enter a valid weight (e.g. 4.5 lbs)';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      species,
      weight: weight.trim(),
      length: length.trim(),
      lure: lure.trim(),
      notes: notes.trim(),
      photoUri,
      caughtAt,
    });
  };

  return (
    <View>
      <View
        style={[
          styles.locationBanner,
          locationLabel.hasLocation ? styles.locationBannerActive : styles.locationBannerMissing,
        ]}
        accessibilityRole="text"
        accessibilityLabel={
          locationLabel.hasLocation
            ? `Catch will be saved at ${locationLabel.title}${locationLabel.subtitle ? `, ${locationLabel.subtitle}` : ''}`
            : locationLabel.subtitle ?? locationLabel.title
        }
      >
        <MapPin
          color={locationLabel.hasLocation ? colors.accent : colors.warning}
          size={18}
        />
        <View style={styles.locationBannerText}>
          <Text style={styles.locationBannerTitle}>{locationLabel.title}</Text>
          {locationLabel.subtitle ? (
            <Text style={styles.locationBannerSubtitle}>{locationLabel.subtitle}</Text>
          ) : null}
        </View>
      </View>

      <SpeciesPicker
        value={species}
        onChange={(name) => {
          setSpecies(name);
          if (errors.species) setErrors((e) => ({ ...e, species: undefined }));
        }}
        error={errors.species}
        speciesOptions={speciesOptions}
        speciesOptionsHint={speciesOptionsHint}
      />

      {selectedSpeciesData && (
        <View style={styles.speciesCard}>
          <View style={styles.speciesCardHeader}>
            <Info color={colors.accent} size={18} />
            <Text style={styles.speciesCardTitle}>{selectedSpeciesData.name}</Text>
          </View>
          <Text style={styles.speciesScientific}>{selectedSpeciesData.scientificName}</Text>
          <View style={styles.speciesDetails}>
            <View style={styles.speciesDetailItem}>
              <Text style={styles.speciesDetailLabel}>Habitat</Text>
              <Text style={styles.speciesDetailValue}>{selectedSpeciesData.habitat}</Text>
            </View>
            <View style={styles.speciesDetailRow}>
              <View style={styles.speciesDetailItem}>
                <Text style={styles.speciesDetailLabel}>Avg. Weight</Text>
                <Text style={styles.speciesDetailValue}>{selectedSpeciesData.averageWeight}</Text>
              </View>
              <View style={styles.speciesDetailItem}>
                <Text style={styles.speciesDetailLabel}>Season</Text>
                <Text style={styles.speciesDetailValue}>{selectedSpeciesData.season}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <TextField
        label="Weight"
        required
        placeholder={weightUnit === 'kg' ? 'e.g., 2 kg' : 'e.g., 4.5 lbs'}
        value={weight}
        onChangeText={(text) => {
          setWeight(text);
          if (errors.weight) setErrors((e) => ({ ...e, weight: undefined }));
        }}
        keyboardType="decimal-pad"
        error={errors.weight}
      />

      <TextField
        label="Length"
        placeholder="e.g., 18 in"
        value={length}
        onChangeText={setLength}
      />

      <CatchDateTimeField value={caughtAt} onChange={setCaughtAt} />

      <TextField
        label="Lure Used"
        placeholder="e.g., Crankbait, Spinner..."
        value={lure}
        onChangeText={setLure}
      />

      {selectedSpeciesData && selectedSpeciesData.lures.length > 0 && (
        <View style={styles.lureSuggestions}>
          <Text style={styles.lureSuggestionTitle}>Suggestions:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedSpeciesData.lures.map((l, index) => (
              <TouchableOpacity
                key={index}
                style={styles.lureChip}
                onPress={() => setLure(l)}
                accessibilityRole="button"
                accessibilityLabel={`Use lure: ${l}`}
              >
                <Text style={styles.lureChipText}>{l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <TextField
        label="Notes"
        placeholder="Any details about your catch..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={styles.textArea}
      />

      <PhotoPicker value={photoUri} onChange={setPhotoUri} />

      {showSaveButton && (
        <Button
          title="Save Catch"
          onPress={handleSubmit}
          loading={saving}
          disabled={saving}
          icon={<Save color={colors.accentForeground} size={20} />}
          style={styles.saveButton}
          textStyle={styles.saveButtonText}
          accessibilityLabel="Save catch"
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    locationBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
    },
    locationBannerActive: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    locationBannerMissing: {
      backgroundColor: colors.warningSurface,
      borderColor: colors.toastWarning,
    },
    locationBannerText: {
      flex: 1,
      gap: 2,
    },
    locationBannerTitle: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    locationBannerSubtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
    },
    speciesCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    speciesCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    speciesCardTitle: {
      color: colors.accent,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.bold,
    },
    speciesScientific: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      fontStyle: 'italic',
      marginBottom: Spacing.sm,
    },
    speciesDetails: {
      gap: Spacing.sm,
    },
    speciesDetailRow: {
      flexDirection: 'row',
      gap: Spacing.lg,
    },
    speciesDetailItem: {
      marginBottom: Spacing.xs,
    },
    speciesDetailLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    speciesDetailValue: {
      color: colors.text,
      fontSize: FontSizes.sm,
      marginTop: Spacing.xs,
    },
    lureSuggestions: {
      marginTop: -Spacing.sm,
      marginBottom: Spacing.md,
    },
    lureSuggestionTitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginBottom: Spacing.xs,
    },
    lureChip: {
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      marginRight: Spacing.xs,
    },
    lureChipText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    textArea: {
      minHeight: 100,
    },
    saveButton: {
      marginTop: Spacing.md,
      marginBottom: Spacing.xl,
      paddingVertical: Spacing.lg,
    },
    saveButtonText: {
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.bold,
    },
  });
}
