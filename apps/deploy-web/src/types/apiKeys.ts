export interface IApiKey {
  id: string;
  name: string;
  keyFormat: string;
  apiKey: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}
