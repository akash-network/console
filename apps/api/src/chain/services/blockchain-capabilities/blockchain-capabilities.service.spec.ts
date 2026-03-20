import { describe, expect, it, vi } from "vitest";

import { BlockchainCapabilitiesService } from "./blockchain-capabilities.service";

describe(BlockchainCapabilitiesService.name, () => {
  describe("supportsACT", () => {
    it("returns true when app version is >= 2.0.0-rc1", async () => {
      const { service } = setup({ appVersion: "2.0.0" });

      const result = await service.supportsACT();

      expect(result).toBe(true);
    });

    it("returns true when app version has v prefix", async () => {
      const { service } = setup({ appVersion: "v2.1.0" });

      const result = await service.supportsACT();

      expect(result).toBe(true);
    });

    it("returns true when app version is exactly 2.0.0-rc1", async () => {
      const { service } = setup({ appVersion: "2.0.0-rc1" });

      const result = await service.supportsACT();

      expect(result).toBe(true);
    });

    it("returns false when app version is below 2.0.0-rc1", async () => {
      const { service } = setup({ appVersion: "1.9.0" });

      const result = await service.supportsACT();

      expect(result).toBe(false);
    });

    it("returns false when app version is undefined", async () => {
      const { service } = setup({ appVersion: undefined });

      const result = await service.supportsACT();

      expect(result).toBe(false);
    });

    it("caches the result across multiple calls", async () => {
      const { service, getNodeInfo } = setup({ appVersion: "2.0.0" });

      await service.supportsACT();
      await service.supportsACT();

      expect(getNodeInfo).toHaveBeenCalledTimes(1);
    });
  });

  function setup(input: { appVersion: string | undefined }) {
    const getNodeInfo = vi.fn().mockResolvedValue({
      applicationVersion: { version: input.appVersion }
    });

    const chainSdk = {
      cosmos: {
        base: {
          tendermint: {
            v1beta1: { getNodeInfo }
          }
        }
      }
    };

    const service = new BlockchainCapabilitiesService(chainSdk as any);

    return { service, getNodeInfo };
  }
});
