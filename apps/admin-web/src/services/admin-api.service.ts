import type { ListUsersParams, PaginatedUsers, SearchUsersParams, User, UserStats } from "@src/types/user";

const PROXY_BASE_URL = "/api/proxy";

interface ApiPaginatedResponse<T> {
  data: {
    users: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

interface ApiResponse<T> {
  data: T;
}

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PROXY_BASE_URL}${endpoint}`, {
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

    const response = await fetchWithAuth<ApiPaginatedResponse<User>>(`/v1/admin/users?${queryString}`);
    return {
      ...response.data,
      totalPages: Math.ceil(response.data.total / response.data.pageSize)
    };
  },

  async searchUsers(params: SearchUsersParams): Promise<PaginatedUsers> {
    const { query, page = 1, pageSize = 20 } = params;
    const queryString = new URLSearchParams({
      q: query,
      page: page.toString(),
      pageSize: pageSize.toString()
    }).toString();

    const response = await fetchWithAuth<ApiPaginatedResponse<User>>(`/v1/admin/users/search?${queryString}`);
    return {
      ...response.data,
      totalPages: Math.ceil(response.data.total / response.data.pageSize)
    };
  },

  async getUserById(id: string): Promise<User> {
    const response = await fetchWithAuth<ApiResponse<User>>(`/v1/admin/users/${id}`);
    return response.data;
  },

  async getUserStats(): Promise<UserStats> {
    const response = await fetchWithAuth<ApiResponse<UserStats>>(`/v1/admin/analytics/users`);
    return response.data;
  }
};
