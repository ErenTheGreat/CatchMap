import React, { createContext, useCallback, useContext, useState } from 'react';
import { confirmDiscardUnsavedChanges } from '@/utils/unsavedChanges';

interface LogFormGuardContextValue {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmLeave: (proceed: () => void) => void;
}

const LogFormGuardContext = createContext<LogFormGuardContextValue | null>(null);

export function LogFormGuardProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setDirty] = useState(false);

  const confirmLeave = useCallback(
    (proceed: () => void) => {
      confirmDiscardUnsavedChanges({
        isDirty,
        title: 'Discard changes?',
        message: 'You have unsaved entries on the Log tab.',
        onDiscard: () => {
          setDirty(false);
          proceed();
        },
      });
    },
    [isDirty]
  );

  return (
    <LogFormGuardContext.Provider value={{ isDirty, setDirty, confirmLeave }}>
      {children}
    </LogFormGuardContext.Provider>
  );
}

export function useLogFormGuard() {
  const context = useContext(LogFormGuardContext);
  if (!context) {
    throw new Error('useLogFormGuard must be used within LogFormGuardProvider');
  }
  return context;
}
