import { describe, expect, it, vi, beforeEach } from 'vitest';

const { dismiss, isVisible, alert } = vi.hoisted(() => ({
  dismiss: vi.fn(),
  isVisible: vi.fn(),
  alert: vi.fn(),
}));

vi.mock('react-native', () => ({
  Keyboard: {
    dismiss,
    isVisible,
  },
  Alert: {
    alert,
  },
}));

import { confirmDiscardUnsavedChanges } from '@/utils/unsavedChanges';

describe('confirmDiscardUnsavedChanges', () => {
  beforeEach(() => {
    dismiss.mockReset();
    isVisible.mockReset();
    alert.mockReset();
  });

  it('dismisses the keyboard instead of prompting while it is open', () => {
    isVisible.mockReturnValue(true);
    const onDiscard = vi.fn();

    confirmDiscardUnsavedChanges({ isDirty: true, onDiscard });

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('closes immediately when the form is clean', () => {
    isVisible.mockReturnValue(false);
    const onDiscard = vi.fn();

    confirmDiscardUnsavedChanges({ isDirty: false, onDiscard });

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('prompts before discarding dirty form changes', () => {
    isVisible.mockReturnValue(false);
    const onDiscard = vi.fn();

    confirmDiscardUnsavedChanges({ isDirty: true, onDiscard });

    expect(alert).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });
});
