import nock from "nock";

import { app } from "@src/app";
import type { GetProposalByIdResponse, GetProposalListResponse } from "@src/proposal/http-schemas/proposal.schema";
import { apiProxyUrl } from "@src/utils/constants";

describe("Proposals", () => {
  afterAll(() => {
    nock.cleanAll();
  });

  describe("GET /v1/proposals", () => {
    it("resolves list of most recent proposals", async () => {
      setup();

      const response = await app.request("/v1/proposals");
      const data = (await response.json()) as GetProposalListResponse;

      expect(response.status).toBe(200);
      expect(data).toEqual([
        {
          id: 3,
          title: "Enable axlUSDC for deployments",
          status: "PROPOSAL_STATUS_PASSED",
          submitTime: "2023-08-04T11:23:30.716939528Z",
          votingStartTime: "2023-08-04T11:23:30.716939528Z",
          votingEndTime: "2023-08-04T11:33:30.716939528Z",
          totalDeposit: 1010000000
        },
        {
          id: 2,
          title: "v0.24.0",
          status: "PROPOSAL_STATUS_PASSED",
          submitTime: "2023-08-04T09:33:52.911650830Z",
          votingStartTime: "2023-08-04T09:34:14.957738073Z",
          votingEndTime: "2023-08-04T09:44:14.957738073Z",
          totalDeposit: 10000000
        },
        {
          id: 1,
          title: "v0.24.0",
          status: "PROPOSAL_STATUS_FAILED",
          submitTime: "2023-08-04T09:22:37.090076750Z",
          votingStartTime: "2023-08-04T09:22:53.568959577Z",
          votingEndTime: "2023-08-04T09:32:53.568959577Z",
          totalDeposit: 10000000
        }
      ]);
    });
  });

  describe("GET /v1/proposals/{id}", () => {
    it("resolves a proposal", async () => {
      setup();

      const response = await app.request("/v1/proposals/2");
      const data = (await response.json()) as GetProposalByIdResponse;

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: 2,
        title: "v0.24.0",
        description: "SW upgrade proposal for v0.24.0",
        status: "PROPOSAL_STATUS_VOTING_PERIOD",
        submitTime: "2023-08-04T09:33:52.911650830Z",
        votingStartTime: "2023-08-04T09:34:14.957738073Z",
        votingEndTime: "2023-08-04T09:44:14.957738073Z",
        totalDeposit: 10000000,
        tally: {
          yes: 3000002000000,
          abstain: 0,
          no: 0,
          noWithVeto: 0,
          total: 3000002000000
        },
        paramChanges: []
      });
    });

    it("throws 400 for an invalid proposal id", async () => {
      setup();

      const response = await app.request("/v1/proposals/invalid");

      expect(response.status).toBe(400);
    });

    it("throws 404 for an unknown proposal", async () => {
      setup();

      const response = await app.request("/v1/proposals/999");

      expect(response.status).toBe(404);
    });
  });

  const setup = () => {
    nock(apiProxyUrl)
      .persist()
      .get("/cosmos/gov/v1beta1/proposals?pagination.limit=1000")
      .reply(200, {
        proposals: [
          {
            proposal_id: "1",
            content: {
              "@type": "/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal",
              title: "v0.24.0",
              description: "SW upgrade proposal for v0.24.0",
              plan: {
                name: "v0.24.0",
                time: "0001-01-01T00:00:00Z",
                height: "249633",
                info: "https://raw.githubusercontent.com/akash-network/net/main/sandbox/upgrades/v0.24.0/info.json",
                upgraded_client_state: null
              }
            },
            status: "PROPOSAL_STATUS_FAILED",
            final_tally_result: {
              yes: "3000002000000",
              abstain: "0",
              no: "0",
              no_with_veto: "0"
            },
            submit_time: "2023-08-04T09:22:37.090076750Z",
            deposit_end_time: "2023-08-04T09:32:37.090076750Z",
            total_deposit: [
              {
                denom: "uakt",
                amount: "10000000"
              }
            ],
            voting_start_time: "2023-08-04T09:22:53.568959577Z",
            voting_end_time: "2023-08-04T09:32:53.568959577Z"
          },
          {
            proposal_id: "2",
            content: {
              "@type": "/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal",
              title: "v0.24.0",
              description: "SW upgrade proposal for v0.24.0",
              plan: {
                name: "v0.24.0",
                time: "0001-01-01T00:00:00Z",
                height: "249826",
                info: "https://raw.githubusercontent.com/akash-network/net/main/sandbox/upgrades/v0.24.0/info.json",
                upgraded_client_state: null
              }
            },
            status: "PROPOSAL_STATUS_PASSED",
            final_tally_result: {
              yes: "3000002000000",
              abstain: "0",
              no: "0",
              no_with_veto: "0"
            },
            submit_time: "2023-08-04T09:33:52.911650830Z",
            deposit_end_time: "2023-08-04T09:43:52.911650830Z",
            total_deposit: [
              {
                denom: "uakt",
                amount: "10000000"
              }
            ],
            voting_start_time: "2023-08-04T09:34:14.957738073Z",
            voting_end_time: "2023-08-04T09:44:14.957738073Z"
          },
          {
            proposal_id: "3",
            content: {
              "@type": "/cosmos.params.v1beta1.ParameterChangeProposal",
              title: "Enable axlUSDC for deployments",
              description: "Enable axlUSDC for deployments",
              changes: [
                {
                  subspace: "take",
                  key: "DenomTakeRates",
                  value: JSON.stringify([
                    {
                      denom: "uakt",
                      rate: 0
                    },
                    {
                      denom: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84",
                      rate: 20
                    }
                  ])
                },
                {
                  subspace: "deployment",
                  key: "MinDeposits",
                  value: JSON.stringify([
                    {
                      denom: "uakt",
                      amount: "5000000"
                    },
                    {
                      denom: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84",
                      amount: "5000000"
                    }
                  ])
                }
              ]
            },
            status: "PROPOSAL_STATUS_PASSED",
            final_tally_result: {
              yes: "3000002000000",
              abstain: "0",
              no: "0",
              no_with_veto: "0"
            },
            submit_time: "2023-08-04T11:23:30.716939528Z",
            deposit_end_time: "2023-08-04T11:33:30.716939528Z",
            total_deposit: [
              {
                denom: "uakt",
                amount: "1010000000"
              }
            ],
            voting_start_time: "2023-08-04T11:23:30.716939528Z",
            voting_end_time: "2023-08-04T11:33:30.716939528Z"
          }
        ]
      });

    nock(apiProxyUrl)
      .persist()
      .get("/cosmos/gov/v1beta1/proposals/2")
      .reply(200, {
        proposal: {
          proposal_id: "2",
          content: {
            "@type": "/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal",
            title: "v0.24.0",
            description: "SW upgrade proposal for v0.24.0",
            plan: {
              name: "v0.24.0",
              time: "0001-01-01T00:00:00Z",
              height: "249826",
              info: "https://raw.githubusercontent.com/akash-network/net/main/sandbox/upgrades/v0.24.0/info.json",
              upgraded_client_state: null
            }
          },
          status: "PROPOSAL_STATUS_VOTING_PERIOD",
          final_tally_result: {
            yes: "0",
            abstain: "0",
            no: "0",
            no_with_veto: "0"
          },
          submit_time: "2023-08-04T09:33:52.911650830Z",
          deposit_end_time: "2023-08-04T09:43:52.911650830Z",
          total_deposit: [
            {
              denom: "uakt",
              amount: "10000000"
            }
          ],
          voting_start_time: "2023-08-04T09:34:14.957738073Z",
          voting_end_time: "2023-08-04T09:44:14.957738073Z"
        }
      });

    nock(apiProxyUrl)
      .persist()
      .get("/cosmos/gov/v1beta1/proposals/2/tally")
      .reply(200, {
        tally: {
          yes: "3000002000000",
          abstain: "0",
          no: "0",
          no_with_veto: "0"
        }
      });

    nock(apiProxyUrl).persist().get("/cosmos/gov/v1beta1/proposals/999").reply(404);
  };
});
