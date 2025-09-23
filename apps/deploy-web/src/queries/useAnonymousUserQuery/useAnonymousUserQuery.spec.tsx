import type { UserHttpService } from "@akashnetwork/http-sdk";
import { AxiosError } from "axios";
import { mock } from "jest-mock-extended";
import { createStore, Provider as JotaiProvider } from "jotai";
import { setTimeout as wait } from "timers/promises";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { setupQuery } from "../../../tests/unit/query-client";
import { DEFAULT_RETRY_AFTER_SECONDS, useAnonymousUserQuery } from "./useAnonymousUserQuery";

import { act, waitFor } from "@testing-library/react";

describe(useAnonymousUserQuery.name, () => {
  const mockUser = {
    id: "test-user-id",
    username: "testuser",
    email: "test@example.com",
    emailVerified: false,
    subscribedToNewsletter: true,
    bio: "Test bio",
    youtubeUsername: "testyoutube",
    twitterUsername: "testtwitter",
    githubUsername: "testgithub"
  };

  it("creates anonymous user if id is not provided", async () => {
    const userService = mock<UserHttpService>({
      getOrCreateAnonymousUser: jest.fn().mockResolvedValue({
        data: mockUser,
        token: "test-token"
      })
    });

    const { result } = setup({
      services: {
        user: () => userService
      }
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe("test-token");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledWith(undefined);
  });

  it("fetches anonymous user if id is provided", async () => {
    const userId = "existing-user-id";
    const userService = mock<UserHttpService>();
    userService.getOrCreateAnonymousUser.mockResolvedValue({
      data: mockUser
    });

    const { result } = setup({
      services: {
        user: () => userService
      },
      id: userId
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledWith(userId);
  });

  it("handles 429 rate limit error with retryAfter", async () => {
    const retryAfterSeconds = 30;
    const rateLimitError = new AxiosError("Too Many Requests", "429", undefined, undefined, {
      status: 429,
      statusText: "Too Many Requests",
      headers: {},
      data: { retryAfter: retryAfterSeconds },
      config: {} as any
    });
    const userService = mock<UserHttpService>({
      getOrCreateAnonymousUser: jest.fn().mockRejectedValue(rateLimitError)
    });

    const { result } = setup({
      services: {
        user: () => userService
      }
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(rateLimitError);
      expect(result.current.retryAfter).toBeDefined();
    });

    const expectedRetryTime = new Date(Date.now() + retryAfterSeconds * 1000);
    expect(result.current.retryAfter!.getTime()).toBeGreaterThanOrEqual(expectedRetryTime.getTime() - 1000);
    expect(result.current.retryAfter!.getTime()).toBeLessThanOrEqual(expectedRetryTime.getTime() + 1000);
  });

  it("handles 429 rate limit error with default retryAfter when not provided", async () => {
    const rateLimitError = new AxiosError("Too Many Requests", "429", undefined, undefined, {
      status: 429,
      statusText: "Too Many Requests",
      headers: {},
      data: {},
      config: {} as any
    });

    const userService = mock<UserHttpService>({
      getOrCreateAnonymousUser: jest.fn().mockRejectedValue(rateLimitError)
    });

    const { result } = setup({
      services: {
        user: () => userService
      }
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(rateLimitError);
      expect(result.current.retryAfter).toBeDefined();
    });

    const expectedRetryTime = new Date(Date.now() + DEFAULT_RETRY_AFTER_SECONDS * 1000);
    expect(result.current.retryAfter!.getTime()).toBeGreaterThanOrEqual(expectedRetryTime.getTime() - 1000);
    expect(result.current.retryAfter!.getTime()).toBeLessThanOrEqual(expectedRetryTime.getTime() + 1000);
  });

  it("handles generic error", async () => {
    const genericError = new Error("Network error");
    const userService = mock<UserHttpService>({
      getOrCreateAnonymousUser: jest.fn().mockRejectedValue(genericError)
    });

    const { result } = setup({
      services: {
        user: () => userService
      }
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(genericError);
    });
  });

  it("reports errors to error handler", async () => {
    const userService = mock<UserHttpService>();
    const errorHandler = mock<any>();
    const genericError = new Error("Network error");

    userService.getOrCreateAnonymousUser.mockRejectedValue(genericError);

    setup({
      services: {
        user: () => userService,
        errorHandler: () => errorHandler
      }
    });

    await waitFor(() => {
      expect(errorHandler.reportError).toHaveBeenCalledWith({
        error: genericError,
        tags: { category: "anonymousUserQuery" }
      });
    });
  });

  it("does not fetch when enabled is false", async () => {
    const userService = mock<UserHttpService>();

    const { result } = setup({
      services: {
        user: () => userService
      },
      options: { enabled: false }
    });

    await act(() => wait(1000));

    expect(result.current.user).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(userService.getOrCreateAnonymousUser).not.toHaveBeenCalled();
  });

  it("does not fetch when user already exists", async () => {
    const userService = mock<UserHttpService>({
      getOrCreateAnonymousUser: jest.fn().mockResolvedValue({
        data: mockUser,
        token: "test-token"
      })
    });

    const { result, rerender } = setup({
      services: {
        user: () => userService
      }
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    rerender();

    await act(() => wait(1000));

    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when already loading", async () => {
    const pendingPromise = Promise.withResolvers<{ data: typeof mockUser; token: string }>();
    const userService = mock<UserHttpService>({
      getOrCreateAnonymousUser: jest.fn().mockReturnValue(pendingPromise.promise)
    });

    const { result, rerender } = setup({
      services: {
        user: () => userService
      }
    });

    expect(result.current.isLoading).toBe(true);

    rerender();

    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledTimes(1);

    act(() => pendingPromise.resolve({ data: mockUser, token: "test-token" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toEqual(mockUser);
    });
  });

  it("refetches when retryAfter time has passed", async () => {
    const userService = mock<UserHttpService>();
    const retryAfterSeconds = 1;
    const rateLimitError = new AxiosError("Too Many Requests", "429", undefined, undefined, {
      status: 429,
      statusText: "Too Many Requests",
      headers: {},
      data: { retryAfter: retryAfterSeconds },
      config: {} as any
    });

    userService.getOrCreateAnonymousUser.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({
      data: mockUser,
      token: "test-token"
    });

    const { result, rerender } = setup({
      services: {
        user: () => userService
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBe(rateLimitError);
    });

    await act(() => wait(retryAfterSeconds * 1000 + 100));
    rerender();

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeUndefined();
    });

    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledTimes(2);
  });

  function setup(input?: { services?: ServicesProviderProps["services"]; id?: string; options?: { enabled?: boolean } }) {
    const store = createStore();
    return setupQuery(
      () =>
        useAnonymousUserQuery(input?.id, {
          enabled: true,
          ...input?.options
        }),
      {
        services: {
          errorHandler: () => mock<ErrorHandlerService>(),
          ...input?.services
        },
        wrapper: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>
      }
    );
  }
});
