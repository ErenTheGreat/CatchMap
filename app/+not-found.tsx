import { Stack, router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fish } from 'lucide-react-native';
import { Spacing, FontSizes, FontWeights, type ThemeColors } from '@/constants/theme';
import { Button } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
      backgroundColor: colors.background,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.xl,
      fontWeight: FontWeights.bold,
      marginTop: Spacing.lg,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    button: {
      marginTop: Spacing.xl,
    },
  });
}

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <SafeAreaView style={styles.container}>
        <Fish color={colors.textMuted} size={64} />
        <Text style={styles.title}>This screen {"doesn't"} exist</Text>
        <Text style={styles.subtitle}>
          The page {"you're"} looking for may have been moved or removed.
        </Text>
        <Button
          title="Go to Map"
          variant="secondary"
          style={styles.button}
          onPress={() => router.replace('/(tabs)')}
        />
      </SafeAreaView>
    </>
  );
}
