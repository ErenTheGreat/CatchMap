import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fishingApi, CatchRecord, SaveCatchInput, UpdateCatchInput } from '@/lib/api/fishingApi';

const CATCHES_KEY = ['catches'];

export function useCatches() {
  return useQuery({
    queryKey: CATCHES_KEY,
    queryFn: () => fishingApi.getCatches(),
    staleTime: 60 * 1000,
  });
}

export function useSyncCatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fishingApi.syncPendingCatches(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATCHES_KEY });
    },
  });
}

export function useSaveCatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (catchData: SaveCatchInput) =>
      fishingApi.saveCatch(catchData),
    onMutate: async (catchData) => {
      await queryClient.cancelQueries({ queryKey: CATCHES_KEY });
      const previous = queryClient.getQueryData<CatchRecord[]>(CATCHES_KEY);

      const { caughtAt, ...rest } = catchData;
      const optimistic: CatchRecord = {
        ...rest,
        id: `optimistic-${Date.now()}`,
        createdAt: caughtAt ?? Date.now(),
      };

      queryClient.setQueryData<CatchRecord[]>(CATCHES_KEY, (old) =>
        old ? [optimistic, ...old] : [optimistic]
      );

      return { previous };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<CatchRecord[]>(CATCHES_KEY, (old) => {
        if (!old) return [result.record];
        const withoutOptimistic = old.filter((c) => !c.id.startsWith('optimistic-'));
        return [result.record, ...withoutOptimistic];
      });
      queryClient.invalidateQueries({ queryKey: CATCHES_KEY });
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CATCHES_KEY, context.previous);
      }
    },
  });
}

export function useUpdateCatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateCatchInput }) =>
      fishingApi.updateCatch(id, changes),
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: CATCHES_KEY });
      const previous = queryClient.getQueryData<CatchRecord[]>(CATCHES_KEY);

      queryClient.setQueryData<CatchRecord[]>(CATCHES_KEY, (old) =>
        old
          ? old.map((c) => {
              if (c.id !== id) return c;
              const { caughtAt, ...rest } = changes;
              return {
                ...c,
                ...rest,
                ...(caughtAt !== undefined ? { createdAt: caughtAt } : {}),
              };
            })
          : []
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CATCHES_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CATCHES_KEY });
    },
  });
}

export function useDeleteCatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => fishingApi.deleteCatch(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CATCHES_KEY });
      const previous = queryClient.getQueryData<CatchRecord[]>(CATCHES_KEY);

      queryClient.setQueryData<CatchRecord[]>(CATCHES_KEY, (old) =>
        old ? old.filter((c) => c.id !== id) : []
      );

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CATCHES_KEY, context.previous);
      }
    },
  });
}
