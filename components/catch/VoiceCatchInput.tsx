import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Mic, MicOff, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { parseVoiceCatchTranscript, type ParsedVoiceCatch } from '@/utils/voiceCatchParser';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

interface VoiceCatchInputProps {
  onParsed: (parsed: ParsedVoiceCatch) => void;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getWebSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function VoiceCatchInput({ onParsed }: VoiceCatchInputProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [modalVisible, setModalVisible] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  const applyTranscript = useCallback(
    (text: string) => {
      const parsed = parseVoiceCatchTranscript(text);
      onParsed(parsed);
      hapticSuccess();
      setModalVisible(false);
      setTranscript('');
    },
    [onParsed]
  );

  const startWebListening = useCallback(() => {
    const SpeechRecognition = getWebSpeechRecognition();
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const result = event.results[0]?.[0]?.transcript;
      if (result) setTranscript(result);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    return true;
  }, []);

  const openModal = () => {
    hapticLight();
    setModalVisible(true);
    setTranscript('');

    if (Platform.OS === 'web') {
      const started = startWebListening();
      if (!started) setListening(false);
    }
  };

  const handleApply = () => {
    if (!transcript.trim()) return;
    applyTranscript(transcript);
  };

  return (
    <>
      <Pressable
        style={styles.micButton}
        onPress={openModal}
        accessibilityRole="button"
        accessibilityLabel="Log catch by voice"
      >
        <Mic color={colors.accent} size={18} />
        <Text style={styles.micLabel}>Voice log</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Voice catch log</Text>
              <Pressable onPress={() => { stopListening(); setModalVisible(false); }} hitSlop={8}>
                <X color={colors.textMuted} size={22} />
              </Pressable>
            </View>

            <Text style={styles.hint}>
              {Platform.OS === 'web'
                ? 'Speak clearly: "18 inch largemouth on texas rig"'
                : 'Tap the keyboard microphone on your device to dictate, or type below.'}
            </Text>

            <TextInput
              style={styles.input}
              value={transcript}
              onChangeText={setTranscript}
              placeholder='e.g. "2 lb bass, texas rig, dawn"'
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
            />

            {listening ? (
              <View style={styles.listeningRow}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.listeningText}>Listening…</Text>
                <Pressable onPress={stopListening} accessibilityRole="button" accessibilityLabel="Stop listening">
                  <MicOff color={colors.textMuted} size={18} />
                </Pressable>
              </View>
            ) : Platform.OS === 'web' ? (
              <Pressable style={styles.secondaryButton} onPress={startWebListening}>
                <Mic color={colors.accent} size={16} />
                <Text style={styles.secondaryButtonText}>Start listening</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.applyButton, !transcript.trim() && styles.applyButtonDisabled]}
              onPress={handleApply}
              disabled={!transcript.trim()}
              accessibilityRole="button"
              accessibilityLabel="Apply voice catch to form"
            >
              <Text style={styles.applyButtonText}>Apply to form</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    micButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.accentDark,
      marginBottom: Spacing.sm,
    },
    micLabel: {
      fontSize: FontSizes.sm,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    hint: {
      fontSize: FontSizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    input: {
      minHeight: 80,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      fontSize: FontSizes.md,
      color: colors.text,
      backgroundColor: colors.cardLight,
      textAlignVertical: 'top',
    },
    listeningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    listeningText: {
      flex: 1,
      fontSize: FontSizes.sm,
      color: colors.accent,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
    },
    secondaryButtonText: {
      fontSize: FontSizes.sm,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    applyButton: {
      backgroundColor: colors.accent,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    applyButtonDisabled: {
      opacity: 0.5,
    },
    applyButtonText: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.accentForeground,
    },
  });
}
