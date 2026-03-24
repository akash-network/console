import type { DeploymentSettingHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ContextType as WalletProviderContextType } from "@src/context/WalletProvider/WalletProvider";
import { USE_DEPLOYMENT_SETTING_DEPENDENCIES, useDeploymentSettingQuery } from "./deploymentSettingsQuery";

import { act } from "@testing-library/react";
import { buildWallet } from "@tests/seeders";
import { setupQuery } from "@tests/unit/query-client";

describe("useDeploymentSettingQuery", () => {
  describe("query", () => {
    it("fetches deployment setting by dseq when wallet is managed", async () => {
      const dseq = faker.string.numeric(6);
      const settingData = buildDeploymentSetting({ dseq });
      const deploymentSettingService = mock<DeploymentSettingHttpService>({
        findByDseq: vi.fn().mockResolvedValue(settingData)
      });

      const { result } = setup({ dseq, services: { deploymentSetting: () => deploymentSettingService } });

      await vi.waitFor(() => {
        expect(result.current.data).toEqual(settingData);
      });
      expect(deploymentSettingService.findByDseq).toHaveBeenCalledWith(dseq);
    });

    it("does not fetch when wallet is not managed", () => {
      const dseq = faker.string.numeric(6);
      const deploymentSettingService = mock<DeploymentSettingHttpService>();

      const { result } = setup({
        dseq,
        wallet: buildWallet({ isManaged: false }),
        services: { deploymentSetting: () => deploymentSettingService }
      });

      expect(result.current.data).toBeUndefined();
      expect(deploymentSettingService.findByDseq).not.toHaveBeenCalled();
    });

    it("does not fetch when dseq is empty", () => {
      const deploymentSettingService = mock<DeploymentSettingHttpService>();

      const { result } = setup({
        dseq: "",
        services: { deploymentSetting: () => deploymentSettingService }
      });

      expect(result.current.data).toBeUndefined();
      expect(deploymentSettingService.findByDseq).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("updates deployment setting and refreshes cache", async () => {
      const dseq = faker.string.numeric(6);
      const updatedSetting = buildDeploymentSetting({ dseq, autoTopUpEnabled: true });
      const deploymentSettingService = mock<DeploymentSettingHttpService>({
        findByDseq: vi.fn().mockResolvedValue(buildDeploymentSetting({ dseq })),
        updateByDseq: vi.fn().mockResolvedValue(updatedSetting)
      });
      const queryClient = new QueryClient();

      const { result } = setup({
        dseq,
        services: {
          deploymentSetting: () => deploymentSettingService,
          queryClient: () => queryClient
        }
      });

      await vi.waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      act(() => {
        result.current.setAutoTopUpEnabled(true);
      });

      await vi.waitFor(() => {
        expect(result.current.data?.autoTopUpEnabled).toBe(true);
      });
      expect(deploymentSettingService.updateByDseq).toHaveBeenCalledWith(dseq, { autoTopUpEnabled: true });
    });

    it("throws when wallet is not managed", async () => {
      const dseq = faker.string.numeric(6);
      const deploymentSettingService = mock<DeploymentSettingHttpService>();

      const { result } = setup({
        dseq,
        wallet: buildWallet({ isManaged: false }),
        services: { deploymentSetting: () => deploymentSettingService }
      });

      act(() => {
        result.current.update(true);
      });

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(deploymentSettingService.updateByDseq).not.toHaveBeenCalled();
    });
  });

  function setup(input: { dseq: string; wallet?: WalletProviderContextType; services?: Record<string, () => unknown> }) {
    const wallet = input.wallet ?? buildWallet({ isManaged: true });
    const dependencies: typeof USE_DEPLOYMENT_SETTING_DEPENDENCIES = {
      ...USE_DEPLOYMENT_SETTING_DEPENDENCIES,
      useWallet: () => wallet
    };

    return setupQuery(() => useDeploymentSettingQuery({ dseq: input.dseq }, dependencies), {
      services: {
        deploymentSetting: () => mock<DeploymentSettingHttpService>(),
        ...input.services
      }
    });
  }
});

function buildDeploymentSetting(overrides: { dseq: string; autoTopUpEnabled?: boolean }) {
  return {
    id: faker.number.int(),
    userId: faker.string.uuid(),
    dseq: overrides.dseq,
    autoTopUpEnabled: overrides.autoTopUpEnabled ?? false,
    estimatedTopUpAmount: faker.number.float({ min: 0, max: 100 }),
    topUpFrequencyMs: faker.number.int({ min: 1000, max: 100000 }),
    createdAt: faker.date.recent().toISOString(),
    updatedAt: faker.date.recent().toISOString()
  };
}
