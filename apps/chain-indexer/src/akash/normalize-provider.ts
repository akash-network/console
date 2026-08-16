import type { AkashChangeBody } from "@src/akash/akash-changes";
import { akashTypeUrlSet } from "@src/akash/akash-changes";
import { asRecord, asString } from "@src/akash/json";
import { attributeList } from "@src/akash/resources";

const PROVIDER_VERSIONS = ["v1beta1", "v1beta2", "v1beta3", "v1beta4"] as const;

const CREATE_PROVIDER = typeUrlSet("MsgCreateProvider");
const UPDATE_PROVIDER = typeUrlSet("MsgUpdateProvider");
const DELETE_PROVIDER = typeUrlSet("MsgDeleteProvider");

function typeUrlSet(name: string): Set<string> {
  return akashTypeUrlSet("provider", name, PROVIDER_VERSIONS);
}

/** All four provider proto eras share the same message shape, so parsing is version-independent. */
export function normalizeProviderMessage(typeUrl: string, body: Record<string, unknown>): AkashChangeBody | null {
  if (CREATE_PROVIDER.has(typeUrl)) {
    return normalizeProviderInfo(body, "providerCreated");
  }
  if (UPDATE_PROVIDER.has(typeUrl)) {
    return normalizeProviderInfo(body, "providerUpdated");
  }
  if (DELETE_PROVIDER.has(typeUrl)) {
    const owner = asString(body.owner);
    return owner ? { kind: "providerDeleted", owner } : null;
  }
  return null;
}

function normalizeProviderInfo(body: Record<string, unknown>, kind: "providerCreated" | "providerUpdated"): AkashChangeBody | null {
  const owner = asString(body.owner);
  const hostUri = asString(body.hostUri);
  if (!owner || !hostUri) {
    return null;
  }
  const info = asRecord(body.info);
  return {
    kind,
    owner,
    hostUri,
    email: asString(info?.email) || null,
    website: asString(info?.website) || null,
    attributes: attributeList(body.attributes)
  };
}
