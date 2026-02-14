import { type RefObject, useState } from "react";
import type { Tabs } from "@akashnetwork/ui/components";
import { mock } from "jest-mock-extended";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { NextRouter } from "next/router";

import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AuthService } from "@src/services/auth/auth/auth.service";
import type { SignInForm, SignInFormValues } from "../SignInForm/SignInForm";
import type { SignUpForm, SignUpFormValues } from "../SignUpForm/SignUpForm";
import { AuthPage, DEPENDENCIES } from "./AuthPage";

import { act, render, screen, waitFor } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(AuthPage.name, () => {
  it("redirects to social login with computed return url", async () => {
    const SocialAuthMock = jest.fn(ComponentMock);
    const { authService } = setup({
      searchParams: {
        tab: "login",
        from: "/protected"
      },
      dependencies: {
        SocialAuth: SocialAuthMock
      }
    });
    authService.loginViaOauth.mockResolvedValue(undefined);

    act(() => {
      SocialAuthMock.mock.calls[0][0].onSocialLogin("github");
    });

    await waitFor(() => {
      expect(authService.loginViaOauth).toHaveBeenCalledWith({
        connection: "github",
        returnTo: "/protected"
      });
    });
  });

  it("sets active tab based on query param", () => {
    const TabsMock = jest.fn(ComponentMock as typeof Tabs);
    setup({
      searchParams: {
        tab: "signup"
      },
      dependencies: {
        Tabs: TabsMock as unknown as typeof Tabs
      }
    });
    expect(TabsMock.mock.calls[0][0].value).toBe("signup");
  });

  it("resets mutation and updates tab query when switching to login", async () => {
    const TabsMock = jest.fn(ComponentMock as typeof Tabs);
    const SignUpFormMock = jest.fn(ComponentMock as typeof SignUpForm);
    const RemoteApiErrorMock = jest.fn(({ error }) => error && <div>Unexpected error</div>);
    const { authService } = setup({
      searchParams: {
        tab: "signup"
      },
      dependencies: {
        Tabs: TabsMock as unknown as typeof Tabs,
        SignUpForm: SignUpFormMock,
        RemoteApiError: RemoteApiErrorMock
      }
    });
    authService.signup.mockRejectedValue(new Error("Account exists"));

    act(() => {
      SignUpFormMock.mock.calls[0][0].onSubmit({
        email: "test@example.com",
        password: "password123",
        termsAndConditions: true
      });
    });

    await waitFor(() => {
      expect(authService.signup).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });

    act(() => {
      TabsMock.mock.calls[0][0].onValueChange?.("login");
    });

    await waitFor(() => {
      expect(screen.queryByText(/unexpected error/i)).not.toBeInTheDocument();
    });
  });

  describe("when SignIn tab is open", () => {
    it("runs sign-in flow and redirects to return url", async () => {
      const SignInFormMock = jest.fn(ComponentMock as typeof SignInForm);
      const { authService, checkSession, navigateBack } = setup({
        searchParams: {
          returnTo: "/dashboard"
        },
        dependencies: {
          SignInForm: SignInFormMock
        }
      });
      const credentials: SignInFormValues = {
        email: "test@example.com",
        password: "password123"
      };

      act(() => {
        SignInFormMock.mock.calls[0][0].onSubmit(credentials);
      });

      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({
          ...credentials,
          captchaToken: "test-captcha-token"
        });
      });
      expect(authService.signup).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(checkSession).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(navigateBack).toHaveBeenCalled();
      });
    });

    it("shows alert when sign-in fails", async () => {
      const SignInFormMock = jest.fn(ComponentMock as typeof SignInForm);
      const RemoteApiErrorMock = jest.fn(({ error }) => error && <div>Unexpected error</div>);
      const { authService, router, navigateBack } = setup({
        dependencies: {
          SignInForm: SignInFormMock,
          RemoteApiError: RemoteApiErrorMock
        }
      });
      authService.login.mockRejectedValue(new Error("Invalid credentials"));

      act(() => {
        SignInFormMock.mock.calls[0][0].onSubmit({
          email: "test@example.com",
          password: "password123"
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
      expect(router.push).not.toHaveBeenCalled();
      expect(navigateBack).not.toHaveBeenCalled();
    });
  });

  describe("when SignUp tab is open", () => {
    it("runs sign-up flow and redirects to return url", async () => {
      const SignUpFormMock = jest.fn(ComponentMock as typeof SignUpForm);
      const { authService, checkSession, navigateBack } = setup({
        searchParams: {
          returnTo: "/dashboard"
        },
        dependencies: {
          SignUpForm: SignUpFormMock
        }
      });
      const credentials: SignUpFormValues = {
        email: "test@example.com",
        password: "password123",
        termsAndConditions: true
      };

      act(() => {
        SignUpFormMock.mock.calls[0][0].onSubmit(credentials);
      });

      await waitFor(() => {
        expect(authService.signup).toHaveBeenCalledWith({
          ...credentials,
          captchaToken: "test-captcha-token"
        });
      });
      expect(authService.login).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(checkSession).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(navigateBack).toHaveBeenCalled();
      });
    });

    it("shows alert when sign-up fails", async () => {
      const SignUpFormMock = jest.fn(ComponentMock as typeof SignUpForm);
      const RemoteApiErrorMock = jest.fn(({ error }) => error && <div>Unexpected error</div>);
      const { authService, router, navigateBack } = setup({
        dependencies: {
          SignUpForm: SignUpFormMock,
          RemoteApiError: RemoteApiErrorMock
        }
      });
      authService.signup.mockRejectedValue(new Error("Invalid credentials"));

      act(() => {
        SignUpFormMock.mock.calls[0][0].onSubmit({
          email: "test@example.com",
          password: "password123",
          termsAndConditions: true
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
      expect(router.push).not.toHaveBeenCalled();
      expect(navigateBack).not.toHaveBeenCalled();
    });
  });

  describe("when ForgotPassword view is open", () => {
    it("renders forgot password form when SignInForm notifies about its request", async () => {
      const SignInFormMock = jest.fn((() => <span>SignInForm</span>) as typeof SignInForm);
      const ForgotPasswordFormMock = jest.fn(() => <span>ForgotPasswordForm</span>);
      const { router } = setup({
        dependencies: {
          SignInForm: SignInFormMock,
          ForgotPasswordForm: ForgotPasswordFormMock
        }
      });

      await act(() => {
        SignInFormMock.mock.calls[0][0].onForgotPasswordClick?.();
      });

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledTimes(1);
        expect(screen.getByText("ForgotPasswordForm")).toBeInTheDocument();
      });
    });

    it("submits forgot password form and displays success message", async () => {
      const ForgotPasswordFormMock = jest.fn(ComponentMock as typeof DEPENDENCIES.ForgotPasswordForm);
      const { authService } = setup({
        searchParams: {
          tab: "forgot-password"
        },
        dependencies: {
          ForgotPasswordForm: ForgotPasswordFormMock
        }
      });

      await act(() => {
        ForgotPasswordFormMock.mock.calls[0][0].onSubmit({ email: "test@example.com" });
      });

      await waitFor(() => {
        expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith({ email: "test@example.com", captchaToken: "test-captcha-token" });
      });
    });
  });

  function setup(input: {
    searchParams?: {
      tab?: "login" | "signup" | "forgot-password";
      returnTo?: string;
      from?: string;
    };
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const authService = mock<AuthService>();
    let setRouterPageParams: (params: URLSearchParams) => void = () => {};
    const router = mock<NextRouter>({
      replace: jest.fn(url => {
        setRouterPageParams?.(new URL(url as string, "http://localunittest:8080").searchParams);
        return Promise.resolve(true);
      }),
      push: jest.fn().mockResolvedValue(true)
    });
    const checkSession = jest.fn(async () => undefined);
    const useUser: typeof DEPENDENCIES.useUser = () => ({
      checkSession,
      isLoading: false,
      error: undefined,
      user: {}
    });

    const navigateBack = jest.fn();
    const useReturnTo: typeof DEPENDENCIES.useReturnTo = () => ({
      returnTo: input.searchParams?.returnTo || input.searchParams?.from || "/",
      navigateWithReturnTo: jest.fn(),
      navigateBack,
      hasReturnTo: true,
      isDeploymentReturnTo: false
    });

    const useWallet: typeof DEPENDENCIES.useWallet = () => ({
      address: "",
      walletName: "",
      isWalletConnected: false,
      isWalletLoaded: false,
      connectManagedWallet: jest.fn(),
      logout: jest.fn(),
      signAndBroadcastTx: jest.fn(),
      isManaged: false,
      isCustodial: false,
      isWalletLoading: false,
      isTrialing: false,
      isOnboarding: false,
      switchWalletType: jest.fn(),
      hasManagedWallet: false
    });

    const params = new URLSearchParams();
    params.set("tab", input.searchParams?.tab || "login");
    if (input.searchParams?.from) {
      params.set("from", input.searchParams.from);
    }
    if (input.searchParams?.returnTo) {
      params.set("returnTo", input.searchParams.returnTo);
    }
    const useSearchParams = () => {
      const [pageParams, setPageParams] = useState(params);
      setRouterPageParams = setPageParams;
      return pageParams as ReadonlyURLSearchParams;
    };

    const Turnstile = jest.fn(({ turnstileRef }: { turnstileRef?: RefObject<TurnstileRef> }) => {
      if (turnstileRef) {
        (turnstileRef as { current: TurnstileRef }).current = {
          renderAndWaitResponse: jest.fn().mockResolvedValue({ token: "test-captcha-token" })
        };
      }
      return null;
    });
    const analyticsService = mock<AnalyticsService>();

    render(
      <TestContainerProvider services={{ authService: () => authService, analyticsService: () => analyticsService }}>
        <AuthPage
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useUser,
            useSearchParams,
            useRouter: () => router,
            useReturnTo: input.dependencies?.useReturnTo || useReturnTo,
            useWallet: input.dependencies?.useWallet || useWallet,
            Turnstile,
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return {
      authService,
      analyticsService,
      router,
      checkSession,
      navigateBack
    };
  }
});
