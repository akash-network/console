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

  it("escapes HTML characters in the code", () => {
    const user = { id: "user-456", email: "test@example.com" };
    const vars = { code: '<script>alert("xss")</script>' };

    const result = emailVerificationCodeNotification(user, vars);

    expect(result.payload.description).not.toContain("<script>");
    expect(result.payload.description).toContain("&lt;script&gt;");
    expect(result.payload.description).toContain("&quot;xss&quot;");
  });

  it("escapes ampersands in the code", () => {
    const user = { id: "user-789", email: "test@example.com" };
    const vars = { code: "a&b" };

    const result = emailVerificationCodeNotification(user, vars);

    expect(result.payload.description).toContain("a&amp;b");
  });

  it("escapes single quotes in the code", () => {
    const user = { id: "user-abc", email: "test@example.com" };
    const vars = { code: "it's" };

    const result = emailVerificationCodeNotification(user, vars);

    expect(result.payload.description).toContain("it&#39;s");
  });
});
