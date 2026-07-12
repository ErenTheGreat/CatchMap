import { Platform, Share, Linking } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

export type FeedbackCategory = 'bug' | 'feature' | 'general';

export interface SubmitFeedbackInput {
  category: FeedbackCategory;
  message: string;
  contactEmail?: string;
}

export type FeedbackSubmitResult =
  | { method: 'supabase' }
  | { method: 'email' }
  | { method: 'share' };

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug report',
  feature: 'Feature request',
  general: 'General feedback',
};

function buildFeedbackBody(input: SubmitFeedbackInput): string {
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const appName = Constants.expoConfig?.name ?? 'CatchMap';
  const lines = [
    `App: ${appName}`,
    `Version: ${appVersion}`,
    `Platform: ${Platform.OS}`,
    `Category: ${CATEGORY_LABELS[input.category]}`,
    input.contactEmail ? `Reply-to: ${input.contactEmail}` : null,
    '',
    input.message.trim(),
  ].filter(Boolean);

  return lines.join('\n');
}

async function submitViaSupabase(input: SubmitFeedbackInput): Promise<boolean> {
  const appVersion = Constants.expoConfig?.version ?? null;
  const { error } = await supabase.rpc('submit_app_feedback', {
    p_category: input.category,
    p_message: input.message.trim(),
    p_contact_email: input.contactEmail?.trim() || null,
    p_app_version: appVersion,
    p_platform: Platform.OS,
  });

  if (error) {
    if (__DEV__) console.warn('Feedback Supabase insert failed:', error.message);
    return false;
  }

  return true;
}

async function submitViaEmail(input: SubmitFeedbackInput): Promise<boolean> {
  const email = process.env.EXPO_PUBLIC_FEEDBACK_EMAIL?.trim();
  if (!email) return false;

  const subject = encodeURIComponent(
    `CatchMap feedback — ${CATEGORY_LABELS[input.category]}`
  );
  const body = encodeURIComponent(buildFeedbackBody(input));
  const url = `mailto:${email}?subject=${subject}&body=${body}`;

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;

  await Linking.openURL(url);
  return true;
}

async function submitViaShare(input: SubmitFeedbackInput): Promise<boolean> {
  await Share.share({
    title: 'CatchMap feedback',
    message: buildFeedbackBody(input),
  });
  return true;
}

export async function submitFeedback(
  input: SubmitFeedbackInput
): Promise<FeedbackSubmitResult> {
  const message = input.message.trim();
  if (message.length < 10) {
    throw new Error('Please enter at least 10 characters of feedback.');
  }

  if (await submitViaSupabase(input)) {
    return { method: 'supabase' };
  }

  if (await submitViaEmail(input)) {
    return { method: 'email' };
  }

  await submitViaShare(input);
  return { method: 'share' };
}
