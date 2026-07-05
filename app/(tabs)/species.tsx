import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Fish, MapPin, Calendar, ChevronRight } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights } from '@/constants/theme';
import speciesData from '@/data/species.json';

interface Species {
  id: string;
  name: string;
  scientificName: string;
  habitat: string;
  description: string;
  averageWeight: string;
  maxWeight: string;
  season: string;
  lures: string[];
  image: string;
}

export default function SpeciesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);

  const filteredSpecies = useMemo(() => {
    if (!searchQuery.trim()) return speciesData;
    const query = searchQuery.toLowerCase();
    return speciesData.filter(
      (species) =>
        species.name.toLowerCase().includes(query) ||
        species.habitat.toLowerCase().includes(query) ||
        species.scientificName.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Species Library</Text>
        <Text style={styles.headerSubtitle}>
          {speciesData.length} species in database
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search color={Colors.textMuted} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, habitat, or scientific name..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.listView} showsVerticalScrollIndicator={false}>
        {filteredSpecies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Fish color={Colors.textMuted} size={48} />
            <Text style={styles.emptyText}>No species found</Text>
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          </View>
        ) : (
          filteredSpecies.map((species) => (
            <TouchableOpacity
              key={species.id}
              style={[
                styles.speciesCard,
                selectedSpecies?.id === species.id && styles.speciesCardSelected,
              ]}
              onPress={() =>
                setSelectedSpecies(selectedSpecies?.id === species.id ? null : species)
              }
            >
              <View style={styles.speciesCardHeader}>
                <View style={styles.speciesIcon}>
                  <Fish color={Colors.accent} size={20} />
                </View>
                <View style={styles.speciesInfo}>
                  <Text style={styles.speciesName}>{species.name}</Text>
                  <Text style={styles.speciesScientific}>{species.scientificName}</Text>
                </View>
                <ChevronRight
                  color={selectedSpecies?.id === species.id ? Colors.accent : Colors.textMuted}
                  size={20}
                  style={{
                    transform: [{ rotate: selectedSpecies?.id === species.id ? '90deg' : '0deg' }],
                  }}
                />
              </View>

              <View style={styles.speciesQuickInfo}>
                <View style={styles.quickInfoItem}>
                  <MapPin color={Colors.textMuted} size={14} />
                  <Text style={styles.quickInfoText}>{species.habitat}</Text>
                </View>
                <View style={styles.quickInfoItem}>
                  <Calendar color={Colors.textMuted} size={14} />
                  <Text style={styles.quickInfoText}>{species.season}</Text>
                </View>
              </View>

              {selectedSpecies?.id === species.id && (
                <View style={styles.expandedContent}>
                  <Text style={styles.description}>{species.description}</Text>

                  <View style={styles.detailsGrid}>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>Average Weight</Text>
                      <Text style={styles.detailValue}>{species.averageWeight}</Text>
                    </View>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>Max Weight</Text>
                      <Text style={styles.detailValue}>{species.maxWeight}</Text>
                    </View>
                  </View>

                  <View style={styles.luresSection}>
                    <Text style={styles.luresTitle}>Recommended Lures</Text>
                    <View style={styles.luresList}>
                      {species.lures.map((lure, index) => (
                        <View key={index} style={styles.lureChip}>
                          <Text style={styles.lureChipText}>{lure}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
    marginLeft: Spacing.sm,
  },
  listView: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  speciesCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  speciesCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardLight,
  },
  speciesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  speciesIcon: {
    backgroundColor: Colors.accentDark,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  speciesInfo: {
    flex: 1,
  },
  speciesName: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
  },
  speciesScientific: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  speciesQuickInfo: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  quickInfoText: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
  },
  expandedContent: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: FontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.xs,
  },
  luresSection: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  luresTitle: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.sm,
  },
  luresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  lureChip: {
    backgroundColor: Colors.accentDark,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  lureChipText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.medium,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
  },
  bottomPadding: {
    height: Spacing.xxl,
  },
});
