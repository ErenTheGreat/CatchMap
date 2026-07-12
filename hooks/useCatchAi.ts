import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePro } from '@/providers/ProProvider';
import { PRO_AI_DAILY_LIMIT } from '@/constants/pro';
import {
  fetchHostedAiUsage,
  hostedGenerateText,
  type HostedAiError,
  type HostedAiUsage,
} from '@/lib/ai/hostedAiClient';
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

export type { HostedAiError as GeminiError };

export function useCatchAi() {
  const { isPro } = usePro();
  const hasPro = isPro;
  const [usage, setUsage] = useState<HostedAiUsage>({
    count: 0,
    limit: PRO_AI_DAILY_LIMIT,
    remaining: PRO_AI_DAILY_LIMIT,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const refresh = useCallback(async () => {
    if (hasPro) {
      const usageStatus = await fetchHostedAiUsage();
      setUsage(usageStatus);
    } else {
      setUsage({ count: 0, limit: PRO_AI_DAILY_LIMIT, remaining: 0 });
    }
  }, [hasPro]);

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

  const clearChat = useCallback(async () => {
    await persistMessages([]);
  }, [persistMessages]);

  const sendMessage = useCallback(
    async (
      text: string,
      context?: FishingContextInput
    ): Promise<{ error: HostedAiError | null }> => {
      const trimmed = text.trim();
      if (!trimmed) return { error: null };

      if (!hasPro) {
        return {
          error: {
            code: 'not_pro',
            message: 'CatchMap Pro is required for Catch AI.',
          },
        };
      }

      if (usage.remaining <= 0) {
        return {
          error: {
            code: 'quota_exceeded',
            message: `Daily AI limit reached (${PRO_AI_DAILY_LIMIT} requests). Try again tomorrow.`,
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
      setMessages(withUser);
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

        const { text: reply, error, usage: nextUsage } = await hostedGenerateText({
          feature: 'chat',
          systemPrompt: buildFishingSystemPrompt(),
          userPrompt,
          temperature: 0.7,
          maxOutputTokens: 1024,
        });

        if (error) {
          setMessages(messages);
          return { error };
        }

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply ?? '',
          timestamp: Date.now(),
        };
        await persistMessages([...withUser, assistantMsg]);
        if (nextUsage) setUsage(nextUsage);
        await refresh();
        return { error: null };
      } finally {
        setSending(false);
      }
    },
    [messages, persistMessages, refresh, usage.remaining, hasPro]
  );

  return {
    hasKey: hasPro,
    hasPro,
    usage: {
      status:
        usage.remaining <= 0 ? ('exceeded' as const) : usage.count / usage.limit >= 0.8 ? ('warning' as const) : ('ok' as const),
      count: usage.count,
      budget: usage.limit,
      remaining: usage.remaining,
      percentUsed: usage.limit > 0 ? Math.round((usage.count / usage.limit) * 100) : 100,
    },
    messages,
    sending,
    loadingHistory,
    refresh,
    clearChat,
    sendMessage,
  };
}
