import escapeHtml from "lodash/escape";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

const EXPIRY_DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

const EXPIRY_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });

/** Key names are whatever the owner typed, so they are escaped before going into the markup; the summary stays plain text, which the email layout escapes. */
export function apiKeysExpiryAssignedNotification(
  user: UserOutput,
  vars: { keys: { name: string; keyFormat: string }[]; expiresAt: string; apiKeysUrl: string }
): CreateNotificationInput {
  const expiresAt = new Date(vars.expiresAt);
  const expiryDate = EXPIRY_DATE_FORMAT.format(expiresAt);
  const listedKeys = vars.keys.map(({ name, keyFormat }) => `<strong>${escapeHtml(name)}</strong> (${escapeHtml(keyFormat)})`).join(", ");

  return {
    notificationId: `apiKeysExpiryAssigned.${user.id}.${vars.expiresAt}`,
    payload: {
      summary:
        vars.keys.length === 1
          ? `Your Akash Console API key "${vars.keys[0].name}" now expires on ${expiryDate}`
          : `${vars.keys.length} of your Akash Console API keys now expire on ${expiryDate}`,
      description:
        "<p>Akash Console API keys now expire after one year at most. " +
        `These keys of yours had no expiration, so they stop working on <strong>${EXPIRY_FORMAT.format(expiresAt)} UTC</strong>: ${listedKeys}.</p>` +
        "<p>Before then, create new keys, switch your integrations over to them, then revoke the old ones. " +
        "We will remind you 30, 7 and 1 day before they expire.</p>",
      actions: [{ label: "Manage API keys", url: vars.apiKeysUrl }]
    },
    user: { id: user.id, email: user.email }
  };
}
