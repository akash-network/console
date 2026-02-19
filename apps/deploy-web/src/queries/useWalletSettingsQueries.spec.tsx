import type { UpdateWalletSettingsParams, WalletSettings, WalletSettingsHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useWalletSettingsMutations, useWalletSettingsQuery } from "./useWalletSettingsQueries";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe("useWalletSettingsQueries", () => {
  describe(useWalletSettingsQuery.name, () => {
    it("fetches wallet settings successfully", async () => {
      const mockSettings: WalletSettings = {
        autoReloadEnabled: true
      };
      const walletSettingsService = mock<WalletSettingsHttpService>({
        getWalletSettings: vi.fn().mockResolvedValue(mockSettings)
      });

      const { result } = setupQuery(() => useWalletSettingsQuery(), {
        services: { walletSettings: () => walletSettingsService }
      });

      await vi.waitFor(() => {
        expect(walletSettingsService.getWalletSettings).toHaveBeenCalled();
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockSettings);
      });
    });

    it("handles error when fetching wallet settings", async () => {
      const walletSettingsService = mock<WalletSettingsHttpService>({
        getWalletSettings: vi.fn().mockRejectedValue(new Error("Failed to fetch settings"))
      });

      const { result } = setupQuery(() => useWalletSettingsQuery(), {
        services: { walletSettings: () => walletSettingsService }
      });

      await vi.waitFor(() => {
        expect(walletSettingsService.getWalletSettings).toHaveBeenCalled();
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe(useWalletSettingsMutations.name, () => {
    describe("updateWalletSettings", () => {
      it("updates wallet settings and invalidates queries", async () => {
        const updateParams: UpdateWalletSettingsParams = {
          autoReloadEnabled: true
        };
        const mockUpdatedSettings: WalletSettings = {
          autoReloadEnabled: true
        };
        const walletSettingsService = mock<WalletSettingsHttpService>({
          updateWalletSettings: vi.fn().mockResolvedValue(mockUpdatedSettings)
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          await result.current.updateWalletSettings.mutateAsync(updateParams);
        });

        await vi.waitFor(() => {
          expect(walletSettingsService.updateWalletSettings).toHaveBeenCalledWith(updateParams);
          expect(result.current.updateWalletSettings.isSuccess).toBe(true);
        });
      });

      it("handles error when updating wallet settings", async () => {
        const updateParams: UpdateWalletSettingsParams = {
          autoReloadEnabled: false
        };
        const walletSettingsService = mock<WalletSettingsHttpService>({
          updateWalletSettings: vi.fn().mockRejectedValue(new Error("Update failed"))
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

        await vi.waitFor(() => {
          expect(walletSettingsService.updateWalletSettings).toHaveBeenCalledWith(updateParams);
          expect(result.current.updateWalletSettings.isError).toBe(true);
        });
      });
    });

    describe("createWalletSettings", () => {
      it("creates wallet settings and invalidates queries", async () => {
        const newSettings: WalletSettings = {
          autoReloadEnabled: true
        };
        const walletSettingsService = mock<WalletSettingsHttpService>({
          createWalletSettings: vi.fn().mockResolvedValue(newSettings)
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          await result.current.createWalletSettings.mutateAsync(newSettings);
        });

        await vi.waitFor(() => {
          expect(walletSettingsService.createWalletSettings).toHaveBeenCalledWith(newSettings);
          expect(result.current.createWalletSettings.isSuccess).toBe(true);
        });
      });

      it("handles error when creating wallet settings", async () => {
        const newSettings: WalletSettings = {
          autoReloadEnabled: true
        };
        const walletSettingsService = mock<WalletSettingsHttpService>({
          createWalletSettings: vi.fn().mockRejectedValue(new Error("Creation failed"))
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

        await vi.waitFor(() => {
          expect(walletSettingsService.createWalletSettings).toHaveBeenCalledWith(newSettings);
          expect(result.current.createWalletSettings.isError).toBe(true);
        });
      });
    });

    describe("deleteWalletSettings", () => {
      it("deletes wallet settings and invalidates queries", async () => {
        const walletSettingsService = mock<WalletSettingsHttpService>({
          deleteWalletSettings: vi.fn().mockResolvedValue(undefined)
        });

        const { result } = setupQuery(() => useWalletSettingsMutations(), {
          services: { walletSettings: () => walletSettingsService }
        });

        await act(async () => {
          await result.current.deleteWalletSettings.mutateAsync();
        });

        await vi.waitFor(() => {
          expect(walletSettingsService.deleteWalletSettings).toHaveBeenCalled();
          expect(result.current.deleteWalletSettings.isSuccess).toBe(true);
        });
      });

      it("handles error when deleting wallet settings", async () => {
        const walletSettingsService = mock<WalletSettingsHttpService>({
          deleteWalletSettings: vi.fn().mockRejectedValue(new Error("Deletion failed"))
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

        await vi.waitFor(() => {
          expect(walletSettingsService.deleteWalletSettings).toHaveBeenCalled();
          expect(result.current.deleteWalletSettings.isError).toBe(true);
        });
      });
    });
  });
});
