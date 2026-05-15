import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
import { AuthPagePasswordless, DEPENDENCIES } from "./AuthPagePasswordless";

import { act, render } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(AuthPagePasswordless.name, () => {
  it("flips to the verify screen when EmailCodeStart calls onStarted", () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    const EmailCodeVerifyMock = vi.fn(ComponentMock);
    setup({
      dependencies: { EmailCodeStart: EmailCodeStartMock as never, EmailCodeVerify: EmailCodeVerifyMock as never }
    });

    act(() => {
      EmailCodeStartMock.mock.calls[0][0].onStarted("alice@example.com");
    });

    expect(EmailCodeVerifyMock).toHaveBeenCalled();
    expect(EmailCodeVerifyMock.mock.calls.at(-1)?.[0].email).toBe("alice@example.com");
  });

  it("starts on the verify screen and prefills email from initialEmail/initialScreen", () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    const EmailCodeVerifyMock = vi.fn(ComponentMock);
    setup({
      initialEmail: "alice@example.com",
      initialScreen: "verify",
      dependencies: { EmailCodeStart: EmailCodeStartMock as never, EmailCodeVerify: EmailCodeVerifyMock as never }
    });

    expect(EmailCodeVerifyMock).toHaveBeenCalled();
    expect(EmailCodeVerifyMock.mock.calls.at(-1)?.[0].email).toBe("alice@example.com");
  });

  it("returns to the entry screen when EmailCodeVerify calls onEditEmail", () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    const EmailCodeVerifyMock = vi.fn(ComponentMock);
    setup({
      initialEmail: "alice@example.com",
      initialScreen: "verify",
      dependencies: { EmailCodeStart: EmailCodeStartMock as never, EmailCodeVerify: EmailCodeVerifyMock as never }
    });

    act(() => {
      EmailCodeVerifyMock.mock.calls.at(-1)?.[0].onEditEmail();
    });

    expect(EmailCodeStartMock).toHaveBeenCalled();
    expect(EmailCodeStartMock.mock.calls.at(-1)?.[0].defaultEmail).toBe("alice@example.com");
  });

  it("notifies the persistence layer when EmailCodeStart succeeds", () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    const { onFlowChange } = setup({ dependencies: { EmailCodeStart: EmailCodeStartMock as never } });

    act(() => {
      EmailCodeStartMock.mock.calls[0][0].onStarted("alice@example.com");
    });

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
      await EmailCodeVerifyMock.mock.calls.at(-1)?.[0].onVerified();
    });

    expect(onFlowReset).toHaveBeenCalled();
    expect(checkSession).toHaveBeenCalled();
    expect(navigateBack).toHaveBeenCalled();
  });

  it("provides a captcha-token getter that resolves to the Turnstile token", async () => {
    const EmailCodeStartMock = vi.fn(ComponentMock);
    setup({ dependencies: { EmailCodeStart: EmailCodeStartMock as never } });

    const getCaptchaToken = EmailCodeStartMock.mock.calls[0][0].getCaptchaToken as () => Promise<string>;
    const token = await getCaptchaToken();

    expect(token).toBe("test-captcha-token");
  });

  function setup(
    input: {
      initialEmail?: string;
      initialScreen?: "entry" | "verify";
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
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

    const Turnstile = vi.fn(({ turnstileRef }: { turnstileRef?: RefObject<TurnstileRef> }) => {
      if (turnstileRef) {
        (turnstileRef as { current: TurnstileRef }).current = mock<TurnstileRef>({
          renderAndWaitResponse: vi.fn().mockResolvedValue({ token: "test-captcha-token" })
        });
      }
      return null;
    });

    render(
      <TestContainerProvider services={{}}>
        <AuthPagePasswordless
          initialEmail={input.initialEmail ?? ""}
          initialScreen={input.initialScreen ?? "entry"}
          onFlowChange={onFlowChange}
          onFlowReset={onFlowReset}
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useUser,
            useReturnTo,
            Turnstile,
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return { onFlowChange, onFlowReset, checkSession, navigateBack };
  }
});
