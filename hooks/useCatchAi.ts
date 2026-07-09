import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hasUserGeminiApiKey,
  getDailyBudget,
  setDailyBudget,
  setUserGeminiApiKey,
  clearUserGeminiApiKey,
  getUserGeminiApiKey,
} from '@/lib/ai/userApiKey';
import {
  getUsageStatus,
  canMakeAiRequest,
  incrementUsageCount,
  type UsageStatus,
} from '@/lib/ai/usageTracker';
import {
  generateText,
  testGeminiConnection,
  type GeminiError,
} from '@/lib/ai/geminiClient';
import {
  buildFishingSystemPrompt,
  buildFishingContextBlock,
  type FishingContextInput,
} from '@/lib/ai/contextBuilder';

const CHAT_HISTORY_KEY = 'catchmap_ai_chat_history';
const MAX_HISTORY = 40;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function useCatchAi() {
  const [hasKey, setHasKey] = useState(false);
  const [usage, setUsage] = useState({
    status: 'ok' as UsageStatus,
    count: 0,
    budget: 100,
    remaining: 100,
    percentUsed: 0,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const refresh = useCallback(async () => {
    const [keyPresent, usageStatus] = await Promise.all([
      hasUserGeminiApiKey(),
      getUsageStatus(),
    ]);
    setHasKey(keyPresent);
    setUsage(usageStatus);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    AsyncStorage.getItem(CHAT_HISTORY_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMessage[];
          setMessages(parsed.slice(-MAX_HISTORY));
        }
      })
      .finally(() => setLoadingHistory(false));
  }, []);

  const persistMessages = useCallback(async (next: ChatMessage[]) => {
    setMessages(next);
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(next.slice(-MAX_HISTORY)));
  }, []);

  const saveApiKey = useCallback(
    async (key: string) => {
      await setUserGeminiApiKey(key);
      await refresh();
    },
    [refresh]
  );

  const removeApiKey = useCallback(async (): Promise<boolean> => {
    const removed = await clearUserGeminiApiKey();
    await refresh();
    return removed;
  }, [refresh]);

  const updateDailyBudget = useCallback(
    async (budget: number) => {
      await setDailyBudget(budget);
      await refresh();
    },
    [refresh]
  );

  const testKey = useCallback(async (key: string): Promise<boolean> => {
    return testGeminiConnection(key);
  }, []);

  const clearChat = useCallback(async () => {
    await persistMessages([]);
  }, [persistMessages]);

  const sendMessage = useCallback(
    async (
      text: string,
      context?: FishingContextInput
    ): Promise<{ error: GeminiError | null }> => {
      const trimmed = text.trim();
      if (!trimmed) return { error: null };

      if (!(await canMakeAiRequest())) {
        return {
          error: {
            code: 'quota_exceeded',
            message: 'Daily AI budget reached. Adjust in Settings or try tomorrow.',
          },
        };
      }

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      const withUser = [...messages, userMsg];
      await persistMessages(withUser);
      setSending(true);

      try {
        const historyBlock = withUser
          .slice(-8)
          .map((m) => `${m.role === 'user' ? 'Angler' : 'Catch AI'}: ${m.content}`)
          .join('\n');

        const contextBlock = context ? buildFishingContextBlock(context) : '';
        const userPrompt = [
          contextBlock ? `App context:\n${contextBlock}` : '',
          `Conversation:\n${historyBlock}`,
          `Angler: ${trimmed}`,
          'Catch AI:',
        ]
          .filter(Boolean)
          .join('\n\n');

        const { result, error } = await generateText({
          systemPrompt: buildFishingSystemPrompt(),
          userPrompt,
          temperature: 0.7,
          maxOutputTokens: 1024,
        });

        if (error) return { error };

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result?.text ?? '',
          timestamp: Date.now(),
        };
        await persistMessages([...withUser, assistantMsg]);
        await refresh();
        return { error: null };
      } finally {
        setSending(false);
      }
    },
    [messages, persistMessages, refresh]
  );

  return {
    hasKey,
    usage,
    messages,
    sending,
    loadingHistory,
    refresh,
    saveApiKey,
    removeApiKey,
    updateDailyBudget,
    getDailyBudget,
    getUserGeminiApiKey,
    testKey,
    clearChat,
    sendMessage,
    incrementUsageCount,
  };
}
