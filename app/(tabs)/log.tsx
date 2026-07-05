import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fish, Save, Info, Trophy, Clock } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights } from '@/constants/theme';
import { getSpeciesRecommendations, getTimeOfDayRecommendation, getMonthName, getCurrentMonth } from '@/utils/recommendations';
import speciesData from '@/data/species.json';
import { useSaveCatch } from '@/hooks/useCatches';

export default function LogScreen() {
  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [weight, setWeight] = useState('');
  const [lure, setLure] = useState('');
  const [notes, setNotes] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const saveCatchMutation = useSaveCatch();
  const saving = saveCatchMutation.isPending;

  const recommendations = useMemo(() => getSpeciesRecommendations(null, null), []);
  const timeOfDay = useMemo(() => getTimeOfDayRecommendation(), []);

  const selectedSpeciesData = speciesData.find(s => s.name === selectedSpecies);

  const handleSaveCatch = () => {
    if (!selectedSpecies || !weight) {
      Alert.alert('Missing Information', 'Please select a species and enter a weight.');
      return;
    }

    saveCatchMutation.mutate(
      {
        species: selectedSpecies,
        speciesId: selectedSpeciesData?.id || '',
        weight,
        lure,
        notes,
        latitude: null,
        longitude: null,
        date: new Date().toLocaleDateString(),
      },
      {
        onSuccess: () => {
          setSelectedSpecies('');
          setWeight('');
          setLure('');
          setNotes('');
          Alert.alert('Success', 'Catch logged successfully!');
        },
        onError: () => {
          Alert.alert('Error', 'Failed to save catch. Please try again.');
        },
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Fish color={Colors.accent} size={28} />
            <Text style={styles.headerTitle}>Log Your Catch</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Record your fishing details for future reference
          </Text>

          <View style={styles.timeCard}>
            <View style={styles.timeHeader}>
              <Clock color={Colors.accent} size={18} />
              <Text style={styles.timeTitle}>Best Time Now: {timeOfDay.period}</Text>
            </View>
            <Text style={styles.timeTip}>{timeOfDay.tip}</Text>
          </View>

          <View style={styles.recommendationSection}>
            <View style={styles.recommendationHeader}>
              <Trophy color={Colors.warning} size={18} />
              <Text style={styles.recommendationTitle}>Top Catches for {getMonthName(getCurrentMonth())}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recommendationScroll}>
              {recommendations.map((rec) => (
                <TouchableOpacity
                  key={rec.id}
                  style={[styles.quickRecCard, rec.isPeak && styles.peakCard]}
                  onPress={() => {
                    setSelectedSpecies(rec.name);
                    setLure(rec.recommendedLure);
                  }}
                >
                  {rec.isPeak && (
                    <View style={styles.peakBadge}>
                      <Trophy color={Colors.background} size={10} />
                      <Text style={styles.peakText}>PEAK</Text>
                    </View>
                  )}
                  <Fish color={Colors.accent} size={24} />
                  <Text style={styles.quickRecName} numberOfLines={1}>{rec.name}</Text>
                  <Text style={styles.quickRecWeight}>{rec.averageWeight}</Text>
                  <View style={styles.quickRecLure}>
                    <Text style={styles.quickRecLureText} numberOfLines={1}>{rec.recommendedLure}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Fish Species *</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowDropdown(!showDropdown)}
            >
              <Text style={selectedSpecies ? styles.dropdownText : styles.dropdownPlaceholder}>
                {selectedSpecies || 'Select species...'}
              </Text>
              <Text style={styles.dropdownArrow}>{showDropdown ? 'v' : '^'}</Text>
            </TouchableOpacity>
            {showDropdown && (
              <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator>
                {speciesData.map((species) => (
                  <TouchableOpacity
                    key={species.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedSpecies(species.name);
                      setShowDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{species.name}</Text>
                    <Text style={styles.dropdownItemHabitat}>{species.habitat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {selectedSpeciesData && (
            <View style={styles.speciesCard}>
              <View style={styles.speciesCardHeader}>
                <Info color={Colors.accent} size={18} />
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
                <View style={styles.speciesDetailItem}>
                  <Text style={styles.speciesDetailLabel}>Recommended Lures</Text>
                  <Text style={styles.speciesDetailValue}>
                    {selectedSpeciesData.lures.join(', ')}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.formRow}>
            <View style={styles.formGroupHalf}>
              <Text style={styles.label}>Weight *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 4.5 lbs"
                placeholderTextColor={Colors.textMuted}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Lure Used</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Crankbait, Spinner..."
              placeholderTextColor={Colors.textMuted}
              value={lure}
              onChangeText={setLure}
            />
            {selectedSpeciesData && selectedSpeciesData.lures.length > 0 && (
              <View style={styles.lureSuggestions}>
                <Text style={styles.lureSuggestionTitle}>Suggestions: </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedSpeciesData.lures.map((l, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.lureChip}
                      onPress={() => setLure(l)}
                    >
                      <Text style={styles.lureChipText}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any details about your catch..."
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveCatch}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <>
                <Save color={Colors.background} size={22} />
                <Text style={styles.saveButtonText}>Save Catch</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginBottom: Spacing.sm,
  },
  timeCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  timeTitle: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  timeTip: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  recommendationSection: {
    marginBottom: Spacing.lg,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  recommendationTitle: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  recommendationScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  quickRecCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: 120,
    alignItems: 'center',
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  peakCard: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardLight,
  },
  peakBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  peakText: {
    color: Colors.background,
    fontSize: 8,
    fontWeight: FontWeights.bold,
  },
  quickRecName: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  quickRecWeight: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  quickRecLure: {
    backgroundColor: Colors.accentDark,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
    width: '100%',
  },
  quickRecLureText: {
    color: Colors.accent,
    fontSize: FontSizes.xs,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  formGroupHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  label: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSizes.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 100,
  },
  dropdownButton: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    color: Colors.text,
    fontSize: FontSizes.md,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: Colors.textMuted,
    fontSize: FontSizes.md,
    flex: 1,
  },
  dropdownArrow: {
    color: Colors.accent,
    fontSize: FontSizes.lg,
  },
  dropdownList: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemText: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
  },
  dropdownItemHabitat: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  speciesCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  speciesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  speciesCardTitle: {
    color: Colors.accent,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  speciesScientific: {
    color: Colors.textSecondary,
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
    color: Colors.textMuted,
    fontSize: FontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speciesDetailValue: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  lureSuggestions: {
    marginTop: Spacing.sm,
  },
  lureSuggestionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  lureChip: {
    backgroundColor: Colors.accentDark,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  lureChipText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.background,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
});
