import { Alert, Keyboard } from 'react-native';

interface UnsavedChangesOptions {
  isDirty: boolean;
  onDiscard: () => void;
  title?: string;
  message?: string;
}

/** Dismiss the keyboard first; only prompt to discard when the user is actually leaving. */
export function confirmDiscardUnsavedChanges({
  isDirty,
  onDiscard,
  title = 'Discard changes?',
  message = 'You have unsaved changes. Discard them?',
}: UnsavedChangesOptions): void {
  if (Keyboard.isVisible()) {
    Keyboard.dismiss();
    return;
  }

  if (!isDirty) {
    onDiscard();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Keep editing', style: 'cancel' },
    {
      text: 'Discard',
      style: 'destructive',
      onPress: onDiscard,
    },
  ]);
}
