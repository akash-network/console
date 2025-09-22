export type NotificationType = "MAINTENANCE";

export type MaintenanceReason = "HARDWARE_UPGRADE" | "NETWORK_MAINTENANCE" | "POWER_WORK" | "DATACENTER_MAINTENANCE" | "SOFTWARE_UPGRADE" | "OTHER_MAINTENANCE";

export interface NotificationDraftInput {
  type: NotificationType;
  reason: MaintenanceReason;
  start_at: string; // ISO UTC
  end_at: string; // ISO UTC
  downtime: boolean;
}

export interface NotificationPreview {
  subject: string;
  body: string;
}

export interface RateLimit {
  remaining: number;
  window_ends_at: string;
}

export interface NotificationDraft {
  id: string;
  status: "draft";
  preview: NotificationPreview;
  rate_limit: RateLimit;
}

export interface Notification {
  id: string;
  type: NotificationType;
  reason: MaintenanceReason;
  start_at: string;
  end_at: string;
  downtime: boolean;
  status: "draft" | "queued" | "sending" | "sent" | "failed";
  created_at: string;
  preview?: NotificationPreview;
  delivery?: {
    total: number;
    delivered: number;
    failed: number;
  };
}

export interface NotificationListResponse {
  items: Notification[];
  page: number;
  page_size: number;
  total: number;
}

export interface SendNotificationResponse {
  status: "queued";
}

// API Error types
export interface NotificationError {
  message: string;
  code?: string;
  field?: string;
  rate_limit?: RateLimit;
}
