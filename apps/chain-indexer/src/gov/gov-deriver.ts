import type { FeeCoin, proposalStatus, voteOption, WeightedVoteOption } from "@src/db/schema";
import type { DecodedBlock, DecodedEvent, DecodedMessage, DecodedTransaction } from "@src/pipeline/decoded-block";

export type ProposalStatus = (typeof proposalStatus.enumValues)[number];
type VoteOptionValue = (typeof voteOption.enumValues)[number];

const SUBMIT_PROPOSAL = new Set(["/cosmos.gov.v1.MsgSubmitProposal", "/cosmos.gov.v1beta1.MsgSubmitProposal"]);
const VOTE = new Set(["/cosmos.gov.v1.MsgVote", "/cosmos.gov.v1beta1.MsgVote"]);
const VOTE_WEIGHTED = new Set(["/cosmos.gov.v1.MsgVoteWeighted", "/cosmos.gov.v1beta1.MsgVoteWeighted"]);
const DEPOSIT = new Set(["/cosmos.gov.v1.MsgDeposit", "/cosmos.gov.v1beta1.MsgDeposit"]);

const FULL_WEIGHT = "1.000000000000000000";

/** cosmos `VoteOption` enum → the stored option; the unspecified/unknown value has no vote and is dropped. */
const VOTE_OPTION_BY_NUMBER: Record<number, VoteOptionValue> = { 1: "yes", 2: "abstain", 3: "no", 4: "no_with_veto" };

/** cosmos EndBlock `active_proposal` result → terminal status. */
const STATUS_BY_RESULT: Record<string, ProposalStatus> = { proposal_passed: "passed", proposal_rejected: "rejected", proposal_failed: "failed" };

export interface DerivedProposal {
  id: number;
  proposerAddress: string | null;
  title: string | null;
  summary: string | null;
  messages: unknown;
  metadata: string | null;
  submitTime: Date;
  submitHeight: number;
  initialDeposit: FeeCoin[];
}

export interface DerivedVote {
  proposalId: number;
  voterAddress: string;
  options: WeightedVoteOption[];
  height: number;
}

export interface DerivedDeposit {
  proposalId: number;
  depositorAddress: string;
  amount: FeeCoin[];
  height: number;
}

/** A status change. `onlyFromDepositPeriod` promotes a proposal into `voting_period` without regressing a terminal state. */
export interface DerivedStatusUpdate {
  proposalId: number;
  status: ProposalStatus;
  onlyFromDepositPeriod?: boolean;
}

export interface GovChanges {
  proposals: DerivedProposal[];
  votes: DerivedVote[];
  deposits: DerivedDeposit[];
  statusUpdates: DerivedStatusUpdate[];
}

/**
 * Extracts governance entities from a block's messages and events. Proposal ids come from the `submit_proposal`
 * event (the message never carries the assigned id); terminal status comes from the EndBlock `active_proposal` /
 * `inactive_proposal` events; a vote promotes its proposal into `voting_period` since votes are only cast then.
 */
export function deriveGovChanges(block: DecodedBlock): GovChanges {
  const changes: GovChanges = { proposals: [], votes: [], deposits: [], statusUpdates: [] };

  for (const tx of block.transactions) {
    for (const message of tx.messages) {
      addMessage(changes, message, tx, block);
    }
  }

  for (const event of block.blockEvents) {
    addBlockEvent(changes, event);
  }

  return changes;
}

function addMessage(changes: GovChanges, message: DecodedMessage, tx: DecodedTransaction, block: DecodedBlock): void {
  const body = asRecord(message.body);
  if (!body) {
    return;
  }

  if (SUBMIT_PROPOSAL.has(message.typeUrl)) {
    addProposal(changes, body, message.index, tx, block);
  } else if (VOTE.has(message.typeUrl)) {
    const option = mapOption(asNumber(body.option));
    addVote(changes, body, option ? [{ option, weight: FULL_WEIGHT }] : [], block.height);
  } else if (VOTE_WEIGHTED.has(message.typeUrl)) {
    addVote(changes, body, mapWeightedOptions(body.options), block.height);
  } else if (DEPOSIT.has(message.typeUrl)) {
    addDeposit(changes, asProposalId(body.proposalId), asString(body.depositor), asCoins(body.amount), block.height);
  }
}

function addProposal(changes: GovChanges, body: Record<string, unknown>, messageIndex: number, tx: DecodedTransaction, block: DecodedBlock): void {
  const id = proposalIdFromEvent(tx, messageIndex);
  if (id === null) {
    return;
  }

  const proposer = asString(body.proposer);
  const initialDeposit = asCoins(body.initialDeposit);

  changes.proposals.push({
    id,
    proposerAddress: proposer,
    title: asString(body.title),
    summary: asString(body.summary),
    messages: body.messages ?? body.content ?? null,
    metadata: asString(body.metadata),
    submitTime: block.datetime,
    submitHeight: block.height,
    initialDeposit
  });

  if (proposer && initialDeposit.length > 0) {
    addDeposit(changes, id, proposer, initialDeposit, block.height);
  }
}

function addVote(changes: GovChanges, body: Record<string, unknown>, options: WeightedVoteOption[], height: number): void {
  const proposalId = asProposalId(body.proposalId);
  const voter = asString(body.voter);
  if (proposalId === null || !voter || options.length === 0) {
    return;
  }

  changes.votes.push({ proposalId, voterAddress: voter, options, height });
  changes.statusUpdates.push({ proposalId, status: "voting_period", onlyFromDepositPeriod: true });
}

function addDeposit(changes: GovChanges, proposalId: number | null, depositor: string | null, amount: FeeCoin[], height: number): void {
  if (proposalId === null || !depositor || amount.length === 0) {
    return;
  }
  changes.deposits.push({ proposalId, depositorAddress: depositor, amount, height });
}

function addBlockEvent(changes: GovChanges, event: DecodedEvent): void {
  const proposalId = asProposalId(event.attributes.proposal_id);
  if (proposalId === null) {
    return;
  }

  if (event.type === "active_proposal") {
    changes.statusUpdates.push({ proposalId, status: STATUS_BY_RESULT[event.attributes.proposal_result] ?? "failed" });
  } else if (event.type === "inactive_proposal") {
    changes.statusUpdates.push({ proposalId, status: "failed" });
  }
}

/** The `submit_proposal` event carries the assigned id, linked by `msg_index`; a lone event needs no index to match. */
function proposalIdFromEvent(tx: DecodedTransaction, messageIndex: number): number | null {
  const events = tx.events.filter(event => event.type === "submit_proposal");
  const event = events.find(candidate => candidate.msgIndex === messageIndex) ?? (events.length === 1 ? events[0] : undefined);
  return asProposalId(event?.attributes.proposal_id);
}

function mapOption(option: number | null): VoteOptionValue | null {
  return option === null ? null : VOTE_OPTION_BY_NUMBER[option] ?? null;
}

function mapWeightedOptions(raw: unknown): WeightedVoteOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(entry => {
      const record = asRecord(entry);
      const option = record ? mapOption(asNumber(record.option)) : null;
      return option ? { option, weight: asString(record?.weight) ?? FULL_WEIGHT } : null;
    })
    .filter((entry): entry is WeightedVoteOption => entry !== null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function asProposalId(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function asCoins(value: unknown): FeeCoin[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(entry => {
      const record = asRecord(entry);
      const denom = asString(record?.denom);
      const amount = asString(record?.amount);
      return denom && amount ? { denom, amount } : null;
    })
    .filter((coin): coin is FeeCoin => coin !== null);
}
