export interface ApiKey {
  apiKey: string;
  createdAt: string;
  expiresAt: string;
  id: string;
  isActive: boolean;
  lastUsedAt: string;
  walletAddress: string;
}

export interface ApiKeyResponse {
  api_key: string;
  created_at: string;
  expires_at: string;
  id: string;
  is_active: boolean;
  last_used_at: string;
  wallet_address: string;
}
