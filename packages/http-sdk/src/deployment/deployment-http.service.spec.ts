import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../utils/httpClient";
import { DeploymentHttpService } from "./deployment-http.service";

describe(DeploymentHttpService.name, () => {
  describe("findAll", () => {
    it("includes filters.state when offset pagination is used", async () => {
      const { service, httpClient } = setup();

      await service.findAll({
        owner: "akash1abc",
        state: "active",
        pagination: { offset: 10, limit: 100 }
      });

      expect(httpClient.get).toHaveBeenCalledWith(
        "/akash/deployment/v1beta4/deployments/list",
        expect.objectContaining({
          params: expect.objectContaining({
            "filters.owner": "akash1abc",
            "filters.state": "active",
            "pagination.offset": 10,
            "pagination.limit": 100
          })
        })
      );
    });

    it("does not include filters.state when state is not provided and key pagination is used", async () => {
      const { service, httpClient } = setup();

      await service.findAll({
        owner: "akash1abc",
        pagination: { key: "some-key", limit: 100 }
      });

      expect(httpClient.get).toHaveBeenCalledWith(
        "/akash/deployment/v1beta4/deployments/list",
        expect.objectContaining({
          params: expect.objectContaining({
            "filters.owner": "akash1abc",
            "pagination.key": "some-key",
            "pagination.limit": 100
          })
        })
      );
      const params = httpClient.get.mock.calls[0][1].params;
      expect(params["filters.state"]).toBeUndefined();
    });

    it("does not include filters.state when no pagination is provided", async () => {
      const { service, httpClient } = setup();

      httpClient.getUri.mockReturnValue("http://test/akash/deployment/v1beta4/deployments/list?filters.owner=akash1abc");
      httpClient.get.mockResolvedValue({
        data: { deployments: [], pagination: { next_key: null, total: "0" } }
      });

      await service.findAll({ owner: "akash1abc" });

      const uri = httpClient.getUri.mock.calls[0][0].url;
      expect(uri).not.toContain("filters.state");
    });

    it("includes filters.state=closed when offset pagination is used with closed state", async () => {
      const { service, httpClient } = setup();

      await service.findAll({
        owner: "akash1abc",
        state: "closed",
        pagination: { offset: 0, limit: 50 }
      });

      const params = httpClient.get.mock.calls[0][1].params;
      expect(params["filters.state"]).toBe("closed");
      expect(params["pagination.offset"]).toBe(0);
    });

    it("sets count_total to true when offset is used", async () => {
      const { service, httpClient } = setup();

      await service.findAll({
        owner: "akash1abc",
        state: "active",
        pagination: { offset: 5, limit: 10 }
      });

      const params = httpClient.get.mock.calls[0][1].params;
      expect(params["pagination.count_total"]).toBe(true);
    });

    it("uses key-based pagination when key is provided", async () => {
      const { service, httpClient } = setup();

      await service.findAll({
        owner: "akash1abc",
        pagination: { key: "next-page-key", limit: 100 }
      });

      const params = httpClient.get.mock.calls[0][1].params;
      expect(params["pagination.key"]).toBe("next-page-key");
      expect(params["pagination.offset"]).toBeUndefined();
    });
  });

  function setup() {
    const emptyResponse = { data: { deployments: [], pagination: { next_key: null, total: "0" } } };
    const httpClient = {
      get: vi.fn().mockResolvedValue(emptyResponse),
      getUri: vi.fn().mockReturnValue("http://test")
    } as unknown as HttpClient & { get: ReturnType<typeof vi.fn>; getUri: ReturnType<typeof vi.fn> };
    const service = new DeploymentHttpService(httpClient);
    return { service, httpClient };
  }
});
