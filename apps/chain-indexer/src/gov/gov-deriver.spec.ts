import { describe, expect, it } from "vitest";

import { deriveGovChanges } from "@src/gov/gov-deriver";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";

const MSG_SUBMIT_PROPOSAL = "/cosmos.gov.v1.MsgSubmitProposal";
const MSG_SUBMIT_PROPOSAL_V1BETA1 = "/cosmos.gov.v1beta1.MsgSubmitProposal";
const MSG_VOTE = "/cosmos.gov.v1.MsgVote";
const MSG_VOTE_WEIGHTED = "/cosmos.gov.v1.MsgVoteWeighted";
const MSG_DEPOSIT = "/cosmos.gov.v1.MsgDeposit";
const SUBMIT_TIME = new Date("2026-08-13T00:00:00Z");

describe("deriveGovChanges", () => {
  it("derives a v1 proposal with the id from its submit_proposal event, plus the initial deposit", () => {
    const changes = deriveGovChanges(
      block({
        messages: [
          {
            typeUrl: MSG_SUBMIT_PROPOSAL,
            body: {
              proposer: "akash1prop",
              title: "Upgrade",
              summary: "Do it",
              metadata: "meta",
              messages: [{ typeUrl: "/x", value: "AA==" }],
              initialDeposit: [{ denom: "uakt", amount: "1000" }]
            }
          }
        ],
        txEvents: [event("submit_proposal", { proposal_id: "7" }, 0)]
      })
    );

    expect(changes.proposals).toEqual([
      {
        id: 7,
        proposerAddress: "akash1prop",
        title: "Upgrade",
        summary: "Do it",
        messages: [{ typeUrl: "/x", value: "AA==" }],
        metadata: "meta",
        submitTime: SUBMIT_TIME,
        submitHeight: 100,
        initialDeposit: [{ denom: "uakt", amount: "1000" }]
      }
    ]);
    expect(changes.deposits).toEqual([{ proposalId: 7, depositorAddress: "akash1prop", amount: [{ denom: "uakt", amount: "1000" }], height: 100 }]);
  });

  it("keeps a v1beta1 proposal's legacy content under messages and leaves title/summary null", () => {
    const changes = deriveGovChanges(
      block({
        messages: [
          {
            typeUrl: MSG_SUBMIT_PROPOSAL_V1BETA1,
            body: { proposer: "akash1prop", content: { typeUrl: "/cosmos.gov.v1beta1.TextProposal", value: "BB==" }, initialDeposit: [] }
          }
        ],
        txEvents: [event("submit_proposal", { proposal_id: "8" }, 0)]
      })
    );

    expect(changes.proposals[0]).toMatchObject({ id: 8, title: null, summary: null, messages: { typeUrl: "/cosmos.gov.v1beta1.TextProposal", value: "BB==" } });
    expect(changes.deposits).toEqual([]);
  });

  it("assigns distinct ids when one early-mainnet tx submits two proposals without msg_index", () => {
    const changes = deriveGovChanges(
      block({
        messages: [
          {
            typeUrl: MSG_SUBMIT_PROPOSAL_V1BETA1,
            body: { proposer: "akash1a", content: { typeUrl: "/cosmos.gov.v1beta1.TextProposal", value: "AA==" }, initialDeposit: [] },
            index: 0
          },
          {
            typeUrl: MSG_SUBMIT_PROPOSAL_V1BETA1,
            body: { proposer: "akash1b", content: { typeUrl: "/cosmos.gov.v1beta1.TextProposal", value: "BB==" }, initialDeposit: [] },
            index: 1
          }
        ],
        txEvents: [
          event("submit_proposal", { proposal_id: "4" }),
          event("submit_proposal", { proposal_type: "Text", voting_period_start: "4" }),
          event("submit_proposal", { proposal_id: "5" }),
          event("submit_proposal", { proposal_type: "Text", voting_period_start: "5" })
        ]
      })
    );

    expect(changes.proposals.map(proposal => proposal.id)).toEqual([4, 5]);
  });

  it("takes the proposal id from a pair of unindexed submit_proposal events the way early mainnet emits them", () => {
    const changes = deriveGovChanges(
      block({
        messages: [
          {
            typeUrl: MSG_SUBMIT_PROPOSAL_V1BETA1,
            body: {
              proposer: "akash1prop",
              content: { typeUrl: "/cosmos.params.v1beta1.ParameterChangeProposal", value: "AA==" },
              initialDeposit: [{ denom: "uakt", amount: "1000000000" }]
            }
          }
        ],
        txEvents: [event("submit_proposal", { proposal_id: "4" }), event("submit_proposal", { proposal_type: "ParameterChange", voting_period_start: "4" })]
      })
    );

    expect(changes.proposals[0]).toMatchObject({ id: 4, proposerAddress: "akash1prop" });
    expect(changes.deposits).toEqual([{ proposalId: 4, depositorAddress: "akash1prop", amount: [{ denom: "uakt", amount: "1000000000" }], height: 100 }]);
    expect(changes.statusUpdates).toEqual([{ proposalId: 4, status: "voting_period", onlyFromDepositPeriod: true }]);
  });

  it("skips a submit proposal whose id cannot be resolved from an event", () => {
    const changes = deriveGovChanges(block({ messages: [{ typeUrl: MSG_SUBMIT_PROPOSAL, body: { proposer: "akash1prop", title: "T" } }], txEvents: [] }));

    expect(changes.proposals).toEqual([]);
  });

  it("links each proposal to its own submit_proposal event by msg_index", () => {
    const changes = deriveGovChanges(
      block({
        messages: [
          { typeUrl: MSG_SUBMIT_PROPOSAL, body: { proposer: "akash1a", title: "A" }, index: 0 },
          { typeUrl: MSG_SUBMIT_PROPOSAL, body: { proposer: "akash1b", title: "B" }, index: 1 }
        ],
        txEvents: [event("submit_proposal", { proposal_id: "20" }, 1), event("submit_proposal", { proposal_id: "10" }, 0)]
      })
    );

    expect(changes.proposals.map(proposal => [proposal.id, proposal.title])).toEqual([
      [10, "A"],
      [20, "B"]
    ]);
  });

  it("derives a plain vote as a single full-weight option and promotes the proposal into voting", () => {
    const changes = deriveGovChanges(block({ messages: [{ typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 1 } }] }));

    expect(changes.votes).toEqual([{ proposalId: 7, voterAddress: "akash1voter", options: [{ option: "yes", weight: "1.000000000000000000" }], height: 100 }]);
    expect(changes.statusUpdates).toEqual([{ proposalId: 7, status: "voting_period", onlyFromDepositPeriod: true }]);
  });

  it("maps a weighted vote's options", () => {
    const changes = deriveGovChanges(
      block({
        messages: [
          {
            typeUrl: MSG_VOTE_WEIGHTED,
            body: {
              proposalId: "7",
              voter: "akash1voter",
              options: [
                { option: 1, weight: "0.700000000000000000" },
                { option: 3, weight: "0.300000000000000000" }
              ]
            }
          }
        ]
      })
    );

    expect(changes.votes[0].options).toEqual([
      { option: "yes", weight: "0.700000000000000000" },
      { option: "no", weight: "0.300000000000000000" }
    ]);
  });

  it("drops a vote whose option is unspecified", () => {
    const changes = deriveGovChanges(block({ messages: [{ typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 0 } }] }));

    expect(changes.votes).toEqual([]);
    expect(changes.statusUpdates).toEqual([]);
  });

  it("derives a standalone deposit", () => {
    const changes = deriveGovChanges(
      block({ messages: [{ typeUrl: MSG_DEPOSIT, body: { proposalId: "7", depositor: "akash1dep", amount: [{ denom: "uakt", amount: "500" }] } }] })
    );

    expect(changes.deposits).toEqual([{ proposalId: 7, depositorAddress: "akash1dep", amount: [{ denom: "uakt", amount: "500" }], height: 100 }]);
  });

  it("sums a proposer's initial deposit and a same-block deposit into one row instead of dropping the second", () => {
    const changes = deriveGovChanges(
      block({
        messages: [
          { typeUrl: MSG_SUBMIT_PROPOSAL, body: { proposer: "akash1prop", title: "Upgrade", initialDeposit: [{ denom: "uakt", amount: "1000" }] }, index: 0 },
          { typeUrl: MSG_DEPOSIT, body: { proposalId: "7", depositor: "akash1prop", amount: [{ denom: "uakt", amount: "500" }] }, index: 1 }
        ],
        txEvents: [event("submit_proposal", { proposal_id: "7" }, 0)]
      })
    );

    expect(changes.deposits).toEqual([{ proposalId: 7, depositorAddress: "akash1prop", amount: [{ denom: "uakt", amount: "1500" }], height: 100 }]);
  });

  it("skips vote and deposit messages from a failed transaction", () => {
    const changes = deriveGovChanges(
      block({
        code: 5,
        messages: [
          { typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 1 } },
          { typeUrl: MSG_DEPOSIT, body: { proposalId: "7", depositor: "akash1dep", amount: [{ denom: "uakt", amount: "500" }] } }
        ]
      })
    );

    expect(changes.votes).toEqual([]);
    expect(changes.deposits).toEqual([]);
    expect(changes.statusUpdates).toEqual([]);
  });

  it("maps an active_proposal result to a terminal status", () => {
    const changes = deriveGovChanges(block({ blockEvents: [event("active_proposal", { proposal_id: "7", proposal_result: "proposal_passed" })] }));

    expect(changes.statusUpdates).toEqual([{ proposalId: 7, status: "passed" }]);
  });

  it("maps an inactive_proposal to failed", () => {
    const changes = deriveGovChanges(block({ blockEvents: [event("inactive_proposal", { proposal_id: "9" })] }));

    expect(changes.statusUpdates).toEqual([{ proposalId: 9, status: "failed" }]);
  });
});

function block(input: {
  height?: number;
  code?: number;
  messages?: { typeUrl: string; body: unknown; index?: number }[];
  txEvents?: DecodedEvent[];
  blockEvents?: DecodedEvent[];
}): DecodedBlock {
  const messages = input.messages ?? [];
  return {
    height: input.height ?? 100,
    datetime: SUBMIT_TIME,
    hash: Buffer.alloc(0),
    parentHash: null,
    proposerAddress: "P",
    transactions:
      messages.length > 0 || input.txEvents
        ? [
            {
              index: 0,
              hash: Buffer.alloc(0),
              code: input.code ?? 0,
              gasUsed: 0,
              gasWanted: 0,
              fee: [],
              messages: messages.map((message, index) => ({ index: message.index ?? index, typeUrl: message.typeUrl, body: message.body })),
              events: input.txEvents ?? [],
              signerAddresses: []
            }
          ]
        : [],
    blockEvents: input.blockEvents ?? []
  };
}

function event(type: string, attributes: Record<string, string>, msgIndex?: number): DecodedEvent {
  return msgIndex === undefined ? { type, attributes } : { type, attributes, msgIndex };
}
