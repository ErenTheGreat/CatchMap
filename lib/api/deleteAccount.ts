import { supabase } from '@/lib/supabase';

export interface DeleteAccountResult {
  error: string | null;
}

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) {
    return { error: error.message ?? 'Could not delete account' };
  }

  const payload = data as { error?: string; success?: boolean } | null;
  if (payload?.error) {
    return { error: payload.error };
  }

  if (!payload?.success) {
    return { error: 'Account deletion failed' };
  }

  return { error: null };
}
