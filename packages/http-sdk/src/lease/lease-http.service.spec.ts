import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../utils/httpClient";
import type { RestAkashLeaseListResponse, RpcLease } from "./lease-http.service";
import { LeaseHttpService } from "./lease-http.service";

describe(LeaseHttpService.name, () => {
  describe("hasLeases", () => {
    it("requests a single lease for the address", async () => {
      const { service, httpClient } = setup();

      await service.hasLeases("akash1abc");

      expect(httpClient.get).toHaveBeenCalledWith(
        "/akash/market/v1beta5/leases/list",
        expect.objectContaining({
          params: expect.objectContaining({
            "filters.owner": "akash1abc",
            "pagination.limit": 1
          })
        })
      );
    });

    it("returns true when the page contains a lease", async () => {
      const { service } = setup({ leases: [{} as RpcLease] });

      await expect(service.hasLeases("akash1abc")).resolves.toBe(true);
    });

    it("returns true when the page is empty but pagination reports more results", async () => {
      const { service } = setup({ pagination: { next_key: "next", total: "0" } });

      await expect(service.hasLeases("akash1abc")).resolves.toBe(true);
    });

    it("returns false when the address has no leases", async () => {
      const { service } = setup();

      await expect(service.hasLeases("akash1abc")).resolves.toBe(false);
    });
  });

  function setup(input?: Partial<RestAkashLeaseListResponse>) {
    const response = {
      data: {
        leases: input?.leases ?? [],
        pagination: input?.pagination ?? { next_key: null, total: "0" }
      }
    };
    const httpClient = {
      get: vi.fn().mockResolvedValue(response)
    } as unknown as HttpClient & { get: ReturnType<typeof vi.fn> };
    const service = new LeaseHttpService(httpClient);
    return { service, httpClient };
  }
});
