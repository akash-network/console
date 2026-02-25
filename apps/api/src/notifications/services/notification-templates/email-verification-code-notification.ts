import type { CreateNotificationInput } from "../notification/notification.service";

export function emailVerificationCodeNotification(user: { id: string; email: string }, vars: { code: string }): CreateNotificationInput {
  return {
    notificationId: `emailVerificationCode.${user.id}.${Date.now()}`,
    payload: {
      summary: "Your verification code",
      description:
        `Your email verification code is: <strong>${vars.code}</strong>. ` +
        `This code expires in 10 minutes. If you did not request this code, please ignore this email.`
    },
    user: {
      id: user.id,
      email: user.email
    }
  };
}
