import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { ProposalDeposits, Proposals, ProposalVotes } from "@src/db/schema";
import { GovWriter } from "@src/gov/gov-writer.service";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";
import type { ChainTransaction } from "@src/providers/db.provider";

import { rowsFor } from "@test/fakes/build-tx-fake";

const MSG_SUBMIT_PROPOSAL = "/cosmos.gov.v1.MsgSubmitProposal";
const MSG_VOTE = "/cosmos.gov.v1.MsgVote";
const MSG_DEPOSIT = "/cosmos.gov.v1.MsgDeposit";

describe(GovWriter.name, () => {
  it("inserts a submitted proposal with its proposer id, deposit_period status and initial deposit", async () => {
    const { govWriter, tx, inserts } = setup();

    await govWriter.writeForBlocks(
      tx,
      [
        block({
          messages: [{ typeUrl: MSG_SUBMIT_PROPOSAL, body: { proposer: "akash1prop", title: "Upgrade", initialDeposit: [{ denom: "uakt", amount: "1000" }] } }],
          txEvents: [event("submit_proposal", { proposal_id: "7" }, 0)]
        })
      ],
      new Map([["akash1prop", 1]])
    );

    expect(rowsFor(inserts, Proposals)).toEqual([
      expect.objectContaining({ id: 7, proposerAccountId: 1, title: "Upgrade", status: "deposit_period", totalDeposit: [{ denom: "uakt", amount: "1000" }] })
    ]);
    expect(rowsFor(inserts, ProposalDeposits)).toEqual([{ proposalId: 7, depositorAccountId: 1, amount: [{ denom: "uakt", amount: "1000" }], height: 100 }]);
  });

  it("refreshes total_deposit from the full deposit history so a later deposit updates the running total", async () => {
    const { govWriter, tx, updates } = setup({ priorDeposits: [{ proposalId: 7, amount: [{ denom: "uakt", amount: "1000" }] }] });

    await govWriter.writeForBlocks(
      tx,
      [block({ messages: [{ typeUrl: MSG_DEPOSIT, body: { proposalId: "7", depositor: "akash1dep", amount: [{ denom: "uakt", amount: "500" }] } }] })],
      new Map([["akash1dep", 3]])
    );

    const proposalUpdate = updates.find(update => update.table === Proposals);
    expect(proposalUpdate?.set).toEqual({ totalDeposit: [{ denom: "uakt", amount: "1500" }] });
  });

  it("upserts a vote with the resolved voter id and promotes the proposal into voting conditionally", async () => {
    const { govWriter, tx, inserts, updates } = setup();

    await govWriter.writeForBlocks(
      tx,
      [block({ messages: [{ typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 1 } }] })],
      new Map([["akash1voter", 2]])
    );

    expect(rowsFor(inserts, ProposalVotes)).toEqual([
      { proposalId: 7, voterAccountId: 2, options: [{ option: "yes", weight: "1.000000000000000000" }], height: 100 }
    ]);
    expect(updates).toHaveLength(1);
    expect(updates[0].set).toEqual({ status: "voting_period" });
    expect(whereSql(updates[0].where)).toContain("status");
  });

  it("collapses a voter's re-vote across blocks in one batch to the latest vote by height", async () => {
    const { govWriter, tx, inserts } = setup();

    await govWriter.writeForBlocks(
      tx,
      [
        block({ height: 100, messages: [{ typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 1 } }] }),
        block({ height: 150, messages: [{ typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 3 } }] })
      ],
      new Map([["akash1voter", 2]])
    );

    expect(rowsFor(inserts, ProposalVotes)).toEqual([
      { proposalId: 7, voterAccountId: 2, options: [{ option: "no", weight: "1.000000000000000000" }], height: 150 }
    ]);
  });

  it("collapses two votes from the same voter in one block to the last one", async () => {
    const { govWriter, tx, inserts } = setup();

    await govWriter.writeForBlocks(
      tx,
      [
        block({
          height: 100,
          messages: [
            { typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 1 }, index: 0 },
            { typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 3 }, index: 1 }
          ]
        })
      ],
      new Map([["akash1voter", 2]])
    );

    expect(rowsFor(inserts, ProposalVotes)).toEqual([
      { proposalId: 7, voterAccountId: 2, options: [{ option: "no", weight: "1.000000000000000000" }], height: 100 }
    ]);
  });

  it("guards the vote upsert so a lower-height commit cannot overwrite a newer vote", async () => {
    const { govWriter, tx, upserts } = setup();

    await govWriter.writeForBlocks(
      tx,
      [block({ messages: [{ typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 1 } }] })],
      new Map([["akash1voter", 2]])
    );

    const voteUpsert = upserts.find(upsert => upsert.table === ProposalVotes) as { table: unknown; config: { setWhere: SQL } };
    expect(whereSql(voteUpsert.config.setWhere)).toContain("height");
    expect(whereSql(voteUpsert.config.setWhere)).toContain(">=");
  });

  it("applies a terminal status from an active_proposal without a status condition", async () => {
    const { govWriter, tx, updates } = setup();

    await govWriter.writeForBlocks(
      tx,
      [block({ blockEvents: [event("active_proposal", { proposal_id: "7", proposal_result: "proposal_passed" })] })],
      new Map()
    );

    expect(updates[0].set).toEqual({ status: "passed" });
    expect(whereSql(updates[0].where)).not.toContain("status");
  });

  it("skips a vote whose voter was never interned", async () => {
    const { govWriter, tx, inserts } = setup();

    await govWriter.writeForBlocks(tx, [block({ messages: [{ typeUrl: MSG_VOTE, body: { proposalId: "7", voter: "akash1voter", option: 1 } }] })], new Map());

    expect(rowsFor(inserts, ProposalVotes)).toEqual([]);
  });

  it("writes nothing for a block without governance", async () => {
    const { govWriter, tx, inserts, updates } = setup();

    await govWriter.writeForBlocks(tx, [block({ messages: [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", body: {} }] })], new Map());

    expect(inserts).toEqual([]);
    expect(updates).toEqual([]);
  });

  function setup(input?: { priorDeposits?: { proposalId: number; amount: { denom: string; amount: string }[] }[] }) {
    const inserts: { table: unknown; rows: Record<string, unknown>[] }[] = [];
    const upserts: { table: unknown; config: Record<string, unknown> }[] = [];
    const updates: { table: unknown; set: Record<string, unknown>; where: unknown }[] = [];
    const priorDeposits = input?.priorDeposits ?? [];

    const tx = {
      insert: (table: unknown) => ({
        values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          inserts.push({ table, rows: Array.isArray(rows) ? rows : [rows] });
          return Object.assign(Promise.resolve(), {
            onConflictDoNothing: () => Object.assign(Promise.resolve(), { returning: () => Promise.resolve([]) }),
            onConflictDoUpdate: (config: Record<string, unknown>) => {
              upserts.push({ table, config });
              return Promise.resolve();
            }
          });
        }
      }),
      update: (table: unknown) => ({
        set: (set: Record<string, unknown>) => ({
          where: (where: unknown) => {
            updates.push({ table, set, where });
            return Promise.resolve();
          }
        })
      }),
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([...priorDeposits, ...rowsFor(inserts, ProposalDeposits).map(row => ({ proposalId: row.proposalId, amount: row.amount }))])
        })
      })
    };

    return { govWriter: new GovWriter(), tx: tx as unknown as ChainTransaction, inserts, upserts, updates };
  }
});

function whereSql(where: unknown): string {
  return new PgDialect().sqlToQuery(where as SQL).sql;
}

function block(input: {
  height?: number;
  messages?: { typeUrl: string; body: unknown; index?: number }[];
  txEvents?: DecodedEvent[];
  blockEvents?: DecodedEvent[];
}): DecodedBlock {
  const messages = input.messages ?? [];
  return {
    height: input.height ?? 100,
    datetime: new Date("2026-08-13T00:00:00Z"),
    hash: Buffer.alloc(0),
    parentHash: null,
    proposerAddress: "P",
    transactions:
      messages.length > 0 || input.txEvents
        ? [
            {
              index: 0,
              hash: Buffer.alloc(0),
              code: 0,
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
