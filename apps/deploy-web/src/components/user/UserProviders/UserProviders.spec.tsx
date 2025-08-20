import type { UserHttpService } from "@akashnetwork/http-sdk";
import type { AxiosInstance } from "axios";
import { mock } from "jest-mock-extended";

import type { BrowserEnvConfig } from "@src/config/browser-env.config";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { UserTracker } from "@src/services/user-tracker/user-tracker.service";
import type { CustomUserProfile } from "@src/types/user";
import { UserProviders } from "./UserProviders";

import { act, render, screen, waitFor } from "@testing-library/react";
import { buildAnonymousUser, buildUser } from "@tests/seeders/user";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(UserProviders.name, () => {
  it("shows loader when user is loading", async () => {
    await setup({
      getProfile: () => new Promise(() => {})
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("tracks user changes", async () => {
    const user = buildUser();
    const anonymousUser = buildAnonymousUser();
    const userTracker = mock<UserTracker>();
    const analyticsService = mock<AnalyticsService>();

    const { rerender } = await setup({
      getProfile: jest
        .fn()
        .mockImplementationOnce(async () => user)
        .mockImplementationOnce(async () => undefined),
      getOrCreateAnonymousUser: jest.fn(async () => ({ data: anonymousUser })),
      userTracker,
      analyticsService
    });

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(userTracker.track).toHaveBeenCalledWith(user);
    expect(analyticsService.identify).toHaveBeenCalledWith({
      id: user.id,
      anonymous: !user.userId,
      emailVerified: user.emailVerified
    });

    act(() => rerender());
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(userTracker.track).toHaveBeenCalledWith({
      isLoading: true
    });
    expect(userTracker.track).toHaveBeenCalledWith({
      ...anonymousUser,
      isLoading: false
    });
    expect(analyticsService.identify).toHaveBeenCalledTimes(2);
    expect(analyticsService.identify).toHaveBeenCalledWith({
      id: anonymousUser.id,
      anonymous: !anonymousUser.userId,
      emailVerified: anonymousUser.emailVerified
    });
  });

  async function setup(input?: {
    getProfile?: () => Promise<CustomUserProfile>;
    userTracker?: UserTracker;
    analyticsService?: AnalyticsService;
    getOrCreateAnonymousUser?: UserHttpService["getOrCreateAnonymousUser"];
  }) {
    const services = {
      internalApiHttpClient: () =>
        mock<Omit<AxiosInstance, "defaults">>({
          get: (() => {
            if (input?.getProfile) return input.getProfile().then(data => ({ data }));
            return Promise.resolve({
              data: buildUser()
            });
          }) as AxiosInstance["get"]
        }) as unknown as AxiosInstance,
      userTracker: () => input?.userTracker || mock<UserTracker>(),
      analyticsService: () => input?.analyticsService || mock<AnalyticsService>(),
      appConfig: () =>
        mock<BrowserEnvConfig>({
          NEXT_PUBLIC_BILLING_ENABLED: true
        }),
      user: () =>
        mock<UserHttpService>({
          getOrCreateAnonymousUser: input?.getOrCreateAnonymousUser || (async () => ({ data: buildAnonymousUser() }))
        })
    };
    let id = 0;
    const genContent = () => (
      <TestContainerProvider services={services}>
        <UserProviders key={++id}>content</UserProviders>
      </TestContainerProvider>
    );

    const result = render(genContent());

    return {
      result,
      rerender: () => result.rerender(genContent())
    };
  }
});
