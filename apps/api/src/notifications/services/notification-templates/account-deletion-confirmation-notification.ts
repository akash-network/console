import { randomUUID } from "crypto";

import type { CreateNotificationInput } from "../notification/notification.service";

export function accountDeletionConfirmationNotification(
  user: { id: string; email: string | null },
  vars: { confirmUrl: string; expiresInMinutes: number; forfeitedBalanceUsd: number }
): CreateNotificationInput {
  const forfeitNotice =
    vars.forfeitedBalanceUsd > 0
      ? ` Your remaining <strong>${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(vars.forfeitedBalanceUsd)}</strong> in credits won't be refunded.`
      : "";

  return {
    notificationId: `accountDeletionConfirmation.${user.id}.${randomUUID()}`,
    payload: {
      summary: "Confirm your Akash Console account deletion",
      description:
        "We got a request to delete your Akash Console account. Deleting it permanently removes your account, API keys, templates and saved settings, and it can't be undone." +
        forfeitNotice +
        ` The button below works for ${vars.expiresInMinutes} minutes. If you didn't make this request, ignore this email and your account stays as it is.`,
      actions: [{ label: "Delete my account", url: vars.confirmUrl }]
    },
    user: { id: user.id, email: user.email }
  };
}
