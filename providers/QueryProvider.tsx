import React, { PropsWithChildren, useEffect } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persistOptions } from '@/lib/queryClient';
import { NetworkProvider } from '@/providers/NetworkProvider';

export function QueryProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    // Viewport queries abort on pan — drop any in-flight/pending tiles on cold start.
    queryClient.removeQueries({ queryKey: ['spotsBBox'] });
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <NetworkProvider>{children}</NetworkProvider>
    </PersistQueryClientProvider>
  );
}
