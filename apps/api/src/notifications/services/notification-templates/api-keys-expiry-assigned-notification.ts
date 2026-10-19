import escapeHtml from "lodash/escape";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

const EXPIRY_DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

const EXPIRY_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });

const POLICY = "<p>Akash Console API keys now expire after one year at most. ";

type AssignedKey = { name: string; keyFormat: string };

/** Key names are whatever the owner typed, so they are escaped before going into the markup; the summary stays plain text, which the email layout escapes. */
export function apiKeysExpiryAssignedNotification(
  user: UserOutput,
  vars: { organizationId: string | null; keys: AssignedKey[]; expiresAt: string; apiKeysUrl: string }
): CreateNotificationInput {
  const expiresAt = new Date(vars.expiresAt);
  const expiryDate = EXPIRY_DATE_FORMAT.format(expiresAt);
  const stopsWorkingOn = `<strong>${EXPIRY_FORMAT.format(expiresAt)} UTC</strong>`;
  const [onlyKey] = vars.keys;

  return {
    notificationId: `apiKeysExpiryAssigned.${user.id}.${vars.organizationId ?? "unassigned"}.${vars.expiresAt}`,
    payload: {
      ...(vars.keys.length === 1
        ? {
            summary: `Your Akash Console API key "${onlyKey.name}" now expires on ${expiryDate}`,
            description:
              `${POLICY}Your API key ${describeKey(onlyKey)} had no expiration, so it stops working on ${stopsWorkingOn}.</p>` +
              "<p>Before then, create a new key, switch your integrations over to it, then revoke the old one. " +
              "We will remind you 30, 7 and 1 day before it expires.</p>"
          }
        : {
            summary: `${vars.keys.length} of your Akash Console API keys now expire on ${expiryDate}`,
            description:
              `${POLICY}These keys of yours had no expiration, so they stop working on ${stopsWorkingOn}: ${vars.keys.map(describeKey).join(", ")}.</p>` +
              "<p>Before then, create new keys, switch your integrations over to them, then revoke the old ones. " +
              "We will remind you 30, 7 and 1 day before they expire.</p>"
          }),
      actions: [{ label: "Manage API keys", url: vars.apiKeysUrl }]
    },
    user: { id: user.id, email: user.email }
  };
}

function describeKey({ name, keyFormat }: AssignedKey) {
  return `<strong>${escapeHtml(name)}</strong> (${escapeHtml(keyFormat)})`;
}
