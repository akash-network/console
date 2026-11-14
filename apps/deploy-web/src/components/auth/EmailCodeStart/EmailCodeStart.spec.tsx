import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { CaptchaChallengeError } from "@src/components/turnstile/CaptchaChallengeError";
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

  it("does not track email_login_init when the captcha is never solved", async () => {
    const getCaptchaToken = vi.fn().mockRejectedValue(new CaptchaChallengeError("abandoned"));
    const { authService, analyticsService } = setup({ getCaptchaToken });

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    await vi.waitFor(() => {
      expect(getCaptchaToken).toHaveBeenCalled();
    });
    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(authService.startEmailCode).not.toHaveBeenCalled();
  });

  it("tracks why the code could not be sent, without the address", async () => {
    const { authService, analyticsService } = setup();
    authService.startEmailCode.mockRejectedValue(apiError({ status: 400, code: "action_refused" }));

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    await vi.waitFor(() => {
      expect(analyticsService.track).toHaveBeenCalledWith("email_login_failed", { category: "user", step: "send_code", reason: "refused_by_policy" });
    });
    expect(JSON.stringify(analyticsService.track.mock.calls)).not.toContain("example.com");
  });

  it("does not track a failed send when the code is sent", async () => {
    const { authService, analyticsService, onStarted } = setup();
    authService.startEmailCode.mockResolvedValue(undefined);

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    await vi.waitFor(() => {
      expect(onStarted).toHaveBeenCalled();
    });
    expect(analyticsService.track).not.toHaveBeenCalledWith("email_login_failed", expect.anything());
  });

  it("keeps the label visible and shows a loading indicator while the code is being sent", async () => {
    const { authService } = setup();
    authService.startEmailCode.mockReturnValue(new Promise<void>(() => {}));

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    await vi.waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /continue with email/i })).toBeDisabled();
  });

  it("records the code-send time on a successful send", async () => {
    const { authService, markCodeSent } = setup();
    authService.startEmailCode.mockResolvedValue(undefined);

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    await vi.waitFor(() => {
      expect(markCodeSent).toHaveBeenCalled();
    });
  });

  function setup(
    input: { defaultEmail?: string; onStarted?: (email: string) => void; getCaptchaToken?: () => Promise<string>; markCodeSent?: () => void } = {}
  ) {
    const authService = mock<AuthService>();
    const analyticsService = mock<AnalyticsService>();
    const onStarted = input.onStarted ?? vi.fn();
    const getCaptchaToken = input.getCaptchaToken ?? vi.fn().mockResolvedValue("captcha-token");
    const markCodeSent = input.markCodeSent ?? vi.fn();

    render(
      <TestContainerProvider services={{ authService: () => authService, analyticsService: () => analyticsService }}>
        <EmailCodeStart
          defaultEmail={input.defaultEmail}
          onStarted={onStarted}
          getCaptchaToken={getCaptchaToken}
          dependencies={{ ...DEPENDENCIES, markCodeSent }}
        />
      </TestContainerProvider>
    );

    return { authService, analyticsService, onStarted, getCaptchaToken, markCodeSent };
  }

  function apiError(input: { status: number; code: string }) {
    return new AxiosError("Request failed", String(input.status), undefined, undefined, {
      status: input.status,
      statusText: "Request failed",
      data: { code: input.code },
      headers: {},
      config: mock<InternalAxiosRequestConfig>()
    });
  }
});
