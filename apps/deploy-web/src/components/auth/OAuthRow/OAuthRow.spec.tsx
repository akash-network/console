import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { InAppBrowser } from "@src/lib/in-app-browser/detectInAppBrowser";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AuthService } from "@src/services/auth/auth/auth.service";
import { DEPENDENCIES, OAuthRow } from "./OAuthRow";

import { act, render } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(OAuthRow.name, () => {
  it("redirects to Google OAuth with the resolved returnTo", async () => {
    const ButtonMock = vi.fn(ComponentMock);
    const { authService, analyticsService } = setup({ returnTo: "/dashboard", dependencies: { Button: ButtonMock as never } });
    authService.loginViaOauth.mockResolvedValue(undefined);

    await act(async () => {
      ButtonMock.mock.calls[0][0].onClick();
    });

    expect(authService.loginViaOauth).toHaveBeenCalledWith({ connection: "google-oauth2", returnTo: "/dashboard" });
    expect(analyticsService.track).toHaveBeenCalledWith("social_login_init", { provider: "google-oauth2" }, "GA");
  });

  it("redirects to GitHub OAuth with the resolved returnTo", async () => {
    const ButtonMock = vi.fn(ComponentMock);
    const { authService, analyticsService } = setup({ returnTo: "/dashboard", dependencies: { Button: ButtonMock as never } });
    authService.loginViaOauth.mockResolvedValue(undefined);

    await act(async () => {
      ButtonMock.mock.calls[1][0].onClick();
    });

    expect(authService.loginViaOauth).toHaveBeenCalledWith({ connection: "github", returnTo: "/dashboard" });
    expect(analyticsService.track).toHaveBeenCalledWith("social_login_init", { provider: "github" }, "GA");
  });

  it("does not show the in-app browser notice in a regular browser", () => {
    const InAppBrowserNoticeMock = vi.fn(ComponentMock);
    setup({ dependencies: { InAppBrowserNotice: InAppBrowserNoticeMock as never } });

    expect(InAppBrowserNoticeMock).not.toHaveBeenCalled();
  });

  describe("when opened inside an in-app browser", () => {
    it("replaces the Google button with a notice naming the in-app browser", () => {
      const ButtonMock = vi.fn(ComponentMock);
      const InAppBrowserNoticeMock = vi.fn(ComponentMock);
      setup({ inAppBrowser: "X", dependencies: { Button: ButtonMock as never, InAppBrowserNotice: InAppBrowserNoticeMock as never } });

      expect(InAppBrowserNoticeMock).toHaveBeenCalledWith({ browser: "X" }, {});
      expect(ButtonMock).toHaveBeenCalledTimes(1);
    });

    it("keeps GitHub sign-in available", async () => {
      const ButtonMock = vi.fn(ComponentMock);
      const { authService } = setup({ inAppBrowser: "X", returnTo: "/dashboard", dependencies: { Button: ButtonMock as never } });
      authService.loginViaOauth.mockResolvedValue(undefined);

      await act(async () => {
        ButtonMock.mock.calls[0][0].onClick();
      });

      expect(authService.loginViaOauth).toHaveBeenCalledWith({ connection: "github", returnTo: "/dashboard" });
    });
  });

  function setup(input: { returnTo?: string; inAppBrowser?: InAppBrowser; dependencies?: Partial<typeof DEPENDENCIES> } = {}) {
    const authService = mock<AuthService>();
    const analyticsService = mock<AnalyticsService>();
    const useReturnTo: typeof DEPENDENCIES.useReturnTo = () => ({
      returnTo: input.returnTo ?? "/",
      navigateWithReturnTo: vi.fn(),
      navigateBack: vi.fn(),
      hasReturnTo: false,
      isDeploymentReturnTo: false
    });

    render(
      <TestContainerProvider services={{ authService: () => authService, analyticsService: () => analyticsService }}>
        <OAuthRow
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useReturnTo,
            useInAppBrowser: () => input.inAppBrowser,
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return { authService, analyticsService };
  }
});
