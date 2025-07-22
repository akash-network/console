import type { UserProviderProps } from "@auth0/nextjs-auth0/client";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import type { AxiosInstance } from "axios";
import { mock } from "jest-mock-extended";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import { CustomSnackbarProvider } from "../../../../packages/ui/context/CustomSnackbarProvider";
import { setupQuery } from "../../tests/unit/query-client";
import { useDepositParams, useSaveSettings } from "./useSaveSettings";

import { act, screen, waitFor } from "@testing-library/react";

describe("Settings management", () => {
  describe(useSaveSettings.name, () => {
    it("saves settings successfully, call checkSession and show success snackbar", async () => {
      const newSettings = {
        username: "testuser",
        subscribedToNewsletter: true
      };
      const consoleApiHttpClient = mock<AxiosInstance>();
      const fetchUser = jest.fn(async () => ({ email: "test@akash.network" }));
      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        },
        fetchUser
      });

      act(() => result.current.mutate(newSettings));
      await waitFor(async () => !result.current.isPending);

      expect(consoleApiHttpClient.put).toHaveBeenCalledWith(expect.stringContaining("user/updateSettings"), newSettings);
      expect(fetchUser).toHaveBeenCalledTimes(2);
      expect(result.current.isSuccess).toBe(true);
      expect(await screen.findByText(/Settings saved/i)).toBeInTheDocument();
    });

    it("handles error when saving settings and show error snackbar", async () => {
      const newSettings = {
        username: "testuser",
        subscribedToNewsletter: true
      };

      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.put.mockRejectedValue(new Error("Network error"));
      const fetchUser = jest.fn(async () => ({ email: "test@akash.network" }));
      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        },
        fetchUser
      });

      act(() => result.current.mutate(newSettings));
      await waitFor(async () => !result.current.isPending);

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

  describe(useDepositParams.name, () => {
    it("should fetch deposit params successfully", async () => {
      const chainApiHttpClient = mock<AxiosInstance>();
      const depositParams = {
        denom: "uakt",
        minDeposit: "1000000"
      };
      chainApiHttpClient.get.mockResolvedValue({
        data: {
          param: {
            value: JSON.stringify(depositParams)
          }
        }
      });

      const { result } = setupQuery(() => useDepositParams(), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await waitFor(() => {
        expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("cosmos/params/v1beta1/params"));
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(depositParams);
      });
    });

    it("handles error when fetching deposit params", async () => {
      const chainApiHttpClient = mock<AxiosInstance>();
      chainApiHttpClient.get.mockRejectedValue(new Error("Failed to fetch deposit params"));

      const { result } = setupQuery(() => useDepositParams(), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await waitFor(() => {
        expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("cosmos/params/v1beta1/params"));
        expect(result.current.isError).toBe(true);
      });
    });
  });
});
