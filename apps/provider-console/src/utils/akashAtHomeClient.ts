import type { Auth0User } from "@src/types/auth0";

export interface InstallationStatus {
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  message: string;
  timestamp: string;
}

export interface UserToken {
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface DeviceInfo {
  id: string;
  status: "online" | "offline" | "setup_required";
  lastSeen: string;
  uptime: number;
  earnings: number;
}

export interface EarningsData {
  total: number;
  daily: number;
  weekly: number;
  monthly: number;
  currency: string;
}

class AkashAtHomeClient {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_AKASH_AT_HOME_API_URL || "http://localhost:8000/api";
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  clearAccessToken(): void {
    this.accessToken = null;
  }

  async authenticateWithAuth0(code: string, state?: string): Promise<{ accessToken: string; user: Auth0User }> {
    const response = await fetch(`${this.baseURL}/auth/callback`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ code, state })
    });

    const data = await this.handleResponse<{ accessToken: string; user: Auth0User }>(response);
    this.setAccessToken(data.accessToken);
    return data;
  }

  async getUserProfile(): Promise<Auth0User> {
    const response = await fetch(`${this.baseURL}/user/profile`, {
      headers: await this.getHeaders()
    });

    return this.handleResponse<Auth0User>(response);
  }

  async generateToken(): Promise<UserToken> {
    const response = await fetch(`${this.baseURL}/tokens`, {
      method: "POST",
      headers: await this.getHeaders()
    });

    return this.handleResponse<UserToken>(response);
  }

  async getInstallationStatus(): Promise<InstallationStatus> {
    const response = await fetch(`${this.baseURL}/installation/status`, {
      headers: await this.getHeaders()
    });

    return this.handleResponse<InstallationStatus>(response);
  }

  async getInstallationProgress(): Promise<number> {
    const response = await fetch(`${this.baseURL}/installation/progress`, {
      headers: await this.getHeaders()
    });

    const data = await this.handleResponse<{ progress: number }>(response);
    return data.progress;
  }

  async downloadISO(): Promise<Blob> {
    const response = await fetch(`${this.baseURL}/iso/download`, {
      headers: await this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to download ISO: ${response.statusText}`);
    }

    return response.blob();
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const response = await fetch(`${this.baseURL}/device/info`, {
      headers: await this.getHeaders()
    });

    return this.handleResponse<DeviceInfo>(response);
  }

  async getEarnings(): Promise<EarningsData> {
    const response = await fetch(`${this.baseURL}/earnings`, {
      headers: await this.getHeaders()
    });

    return this.handleResponse<EarningsData>(response);
  }

  async getInstallationLogs(): Promise<string[]> {
    const response = await fetch(`${this.baseURL}/installation/logs`, {
      headers: await this.getHeaders()
    });

    return this.handleResponse<string[]>(response);
  }

  async refreshToken(): Promise<{ accessToken: string }> {
    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: "POST",
      headers: await this.getHeaders()
    });

    const data = await this.handleResponse<{ accessToken: string }>(response);
    this.setAccessToken(data.accessToken);
    return data;
  }
}

export const akashAtHomeClient = new AkashAtHomeClient();
