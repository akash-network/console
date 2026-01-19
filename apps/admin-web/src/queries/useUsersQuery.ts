import { useQuery } from "@tanstack/react-query";

import { adminApiService } from "@src/services/admin-api.service";
import type { ListUsersParams, SearchUsersParams } from "@src/types/user";

export const userQueryKeys = {
  all: ["users"] as const,
  list: (params: ListUsersParams) => [...userQueryKeys.all, "list", params] as const,
  search: (params: SearchUsersParams) => [...userQueryKeys.all, "search", params] as const,
  detail: (id: string) => [...userQueryKeys.all, "detail", id] as const
};

export function useUsersQuery(params: ListUsersParams = {}) {
  return useQuery({
    queryKey: userQueryKeys.list(params),
    queryFn: () => adminApiService.listUsers(params)
  });
}

export function useSearchUsersQuery(params: SearchUsersParams) {
  return useQuery({
    queryKey: userQueryKeys.search(params),
    queryFn: () => adminApiService.searchUsers(params),
    enabled: params.query.length > 0
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: userQueryKeys.detail(id),
    queryFn: () => adminApiService.getUserById(id),
    enabled: !!id
  });
}
