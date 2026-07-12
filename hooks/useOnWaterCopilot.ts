import { useCallback, useState } from 'react';
import { generateOnWaterCopilotResponse } from '@/lib/ai/proAiFeatures';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { NearbySpot } from '@/utils/recommendations';

export interface OnWaterCopilotContext {
  spot?: NearbySpot | null;
  weather?: WeatherSnapshot | null;
  speciesName?: string | null;
  biteLabel?: string | null;
  personalNote?: string | null;
}

export function useOnWaterCopilot(context: OnWaterCopilotContext) {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);

      const result = await generateOnWaterCopilotResponse({
        question: trimmed,
        spotName: context.spot?.name,
        waterType: context.spot?.water_type,
        latitude: context.spot?.latitude,
        longitude: context.spot?.longitude,
        weather: context.weather,
        speciesName: context.speciesName,
        biteLabel: context.biteLabel,
        personalNote: context.personalNote,
      });

      setLoading(false);
      if (result.error) {
        setError(result.error);
        setAnswer(null);
        return;
      }
      setAnswer(result.text);
    },
    [context]
  );

  const reset = useCallback(() => {
    setAnswer(null);
    setError(null);
  }, []);

  return { ask, loading, answer, error, reset };
}
