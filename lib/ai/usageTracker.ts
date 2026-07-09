import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyBudget } from '@/lib/ai/userApiKey';

const USAGE_KEY = 'catchmap_ai_usage';

interface UsageRecord {
  date: string;
  count: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readUsage(): Promise<UsageRecord> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    if (!raw) return { date: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as UsageRecord;
    if (parsed.date !== todayKey()) return { date: todayKey(), count: 0 };
    return parsed;
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

async function writeUsage(record: UsageRecord): Promise<void> {
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(record));
}

export async function getTodayUsageCount(): Promise<number> {
  const record = await readUsage();
  return record.count;
}

export async function incrementUsageCount(amount = 1): Promise<number> {
  const record = await readUsage();
  record.count += amount;
  await writeUsage(record);
  return record.count;
}

export type UsageStatus = 'ok' | 'warning' | 'exceeded';

export async function getUsageStatus(): Promise<{
  status: UsageStatus;
  count: number;
  budget: number;
  remaining: number;
  percentUsed: number;
}> {
  const [count, budget] = await Promise.all([getTodayUsageCount(), getDailyBudget()]);
  const remaining = Math.max(0, budget - count);
  const percentUsed = budget > 0 ? Math.round((count / budget) * 100) : 100;

  let status: UsageStatus = 'ok';
  if (count >= budget) status = 'exceeded';
  else if (percentUsed >= 80) status = 'warning';

  return { status, count, budget, remaining, percentUsed };
}

export async function canMakeAiRequest(): Promise<boolean> {
  const { status } = await getUsageStatus();
  return status !== 'exceeded';
}
