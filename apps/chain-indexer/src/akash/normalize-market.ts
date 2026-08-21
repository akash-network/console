import { type AkashChangeBody, akashTypeUrlSet, type LeaseKey } from "@src/akash/akash-changes";
import { asInteger, asRecord, asString } from "@src/akash/json";
import { deploymentKey } from "@src/akash/normalize-deployment";

const MARKET_VERSIONS = ["v1beta1", "v1beta2", "v1beta3", "v1beta4", "v1beta5"] as const;

const CREATE_BID = typeUrlSet("MsgCreateBid");
const CLOSE_BID = typeUrlSet("MsgCloseBid");
const CREATE_LEASE = typeUrlSet("MsgCreateLease");
const CLOSE_LEASE = typeUrlSet("MsgCloseLease");
const WITHDRAW_LEASE = typeUrlSet("MsgWithdrawLease");

function typeUrlSet(name: string): Set<string> {
  return akashTypeUrlSet("market", name, MARKET_VERSIONS);
}

export function normalizeMarketMessage(typeUrl: string, body: Record<string, unknown>): AkashChangeBody | null {
  if (CREATE_BID.has(typeUrl)) {
    return normalizeCreateBid(body);
  }
  if (CLOSE_BID.has(typeUrl)) {
    const key = leaseKey(body.id ?? body.bidId);
    return key ? { kind: "bidClosed", key } : null;
  }
  if (CREATE_LEASE.has(typeUrl)) {
    const key = leaseKey(body.bidId);
    return key ? { kind: "leaseCreated", key } : null;
  }
  if (CLOSE_LEASE.has(typeUrl)) {
    const key = leaseKey(body.id ?? body.leaseId);
    return key ? { kind: "leaseClosed", key } : null;
  }
  if (WITHDRAW_LEASE.has(typeUrl)) {
    const key = leaseKey(body.id ?? body.bidId);
    return key ? { kind: "leaseWithdrawn", key } : null;
  }
  return null;
}

/** v1beta1–4 identify the bid by OrderID + a separate provider field; v1beta5 by a full BidID with bseq. */
function normalizeCreateBid(body: Record<string, unknown>): AkashChangeBody | null {
  const key = leaseKey(body.id) ?? leaseKey(body.order, asString(body.provider));
  if (!key) {
    return null;
  }
  const price = asRecord(body.price);
  return {
    kind: "bidCreated",
    key,
    price: asString(price?.amount) ?? "0",
    priceDenom: asString(price?.denom) ?? ""
  };
}

function leaseKey(id: unknown, providerOverride?: string | null): LeaseKey | null {
  const record = asRecord(id);
  const base = deploymentKey(record);
  const gseq = asInteger(record?.gseq);
  const oseq = asInteger(record?.oseq);
  const provider = providerOverride ?? asString(record?.provider);
  if (!base || gseq === null || oseq === null || !provider) {
    return null;
  }
  return { ...base, gseq, oseq, bseq: asInteger(record?.bseq) ?? 0, provider };
}
