import { useUser } from "@auth0/nextjs-auth0/client";
import type { AxiosResponse } from "axios";
import { type AxiosInstance } from "axios";
import { mock } from "jest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { UserTracker } from "@src/services/user-tracker/user-tracker.service";
import type { CustomUserProfile } from "@src/types/user";
import { UserProviders } from "./UserProviders";

import { act, render, screen, waitFor } from "@testing-library/react";
import { buildUser } from "@tests/seeders/user";
import { ComponentMock } from "@tests/unit/mocks";
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
    const userTracker = mock<UserTracker>();
    const analyticsService = mock<AnalyticsService>();

    const { rerender } = await setup({
      getProfile: jest
        .fn()
        .mockImplementationOnce(async () => ({ status: 200, data: user }))
        .mockImplementationOnce(async () => ({ status: 401, data: undefined })),
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

    expect(userTracker.track).toHaveBeenCalledWith(undefined);
    expect(analyticsService.identify).toHaveBeenCalledTimes(1);
  });

  it("does not error if user is not logged in", async () => {
    await setup({
      getProfile: jest.fn(() =>
        Promise.resolve({
          status: 401,
          data: undefined
        } as AxiosResponse<{ data: CustomUserProfile } | undefined>)
      ),
      Content: () => {
        const { user, error } = useUser();
        return (
          <div>
            User: {user?.sub || "not logged in"} Error: {error?.message || "no error"}
          </div>
        );
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/User: not logged/i)).toBeInTheDocument();
      expect(screen.getByText(/Error: no error/i)).toBeInTheDocument();
    });
  });

  async function setup(input?: {
    getProfile?: () => Promise<AxiosResponse<{ data: CustomUserProfile } | undefined>>;
    userTracker?: UserTracker;
    analyticsService?: AnalyticsService;
    Content?: React.ComponentType;
  }) {
    const services = {
      internalApiHttpClient: () =>
        mock<Omit<AxiosInstance, "defaults">>({
          get: (() => {
            if (input?.getProfile) return input.getProfile();
            return Promise.resolve({
              data: buildUser()
            });
          }) as AxiosInstance["get"]
        }) as unknown as AxiosInstance,
      userTracker: () => input?.userTracker || mock<UserTracker>(),
      analyticsService: () => input?.analyticsService || mock<AnalyticsService>()
    };
    const Content = input?.Content || ComponentMock;
    let id = 0;
    const genContent = () => (
      <TestContainerProvider services={services}>
        <UserProviders key={++id}>
          <Content>content</Content>
        </UserProviders>
      </TestContainerProvider>
    );

    const result = render(genContent());

    return {
      result,
      rerender: () => result.rerender(genContent())
    };
  }
});
