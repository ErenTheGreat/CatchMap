import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MIN_QUERY_LENGTH,
  searchLocationsByName,
} from '@/lib/api/endpoints/locationsSearch';
import type { LocationSearchResult } from '@/lib/types/mapCoordinates';

const DEBOUNCE_MS = 300;

export function useLocationSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const enabled = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const searchQuery = useQuery({
    queryKey: ['locationSearch', debouncedQuery],
    queryFn: ({ signal }) => searchLocationsByName(debouncedQuery, signal),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });

  return {
    results: searchQuery.data ?? [],
    isSearching: enabled && (searchQuery.isFetching || searchQuery.isLoading),
    isFetched: searchQuery.isFetched,
    error: searchQuery.error instanceof Error ? searchQuery.error : null,
    hasQuery: enabled,
  };
}

export type { LocationSearchResult };
