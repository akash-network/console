import type { NodeHttpService } from "@akashnetwork/http-sdk";
import type { NetConfig } from "@akashnetwork/net";
import { AxiosError } from "axios";
import { NotFound } from "http-errors";
import { mock } from "jest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import { NetworkService } from "./network.service";

describe("NetworkService", () => {
  let networkService: NetworkService;
  let nodeHttpService: jest.Mocked<NodeHttpService>;
  let netConfig: jest.Mocked<NetConfig>;

  beforeEach(() => {
    // Clear cache before each test
    cacheEngine.clearAllKeyInCache();
    
    nodeHttpService = mock<NodeHttpService>();
    netConfig = mock<NetConfig>();
    networkService = new NetworkService(nodeHttpService, netConfig);
  });

  afterEach(() => {
    // Clear cache after each test
    cacheEngine.clearAllKeyInCache();
  });

  describe("getNodes", () => {
    it("should return nodes for a valid network", async () => {
      const mockNodes = [
        {
          id: "node1",
          api: "https://api.akash.network",
          rpc: "https://rpc.akash.network"
        }
      ];

      netConfig.mapped.mockReturnValue("mainnet");
      nodeHttpService.getNodes.mockResolvedValue(mockNodes);

      const result = await networkService.getNodes("mainnet");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toEqual(mockNodes);
      }
      expect(netConfig.mapped).toHaveBeenCalledWith("mainnet");
      expect(nodeHttpService.getNodes).toHaveBeenCalledWith("mainnet");
    });

    it("should return NotFound error for unsupported network", async () => {
      netConfig.mapped.mockImplementation(() => {
        throw new Error("Network testnet not supported");
      });

      const result = await networkService.getNodes("testnet");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.val).toBeInstanceOf(NotFound);
        expect(result.val.message).toContain("Network testnet not supported");
      }
      expect(netConfig.mapped).toHaveBeenCalledWith("testnet");
      expect(nodeHttpService.getNodes).not.toHaveBeenCalled();
    });

    it("should return NotFound error when node service returns 404", async () => {
      netConfig.mapped.mockReturnValue("mainnet");
      const axiosError = new AxiosError("Not Found");
      axiosError.status = 404;
      nodeHttpService.getNodes.mockRejectedValue(axiosError);

      const result = await networkService.getNodes("mainnet");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.val).toBeInstanceOf(NotFound);
        expect(result.val.message).toBe("Network nodes not found");
      }
    });

    it("should throw other errors", async () => {
      netConfig.mapped.mockReturnValue("mainnet");
      const genericError = new Error("Some unexpected error");
      nodeHttpService.getNodes.mockRejectedValue(genericError);

      await expect(networkService.getNodes("mainnet")).rejects.toThrow("Some unexpected error");
    });
  });
});
