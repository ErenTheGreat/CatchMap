import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fish, MapPin, Calendar } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import speciesData from '@/data/species.json';
import {
  EmptyState,
  ThemeToggleButton,
  SettingsButton,
  ResponsiveScreen,
  AppScreenHeader,
  SearchField,
  ThemedText,
  FadeInView,
  ScalePressable,
  CollapsibleContent,
  AnimatedChevron,
} from '@/components/ui';
import RigListSection from '@/components/rigs/RigListSection';
import { getRigsForSpecies } from '@/utils/speciesRigs';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTheme } from '@/providers/ThemeProvider';

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    headerText: {
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    headerSubtitle: {
      color: colors.textSecondary,
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
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: FontSizes.md,
      paddingVertical: Spacing.md,
      marginLeft: Spacing.sm,
    },
    listView: {
      flex: 1,
      paddingHorizontal: Spacing.md,
    },
    speciesCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    speciesCardWide: {
      flexGrow: 1,
      flexBasis: '48%',
      minWidth: 300,
      maxWidth: '100%',
    },
    speciesCardWrap: {
      width: '100%',
    },
    speciesCardWrapWide: {
      flexGrow: 1,
      flexBasis: '48%',
      minWidth: 300,
      maxWidth: '100%',
    },
    speciesList: {
      gap: Spacing.sm,
    },
    speciesListWide: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    speciesCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.cardLight,
    },
    speciesCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    speciesIcon: {
      backgroundColor: colors.accentDark,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speciesImage: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
    },
    speciesInfo: {
      flex: 1,
    },
    speciesName: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    speciesScientific: {
      color: colors.textSecondary,
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
      color: colors.textMuted,
      fontSize: FontSizes.sm,
    },
    expandedContent: {
      marginTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Spacing.md,
    },
    description: {
      color: colors.textSecondary,
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
      backgroundColor: colors.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
    },
    detailLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.xs,
    },
    luresSection: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
    },
    luresTitle: {
      color: colors.text,
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
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
    },
    lureChipText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    bottomPadding: {
      height: Spacing.xxl,
    },
  });
}

export default function SpeciesScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isWide } = useResponsiveLayout();
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
      <ResponsiveScreen>
      <AppScreenHeader
        variant="compact"
        title="Species Library"
        subtitle={`${speciesData.length} species in database`}
        actions={
          <>
            <SettingsButton />
            <ThemeToggleButton />
          </>
        }
      />

      <View style={styles.searchContainer}>
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, habitat, or scientific name..."
          accessibilityLabel="Search species"
        />
      </View>

      <ScrollView style={styles.listView} showsVerticalScrollIndicator={false}>
        {filteredSpecies.length === 0 ? (
          <EmptyState
            icon={<Fish color={colors.textMuted} size={48} />}
            title="No species found"
            subtitle="Try a different search term"
          />
        ) : (
          <View style={[styles.speciesList, isWide && styles.speciesListWide]}>
          {filteredSpecies.map((species, index) => {
            const isExpanded = selectedSpecies?.id === species.id;

            return (
            <FadeInView
              key={species.id}
              delay={Math.min(index * 40, 240)}
              style={isWide ? styles.speciesCardWrapWide : styles.speciesCardWrap}
            >
              <ScalePressable
                style={[
                  styles.speciesCard,
                  isWide && styles.speciesCardWide,
                  isExpanded && styles.speciesCardSelected,
                ]}
                onPress={() => setSelectedSpecies(isExpanded ? null : species)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={`${species.name}, ${species.scientificName}`}
              >
                <View style={styles.speciesCardHeader}>
                  <View style={styles.speciesIcon}>
                    {species.image ? (
                      <Image source={{ uri: species.image }} style={styles.speciesImage} />
                    ) : (
                      <Fish color={colors.accent} size={20} />
                    )}
                  </View>
                  <View style={styles.speciesInfo}>
                    <ThemedText style={styles.speciesName}>{species.name}</ThemedText>
                    <ThemedText style={styles.speciesScientific}>{species.scientificName}</ThemedText>
                  </View>
                  <AnimatedChevron
                    expanded={isExpanded}
                    color={isExpanded ? colors.accent : colors.textMuted}
                  />
                </View>

                <View style={styles.speciesQuickInfo}>
                  <View style={styles.quickInfoItem}>
                    <MapPin color={colors.textMuted} size={14} />
                    <ThemedText style={styles.quickInfoText}>{species.habitat}</ThemedText>
                  </View>
                  <View style={styles.quickInfoItem}>
                    <Calendar color={colors.textMuted} size={14} />
                    <ThemedText style={styles.quickInfoText}>{species.season}</ThemedText>
                  </View>
                </View>

                <CollapsibleContent expanded={isExpanded}>
                  <View style={styles.expandedContent}>
                    <ThemedText style={styles.description}>{species.description}</ThemedText>

                    <View style={styles.detailsGrid}>
                      <View style={styles.detailBox}>
                        <ThemedText style={styles.detailLabel}>Average Weight</ThemedText>
                        <ThemedText style={styles.detailValue}>{species.averageWeight}</ThemedText>
                      </View>
                      <View style={styles.detailBox}>
                        <ThemedText style={styles.detailLabel}>Max Weight</ThemedText>
                        <ThemedText style={styles.detailValue}>{species.maxWeight}</ThemedText>
                      </View>
                    </View>

                    {(() => {
                      const rigs = getRigsForSpecies(species.id);
                      if (rigs.length > 0) {
                        return <RigListSection rigs={rigs} />;
                      }
                      return (
                        <View style={styles.luresSection}>
                          <ThemedText style={styles.luresTitle}>Recommended Lures</ThemedText>
                          <View style={styles.luresList}>
                            {species.lures.map((lure, lureIndex) => (
                              <View key={lureIndex} style={styles.lureChip}>
                                <ThemedText style={styles.lureChipText}>{lure}</ThemedText>
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                </CollapsibleContent>
              </ScalePressable>
            </FadeInView>
            );
          })}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
      </ResponsiveScreen>
    </SafeAreaView>
  );
}
