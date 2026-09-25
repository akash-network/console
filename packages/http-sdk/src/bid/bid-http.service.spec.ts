import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { HttpClient } from "../utils/httpClient";
import type { Bid } from "./bid-http.service";
import { BidHttpService } from "./bid-http.service";

describe(BidHttpService.name, () => {
  describe("list", () => {
    it("lists every bid of the deployment when given no state", async () => {
      const { service, httpClient } = setup();

      await service.list("akash1owner", "123");

      expect(httpClient.get).toHaveBeenCalledWith("/akash/market/v1beta5/bids/list?filters.owner=akash1owner&filters.dseq=123");
    });

    it("lists only the bids in the state it was given", async () => {
      const { service, httpClient } = setup();

      await service.list("akash1owner", "123", { state: "active" });

      expect(httpClient.get).toHaveBeenCalledWith("/akash/market/v1beta5/bids/list?filters.owner=akash1owner&filters.dseq=123&filters.state=active");
    });

    it("answers with the bids the page holds", async () => {
      const bids = [mock<Bid>()];
      const { service } = setup({ bids });

      await expect(service.list("akash1owner", "123")).resolves.toBe(bids);
    });
  });

  function setup(input?: { bids?: Bid[] }) {
    const httpClient = mock<HttpClient>();
    httpClient.get.mockResolvedValue({ data: { bids: input?.bids ?? [], pagination: { next_key: null, total: "0" } } });
    const service = new BidHttpService(httpClient);

    return { service, httpClient };
  }
});
