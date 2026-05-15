import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

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
    expect(analyticsService.track).toHaveBeenCalledWith("social_login_init", { provider: "google-oauth2" });
  });

  it("redirects to GitHub OAuth with the resolved returnTo", async () => {
    const ButtonMock = vi.fn(ComponentMock);
    const { authService, analyticsService } = setup({ returnTo: "/dashboard", dependencies: { Button: ButtonMock as never } });
    authService.loginViaOauth.mockResolvedValue(undefined);

    await act(async () => {
      ButtonMock.mock.calls[1][0].onClick();
    });

    expect(authService.loginViaOauth).toHaveBeenCalledWith({ connection: "github", returnTo: "/dashboard" });
    expect(analyticsService.track).toHaveBeenCalledWith("social_login_init", { provider: "github" });
  });

  function setup(input: { returnTo?: string; dependencies?: Partial<typeof DEPENDENCIES> } = {}) {
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
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return { authService, analyticsService };
  }
});
