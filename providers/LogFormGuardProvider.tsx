import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { confirmDiscardUnsavedChanges } from '@/utils/unsavedChanges';

interface LogFormGuardContextValue {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmLeave: (proceed: () => void) => void;
  registerDiscardHandler: (handler: () => void, active: boolean) => void;
}

const LogFormGuardContext = createContext<LogFormGuardContextValue | null>(null);

export function LogFormGuardProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setDirty] = useState(false);
  const discardHandlersRef = useRef(new Set<() => void>());

  const registerDiscardHandler = useCallback((handler: () => void, active: boolean) => {
    if (active) {
      discardHandlersRef.current.add(handler);
    } else {
      discardHandlersRef.current.delete(handler);
    }
  }, []);

  const confirmLeave = useCallback(
    (proceed: () => void) => {
      confirmDiscardUnsavedChanges({
        isDirty,
        title: 'Discard changes?',
        message: 'You have unsaved catch entries.',
        onDiscard: () => {
          setDirty(false);
          discardHandlersRef.current.forEach((handler) => handler());
          proceed();
        },
      });
    },
    [isDirty]
  );

  return (
    <LogFormGuardContext.Provider value={{ isDirty, setDirty, confirmLeave, registerDiscardHandler }}>
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

/** Register a callback to run when the user discards unsaved catch form changes. */
export function useLogFormGuardDiscard(onDiscard: () => void) {
  const { registerDiscardHandler } = useLogFormGuard();
  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;

  const handler = useCallback(() => {
    onDiscardRef.current();
  }, []);

  useEffect(() => {
    registerDiscardHandler(handler, true);
    return () => registerDiscardHandler(handler, false);
  }, [handler, registerDiscardHandler]);
}
