import { z } from "zod";

export const notificationTypeSchema = z.enum(["MAINTENANCE"]);

export const maintenanceReasonSchema = z.enum([
  "HARDWARE_UPGRADE",
  "NETWORK_MAINTENANCE",
  "POWER_WORK",
  "DATACENTER_MAINTENANCE",
  "SOFTWARE_UPGRADE",
  "OTHER_MAINTENANCE"
]);

export const notificationDraftInputSchema = z
  .object({
    type: notificationTypeSchema,
    reason: maintenanceReasonSchema,
    start_at: z.string().min(1, "Start time is required"),
    end_at: z.string().min(1, "End time is required"),
    downtime: z.boolean()
  })
  .refine(
    data => {
      const startDate = new Date(data.start_at);
      const endDate = new Date(data.end_at);
      return endDate > startDate;
    },
    {
      message: "End time must be after start time",
      path: ["end_at"]
    }
  )
  .refine(
    data => {
      const startDate = new Date(data.start_at);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      return startDate >= fiveMinutesFromNow;
    },
    {
      message: "Start time must be at least 5 minutes in the future",
      path: ["start_at"]
    }
  )
  .refine(
    data => {
      const startDate = new Date(data.start_at);
      const endDate = new Date(data.end_at);
      const durationMs = endDate.getTime() - startDate.getTime();
      const maxDurationMs = 14 * 24 * 60 * 60 * 1000; // 14 days
      return durationMs <= maxDurationMs;
    },
    {
      message: "Duration cannot exceed 14 days",
      path: ["end_at"]
    }
  );

export const notificationPreviewSchema = z.object({
  subject: z.string(),
  body: z.string()
});

export const rateLimitSchema = z.object({
  remaining: z.number(),
  window_ends_at: z.string()
});

export const notificationDraftSchema = z.object({
  id: z.string(),
  status: z.literal("draft"),
  preview: notificationPreviewSchema,
  rate_limit: rateLimitSchema
});

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  reason: maintenanceReasonSchema,
  start_at: z.string(),
  end_at: z.string(),
  downtime: z.boolean(),
  status: z.enum(["draft", "queued", "sending", "sent", "failed"]),
  created_at: z.string(),
  preview: notificationPreviewSchema.optional(),
  delivery: z
    .object({
      total: z.number(),
      delivered: z.number(),
      failed: z.number()
    })
    .optional()
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number()
});

export const sendNotificationResponseSchema = z.object({
  status: z.literal("queued")
});

// Helper function to get reason display labels
export const getReasonLabel = (reason: string): string => {
  const labels: Record<string, string> = {
    HARDWARE_UPGRADE: "Hardware Upgrade",
    NETWORK_MAINTENANCE: "Network Maintenance",
    POWER_WORK: "Power Work",
    DATACENTER_MAINTENANCE: "Datacenter Maintenance",
    SOFTWARE_UPGRADE: "Software Upgrade",
    OTHER_MAINTENANCE: "Other Maintenance"
  };
  return labels[reason] || reason;
};

// Helper function to get status display labels and colors
export const getStatusInfo = (status: string) => {
  const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
    draft: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
    queued: { label: "Queued", color: "text-blue-600", bgColor: "bg-blue-100" },
    sending: { label: "Sending", color: "text-yellow-600", bgColor: "bg-yellow-100" },
    sent: { label: "Sent", color: "text-green-600", bgColor: "bg-green-100" },
    failed: { label: "Failed", color: "text-red-600", bgColor: "bg-red-100" }
  };
  return statusMap[status] || { label: status, color: "text-gray-600", bgColor: "bg-gray-100" };
};
