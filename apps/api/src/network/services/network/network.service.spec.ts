import type { NodeHttpService } from "@akashnetwork/http-sdk";
import type { NetConfig } from "@akashnetwork/net";
import { AxiosError } from "axios";
import type { HttpError } from "http-errors";
import { NotFound } from "http-errors";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import { NetworkService } from "./network.service";

describe(NetworkService.name, () => {
  afterEach(() => {
    cacheEngine.clearAllKeyInCache();
  });

  describe("getNodes", () => {
    it("returns nodes for a valid network", async () => {
      const mockNodes = [
        {
          id: "node1",
          api: "https://api.akash.network",
          rpc: "https://rpc.akash.network"
        }
      ];
      const { service, netConfig, nodeHttpService } = setup();

      netConfig.mapped.mockReturnValue("mainnet");
      nodeHttpService.getNodes.mockResolvedValue(mockNodes);

      const result = await service.getNodes("mainnet");

      expect(result.ok).toBe(true);
      expect((result as { ok: true; val: typeof mockNodes }).val).toEqual(mockNodes);
      expect(netConfig.mapped).toHaveBeenCalledWith("mainnet");
      expect(nodeHttpService.getNodes).toHaveBeenCalledWith("mainnet");
    });

    it("returns NotFound error for unsupported network", async () => {
      const { service, netConfig, nodeHttpService } = setup();

      netConfig.mapped.mockImplementation(() => {
        throw new Error("Network testnet not supported");
      });

      const result = await service.getNodes("testnet");

      expect(result.ok).toBe(false);
      expect((result as { ok: false; val: HttpError }).val).toBeInstanceOf(NotFound);
      expect((result as { ok: false; val: HttpError }).val.message).toContain("Network testnet not supported");
      expect(netConfig.mapped).toHaveBeenCalledWith("testnet");
      expect(nodeHttpService.getNodes).not.toHaveBeenCalled();
    });

    it("returns NotFound error when node service returns 404", async () => {
      const { service, netConfig, nodeHttpService } = setup();
      const axiosError = new AxiosError("Not Found");
      axiosError.status = 404;

      netConfig.mapped.mockReturnValue("mainnet");
      nodeHttpService.getNodes.mockRejectedValue(axiosError);

      const result = await service.getNodes("mainnet");

      expect(result.ok).toBe(false);
      expect((result as { ok: false; val: HttpError }).val).toBeInstanceOf(NotFound);
      expect((result as { ok: false; val: HttpError }).val.message).toBe("Network nodes not found");
    });

    it("throws other errors", async () => {
      const { service, netConfig, nodeHttpService } = setup();
      const genericError = new Error("Some unexpected error");

      netConfig.mapped.mockReturnValue("mainnet");
      nodeHttpService.getNodes.mockRejectedValue(genericError);

      await expect(service.getNodes("mainnet")).rejects.toThrow("Some unexpected error");
    });
  });

  function setup(): {
    netConfig: MockProxy<NetConfig>;
    nodeHttpService: MockProxy<NodeHttpService>;
    service: NetworkService;
  } {
    cacheEngine.clearAllKeyInCache();

    const nodeHttpService = mock<NodeHttpService>();
    const netConfig = mock<NetConfig>();
    const service = new NetworkService(nodeHttpService, netConfig);

    return { netConfig, nodeHttpService, service };
  }
});
