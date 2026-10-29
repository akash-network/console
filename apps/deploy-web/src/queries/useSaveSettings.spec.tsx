import type { HttpClient } from "@akashnetwork/http-sdk";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import type { UserProviderProps } from "@auth0/nextjs-auth0/client";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { setupQuery } from "../../tests/unit/query-client";
import { ORGANIZATIONS_QUERY_KEY } from "./useOrganizationQueries";
import { useSaveSettings } from "./useSaveSettings";

import { act, screen } from "@testing-library/react";

describe("Settings management", () => {
  describe(useSaveSettings.name, () => {
    it("stays pending until the session refresh after saving finishes", async () => {
      const consoleApiHttpClient = mock<HttpClient>();
      consoleApiHttpClient.put.mockResolvedValue({ status: 200 });
      let finishRefresh: (user: { email: string }) => void = () => {};
      const fetchUser = vi
        .fn()
        .mockResolvedValueOnce({ email: "test@akash.network" })
        .mockReturnValueOnce(new Promise(resolve => (finishRefresh = resolve)));
      const { result } = setup({ services: { consoleApiHttpClient: () => consoleApiHttpClient }, fetchUser });

      act(() => result.current.mutate({ username: "testuser" }));
      await vi.waitFor(() => expect(fetchUser).toHaveBeenCalledTimes(2));

      expect(result.current.isPending).toBe(true);

      act(() => finishRefresh({ email: "test@akash.network" }));
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("saves settings and refreshes the session", async () => {
      const newSettings = {
        username: "testuser",
        subscribedToNewsletter: true
      };
      const consoleApiHttpClient = mock<HttpClient>({
        put: vi.fn().mockResolvedValue({ status: 200 })
      } as unknown as HttpClient);
      const fetchUser = vi.fn(async () => ({ email: "test@akash.network" }));
      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        },
        fetchUser
      });

      act(() => result.current.mutate(newSettings));
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(consoleApiHttpClient.put).toHaveBeenCalledWith(expect.stringContaining("/v1/user/updateSettings"), newSettings);
      expect(fetchUser).toHaveBeenCalledTimes(2);
      expect(result.current.isSuccess).toBe(true);
    });

    it("reloads only the organizations after a username change so the personal organization shows the new name", async () => {
      const consoleApiHttpClient = mock<HttpClient>();
      consoleApiHttpClient.put.mockResolvedValue({ status: 200 });
      const queryClient = new QueryClient();
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [] });
      queryClient.setQueryData(["v1", "listProjects"], { data: [] });
      const { result } = setup({ services: { consoleApiHttpClient: () => consoleApiHttpClient, queryClient: () => queryClient } });

      act(() => result.current.mutate({ username: "testuser" }));
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(queryClient.getQueryState(ORGANIZATIONS_QUERY_KEY)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(["v1", "listProjects"])?.isInvalidated).toBe(false);
    });

    it("keeps the cached organizations when the username is not part of the change", async () => {
      const consoleApiHttpClient = mock<HttpClient>();
      consoleApiHttpClient.put.mockResolvedValue({ status: 200 });
      const queryClient = new QueryClient();
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [] });
      const { result } = setup({ services: { consoleApiHttpClient: () => consoleApiHttpClient, queryClient: () => queryClient } });

      act(() => result.current.mutate({ subscribedToProductUpdates: false }));
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(queryClient.getQueryState(ORGANIZATIONS_QUERY_KEY)?.isInvalidated).toBe(false);
    });

    it("handles error when saving settings and show error snackbar", async () => {
      const newSettings = {
        username: "testuser",
        subscribedToNewsletter: true
      };

      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.put.mockRejectedValue(new Error("Network error"));
      const fetchUser = vi.fn(async () => ({ email: "test@akash.network" }));
      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient,
          errorHandler: () => mock<ErrorHandlerService>()
        },
        fetchUser
      });

      act(() => result.current.mutate(newSettings));
      await vi.waitFor(async () => !result.current.isPending);

      expect(fetchUser).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(/Error saving settings/i)).toBeInTheDocument();
    });

    function setup(input?: { services?: ServicesProviderProps["services"]; fetchUser?: UserProviderProps["fetcher"] }) {
      const user = { email: "test@akash.network" };
      return setupQuery(() => useSaveSettings(), {
        services: input?.services,
        wrapper: ({ children }) => (
          <CustomSnackbarProvider>
            <UserProvider fetcher={input?.fetchUser ?? (() => Promise.resolve(user))}>{children}</UserProvider>
          </CustomSnackbarProvider>
        )
      });
    }
  });
});
