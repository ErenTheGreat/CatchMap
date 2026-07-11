import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Save, Info, MapPin, Users, Sparkles } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { Button, SpeciesPicker, TextField } from '@/components/ui';
import PhotoPicker from '@/components/catch/PhotoPicker';
import CatchDateTimeField from '@/components/catch/CatchDateTimeField';
import CatchRegulationCard from '@/components/catch/CatchRegulationCard';
import { isCloudSyncFeatureAvailable, isSpeciesIdEnabled, isCatchAiChatEnabled } from '@/constants/features';
import speciesData from '@/data/species.json';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useUnits } from '@/providers/UnitsProvider';
import { getCatchRegulationCheck } from '@/utils/fishingRegulations';
import {
  type CatchLocation,
  formatCatchLocationLabel,
} from '@/utils/catchLocation';
import {
  identifySpeciesFromPhoto,
  type SpeciesIdentificationFailure,
  type SpeciesIdentificationResult,
} from '@/lib/species/identifySpeciesFromPhoto';
import { suggestSpeciesFromContext } from '@/lib/species/suggestSpeciesFromContext';
import { useCatches } from '@/hooks/useCatches';
import CatchCoachCard from '@/components/coach/CatchCoachCard';
import VoiceCatchInput from '@/components/catch/VoiceCatchInput';
import type { ParsedVoiceCatch } from '@/utils/voiceCatchParser';
import {
  useCatchCoachAdvice,
  type CatchCoachContext,
} from '@/hooks/useCatchCoachAdvice';
import type { CatchCoachAdvice } from '@/lib/types/catchCoach';

export interface LogCatchFormValues {
  species: string;
  weight: string;
  length: string;
  lure: string;
  notes: string;
  photoUri: string | null;
  caughtAt: number;
  /** Opt-in: contribute this catch anonymously to community bite data. */
  sharedAnonymously: boolean;
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
  /** Optional richer context from map modal (prediction, community, etc.). */
  coachContext?: CatchCoachContext;
}

const EMPTY_VALUES: LogCatchFormValues = {
  species: '',
  weight: '',
  length: '',
  lure: '',
  notes: '',
  photoUri: null,
  caughtAt: 0,
  sharedAnonymously: false,
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
    (values.photoUri ?? null) !== (baseline.photoUri ?? null) ||
    values.sharedAnonymously !== baseline.sharedAnonymously
  );
}

const EMPTY_INITIAL_VALUES: Partial<LogCatchFormValues> = {};

function getSpeciesIdFailureMessage(failure: SpeciesIdentificationFailure): string {
  switch (failure) {
    case 'not_pro':
      return 'CatchMap Pro is required for photo species identification.';
    case 'quota_exceeded':
      return 'Daily AI budget reached. Pick a species below or try again tomorrow.';
    case 'image_unreadable':
      return 'Could not read the photo file. Try choosing the image again.';
    case 'no_match':
      return 'Catch AI could not identify this fish — select manually below.';
    case 'aborted':
      return '';
    case 'server_unavailable':
    default:
      return 'Photo identification failed — select species manually below.';
  }
}

export default function LogCatchForm({
  initialValues = EMPTY_INITIAL_VALUES,
  location,
  speciesOptions,
  speciesOptionsHint,
  onSubmit,
  saving = false,
  showSaveButton = true,
  onDirtyChange,
  coachContext,
}: LogCatchFormProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { weightUnit } = useUnits();
  const { data: catches = [] } = useCatches();
  const styles = useThemedStyles(createStyles);
  const baselineValues = useMemo(
    () => ({ ...EMPTY_VALUES, ...initialValues }),
    [initialValues]
  );
  const locationLabel = useMemo(
    () => formatCatchLocationLabel(location ?? { latitude: null, longitude: null, locationName: null }),
    [location]
  );
  const [species, setSpecies] = useState(baselineValues.species);
  const [weight, setWeight] = useState(baselineValues.weight);
  const [length, setLength] = useState(baselineValues.length);
  const [lure, setLure] = useState(baselineValues.lure);
  const [notes, setNotes] = useState(baselineValues.notes);
  const [photoUri, setPhotoUri] = useState<string | null>(baselineValues.photoUri);
  const [caughtAt, setCaughtAt] = useState<number>(
    baselineValues.caughtAt || Date.now()
  );
  const [sharedAnonymously, setSharedAnonymously] = useState<boolean>(
    baselineValues.sharedAnonymously
  );
  const [errors, setErrors] = useState<{ species?: string; weight?: string }>({});
  const [speciesSuggestion, setSpeciesSuggestion] = useState<SpeciesIdentificationResult | null>(null);
  const [identifyingSpecies, setIdentifyingSpecies] = useState(false);
  const [speciesIdFailure, setSpeciesIdFailure] = useState<SpeciesIdentificationFailure | null>(null);
  const [speciesIdWarning, setSpeciesIdWarning] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const speciesManuallySetRef = useRef(Boolean(baselineValues.species));

  const values = useMemo(
    () => ({ species, weight, length, lure, notes, photoUri, caughtAt, sharedAnonymously }),
    [species, weight, length, lure, notes, photoUri, caughtAt, sharedAnonymously]
  );

  const contextSuggestions = useMemo(
    () =>
      suggestSpeciesFromContext({
        latitude: location?.latitude,
        longitude: location?.longitude,
        waterType: location?.waterType ?? null,
        speciesOptions,
        recentCatches: catches,
        limit: 5,
      }),
    [location?.latitude, location?.longitude, location?.waterType, speciesOptions, catches]
  );

  useEffect(() => {
    if (!onDirtyChange) return;

    const isDirty = isLogCatchFormDirty(values, baselineValues);
    if (dirtyRef.current === isDirty) return;

    dirtyRef.current = isDirty;
    onDirtyChange(isDirty);
  }, [values, baselineValues, onDirtyChange]);

  useEffect(() => {
    if (!photoUri) {
      setSpeciesSuggestion(null);
      setSpeciesIdFailure(null);
      return;
    }

    const controller = new AbortController();
    setIdentifyingSpecies(true);
    setSpeciesIdFailure(null);
    setSpeciesIdWarning(null);
    void identifySpeciesFromPhoto(photoUri, controller.signal)
      .then(({ result, failure, warning }) => {
        if (controller.signal.aborted) return;
        setSpeciesSuggestion(result);
        setSpeciesIdFailure(result ? null : (failure ?? null));
        setSpeciesIdWarning(warning ?? null);
        if (result && !speciesManuallySetRef.current) {
          setSpecies(result.speciesName);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIdentifyingSpecies(false);
        }
      });

    return () => controller.abort();
  }, [photoUri]);

  const selectedSpeciesData = speciesData.find((s) => s.name === species);

  const { advice: coachAdvice, isLoading: coachLoading } = useCatchCoachAdvice({
    species,
    latitude: location?.latitude,
    longitude: location?.longitude,
    locationName: location?.locationName,
    context: coachContext,
  });

  const handleApplyCoachSetup = (advice: CatchCoachAdvice) => {
    setLure(advice.setup.lureLabel);
    const noteParts = [advice.setup.tip, advice.technique].filter(Boolean);
    if (noteParts.length > 0) {
      const coachNote = noteParts.join(' ');
      setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${coachNote}` : coachNote));
    }
  };

  const regulationCheck = useMemo(
    () =>
      getCatchRegulationCheck({
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        speciesName: species,
        waterType: location?.waterType ?? null,
        length,
      }),
    [location?.latitude, location?.longitude, location?.waterType, species, length]
  );

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
      sharedAnonymously,
    });
  };

  const handleVoiceParsed = (parsed: ParsedVoiceCatch) => {
    if (parsed.species) {
      speciesManuallySetRef.current = true;
      setSpecies(parsed.species);
    }
    if (parsed.weight) setWeight(parsed.weight);
    if (parsed.length) setLength(parsed.length);
    if (parsed.lure) setLure(parsed.lure);
    if (parsed.notes) setNotes((prev) => (prev ? `${prev}\n${parsed.notes}` : parsed.notes!));
  };

  return (
    <View>
      <VoiceCatchInput onParsed={handleVoiceParsed} />

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
          speciesManuallySetRef.current = true;
          setSpecies(name);
          if (errors.species) setErrors((e) => ({ ...e, species: undefined }));
        }}
        error={errors.species}
        speciesOptions={speciesOptions}
        speciesOptionsHint={speciesOptionsHint}
      />

      {contextSuggestions.length > 0 && !species ? (
        <View style={styles.suggestionSection}>
          <Text style={styles.suggestionTitle}>Likely species here</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {contextSuggestions.map((s) => (
              <TouchableOpacity
                key={s.name}
                style={styles.contextChip}
                onPress={() => {
                  speciesManuallySetRef.current = true;
                  setSpecies(s.name);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${s.name}`}
              >
                <Text style={styles.contextChipText}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {identifyingSpecies ? (
        <View style={styles.speciesIdRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.speciesIdText}>Catch AI is identifying your fish…</Text>
        </View>
      ) : null}

      {speciesIdWarning && !identifyingSpecies ? (
        <Text style={styles.speciesIdHint}>{speciesIdWarning}</Text>
      ) : null}

      {speciesIdFailure && !identifyingSpecies ? (
        <Text style={styles.speciesIdFailedText}>
          {getSpeciesIdFailureMessage(speciesIdFailure)}
        </Text>
      ) : null}

      {speciesSuggestion && speciesSuggestion.speciesName !== species ? (
        <TouchableOpacity
          style={styles.speciesSuggestionChip}
          onPress={() => {
            setSpecies(speciesSuggestion.speciesName);
            speciesManuallySetRef.current = true;
          }}
          accessibilityRole="button"
          accessibilityLabel={`Use suggested species ${speciesSuggestion.speciesName}`}
        >
          <Sparkles color={colors.accent} size={14} />
          <Text style={styles.speciesSuggestionText}>
            {speciesSuggestion.provisional
              ? `Looks like ${speciesSuggestion.speciesName} (unverified) — tap to use`
              : `Looks like ${speciesSuggestion.speciesName} — tap to use`}
          </Text>
        </TouchableOpacity>
      ) : null}

      {coachAdvice || coachLoading ? (
        <CatchCoachCard
          advice={coachAdvice}
          loading={coachLoading}
          onApplySetup={handleApplyCoachSetup}
          coachContext={{
            latitude: location?.latitude,
            longitude: location?.longitude,
            locationName: location?.locationName,
            waterType: location?.waterType,
            speciesName: species,
          }}
          onAskCatchAi={
            isCatchAiChatEnabled()
              ? () => router.push('/assistant')
              : undefined
          }
        />
      ) : selectedSpeciesData ? (
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
      ) : null}

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

      {species ? <CatchRegulationCard check={regulationCheck} /> : null}

      <CatchDateTimeField value={caughtAt} onChange={setCaughtAt} />

      <TextField
        label="Lure Used"
        placeholder="e.g., Crankbait, Spinner..."
        value={lure}
        onChangeText={setLure}
      />

      {!coachAdvice && !coachLoading && selectedSpeciesData && selectedSpeciesData.lures.length > 0 ? (
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
      ) : null}

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

      {isSpeciesIdEnabled() && !photoUri ? (
        <Text style={styles.speciesIdHint}>
          Add a catch photo for Catch AI species ID (uses your free Google API key), or pick from
          likely species above.
        </Text>
      ) : null}

      {isCloudSyncFeatureAvailable() ? (
        <View style={styles.shareCard}>
          <Users color={colors.accent} size={18} />
          <View style={styles.shareTextBlock}>
            <Text style={styles.shareTitle}>Help anglers in your area</Text>
            <Text style={styles.shareSubtitle}>
              Share this catch anonymously to improve local bite intel. Only species, timing, and
              lure feed community stats — never your name or exact GPS. Smarter spots without
              selling your secret hole.
            </Text>
          </View>
          <Switch
            value={sharedAnonymously}
            onValueChange={setSharedAnonymously}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.card}
            accessibilityRole="switch"
            accessibilityLabel="Share this catch anonymously to help nearby anglers"
          />
        </View>
      ) : null}

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
    speciesIdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    speciesIdText: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
    },
    speciesIdFailedText: {
      color: colors.warning,
      fontSize: FontSizes.sm,
      marginBottom: Spacing.sm,
    },
    speciesSuggestionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      alignSelf: 'flex-start',
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    speciesSuggestionText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    speciesIdHint: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      lineHeight: 18,
      marginTop: -Spacing.xs,
      marginBottom: Spacing.sm,
    },
    suggestionSection: {
      marginBottom: Spacing.sm,
    },
    suggestionTitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      marginBottom: Spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    contextChip: {
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      marginRight: Spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contextChipText: {
      color: colors.text,
      fontSize: FontSizes.sm,
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
    shareCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    shareTextBlock: {
      flex: 1,
      gap: 2,
    },
    shareTitle: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    shareSubtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      lineHeight: 16,
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
