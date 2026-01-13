import { type RefObject, useState } from "react";
import type { Tabs } from "@akashnetwork/ui/components";
import { mock } from "jest-mock-extended";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { NextRouter } from "next/router";

import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
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
      const { authService, router, checkSession } = setup({
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
        expect(router.push).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("shows alert when sign-in fails", async () => {
      const SignInFormMock = jest.fn(ComponentMock as typeof SignInForm);
      const RemoteApiErrorMock = jest.fn(({ error }) => error && <div>Unexpected error</div>);
      const { authService, router } = setup({
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
    });
  });

  describe("when SignUp tab is open", () => {
    it("runs sign-up flow and redirects to return url", async () => {
      const SignUpFormMock = jest.fn(ComponentMock as typeof SignUpForm);
      const { authService, router, checkSession } = setup({
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
        expect(router.push).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("shows alert when sign-up fails", async () => {
      const SignUpFormMock = jest.fn(ComponentMock as typeof SignUpForm);
      const RemoteApiErrorMock = jest.fn(({ error }) => error && <div>Unexpected error</div>);
      const { authService, router } = setup({
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

  describe("when deploy button flow is active", () => {
    it("renders ConnectWalletButton when deploy button flow is active", () => {
      const ConnectWalletButtonMock = jest.fn(() => <button data-testid="connect-wallet-btn">Connect Wallet</button>);
      setup({
        searchParams: {
          tab: "login",
          from: "/new-deployment?repoUrl=https://github.com/test/repo.git"
        },
        dependencies: {
          useDeployButtonFlow: () => ({
            isDeployButtonFlow: true,
            params: {
              repoUrl: "https://github.com/test/repo.git",
              branch: null,
              buildCommand: null,
              startCommand: null,
              installCommand: null,
              buildDirectory: null,
              nodeVersion: null,
              templateId: null
            },
            buildReturnUrl: () => "/new-deployment",
            buildUrlParams: () => ({ repoUrl: "https://github.com/test/repo.git" })
          }),
          ConnectWalletButton: ConnectWalletButtonMock
        }
      });

      expect(screen.queryByTestId("connect-wallet-btn")).toBeInTheDocument();
    });

    it("does not render ConnectWalletButton when deploy button flow is inactive", () => {
      setup({
        searchParams: {
          tab: "login"
        }
      });

      expect(screen.queryByTestId("connect-wallet-btn")).not.toBeInTheDocument();
    });

    it("redirects to returnUrl when wallet connects during deploy button flow", async () => {
      const { router } = setup({
        searchParams: {
          tab: "login",
          from: "/new-deployment?repoUrl=https://github.com/test/repo.git"
        },
        dependencies: {
          useDeployButtonFlow: () => ({
            isDeployButtonFlow: true,
            params: {
              repoUrl: "https://github.com/test/repo.git",
              branch: null,
              buildCommand: null,
              startCommand: null,
              installCommand: null,
              buildDirectory: null,
              nodeVersion: null,
              templateId: null
            },
            buildReturnUrl: () => "/new-deployment?repoUrl=https://github.com/test/repo.git",
            buildUrlParams: () => ({ repoUrl: "https://github.com/test/repo.git" })
          }),
          useWallet: () => ({
            address: "akash1test",
            walletName: "test",
            isWalletConnected: true,
            isWalletLoaded: true,
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
          })
        }
      });

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith("/new-deployment?repoUrl=https://github.com/test/repo.git");
      });
    });

    it("renders SocialAuth instead of Tabs when deploy button flow is active", () => {
      const SocialAuthMock = jest.fn(ComponentMock);
      const TabsMock = jest.fn(ComponentMock as typeof Tabs);
      setup({
        searchParams: {
          tab: "login",
          from: "/new-deployment?repoUrl=https://github.com/test/repo.git"
        },
        dependencies: {
          useDeployButtonFlow: () => ({
            isDeployButtonFlow: true,
            params: {
              repoUrl: "https://github.com/test/repo.git",
              branch: null,
              buildCommand: null,
              startCommand: null,
              installCommand: null,
              buildDirectory: null,
              nodeVersion: null,
              templateId: null
            },
            buildReturnUrl: () => "/new-deployment",
            buildUrlParams: () => ({ repoUrl: "https://github.com/test/repo.git" })
          }),
          SocialAuth: SocialAuthMock,
          Tabs: TabsMock as unknown as typeof Tabs
        }
      });

      expect(SocialAuthMock).toHaveBeenCalled();
      expect(TabsMock).not.toHaveBeenCalled();
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

    const useDeployButtonFlow: typeof DEPENDENCIES.useDeployButtonFlow = () => ({
      isDeployButtonFlow: false,
      params: {
        repoUrl: null,
        branch: null,
        buildCommand: null,
        startCommand: null,
        installCommand: null,
        buildDirectory: null,
        nodeVersion: null,
        templateId: null
      },
      buildReturnUrl: () => "/",
      buildUrlParams: () => ({})
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

    render(
      <TestContainerProvider services={{ authService: () => authService }}>
        <AuthPage
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useUser,
            useSearchParams,
            useRouter: () => router,
            useDeployButtonFlow: input.dependencies?.useDeployButtonFlow || useDeployButtonFlow,
            useWallet: input.dependencies?.useWallet || useWallet,
            Turnstile,
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return {
      authService,
      router,
      checkSession
    };
  }
});
