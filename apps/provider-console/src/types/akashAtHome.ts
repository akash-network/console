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

export interface InstallationLog {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error";
  message: string;
}

export interface AkashAtHomeState {
  user: {
    profile: any;
    token: UserToken | null;
  };
  device: {
    info: DeviceInfo | null;
    status: InstallationStatus | null;
  };
  earnings: EarningsData | null;
  isLoading: boolean;
  error: string | null;
}
