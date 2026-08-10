import nock from "nock";
import { container } from "tsyringe";
import { afterAll, describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core";
import type { GetProposalByIdResponse, GetProposalListResponse } from "@src/proposal/http-schemas/proposal.schema";
import { app } from "@src/rest-app";

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
          id: 4,
          title: "PIP Spot and Reservation Revenue Share Proposal",
          status: "PROPOSAL_STATUS_DEPOSIT_PERIOD",
          submitTime: "2023-08-05T10:00:00.000000000Z",
          votingStartTime: "0001-01-01T00:00:00Z",
          votingEndTime: "0001-01-01T00:00:00Z",
          totalDeposit: 0
        },
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
          title: "Akash Inflation & Community Pool Update",
          status: "PROPOSAL_STATUS_VOTING_PERIOD",
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
    it("resolves a proposal in voting period with tally from the live tally endpoint", async () => {
      setup();

      const response = await app.request("/v1/proposals/2");
      const data = (await response.json()) as GetProposalByIdResponse;

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: 2,
        title: "Akash Inflation & Community Pool Update",
        description: "Reduce inflation and fund community pool",
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

    it("resolves a closed legacy proposal with param changes and tally from the final tally result", async () => {
      setup();

      const response = await app.request("/v1/proposals/3");
      const data = (await response.json()) as GetProposalByIdResponse;

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: 3,
        title: "Enable axlUSDC for deployments",
        description: "Enable axlUSDC for deployments",
        status: "PROPOSAL_STATUS_PASSED",
        submitTime: "2023-08-04T11:23:30.716939528Z",
        votingStartTime: "2023-08-04T11:23:30.716939528Z",
        votingEndTime: "2023-08-04T11:33:30.716939528Z",
        totalDeposit: 1010000000,
        tally: {
          yes: 3000002000000,
          abstain: 1000000,
          no: 2000000,
          noWithVeto: 0,
          total: 3000005000000
        },
        paramChanges: [
          {
            subspace: "take",
            key: "DenomTakeRates",
            value: [
              {
                denom: "uakt",
                rate: 0
              },
              {
                denom: "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E",
                rate: 20
              }
            ]
          },
          {
            subspace: "deployment",
            key: "MinDeposits",
            value: [
              {
                denom: "uakt",
                amount: "5000000"
              },
              {
                denom: "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E",
                amount: "5000000"
              }
            ]
          }
        ]
      });
    });

    it("resolves a proposal without messages, deposit and voting times", async () => {
      setup();

      const response = await app.request("/v1/proposals/4");
      const data = (await response.json()) as GetProposalByIdResponse;

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: 4,
        title: "PIP Spot and Reservation Revenue Share Proposal",
        description: "Signaling proposal for PIP revenue share",
        status: "PROPOSAL_STATUS_DEPOSIT_PERIOD",
        submitTime: "2023-08-05T10:00:00.000000000Z",
        votingStartTime: "0001-01-01T00:00:00Z",
        votingEndTime: "0001-01-01T00:00:00Z",
        totalDeposit: 0,
        tally: {
          yes: 0,
          abstain: 0,
          no: 0,
          noWithVeto: 0,
          total: 0
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

  const GOV_AUTHORITY = "akash10d07y265gmmuvt4z0w9aw880jnsr700jhe7z0f";

  const softwareUpgradeProposal = {
    id: "1",
    messages: [
      {
        "@type": "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade",
        authority: GOV_AUTHORITY,
        plan: {
          name: "v0.24.0",
          time: "0001-01-01T00:00:00Z",
          height: "249633",
          info: "https://raw.githubusercontent.com/akash-network/net/main/sandbox/upgrades/v0.24.0/info.json",
          upgraded_client_state: null
        }
      }
    ],
    status: "PROPOSAL_STATUS_FAILED",
    final_tally_result: {
      yes_count: "3000002000000",
      abstain_count: "0",
      no_count: "0",
      no_with_veto_count: "0"
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
    voting_end_time: "2023-08-04T09:32:53.568959577Z",
    metadata: "",
    title: "v0.24.0",
    summary: "SW upgrade proposal for v0.24.0",
    proposer: GOV_AUTHORITY
  };

  const multiMessageProposal = {
    id: "2",
    messages: [
      {
        "@type": "/cosmos.mint.v1beta1.MsgUpdateParams",
        authority: GOV_AUTHORITY,
        params: {
          inflation_max: "0.13",
          inflation_min: "0.09"
        }
      },
      {
        "@type": "/cosmos.distribution.v1beta1.MsgCommunityPoolSpend",
        authority: GOV_AUTHORITY,
        recipient: GOV_AUTHORITY,
        amount: [
          {
            denom: "uakt",
            amount: "5023590000"
          }
        ]
      }
    ],
    status: "PROPOSAL_STATUS_VOTING_PERIOD",
    final_tally_result: {
      yes_count: "0",
      abstain_count: "0",
      no_count: "0",
      no_with_veto_count: "0"
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
    voting_end_time: "2023-08-04T09:44:14.957738073Z",
    metadata: "",
    title: "Akash Inflation & Community Pool Update",
    summary: "Reduce inflation and fund community pool",
    proposer: GOV_AUTHORITY
  };

  const legacyParamChangeProposal = {
    id: "3",
    messages: [
      {
        "@type": "/cosmos.gov.v1.MsgExecLegacyContent",
        authority: GOV_AUTHORITY,
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
                  denom: "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E",
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
                  denom: "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E",
                  amount: "5000000"
                }
              ])
            }
          ]
        }
      }
    ],
    status: "PROPOSAL_STATUS_PASSED",
    final_tally_result: {
      yes_count: "3000002000000",
      abstain_count: "1000000",
      no_count: "2000000",
      no_with_veto_count: "0"
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
    voting_end_time: "2023-08-04T11:33:30.716939528Z",
    metadata: "",
    title: "Enable axlUSDC for deployments",
    summary: "Enable axlUSDC for deployments",
    proposer: GOV_AUTHORITY
  };

  /** protojson omits empty repeated fields, so a zero-message zero-deposit proposal arrives without `messages` and `total_deposit` keys. */
  const omittedRepeatedFieldsProposal = {
    id: "4",
    status: "PROPOSAL_STATUS_DEPOSIT_PERIOD",
    final_tally_result: {
      yes_count: "0",
      abstain_count: "0",
      no_count: "0",
      no_with_veto_count: "0"
    },
    submit_time: "2023-08-05T10:00:00.000000000Z",
    deposit_end_time: "2023-08-19T10:00:00.000000000Z",
    voting_start_time: null,
    voting_end_time: null,
    metadata: "",
    title: "PIP Spot and Reservation Revenue Share Proposal",
    summary: "Signaling proposal for PIP revenue share",
    proposer: GOV_AUTHORITY
  };

  const setup = () => {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get("/cosmos/gov/v1/proposals?pagination.limit=1000")
      .reply(200, {
        proposals: [softwareUpgradeProposal, multiMessageProposal, legacyParamChangeProposal, omittedRepeatedFieldsProposal],
        pagination: {
          next_key: null,
          total: "4"
        }
      });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL).persist().get("/cosmos/gov/v1/proposals/2").reply(200, { proposal: multiMessageProposal });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get("/cosmos/gov/v1/proposals/2/tally")
      .reply(200, {
        tally: {
          yes_count: "3000002000000",
          abstain_count: "0",
          no_count: "0",
          no_with_veto_count: "0"
        }
      });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL).persist().get("/cosmos/gov/v1/proposals/3").reply(200, { proposal: legacyParamChangeProposal });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL).persist().get("/cosmos/gov/v1/proposals/4").reply(200, { proposal: omittedRepeatedFieldsProposal });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get("/cosmos/gov/v1/proposals/999")
      .reply(404, { code: 5, message: "proposal 999 doesn't exist", details: [] });
  };
});
