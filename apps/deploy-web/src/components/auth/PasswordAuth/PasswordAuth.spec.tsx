import { type RefObject, useState } from "react";
import type { Tabs } from "@akashnetwork/ui/components";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AuthService } from "@src/services/auth/auth/auth.service";
import type { SignInForm, SignInFormValues } from "../SignInForm/SignInForm";
import type { SignUpForm, SignUpFormValues } from "../SignUpForm/SignUpForm";
import { DEPENDENCIES, PasswordAuth } from "./PasswordAuth";

import { act, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(PasswordAuth.name, () => {
  it("sets active tab based on query param", () => {
    const TabsMock = vi.fn(ComponentMock as typeof Tabs);
    setup({
      searchParams: { tab: "signup" },
      dependencies: { Tabs: TabsMock as unknown as typeof Tabs }
    });
    expect(TabsMock).toHaveBeenCalledWith(expect.objectContaining({ value: "signup" }), expect.anything());
  });

  it("resets mutation error and updates tab query when switching tabs", async () => {
    const TabsMock = vi.fn(ComponentMock as typeof Tabs);
    const SignUpFormMock = vi.fn(ComponentMock as typeof SignUpForm);
    const RemoteApiErrorMock = vi.fn(({ error }) => error && <div>Unexpected error</div>);
    const { authService } = setup({
      searchParams: { tab: "signup" },
      dependencies: {
        Tabs: TabsMock as unknown as typeof Tabs,
        SignUpForm: SignUpFormMock,
        RemoteApiError: RemoteApiErrorMock
      }
    });
    authService.signup.mockRejectedValue(new Error("Account exists"));

    act(() =>
      SignUpFormMock.mock.lastCall![0].onSubmit({
        email: "test@example.com",
        password: "password123",
        termsAndConditions: true
      })
    );

    await vi.waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });

    act(() => TabsMock.mock.lastCall![0].onValueChange?.("login"));

    await vi.waitFor(() => {
      expect(screen.queryByText(/unexpected error/i)).not.toBeInTheDocument();
    });
  });

  describe("when SignIn tab is open", () => {
    it("runs sign-in flow with captcha token, refreshes the session, and navigates back", async () => {
      const SignInFormMock = vi.fn(ComponentMock as typeof SignInForm);
      const { authService, checkSession, navigateBack } = setup({
        dependencies: { SignInForm: SignInFormMock }
      });
      const credentials: SignInFormValues = { email: "test@example.com", password: "password123" };

      act(() => SignInFormMock.mock.lastCall![0].onSubmit(credentials));

      await vi.waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({ ...credentials, captchaToken: "test-captcha-token" });
      });
      expect(authService.signup).not.toHaveBeenCalled();
      await vi.waitFor(() => {
        expect(checkSession).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(navigateBack).toHaveBeenCalled();
      });
    });

    it("renders RemoteApiError when sign-in fails", async () => {
      const SignInFormMock = vi.fn(ComponentMock as typeof SignInForm);
      const RemoteApiErrorMock = vi.fn(({ error }) => error && <div>Unexpected error</div>);
      const { authService } = setup({
        dependencies: { SignInForm: SignInFormMock, RemoteApiError: RemoteApiErrorMock }
      });
      authService.login.mockRejectedValue(new Error("Invalid credentials"));

      act(() => SignInFormMock.mock.lastCall![0].onSubmit({ email: "test@example.com", password: "password123" }));

      await vi.waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
    });
  });

  describe("when SignUp tab is open", () => {
    it("runs sign-up flow with captcha token, refreshes the session, and navigates back", async () => {
      const SignUpFormMock = vi.fn(ComponentMock as typeof SignUpForm);
      const { authService, checkSession, navigateBack } = setup({
        searchParams: { tab: "signup" },
        dependencies: { SignUpForm: SignUpFormMock }
      });
      const credentials: SignUpFormValues = {
        email: "test@example.com",
        password: "password123",
        termsAndConditions: true
      };

      act(() => SignUpFormMock.mock.lastCall![0].onSubmit(credentials));

      await vi.waitFor(() => {
        expect(authService.signup).toHaveBeenCalledWith({ ...credentials, captchaToken: "test-captcha-token" });
      });
      expect(authService.login).not.toHaveBeenCalled();
      await vi.waitFor(() => {
        expect(checkSession).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(navigateBack).toHaveBeenCalled();
      });
    });

    it("renders RemoteApiError when sign-up fails", async () => {
      const SignUpFormMock = vi.fn(ComponentMock as typeof SignUpForm);
      const RemoteApiErrorMock = vi.fn(({ error }) => error && <div>Unexpected error</div>);
      const { authService } = setup({
        searchParams: { tab: "signup" },
        dependencies: { SignUpForm: SignUpFormMock, RemoteApiError: RemoteApiErrorMock }
      });
      authService.signup.mockRejectedValue(new Error("Email already in use"));

      act(() =>
        SignUpFormMock.mock.lastCall![0].onSubmit({
          email: "test@example.com",
          password: "password123",
          termsAndConditions: true
        })
      );

      await vi.waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
    });
  });

  describe("when ForgotPassword view is open", () => {
    it("swaps to the forgot-password form when SignInForm's forgot link is clicked", async () => {
      const SignInFormMock = vi.fn((() => <span>SignInForm</span>) as typeof SignInForm);
      const ForgotPasswordFormMock = vi.fn(() => <span>ForgotPasswordForm</span>);
      const { router } = setup({
        dependencies: {
          SignInForm: SignInFormMock,
          ForgotPasswordForm: ForgotPasswordFormMock as never
        }
      });

      await act(() => SignInFormMock.mock.lastCall![0].onForgotPasswordClick?.());

      await vi.waitFor(() => {
        expect(router.replace).toHaveBeenCalledTimes(1);
        expect(screen.getByText("ForgotPasswordForm")).toBeInTheDocument();
      });
    });

    it("submits the forgot-password form with the captcha token", async () => {
      const ForgotPasswordFormMock = vi.fn(ComponentMock as typeof DEPENDENCIES.ForgotPasswordForm);
      const { authService } = setup({
        searchParams: { tab: "forgot-password" },
        dependencies: { ForgotPasswordForm: ForgotPasswordFormMock }
      });

      await act(() => ForgotPasswordFormMock.mock.lastCall![0].onSubmit({ email: "test@example.com" }));

      await vi.waitFor(() => {
        expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith({
          email: "test@example.com",
          captchaToken: "test-captcha-token"
        });
      });
    });
  });

  describe("$5 credit subtext", () => {
    it("renders when console_onboarding_redesign is enabled and the login/signup view is active", () => {
      setup({ isOnboardingRedesignEnabled: true });
      expect(screen.getByText(/\$5 credit to deploy your first container/i)).toBeInTheDocument();
    });

    it("does not render when console_onboarding_redesign is disabled", () => {
      setup({ isOnboardingRedesignEnabled: false });
      expect(screen.queryByText(/\$5 credit to deploy your first container/i)).not.toBeInTheDocument();
    });

    it("does not render in the forgot-password view even when console_onboarding_redesign is enabled", () => {
      setup({ searchParams: { tab: "forgot-password" }, isOnboardingRedesignEnabled: true });
      expect(screen.queryByText(/\$5 credit to deploy your first container/i)).not.toBeInTheDocument();
    });
  });

  function setup(
    input: {
      searchParams?: {
        tab?: "login" | "signup" | "forgot-password";
        returnTo?: string;
        from?: string;
      };
      isOnboardingRedesignEnabled?: boolean;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const authService = mock<AuthService>();
    let setRouterPageParams: (params: URLSearchParams) => void = () => {};
    const router = mock<NextRouter>({
      replace: vi.fn(url => {
        setRouterPageParams?.(new URL(url as string, "http://localunittest:8080").searchParams);
        return Promise.resolve(true);
      }),
      push: vi.fn().mockResolvedValue(true)
    });
    const checkSession = vi.fn(async () => undefined);
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ checkSession, isLoading: false, user: undefined });
    const navigateBack = vi.fn();
    const useReturnTo: typeof DEPENDENCIES.useReturnTo = () =>
      mock<ReturnType<typeof DEPENDENCIES.useReturnTo>>({
        returnTo: input.searchParams?.returnTo || input.searchParams?.from || "/",
        navigateWithReturnTo: vi.fn(),
        navigateBack,
        hasReturnTo: false,
        isDeploymentReturnTo: false
      });
    const useFlag: typeof DEPENDENCIES.useFlag = (() => Boolean(input.isOnboardingRedesignEnabled)) as never;

    const params = new URLSearchParams();
    params.set("tab", input.searchParams?.tab || "login");
    if (input.searchParams?.from) params.set("from", input.searchParams.from);
    if (input.searchParams?.returnTo) params.set("returnTo", input.searchParams.returnTo);
    const useSearchParams = () => {
      const [pageParams, setPageParams] = useState(params);
      setRouterPageParams = setPageParams;
      return pageParams as ReadonlyURLSearchParams;
    };

    const Turnstile = vi.fn(({ turnstileRef }: { turnstileRef?: RefObject<TurnstileRef> }) => {
      if (turnstileRef) {
        (turnstileRef as { current: TurnstileRef }).current = mock<TurnstileRef>({
          renderAndWaitResponse: vi.fn().mockResolvedValue({ token: "test-captcha-token" })
        });
      }
      return null;
    });
    const analyticsService = mock<AnalyticsService>();

    render(
      <TestContainerProvider services={{ authService: () => authService, analyticsService: () => analyticsService }}>
        <PasswordAuth
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useUser,
            useSearchParams,
            useRouter: () => router,
            useReturnTo,
            useFlag,
            Turnstile,
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return { authService, analyticsService, router, checkSession, navigateBack };
  }
});
