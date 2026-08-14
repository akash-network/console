import { fromBase64, toBase64, toHex } from "@cosmjs/encoding";
import { PubKey as Ed25519PubKey } from "cosmjs-types/cosmos/crypto/ed25519/keys";
import {
  QueryValidatorDelegationsRequest,
  QueryValidatorDelegationsResponse,
  QueryValidatorsRequest,
  QueryValidatorsResponse,
  QueryValidatorUnbondingDelegationsRequest,
  QueryValidatorUnbondingDelegationsResponse
} from "cosmjs-types/cosmos/staking/v1beta1/query";
import { BondStatus } from "cosmjs-types/cosmos/staking/v1beta1/staking";
import type { Any } from "cosmjs-types/google/protobuf/any";
import type { Timestamp } from "cosmjs-types/google/protobuf/timestamp";

import { consensusHexAddress, operatorToAccountAddress } from "@src/genesis/genesis-address";

export const VALIDATORS_PATH = "/cosmos.staking.v1beta1.Query/Validators";
export const VALIDATOR_DELEGATIONS_PATH = "/cosmos.staking.v1beta1.Query/ValidatorDelegations";
export const VALIDATOR_UNBONDING_PATH = "/cosmos.staking.v1beta1.Query/ValidatorUnbondingDelegations";

/** One node page. Callers loop on the returned cursor, so this bounds a single round-trip, not the whole set. */
const PAGE_LIMIT = 1000n;

export type SnapshotValidatorStatus = "bonded" | "unbonding" | "unbonded";

/** The full validator row the snapshot reconciles against the chain, including the consensus `hexAddress` derived from the ed25519 pubkey. */
export interface SnapshotValidator {
  operatorAddress: string;
  hexAddress: string | null;
  accountAddress: string | null;
  moniker: string | null;
  identity: string | null;
  website: string | null;
  details: string | null;
  securityContact: string | null;
  commissionRate: string | null;
  commissionMaxRate: string | null;
  commissionMaxChangeRate: string | null;
  minSelfDelegation: string | null;
  jailed: boolean;
  status: SnapshotValidatorStatus | null;
  tokens: string;
  delegatorShares: string;
  unbondingHeight: number | null;
  unbondingTime: Date | null;
}

export interface SnapshotDelegation {
  delegatorAddress: string;
  validatorOperatorAddress: string;
  shares: string;
}

export interface SnapshotUnbondingEntry {
  delegatorAddress: string;
  validatorOperatorAddress: string;
  creationHeight: number;
  completionTime: Date;
  initialBalance: string;
  balance: string;
}

/** A decoded page plus the cursor to fetch the next one, or null once the set is exhausted. */
export interface Page<T> {
  items: T[];
  nextKey: Uint8Array | null;
}

export function encodeValidatorsRequest(pageKey: Uint8Array = new Uint8Array()): string {
  return toHex(QueryValidatorsRequest.encode(QueryValidatorsRequest.fromPartial({ status: "", pagination: pageRequest(pageKey) })).finish());
}

export function encodeValidatorDelegationsRequest(validatorAddr: string, pageKey: Uint8Array = new Uint8Array()): string {
  return toHex(QueryValidatorDelegationsRequest.encode(QueryValidatorDelegationsRequest.fromPartial({ validatorAddr, pagination: pageRequest(pageKey) })).finish());
}

export function encodeValidatorUnbondingRequest(validatorAddr: string, pageKey: Uint8Array = new Uint8Array()): string {
  return toHex(QueryValidatorUnbondingDelegationsRequest.encode(QueryValidatorUnbondingDelegationsRequest.fromPartial({ validatorAddr, pagination: pageRequest(pageKey) })).finish());
}

export function decodeValidators(value: string | null): Page<SnapshotValidator> {
  if (!value) {
    return { items: [], nextKey: null };
  }
  const response = QueryValidatorsResponse.decode(fromBase64(value));
  return {
    items: response.validators.map(validator => {
      const rates = validator.commission?.commissionRates;
      return {
        operatorAddress: validator.operatorAddress,
        hexAddress: toConsensusHexAddress(validator.consensusPubkey),
        accountAddress: toAccountAddress(validator.operatorAddress),
        moniker: emptyToNull(validator.description?.moniker),
        identity: emptyToNull(validator.description?.identity),
        website: emptyToNull(validator.description?.website),
        details: emptyToNull(validator.description?.details),
        securityContact: emptyToNull(validator.description?.securityContact),
        commissionRate: decOrNull(rates?.rate),
        commissionMaxRate: decOrNull(rates?.maxRate),
        commissionMaxChangeRate: decOrNull(rates?.maxChangeRate),
        minSelfDelegation: emptyToNull(validator.minSelfDelegation),
        jailed: validator.jailed,
        status: toStatus(validator.status),
        tokens: validator.tokens || "0",
        delegatorShares: formatDec(validator.delegatorShares),
        unbondingHeight: validator.unbondingHeight > 0n ? Number(validator.unbondingHeight) : null,
        unbondingTime: toDateOrNull(validator.unbondingTime)
      };
    }),
    nextKey: nextKeyOf(response.pagination?.nextKey)
  };
}

export function decodeValidatorDelegations(validatorOperatorAddress: string, value: string | null): Page<SnapshotDelegation> {
  if (!value) {
    return { items: [], nextKey: null };
  }
  const response = QueryValidatorDelegationsResponse.decode(fromBase64(value));
  return {
    items: response.delegationResponses.map(({ delegation }) => ({
      delegatorAddress: delegation.delegatorAddress,
      validatorOperatorAddress,
      shares: formatDec(delegation.shares)
    })),
    nextKey: nextKeyOf(response.pagination?.nextKey)
  };
}

export function decodeValidatorUnbonding(validatorOperatorAddress: string, value: string | null): Page<SnapshotUnbondingEntry> {
  if (!value) {
    return { items: [], nextKey: null };
  }
  const response = QueryValidatorUnbondingDelegationsResponse.decode(fromBase64(value));
  return {
    items: response.unbondingResponses.flatMap(unbonding =>
      unbonding.entries.map(entry => ({
        delegatorAddress: unbonding.delegatorAddress,
        validatorOperatorAddress,
        creationHeight: Number(entry.creationHeight),
        completionTime: toDate(entry.completionTime),
        initialBalance: entry.initialBalance,
        balance: entry.balance
      }))
    ),
    nextKey: nextKeyOf(response.pagination?.nextKey)
  };
}

function pageRequest(key: Uint8Array) {
  return { key, offset: 0n, limit: PAGE_LIMIT, countTotal: false, reverse: false };
}

function nextKeyOf(key: Uint8Array | undefined): Uint8Array | null {
  return key && key.length > 0 ? key : null;
}

function emptyToNull(value: string | undefined): string | null {
  return value ? value : null;
}

function decOrNull(raw: string | undefined): string | null {
  return raw ? formatDec(raw) : null;
}

/** Consensus hex address derived from the validator's ed25519 pubkey; a missing or malformed key yields null rather than aborting the snapshot. */
function toConsensusHexAddress(consensusPubkey: Any | undefined): string | null {
  if (!consensusPubkey) {
    return null;
  }
  try {
    return consensusHexAddress(consensusPubkey.typeUrl, toBase64(Ed25519PubKey.decode(consensusPubkey.value).key));
  } catch {
    return null;
  }
}

/** Derives the `akash…` account address from the operator address; a malformed operator address yields null rather than aborting the snapshot. */
function toAccountAddress(operatorAddress: string): string | null {
  try {
    return operatorToAccountAddress(operatorAddress);
  } catch {
    return null;
  }
}

function toStatus(status: BondStatus): SnapshotValidatorStatus | null {
  switch (status) {
    case BondStatus.BOND_STATUS_BONDED:
      return "bonded";
    case BondStatus.BOND_STATUS_UNBONDING:
      return "unbonding";
    case BondStatus.BOND_STATUS_UNBONDED:
      return "unbonded";
    default:
      return null;
  }
}

/**
 * A cosmos `LegacyDec` is marshaled over protobuf as its value scaled by 10^18 with no decimal point
 * (e.g. `"5000000000000000000000000"`). Render it as a fixed 18-decimal string so it matches the
 * genesis-seeded `numeric(38,18)` shares rather than being stored 10^18 times too large.
 */
export function formatDec(raw: string): string {
  const negative = raw.startsWith("-");
  const digits = (negative ? raw.slice(1) : raw).padStart(19, "0");
  const whole = digits.slice(0, -18);
  const fraction = digits.slice(-18);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function toDate(timestamp: Timestamp): Date {
  return new Date(Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1_000_000));
}

function toDateOrNull(timestamp: Timestamp | undefined): Date | null {
  return timestamp && timestamp.seconds > 0n ? toDate(timestamp) : null;
}
