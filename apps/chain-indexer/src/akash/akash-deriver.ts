import type { AkashBlockChanges, AkashChange, AkashChangeBody } from "@src/akash/akash-changes";
import { asInteger, asRecord, asString } from "@src/akash/json";
import { normalizeAuditMessage } from "@src/akash/normalize-audit";
import { normalizeDeploymentMessage } from "@src/akash/normalize-deployment";
import { normalizeMarketMessage } from "@src/akash/normalize-market";
import { normalizeProviderMessage } from "@src/akash/normalize-provider";
import { asUint64String } from "@src/akash/uint64";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";
import { MAX_EXEC_DEPTH, MSG_EXEC_TYPE_URL } from "@src/pipeline/msg-exec";

const LEGACY_EVENT_TYPE = "akash.v1";
const DEPLOYMENT_CLOSED_EVENT_TYPE = "akash.deployment.v1.EventDeploymentClosed";
const LEASE_CLOSED_EVENT_TYPE = "akash.market.v1.EventLeaseClosed";

/**
 * Extracts the deployment, market, provider and audit lifecycle from a block's messages and close events, in the exact
 * order the chain applied it: per transaction, messages first (authz MsgExec unwrapped through the
 * decoder-provided `decoded` field), then that transaction's close events, which catch deployment and
 * lease closes happening as side effects (group close, authz revoke, overdraw on withdraw). Messages
 * in failed transactions are skipped, since cosmos rolls back their state changes and no close event
 * is emitted for them.
 */
export function deriveAkashChanges(block: DecodedBlock): AkashBlockChanges {
  const changes: AkashChange[] = [];

  for (const tx of block.transactions) {
    if (tx.code !== 0) {
      continue;
    }
    for (const message of tx.messages) {
      addMessage(changes, message.typeUrl, message.body, tx.index, message.index, 0);
    }
    addCloseEvents(changes, tx.events, tx.index);
  }

  addCloseEvents(changes, block.blockEvents, null);

  return { height: block.height, datetime: block.datetime, changes };
}

function addMessage(changes: AkashChange[], typeUrl: string, body: unknown, txIndex: number, msgIndex: number, depth: number): void {
  if (typeUrl === MSG_EXEC_TYPE_URL && depth < MAX_EXEC_DEPTH) {
    const msgs = asRecord(body)?.msgs;
    if (Array.isArray(msgs)) {
      for (const inner of msgs) {
        const innerRecord = asRecord(inner);
        const innerTypeUrl = asString(innerRecord?.typeUrl);
        if (innerTypeUrl && innerRecord?.decoded) {
          addMessage(changes, innerTypeUrl, innerRecord.decoded, txIndex, msgIndex, depth + 1);
        }
      }
    }
    return;
  }

  const record = asRecord(body);
  if (!record) {
    return;
  }

  const normalized =
    normalizeDeploymentMessage(typeUrl, record) ??
    normalizeMarketMessage(typeUrl, record) ??
    normalizeProviderMessage(typeUrl, record) ??
    normalizeAuditMessage(typeUrl, record);

  if (normalized) {
    changes.push({ ...normalized, txIndex, msgIndex });
  }
}

function addCloseEvents(changes: AkashChange[], events: DecodedEvent[], txIndex: number | null): void {
  for (const event of events) {
    const change = closeEventChange(event);
    if (change) {
      changes.push({ ...change, txIndex, msgIndex: event.msgIndex ?? null });
    }
  }
}

function closeEventChange(event: DecodedEvent): AkashChangeBody | null {
  if (event.type === LEGACY_EVENT_TYPE) {
    if (event.attributes.action === "deployment-closed") {
      return legacyDeploymentClosed(event.attributes);
    }
    if (event.attributes.action === "lease-closed") {
      return legacyLeaseClosed(event.attributes);
    }
    return null;
  }
  if (event.type === DEPLOYMENT_CLOSED_EVENT_TYPE) {
    return typedDeploymentClosed(event.attributes);
  }
  if (event.type === LEASE_CLOSED_EVENT_TYPE) {
    return typedLeaseClosed(event.attributes);
  }
  return null;
}

function legacyDeploymentClosed(attributes: Record<string, string>): AkashChangeBody | null {
  const owner = asString(attributes.owner);
  const dseq = asUint64String(attributes.dseq);
  return owner && dseq ? { kind: "deploymentClosedEvent", key: { owner, dseq } } : null;
}

function legacyLeaseClosed(attributes: Record<string, string>): AkashChangeBody | null {
  const owner = asString(attributes.owner);
  const dseq = asUint64String(attributes.dseq);
  const gseq = asInteger(attributes.gseq);
  const oseq = asInteger(attributes.oseq);
  const provider = asString(attributes.provider);
  if (!owner || !dseq || gseq === null || oseq === null || !provider) {
    return null;
  }
  return { kind: "leaseClosedEvent", key: { owner, dseq }, gseq, oseq, bseq: null, provider };
}

function typedDeploymentClosed(attributes: Record<string, string>): AkashChangeBody | null {
  const id = parseIdAttribute(attributes.id);
  const owner = asString(id?.owner);
  const dseq = asUint64String(id?.dseq);
  return owner && dseq ? { kind: "deploymentClosedEvent", key: { owner, dseq } } : null;
}

function typedLeaseClosed(attributes: Record<string, string>): AkashChangeBody | null {
  const id = parseIdAttribute(attributes.id);
  const owner = asString(id?.owner);
  const dseq = asUint64String(id?.dseq);
  const gseq = asInteger(id?.gseq);
  const oseq = asInteger(id?.oseq);
  const provider = asString(id?.provider);
  if (!owner || !dseq || gseq === null || oseq === null || !provider) {
    return null;
  }
  return { kind: "leaseClosedEvent", key: { owner, dseq }, gseq, oseq, bseq: asInteger(id?.bseq), provider };
}

/** The typed events carry their id as a JSON string attribute. */
function parseIdAttribute(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}
