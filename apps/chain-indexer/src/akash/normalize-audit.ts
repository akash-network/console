import type { AkashChangeBody } from "@src/akash/akash-changes";
import { akashTypeUrlSet } from "@src/akash/akash-changes";
import { asString } from "@src/akash/json";
import { attributeList } from "@src/akash/resources";

const AUDIT_VERSIONS = ["v1beta1", "v1beta2", "v1beta3", "v1"] as const;

const SIGN_ATTRIBUTES = typeUrlSet("MsgSignProviderAttributes");
const DELETE_ATTRIBUTES = typeUrlSet("MsgDeleteProviderAttributes");

function typeUrlSet(name: string): Set<string> {
  return akashTypeUrlSet("audit", name, AUDIT_VERSIONS);
}

export function normalizeAuditMessage(typeUrl: string, body: Record<string, unknown>): AkashChangeBody | null {
  if (SIGN_ATTRIBUTES.has(typeUrl)) {
    const identity = auditIdentity(body);
    return identity ? { kind: "providerAttributesSigned", ...identity, attributes: attributeList(body.attributes) } : null;
  }
  if (DELETE_ATTRIBUTES.has(typeUrl)) {
    const identity = auditIdentity(body);
    return identity ? { kind: "providerAttributesUnsigned", ...identity, keys: stringKeys(body.keys) } : null;
  }
  return null;
}

function auditIdentity(body: Record<string, unknown>): { owner: string; auditor: string } | null {
  const owner = asString(body.owner);
  const auditor = asString(body.auditor);
  return owner && auditor ? { owner, auditor } : null;
}

function stringKeys(keys: unknown): string[] {
  return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string") : [];
}
