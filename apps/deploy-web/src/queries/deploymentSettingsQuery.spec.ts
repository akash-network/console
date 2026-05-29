import type { DeploymentSettingHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useDeploymentSettingQuery } from "./deploymentSettingsQuery";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe("useDeploymentSettingQuery", () => {
  describe("query", () => {
    it("fetches deployment setting by dseq", async () => {
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
  });

  function setup(input: { dseq: string; services?: Record<string, () => unknown> }) {
    return setupQuery(() => useDeploymentSettingQuery({ dseq: input.dseq }), {
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
