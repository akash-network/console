import { type AkashChangeBody, akashTypeUrlSet, type DeploymentKey } from "@src/akash/akash-changes";
import { asInteger, asRecord, asString } from "@src/akash/json";
import { normalizeGroups } from "@src/akash/resources";
import { asUint64String } from "@src/akash/uint64";

const DEPLOYMENT_VERSIONS = ["v1beta1", "v1beta2", "v1beta3", "v1beta4"] as const;

const CREATE_DEPLOYMENT = typeUrlSet("MsgCreateDeployment");
const CLOSE_DEPLOYMENT = typeUrlSet("MsgCloseDeployment");
const UPDATE_DEPLOYMENT = typeUrlSet("MsgUpdateDeployment");
const DEPOSIT_DEPLOYMENT = typeUrlSet("MsgDepositDeployment", ["v1beta1", "v1beta2", "v1beta3"]);
const CLOSE_GROUP = typeUrlSet("MsgCloseGroup");
const PAUSE_GROUP = typeUrlSet("MsgPauseGroup");
const START_GROUP = typeUrlSet("MsgStartGroup");
const ACCOUNT_DEPOSIT = "/akash.escrow.v1.MsgAccountDeposit";

function typeUrlSet(name: string, versions: readonly string[] = DEPLOYMENT_VERSIONS): Set<string> {
  return akashTypeUrlSet("deployment", name, versions);
}

export function normalizeDeploymentMessage(typeUrl: string, body: Record<string, unknown>): AkashChangeBody | null {
  if (CREATE_DEPLOYMENT.has(typeUrl)) {
    return normalizeCreate(body);
  }
  if (CLOSE_DEPLOYMENT.has(typeUrl)) {
    const key = deploymentKey(body.id);
    return key ? { kind: "deploymentClosed", key } : null;
  }
  if (UPDATE_DEPLOYMENT.has(typeUrl)) {
    const key = deploymentKey(body.id);
    return key ? { kind: "deploymentUpdated", key } : null;
  }
  if (DEPOSIT_DEPLOYMENT.has(typeUrl)) {
    return normalizeDeposit(body);
  }
  if (typeUrl === ACCOUNT_DEPOSIT) {
    return normalizeAccountDeposit(body);
  }
  if (CLOSE_GROUP.has(typeUrl)) {
    return normalizeGroupChange("groupClosed", body);
  }
  if (PAUSE_GROUP.has(typeUrl)) {
    return normalizeGroupChange("groupPaused", body);
  }
  if (START_GROUP.has(typeUrl)) {
    return normalizeGroupChange("groupStarted", body);
  }
  return null;
}

function normalizeCreate(body: Record<string, unknown>): AkashChangeBody | null {
  const key = deploymentKey(body.id);
  if (!key) {
    return null;
  }
  const coin = depositCoin(body.deposit);
  return {
    kind: "deploymentCreated",
    key,
    denom: coin?.denom ?? "uakt",
    deposit: coin?.amount ?? "0",
    depositor: asString(body.depositor),
    groups: normalizeGroups(body.groups)
  };
}

function normalizeDeposit(body: Record<string, unknown>): AkashChangeBody | null {
  const key = deploymentKey(body.id);
  const amount = asString(asRecord(body.amount)?.amount);
  if (!key || !amount) {
    return null;
  }
  return { kind: "deploymentDeposited", key, amount, depositor: asString(body.depositor) };
}

/** v1-era deposits target a generic escrow account: scope must be `deployment` (1) and `xid` is "owner/dseq". */
function normalizeAccountDeposit(body: Record<string, unknown>): AkashChangeBody | null {
  const id = asRecord(body.id);
  const scope = id?.scope;
  if (scope !== 1 && scope !== "deployment") {
    return null;
  }
  const [owner, dseq] = asString(id?.xid)?.split("/") ?? [];
  const amount = asString(asRecord(asRecord(body.deposit)?.amount)?.amount);
  if (!owner || !dseq || !amount) {
    return null;
  }
  return { kind: "deploymentDeposited", key: { owner, dseq }, amount, depositor: asString(body.signer) };
}

function normalizeGroupChange(kind: "groupClosed" | "groupPaused" | "groupStarted", body: Record<string, unknown>): AkashChangeBody | null {
  const id = asRecord(body.id);
  const key = deploymentKey(id);
  const gseq = asInteger(id?.gseq);
  return key && gseq !== null ? { kind, key, gseq } : null;
}

/** v1beta4 wraps the deposit coin in a Deposit message (`deposit.amount`); earlier versions carry the coin directly. */
function depositCoin(deposit: unknown): { denom: string; amount: string } | null {
  const record = asRecord(deposit);
  if (!record) {
    return null;
  }
  const coin = asRecord(record.amount) ?? record;
  const denom = asString(coin.denom);
  const amount = asString(coin.amount);
  return denom && amount ? { denom, amount } : null;
}

export function deploymentKey(id: unknown): DeploymentKey | null {
  const record = asRecord(id);
  const owner = asString(record?.owner);
  const dseq = asUint64String(record?.dseq);
  return owner && dseq ? { owner, dseq } : null;
}
