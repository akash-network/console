import escapeHtml from "lodash/escape";

import { formatEmailDateTime } from "@src/notifications/lib/email-date-time/email-date-time";
import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";

type ExpiringKey = { name: string; keyFormat: string };

type Expiry = { expiresIn: string; expiresOn: string };

export function apiKeyExpiryReminderNotification(
  user: { id: string; email: string | null; timezone: string | null },
  vars: { apiKeyId: string; keys: ExpiringKey[]; expiresAt: string; daysBeforeExpiry: number; apiKeysUrl: string }
): CreateNotificationInput {
  const expiry = {
    expiresIn: vars.daysBeforeExpiry === 1 ? "tomorrow" : `in ${vars.daysBeforeExpiry} days`,
    expiresOn: `<strong>${formatEmailDateTime(new Date(vars.expiresAt), user.timezone, { dateStyle: "long", timeStyle: "short" })}</strong>`
  };

  return {
    notificationId: `apiKeyExpiryReminder.${vars.apiKeyId}.${vars.expiresAt}.${vars.daysBeforeExpiry}`,
    payload: {
      ...(vars.keys.length === 1 ? remindOfOneKey(vars.keys[0], expiry) : remindOfKeys(vars.keys, expiry)),
      actions: [{ label: "Manage API keys", url: vars.apiKeysUrl }]
    },
    user: { id: user.id, email: user.email }
  };
}

function remindOfOneKey(key: ExpiringKey, { expiresIn, expiresOn }: Expiry) {
  return {
    summary: `Your Akash Console API key "${key.name}" expires ${expiresIn}`,
    description:
      `<p>Your API key ${describeKey(key)} expires on ${expiresOn}. Requests made with it are rejected after that.</p>` +
      "<p>To keep your integrations running, create a new key, switch them over to it, then revoke this one.</p>"
  };
}

function remindOfKeys(keys: ExpiringKey[], { expiresIn, expiresOn }: Expiry) {
  return {
    summary: `${keys.length} of your Akash Console API keys expire ${expiresIn}`,
    description:
      `<p>These API keys expire on ${expiresOn}: ${keys.map(describeKey).join(", ")}. Requests made with them are rejected after that.</p>` +
      "<p>To keep your integrations running, create new keys, switch them over, then revoke these ones.</p>"
  };
}

function describeKey({ name, keyFormat }: ExpiringKey) {
  return `<strong>${escapeHtml(name)}</strong> (${escapeHtml(keyFormat)})`;
}
