import { useQuery } from "@tanstack/react-query";

import { adminApiService } from "@src/services/admin-api.service";

export const analyticsQueryKeys = {
  all: ["analytics"] as const,
  userStats: () => [...analyticsQueryKeys.all, "userStats"] as const
};

export function useUserStatsQuery() {
  return useQuery({
    queryKey: analyticsQueryKeys.userStats(),
    queryFn: () => adminApiService.getUserStats()
  });
}
