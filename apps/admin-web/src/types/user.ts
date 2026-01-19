export interface User {
  id: string;
  email: string | null;
  emailVerified: boolean;
  stripeCustomerId: string | null;
  username: string | null;
  userId: string | null;
  bio: string | null;
  subscribedToNewsletter: boolean;
  youtubeUsername: string | null;
  twitterUsername: string | null;
  githubUsername: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  walletAddress: string | null;
  totalSpent: number | null;
  totalCredits: number | null;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserStats {
  totalUsers: number;
  newUsersLast7Days: number;
  activeUsersLast30Days: number;
}

export interface SearchUsersParams {
  query: string;
  page?: number;
  pageSize?: number;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
}
