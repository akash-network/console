import { randomUUID } from "crypto";

import type { CreateNotificationInput } from "../notification/notification.service";

export function emailVerificationCodeNotification(user: { id: string; email: string }, vars: { code: string }): CreateNotificationInput {
  return {
    notificationId: `emailVerificationCode.${user.id}.${randomUUID()}`,
    payload: {
      summary: "Your verification code",
      description: "Enter this code to verify your email address. It expires in 10 minutes. If you did not request it, please ignore this email.",
      code: vars.code
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
