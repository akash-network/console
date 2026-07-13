import type { ReactNode, RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DEPENDENCIES, PasswordlessAuth } from "./PasswordlessAuth";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(PasswordlessAuth.name, () => {
  it("flips to the verify screen when EmailCodeStart calls onStarted", () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    const EmailCodeVerifyMock = vi.fn(ComponentMock);
    setup({
      dependencies: { EmailCodeStart: EmailCodeStartMock as never, EmailCodeVerify: EmailCodeVerifyMock as never }
    });

    act(() => EmailCodeStartMock.mock.lastCall![0].onStarted("alice@example.com"));

    expect(EmailCodeVerifyMock).toHaveBeenLastCalledWith(expect.objectContaining({ email: "alice@example.com" }), expect.anything());
  });

  it("starts on the verify screen and prefills email from initialEmail/initialScreen", () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    const EmailCodeVerifyMock = vi.fn(ComponentMock);
    setup({
      initialEmail: "alice@example.com",
      initialScreen: "verify",
      dependencies: { EmailCodeStart: EmailCodeStartMock as never, EmailCodeVerify: EmailCodeVerifyMock as never }
    });

    expect(EmailCodeVerifyMock).toHaveBeenLastCalledWith(expect.objectContaining({ email: "alice@example.com" }), expect.anything());
  });

  it("returns to the entry screen when EmailCodeVerify calls onEditEmail", () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    const EmailCodeVerifyMock = vi.fn(ComponentMock);
    setup({
      initialEmail: "alice@example.com",
      initialScreen: "verify",
      dependencies: { EmailCodeStart: EmailCodeStartMock as never, EmailCodeVerify: EmailCodeVerifyMock as never }
    });

    act(() => EmailCodeVerifyMock.mock.lastCall![0].onEditEmail());

    expect(EmailCodeStartMock).toHaveBeenLastCalledWith(expect.objectContaining({ defaultEmail: "alice@example.com" }), expect.anything());
  });

  it("notifies the persistence layer when EmailCodeStart succeeds", () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    const { onFlowChange } = setup({ dependencies: { EmailCodeStart: EmailCodeStartMock as never } });

    act(() => EmailCodeStartMock.mock.lastCall![0].onStarted("alice@example.com"));

    expect(onFlowChange).toHaveBeenLastCalledWith({ email: "alice@example.com", screen: "verify" });
  });

  it("resets the persisted flow, refreshes the session, and navigates back when EmailCodeVerify calls onVerified", async () => {
    const EmailCodeVerifyMock = vi.fn(ComponentMock);
    const { onFlowReset, checkSession, navigateBack } = setup({
      initialEmail: "alice@example.com",
      initialScreen: "verify",
      dependencies: { EmailCodeVerify: EmailCodeVerifyMock as never }
    });

    await act(async () => {
      await EmailCodeVerifyMock.mock.lastCall![0].onVerified();
    });

    expect(onFlowReset).toHaveBeenCalled();
    expect(checkSession).toHaveBeenCalled();
    expect(navigateBack).toHaveBeenCalled();
  });

  it("provides a captcha-token getter that resolves to the Turnstile token", async () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    setup({ dependencies: { EmailCodeStart: EmailCodeStartMock as never } });

    const { getCaptchaToken } = EmailCodeStartMock.mock.lastCall![0];
    const token = await getCaptchaToken();

    expect(token).toBe("test-captcha-token");
  });

  it("shows the $1 credit subtext when onboarding_redesign_v1 is enabled", () => {
    setup({ isOnboardingRedesignEnabled: true });
    expect(screen.getByText(/\$1 credit to deploy your first container/i)).toBeInTheDocument();
  });

  it("hides the $1 credit subtext when onboarding_redesign_v1 is disabled", () => {
    setup({ isOnboardingRedesignEnabled: false });
    expect(screen.queryByText(/\$1 credit to deploy your first container/i)).not.toBeInTheDocument();
  });

  it("tracks terms_link_clk when the Terms link is clicked", async () => {
    const { analyticsService } = setup({ dependencies: { Link: AnchorLink as never } });

    await userEvent.click(screen.getByRole("link", { name: "Terms" }));

    expect(analyticsService.track).toHaveBeenCalledWith("terms_link_clk");
  });

  it("tracks privacy_policy_link_clk when the Privacy Policy link is clicked", async () => {
    const { analyticsService } = setup({ dependencies: { Link: AnchorLink as never } });

    await userEvent.click(screen.getByRole("link", { name: "Privacy Policy" }));

    expect(analyticsService.track).toHaveBeenCalledWith("privacy_policy_link_clk");
  });

  function setup(
    input: {
      initialEmail?: string;
      initialScreen?: "entry" | "verify";
      isOnboardingRedesignEnabled?: boolean;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const analyticsService = mock<AnalyticsService>();
    const onFlowChange = vi.fn();
    const onFlowReset = vi.fn();
    const checkSession = vi.fn(async () => undefined);
    const navigateBack = vi.fn();
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        checkSession,
        isLoading: false,
        user: undefined
      });
    const useReturnTo: typeof DEPENDENCIES.useReturnTo = () =>
      mock<ReturnType<typeof DEPENDENCIES.useReturnTo>>({
        returnTo: "/",
        navigateWithReturnTo: vi.fn(),
        navigateBack,
        hasReturnTo: false,
        isDeploymentReturnTo: false
      });
    const useFlag: typeof DEPENDENCIES.useFlag = (() => Boolean(input.isOnboardingRedesignEnabled)) as never;

    const Turnstile = vi.fn(({ turnstileRef }: { turnstileRef?: RefObject<TurnstileRef> }) => {
      if (turnstileRef) {
        (turnstileRef as { current: TurnstileRef }).current = mock<TurnstileRef>({
          renderAndWaitResponse: vi.fn().mockResolvedValue({ token: "test-captcha-token" })
        });
      }
      return null;
    });

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <PasswordlessAuth
          initialEmail={input.initialEmail ?? ""}
          initialScreen={input.initialScreen ?? "entry"}
          onFlowChange={onFlowChange}
          onFlowReset={onFlowReset}
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useUser,
            useReturnTo,
            useFlag,
            Turnstile,
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return { analyticsService, onFlowChange, onFlowReset, checkSession, navigateBack };
  }
});

/** Renders Link dependency as a real anchor so click handlers are exercised in tests. */
function AnchorLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <a href="#" onClick={onClick}>
      {children}
    </a>
  );
}
