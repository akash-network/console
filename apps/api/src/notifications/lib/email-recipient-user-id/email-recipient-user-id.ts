import { createHash } from "node:crypto";

const UUID_V8_VERSION = "8";
const RFC_4122_VARIANT_BITS = 0x8;
const VARIANT_MASK = 0x3;

/** Notification channels belong to a user id, so an address with no account behind it gets one derived from the address itself. */
export function emailRecipientUserId(email: string): string {
  const hex = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  const variant = ((parseInt(hex[16], 16) & VARIANT_MASK) | RFC_4122_VARIANT_BITS).toString(16);

  return [hex.slice(0, 8), hex.slice(8, 12), `${UUID_V8_VERSION}${hex.slice(13, 16)}`, `${variant}${hex.slice(17, 20)}`, hex.slice(20, 32)].join("-");
}
