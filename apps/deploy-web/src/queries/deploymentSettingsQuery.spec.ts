import type { DeploymentSettingHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { getRuntimeAnchorPollInterval, RUNTIME_ANCHOR_POLL_MS, useDeploymentSettingQuery } from "./deploymentSettingsQuery";
import { QueryKeys } from "./queryKeys";

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

  describe("polling until the runtime limit is anchored", () => {
    it("polls while a runtime limit has no deadline yet, since the lease anchors it server-side after this page loads", () => {
      const setting = buildDeploymentSetting({ dseq: "1", runtimeLimitHours: 2, runtimeEndsAt: null });

      expect(getRuntimeAnchorPollInterval(setting, false)).toBe(RUNTIME_ANCHOR_POLL_MS);
    });

    it("stops polling once the deadline lands", () => {
      const setting = buildDeploymentSetting({ dseq: "1", runtimeLimitHours: 2, runtimeEndsAt: faker.date.future().toISOString() });

      expect(getRuntimeAnchorPollInterval(setting, false)).toBe(false);
    });

    it("never polls a deployment that has no runtime limit to anchor", () => {
      const setting = buildDeploymentSetting({ dseq: "1" });

      expect(getRuntimeAnchorPollInterval(setting, false)).toBe(false);
    });

    it("stops polling after a failed fetch, so a persistent error does not retry forever", () => {
      const setting = buildDeploymentSetting({ dseq: "1", runtimeLimitHours: 2, runtimeEndsAt: null });

      expect(getRuntimeAnchorPollInterval(setting, true)).toBe(false);
    });

    it("waits for the first response before deciding", () => {
      expect(getRuntimeAnchorPollInterval(undefined, false)).toBe(false);
    });

    it("picks up the deadline the lease anchors after the page loaded, without a reload", async () => {
      vi.useFakeTimers();

      try {
        const dseq = faker.string.numeric(6);
        const anchored = buildDeploymentSetting({ dseq, runtimeLimitHours: 2, runtimeEndsAt: faker.date.future().toISOString() });
        const findByDseq = vi
          .fn()
          .mockResolvedValueOnce(buildDeploymentSetting({ dseq, runtimeLimitHours: 2, runtimeEndsAt: null }))
          .mockResolvedValue(anchored);

        const { result } = setup({ dseq, services: { deploymentSetting: () => mock<DeploymentSettingHttpService>({ findByDseq }) } });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.data?.runtimeEndsAt).toBeNull();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(RUNTIME_ANCHOR_POLL_MS * 2);
        });
        expect(result.current.data?.runtimeEndsAt).toBe(anchored.runtimeEndsAt);
      } finally {
        vi.useRealTimers();
      }
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

  it("drops an in-flight settings fetch before writing an update, so a slow poll cannot restore the pre-update snapshot", async () => {
    const dseq = faker.string.numeric(6);
    const deploymentSettingService = mock<DeploymentSettingHttpService>({
      findByDseq: vi.fn().mockResolvedValue(buildDeploymentSetting({ dseq, runtimeLimitHours: 2, runtimeEndsAt: null })),
      updateByDseq: vi.fn().mockResolvedValue(buildDeploymentSetting({ dseq, runtimeLimitHours: null }))
    });
    const queryClient = new QueryClient();
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries");

    const { result } = setup({
      dseq,
      services: { deploymentSetting: () => deploymentSettingService, queryClient: () => queryClient }
    });

    await act(async () => {
      result.current.update({ runtimeLimitHours: null });
    });

    await vi.waitFor(() => {
      expect(cancelQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getDeploymentSettingKey(dseq) });
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

function buildDeploymentSetting(overrides: { dseq: string; autoTopUpEnabled?: boolean; runtimeLimitHours?: number | null; runtimeEndsAt?: string | null }) {
  return {
    id: faker.number.int(),
    userId: faker.string.uuid(),
    dseq: overrides.dseq,
    autoTopUpEnabled: overrides.autoTopUpEnabled ?? false,
    estimatedTopUpAmount: faker.number.float({ min: 0, max: 100 }),
    topUpFrequencyMs: faker.number.int({ min: 1000, max: 100000 }),
    runtimeLimitHours: overrides.runtimeLimitHours ?? null,
    runtimeEndsAt: overrides.runtimeEndsAt ?? null,
    createdAt: faker.date.recent().toISOString(),
    updatedAt: faker.date.recent().toISOString()
  };
}
