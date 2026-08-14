import { and, eq, inArray, sql } from "drizzle-orm";
import chunk from "lodash/chunk";
import { singleton } from "tsyringe";

import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import { insertChunked } from "@src/db/insert-chunked";
import type { FeeCoin } from "@src/db/schema";
import { ProposalDeposits, Proposals, ProposalVotes } from "@src/db/schema";
import { sumFeeCoins } from "@src/gov/coin-total";
import type { DerivedDeposit, DerivedProposal, DerivedStatusUpdate, DerivedVote, GovChanges } from "@src/gov/gov-deriver";
import { deriveGovChanges } from "@src/gov/gov-deriver";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import type { ChainTransaction } from "@src/providers/db.provider";

/**
 * Persists governance entities inside the block transaction. Proposal ids and their proposer/voter/depositor
 * addresses are already interned by the committer (governance actors are always the message signer), so this
 * resolves account ids from the passed map rather than interning again. Proposals are inserted conflict-free
 * (their id is assigned once) and their status is advanced only by the separate status updates, so re-committing
 * a block never regresses a proposal that has since entered voting or reached a terminal result.
 */
@singleton()
export class GovWriter {
  async writeForBlocks(tx: ChainTransaction, blocks: DecodedBlock[], accountIds: Map<string, number>): Promise<void> {
    const changes = merge(blocks.map(deriveGovChanges));
    if (changes.proposals.length === 0 && changes.votes.length === 0 && changes.deposits.length === 0 && changes.statusUpdates.length === 0) {
      return;
    }

    await this.#writeProposals(tx, changes.proposals, accountIds);
    await this.#writeVotes(tx, changes.votes, accountIds);
    await this.#writeDeposits(tx, changes.deposits, accountIds);
    await this.#applyStatusUpdates(tx, changes.statusUpdates);
  }

  async #writeProposals(tx: ChainTransaction, proposals: DerivedProposal[], accountIds: Map<string, number>): Promise<void> {
    const rows = proposals.map(proposal => ({
      id: proposal.id,
      proposerAccountId: proposal.proposerAddress ? accountIds.get(proposal.proposerAddress) ?? null : null,
      title: proposal.title,
      summary: proposal.summary,
      messages: proposal.messages,
      metadata: proposal.metadata,
      status: "deposit_period" as const,
      submitTime: proposal.submitTime,
      totalDeposit: proposal.initialDeposit.length > 0 ? proposal.initialDeposit : null,
      submitHeight: proposal.submitHeight
    }));

    await insertChunked(tx, Proposals, rows);
  }

  /**
   * The vote upsert is last-writer-wins on `(proposalId, voterAccountId)`, so the `setWhere` height guard stops
   * an out-of-order commit (e.g. overlapping pods on a rolling deploy) from overwriting a newer vote with a
   * stale one; `dedupeVotes` handles the same collision among blocks merged into a single batch.
   */
  async #writeVotes(tx: ChainTransaction, votes: DerivedVote[], accountIds: Map<string, number>): Promise<void> {
    const rows = dedupeVotes(votes)
      .map(vote => {
        const voterAccountId = accountIds.get(vote.voterAddress);
        return voterAccountId === undefined ? null : { proposalId: vote.proposalId, voterAccountId, options: vote.options, height: vote.height };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    for (const rowChunk of chunk(rows, INSERT_CHUNK_SIZE)) {
      await tx
        .insert(ProposalVotes)
        .values(rowChunk)
        .onConflictDoUpdate({
          target: [ProposalVotes.proposalId, ProposalVotes.voterAccountId],
          set: { options: sqlExcluded("options"), height: sqlExcluded("height") },
          setWhere: sql`excluded.height >= ${ProposalVotes.height}`
        });
    }
  }

  async #writeDeposits(tx: ChainTransaction, deposits: DerivedDeposit[], accountIds: Map<string, number>): Promise<void> {
    const rows = deposits
      .map(deposit => {
        const depositorAccountId = accountIds.get(deposit.depositorAddress);
        return depositorAccountId === undefined ? null : { proposalId: deposit.proposalId, depositorAccountId, amount: deposit.amount, height: deposit.height };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) {
      return;
    }

    await insertChunked(tx, ProposalDeposits, rows);
    await this.#refreshTotalDeposits(tx, [...new Set(rows.map(row => row.proposalId))]);
  }

  /**
   * Recomputes each touched proposal's `total_deposit` from its full deposit history rather than incrementing,
   * so the running total stays correct across blocks and a re-committed block never double-counts.
   */
  async #refreshTotalDeposits(tx: ChainTransaction, proposalIds: number[]): Promise<void> {
    const deposits = await tx
      .select({ proposalId: ProposalDeposits.proposalId, amount: ProposalDeposits.amount })
      .from(ProposalDeposits)
      .where(inArray(ProposalDeposits.proposalId, proposalIds));

    const amountsByProposal = new Map<number, FeeCoin[]>();
    for (const deposit of deposits) {
      const amounts = amountsByProposal.get(deposit.proposalId) ?? [];
      amounts.push(...deposit.amount);
      amountsByProposal.set(deposit.proposalId, amounts);
    }

    for (const proposalId of proposalIds) {
      const total = sumFeeCoins(amountsByProposal.get(proposalId) ?? []);
      await tx
        .update(Proposals)
        .set({ totalDeposit: total.length > 0 ? total : null })
        .where(eq(Proposals.id, proposalId));
    }
  }

  /** A `voting_period` promotion is conditional so it can't overwrite a terminal status; terminal updates are unconditional. */
  async #applyStatusUpdates(tx: ChainTransaction, updates: DerivedStatusUpdate[]): Promise<void> {
    for (const update of updates) {
      const filter = update.onlyFromDepositPeriod ? and(eq(Proposals.id, update.proposalId), eq(Proposals.status, "deposit_period")) : eq(Proposals.id, update.proposalId);
      await tx.update(Proposals).set({ status: update.status }).where(filter);
    }
  }
}

function merge(perBlock: GovChanges[]): GovChanges {
  return {
    proposals: perBlock.flatMap(changes => changes.proposals),
    votes: perBlock.flatMap(changes => changes.votes),
    deposits: perBlock.flatMap(changes => changes.deposits),
    statusUpdates: perBlock.flatMap(changes => changes.statusUpdates)
  };
}

/**
 * Collapses a voter's re-votes on the same proposal within one commit batch to their latest by height. A batch
 * merges votes across many blocks and cosmos allows re-voting during `voting_period`, so the same
 * `(proposalId, voterAccountId)` — the vote's primary key — can appear more than once; feeding both to one
 * `ON CONFLICT DO UPDATE` would raise `21000: command cannot affect row a second time` and abort the batch.
 */
function dedupeVotes(votes: DerivedVote[]): DerivedVote[] {
  const byKey = new Map<string, DerivedVote>();
  for (const vote of votes) {
    const key = `${vote.proposalId}:${vote.voterAddress}`;
    const existing = byKey.get(key);
    if (!existing || vote.height >= existing.height) {
      byKey.set(key, vote);
    }
  }
  return [...byKey.values()];
}

function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
