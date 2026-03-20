import { emailVerificationCodeNotification } from "./email-verification-code-notification";

describe(emailVerificationCodeNotification.name, () => {
  it("returns notification with correct structure", () => {
    const user = { id: "user-123", email: "test@example.com" };
    const vars = { code: "123456" };

    const result = emailVerificationCodeNotification(user, vars);

    expect(result.notificationId).toMatch(/^emailVerificationCode\.user-123\.[0-9a-f-]{36}$/);
    expect(result.payload.summary).toBe("Your verification code");
    expect(result.payload.description).toContain("<strong>123456</strong>");
    expect(result.payload.description).toContain("expires in 10 minutes");
    expect(result.user).toEqual({ id: "user-123", email: "test@example.com" });
  });
});
