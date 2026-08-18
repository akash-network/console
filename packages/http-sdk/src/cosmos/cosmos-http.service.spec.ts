import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { HttpClient } from "../utils/httpClient";
import { CosmosHttpService } from "./cosmos-http.service";
import type { CosmosGovProposal, CosmosGovTallyResult } from "./types";

describe(CosmosHttpService.name, () => {
  describe("getProposals", () => {
    it("requests gov v1 proposals and returns them", async () => {
      const { service, httpClient, proposal } = setup();
      httpClient.get.mockResolvedValue({
        data: { proposals: [proposal], pagination: { next_key: null, total: "1" } }
      });

      const result = await service.getProposals();

      expect(httpClient.get).toHaveBeenCalledWith("/cosmos/gov/v1/proposals?pagination.limit=1000");
      expect(result).toEqual([proposal]);
    });
  });

  describe("getProposal", () => {
    it("requests a gov v1 proposal by id and returns it", async () => {
      const { service, httpClient, proposal } = setup();
      httpClient.get.mockResolvedValue({ data: { proposal } });

      const result = await service.getProposal(42);

      expect(httpClient.get).toHaveBeenCalledWith("/cosmos/gov/v1/proposals/42");
      expect(result).toEqual(proposal);
    });
  });

  describe("getProposalTally", () => {
    it("requests a gov v1 proposal tally by id and returns it", async () => {
      const { service, httpClient, tally } = setup();
      httpClient.get.mockResolvedValue({ data: { tally } });

      const result = await service.getProposalTally(42);

      expect(httpClient.get).toHaveBeenCalledWith("/cosmos/gov/v1/proposals/42/tally");
      expect(result).toEqual(tally);
    });
  });

  function setup() {
    const tally: CosmosGovTallyResult = {
      yes_count: "100",
      abstain_count: "1",
      no_count: "2",
      no_with_veto_count: "0"
    };
    const proposal: CosmosGovProposal = {
      id: "42",
      messages: [],
      status: "PROPOSAL_STATUS_PASSED",
      final_tally_result: tally,
      submit_time: "2026-05-01T00:00:00Z",
      deposit_end_time: "2026-05-15T00:00:00Z",
      total_deposit: [{ denom: "uakt", amount: "1000000000" }],
      voting_start_time: "2026-05-01T00:00:00Z",
      voting_end_time: "2026-05-08T00:00:00Z",
      metadata: "",
      title: "Test proposal",
      summary: "Test proposal summary",
      proposer: "akash1proposer"
    };
    const httpClient = mock<HttpClient>();
    const service = new CosmosHttpService(httpClient);
    return { service, httpClient, proposal, tally };
  }
});
