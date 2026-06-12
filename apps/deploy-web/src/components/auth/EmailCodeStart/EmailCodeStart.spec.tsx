import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AuthService } from "@src/services/auth/auth/auth.service";
import { DEPENDENCIES, EmailCodeStart } from "./EmailCodeStart";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(EmailCodeStart.name, () => {
  it("starts the email code flow and notifies the parent on success", async () => {
    const onStarted = vi.fn();
    const getCaptchaToken = vi.fn().mockResolvedValue("captcha-1");
    const { authService } = setup({ onStarted, getCaptchaToken });
    authService.startEmailCode.mockResolvedValue(undefined);

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    await vi.waitFor(() => {
      expect(authService.startEmailCode).toHaveBeenCalledWith({ email: "alice@example.com", captchaToken: "captcha-1" });
      expect(onStarted).toHaveBeenCalledWith("alice@example.com");
    });
  });

  it("blocks submission for an invalid email", async () => {
    const { authService } = setup();

    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    expect(authService.startEmailCode).not.toHaveBeenCalled();
  });

  it("tracks email_login_init when a valid email starts the flow", async () => {
    const { authService, analyticsService } = setup();
    authService.startEmailCode.mockResolvedValue(undefined);

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    await vi.waitFor(() => {
      expect(analyticsService.track).toHaveBeenCalledWith("email_login_init");
    });
  });

  function setup(input: { defaultEmail?: string; onStarted?: (email: string) => void; getCaptchaToken?: () => Promise<string> } = {}) {
    const authService = mock<AuthService>();
    const analyticsService = mock<AnalyticsService>();
    const onStarted = input.onStarted ?? vi.fn();
    const getCaptchaToken = input.getCaptchaToken ?? vi.fn().mockResolvedValue("captcha-token");

    render(
      <TestContainerProvider services={{ authService: () => authService, analyticsService: () => analyticsService }}>
        <EmailCodeStart defaultEmail={input.defaultEmail} onStarted={onStarted} getCaptchaToken={getCaptchaToken} dependencies={DEPENDENCIES} />
      </TestContainerProvider>
    );

    return { authService, analyticsService, onStarted, getCaptchaToken };
  }
});
