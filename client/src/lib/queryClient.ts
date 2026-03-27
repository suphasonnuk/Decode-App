// TanStack Query client configuration
// Centralizes all data fetching, caching, and background refresh behavior.
// Components use useQuery/useMutation instead of manual useState/useEffect.

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes before refetching
      staleTime: 5 * 60 * 1000,
      // Keep in cache for 10 minutes after component unmounts
      gcTime: 10 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Don't refetch when window regains focus (avoid unnecessary BQ reads)
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

// ── Query keys — centralized to avoid typos and enable targeted invalidation ──
export const QUERY_KEYS = {
  today:       ['today']       as const,
  yesterday:   ['yesterday']   as const,
  week:        (offset: number) => ['week', offset] as const,
  streak:      ['streak']      as const,
  trends:      ['trends']      as const,
  anchors:     ['anchors']     as const,
  profile:     (userId: string) => ['profile', userId] as const,
  coach:       ['coach']       as const,
} as const