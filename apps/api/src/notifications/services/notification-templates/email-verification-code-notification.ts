import { randomUUID } from "crypto";

import type { CreateNotificationInput } from "../notification/notification.service";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function emailVerificationCodeNotification(user: { id: string; email: string }, vars: { code: string }): CreateNotificationInput {
  return {
    notificationId: `emailVerificationCode.${user.id}.${randomUUID()}`,
    payload: {
      summary: "Your verification code",
      description:
        `Your email verification code is: <strong>${escapeHtml(vars.code)}</strong>. ` +
        `This code expires in 10 minutes. If you did not request this code, please ignore this email.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
