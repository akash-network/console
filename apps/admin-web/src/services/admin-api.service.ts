import type { ListUsersParams, PaginatedUsers, SearchUsersParams, User, UserStats } from "@src/types/user";
import { browserEnvConfig } from "../config/browser-env.config";

const API_BASE_URL = browserEnvConfig.NEXT_PUBLIC_ADMIN_API_URL;

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

export const adminApiService = {
  async listUsers(params: ListUsersParams = {}): Promise<PaginatedUsers> {
    const { page = 1, pageSize = 20 } = params;
    const queryString = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString()
    }).toString();

    return fetchWithAuth<PaginatedUsers>(`/v1/admin/users?${queryString}`);
  },

  async searchUsers(params: SearchUsersParams): Promise<PaginatedUsers> {
    const { query, page = 1, pageSize = 20 } = params;
    const queryString = new URLSearchParams({
      q: query,
      page: page.toString(),
      pageSize: pageSize.toString()
    }).toString();

    return fetchWithAuth<PaginatedUsers>(`/v1/admin/users/search?${queryString}`);
  },

  async getUserById(id: string): Promise<User> {
    return fetchWithAuth<User>(`/v1/admin/users/${id}`);
  },

  async getUserStats(): Promise<UserStats> {
    return fetchWithAuth<UserStats>(`/v1/admin/analytics/users`);
  }
};
