import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fishingApi, CatchRecord } from '@/lib/api/fishingApi';

const CATCHES_KEY = ['catches'];

export function useCatches() {
  return useQuery({
    queryKey: CATCHES_KEY,
    queryFn: () => fishingApi.getCatches(),
    staleTime: 60 * 1000,
  });
}

export function useSaveCatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (catchData: Omit<CatchRecord, 'id' | 'createdAt'>) =>
      fishingApi.saveCatch(catchData),
    onSuccess: (newCatch) => {
      queryClient.setQueryData<CatchRecord[]>(CATCHES_KEY, (old) =>
        old ? [newCatch, ...old] : [newCatch]
      );
      queryClient.invalidateQueries({ queryKey: CATCHES_KEY });
    },
  });
}

export function useDeleteCatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => fishingApi.deleteCatch(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CatchRecord[]>(CATCHES_KEY, (old) =>
        old ? old.filter((c) => c.id !== id) : []
      );
    },
  });
}
