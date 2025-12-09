import type { UpdateWalletSettingsParams, WalletSettings } from "@akashnetwork/http-sdk/src/wallet-settings/wallet-settings.types";
import type { WalletSettingsHttpService } from "@akashnetwork/http-sdk/src/wallet-settings/wallet-settings-http.service";
import { mock } from "jest-mock-extended";

import { useWalletSettingsMutations, useWalletSettingsQuery } from "./useWalletSettingsQueries";

import { act, waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe("useWalletSettingsQueries", () => {
  describe(useWalletSettingsQuery.name, () => {
    it("fetches wallet settings successfully", async () => {
      const mockSettings: WalletSettings = {
        autoReloadEnabled: true,
      };
      const walletSettingsService = mock<WalletSettingsHttpService>({
        getWalletSettings: jest.fn().mockResolvedValue(mockSettings)
      });

      const { result } = setupQuery(() => useWalletSettingsQuery(), {
        services: { walletSettings: () => walletSettingsService }
      });

      await waitFor(() => {
        expect(walletSettingsService.getWalletSettings).toHaveBeenCalled();
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockSettings);
      });
    });

    it("handles error when fetching wallet settings", async () => {
      const walletSettingsService = mock<WalletSettingsHttpService>({
        getWalletSettings: jest.fn().mockRejectedValue(new Error("Failed to fetch settings"))
      });

      const { result } = setupQuery(() => useWalletSettingsQuery(), {
        services: { walletSettings: () => walletSettingsService }
      });

      await waitFor(() => {
        expect(walletSettingsService.getWalletSettings).toHaveBeenCalled();
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe(useWalletSettingsMutations.name, () => {
    describe("updateWalletSettings", () => {
      it("updates wallet settings and invalidates queries", async () => {
        const updateParams: UpdateWalletSettingsParams = {
          autoReloadEnabled: true,
        };
        const mockUpdatedSettings: WalletSettings = {
          autoReloadEnabled: true,
        };
        const walletSettingsService = mock<WalletSettingsHttpService>({
          updateWalletSettings: jest.fn().mockResolvedValue(mockUpdatedSettings)
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          await result.current.updateWalletSettings.mutateAsync(updateParams);
        });

        await waitFor(() => {
          expect(walletSettingsService.updateWalletSettings).toHaveBeenCalledWith(updateParams);
          expect(result.current.updateWalletSettings.isSuccess).toBe(true);
        });
      });

      it("handles error when updating wallet settings", async () => {
        const updateParams: UpdateWalletSettingsParams = {
          autoReloadEnabled: false
        };
        const walletSettingsService = mock<WalletSettingsHttpService>({
          updateWalletSettings: jest.fn().mockRejectedValue(new Error("Update failed"))
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          try {
            await result.current.updateWalletSettings.mutateAsync(updateParams);
          } catch (error) {
            // Expected error
          }
        });

        await waitFor(() => {
          expect(walletSettingsService.updateWalletSettings).toHaveBeenCalledWith(updateParams);
          expect(result.current.updateWalletSettings.isError).toBe(true);
        });
      });
    });

    describe("createWalletSettings", () => {
      it("creates wallet settings and invalidates queries", async () => {
        const newSettings: WalletSettings = {
          autoReloadEnabled: true,
        };
        const walletSettingsService = mock<WalletSettingsHttpService>({
          createWalletSettings: jest.fn().mockResolvedValue(newSettings)
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          await result.current.createWalletSettings.mutateAsync(newSettings);
        });

        await waitFor(() => {
          expect(walletSettingsService.createWalletSettings).toHaveBeenCalledWith(newSettings);
          expect(result.current.createWalletSettings.isSuccess).toBe(true);
        });
      });

      it("handles error when creating wallet settings", async () => {
        const newSettings: WalletSettings = {
          autoReloadEnabled: true,
        };
        const walletSettingsService = mock<WalletSettingsHttpService>({
          createWalletSettings: jest.fn().mockRejectedValue(new Error("Creation failed"))
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          try {
            await result.current.createWalletSettings.mutateAsync(newSettings);
          } catch (error) {
            // Expected error
          }
        });

        await waitFor(() => {
          expect(walletSettingsService.createWalletSettings).toHaveBeenCalledWith(newSettings);
          expect(result.current.createWalletSettings.isError).toBe(true);
        });
      });
    });

    describe("deleteWalletSettings", () => {
      it("deletes wallet settings and invalidates queries", async () => {
        const walletSettingsService = mock<WalletSettingsHttpService>({
          deleteWalletSettings: jest.fn().mockResolvedValue(undefined)
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          await result.current.deleteWalletSettings.mutateAsync();
        });

        await waitFor(() => {
          expect(walletSettingsService.deleteWalletSettings).toHaveBeenCalled();
          expect(result.current.deleteWalletSettings.isSuccess).toBe(true);
        });
      });

      it("handles error when deleting wallet settings", async () => {
        const walletSettingsService = mock<WalletSettingsHttpService>({
          deleteWalletSettings: jest.fn().mockRejectedValue(new Error("Deletion failed"))
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          try {
            await result.current.deleteWalletSettings.mutateAsync();
          } catch (error) {
            // Expected error
          }
        });

        await waitFor(() => {
          expect(walletSettingsService.deleteWalletSettings).toHaveBeenCalled();
          expect(result.current.deleteWalletSettings.isError).toBe(true);
        });
      });
    });
  });
});
