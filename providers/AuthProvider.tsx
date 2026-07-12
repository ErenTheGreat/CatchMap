import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setCurrentUserId } from '@/lib/authState';
import { deleteAccount as invokeDeleteAccount } from '@/lib/api/deleteAccount';
import {
  createSessionFromUrl,
  getAuthRedirectUrl,
  getSupabaseAuthParams,
} from '@/lib/auth/deepLinkAuth';

interface AuthResult {
  error: string | null;
  /** True when sign-up succeeded but requires email confirmation first. */
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** True until the persisted session has been restored on startup. */
  initializing: boolean;
  /** True after opening a password-recovery link — show set-new-password UI. */
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
  clearRecoveryMode: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setCurrentUserId(data.session?.user.id ?? null);
      })
      .finally(() => setInitializing(false));

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, nextSession) => {
        setSession(nextSession);
        setCurrentUserId(nextSession?.user.id ?? null);
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true);
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      const handled = await createSessionFromUrl(url);
      if (!handled) return;

      const params = getSupabaseAuthParams(url);
      if (params.type === 'recovery') {
        setRecoveryMode(true);
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  // Supabase recommends pausing token auto-refresh while the app is backgrounded.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (!error) return { error: null };

    const message = error.message.toLowerCase();
    if (message.includes('email not confirmed')) {
      return {
        error:
          'Confirm your email first — open the confirmation link we sent you, then sign in again.',
      };
    }
    return { error: error.message };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) return { error: error.message };
    return { error: null, needsEmailConfirmation: !data.session };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAuthRedirectUrl(),
    });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      setRecoveryMode(false);
    }
    return { error: error?.message ?? null };
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    const result = await invokeDeleteAccount();
    if (result.error) {
      return { error: result.error };
    }

    await supabase.auth.signOut();
    setRecoveryMode(false);
    return { error: null };
  }, []);

  const clearRecoveryMode = useCallback(() => {
    setRecoveryMode(false);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRecoveryMode(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      initializing,
      recoveryMode,
      signIn,
      signUp,
      resetPassword,
      updatePassword,
      deleteAccount,
      clearRecoveryMode,
      signOut,
    }),
    [
      session,
      initializing,
      recoveryMode,
      signIn,
      signUp,
      resetPassword,
      updatePassword,
      deleteAccount,
      clearRecoveryMode,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
