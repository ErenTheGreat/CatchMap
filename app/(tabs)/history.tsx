import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { History, Fish, MapPin, Calendar, Weight, Trash2, Trophy, TrendingUp } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights } from '@/constants/theme';
import { useCatches, useDeleteCatch } from '@/hooks/useCatches';

export default function HistoryScreen() {
  const { data: catches = [], isLoading: loading, isRefetching: refreshing, refetch } = useCatches();
  const deleteCatchMutation = useDeleteCatch();

  const onRefresh = () => {
    refetch();
  };

  const handleDelete = (id: string, species: string) => {
    Alert.alert(
      'Delete Catch',
      `Are you sure you want to delete this ${species} catch?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCatchMutation.mutate(id, {
              onError: () => Alert.alert('Error', 'Failed to delete catch.'),
            });
          },
        },
      ]
    );
  };

  const recentCatches = catches.slice(0, 5);
  const totalCatches = catches.length;
  const uniqueSpecies = new Set(catches.map((c) => c.species)).size;

  const biggestCatch = catches.reduce(
    (max, c) => {
      const weight = parseFloat(c.weight) || 0;
      const maxWeight = parseFloat(max?.weight) || 0;
      return weight > maxWeight ? c : max;
    },
    catches[0] || null
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading catches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <History color={Colors.accent} size={28} />
        <Text style={styles.headerTitle}>Fishing History</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Fish color={Colors.accent} size={24} />
          <Text style={styles.statValue}>{totalCatches}</Text>
          <Text style={styles.statLabel}>Total Catches</Text>
        </View>
        <View style={styles.statCard}>
          <Trophy color={Colors.warning} size={24} />
          <Text style={styles.statValue}>{uniqueSpecies}</Text>
          <Text style={styles.statLabel}>Species</Text>
        </View>
        <View style={styles.statCard}>
          <TrendingUp color={Colors.success} size={24} />
          <Text style={styles.statValue}>
            {biggestCatch ? biggestCatch.weight : 'N/A'}
          </Text>
          <Text style={styles.statLabel}>Biggest</Text>
        </View>
      </View>

      <ScrollView
        style={styles.listView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {catches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Fish color={Colors.textMuted} size={64} />
            <Text style={styles.emptyText}>No catches recorded yet</Text>
            <Text style={styles.emptySubtext}>
              Start logging your catches to see them here
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Recent Catches</Text>
            {catches.map((catchRecord) => (
              <View key={catchRecord.id} style={styles.catchCard}>
                <View style={styles.catchHeader}>
                  <View style={styles.catchIcon}>
                    <Fish color={Colors.accent} size={20} />
                  </View>
                  <View style={styles.catchInfo}>
                    <Text style={styles.catchSpecies}>{catchRecord.species}</Text>
                    <View style={styles.catchMeta}>
                      <View style={styles.metaItem}>
                        <Weight color={Colors.textMuted} size={12} />
                        <Text style={styles.metaText}>{catchRecord.weight}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Calendar color={Colors.textMuted} size={12} />
                        <Text style={styles.metaText}>{catchRecord.date}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(catchRecord.id, catchRecord.species)}
                  >
                    <Trash2 color={Colors.error} size={18} />
                  </TouchableOpacity>
                </View>

                {catchRecord.lure && (
                  <View style={styles.catchDetail}>
                    <Text style={styles.detailLabel}>Lure: </Text>
                    <Text style={styles.detailValue}>{catchRecord.lure}</Text>
                  </View>
                )}

                {catchRecord.notes && (
                  <Text style={styles.catchNotes}>{catchRecord.notes}</Text>
                )}

                {catchRecord.latitude && catchRecord.longitude && (
                  <View style={styles.locationRow}>
                    <MapPin color={Colors.accent} size={12} />
                    <Text style={styles.locationText}>
                      {catchRecord.latitude.toFixed(4)}°, {catchRecord.longitude.toFixed(4)}°
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    marginTop: Spacing.xs,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  listView: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.sm,
  },
  catchCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  catchIcon: {
    backgroundColor: Colors.accentDark,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  catchInfo: {
    flex: 1,
  },
  catchSpecies: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
  },
  catchMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  catchDetail: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
  },
  detailValue: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  catchNotes: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  locationText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.medium,
    marginTop: Spacing.lg,
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  bottomPadding: {
    height: Spacing.xxl,
  },
});
