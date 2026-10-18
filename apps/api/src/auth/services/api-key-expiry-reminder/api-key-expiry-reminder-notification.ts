import escapeHtml from "lodash/escape";

import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";

const EXPIRY_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });

export function apiKeyExpiryReminderNotification(
  user: { id: string; email: string | null },
  vars: { apiKeyId: string; name: string; keyFormat: string; expiresAt: string; daysBeforeExpiry: number; apiKeysUrl: string }
): CreateNotificationInput {
  const expiresIn = vars.daysBeforeExpiry === 1 ? "tomorrow" : `in ${vars.daysBeforeExpiry} days`;

  return {
    notificationId: `apiKeyExpiryReminder.${vars.apiKeyId}.${vars.expiresAt}.${vars.daysBeforeExpiry}`,
    payload: {
      summary: `Your Akash Console API key "${vars.name}" expires ${expiresIn}`,
      description:
        `<p>Your API key <strong>${escapeHtml(vars.name)}</strong> (${escapeHtml(vars.keyFormat)}) expires on ` +
        `<strong>${EXPIRY_FORMAT.format(new Date(vars.expiresAt))} UTC</strong>. Requests made with it are rejected after that.</p>` +
        "<p>To keep your integrations running, create a new key, switch them over to it, then revoke this one.</p>",
      actions: [{ label: "Manage API keys", url: vars.apiKeysUrl }]
    },
    user: { id: user.id, email: user.email }
  };
}
