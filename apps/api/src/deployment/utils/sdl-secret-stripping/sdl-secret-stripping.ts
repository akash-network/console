import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { dump } from "js-yaml";

import { isSdlReference } from "@src/deployment/services/sdl-reference/sdl-reference.service";

type SdlServiceDefinition = SDLInput["services"][string];

/** `length` becomes an estimate once it exceeds the limit, because measuring stops there rather than running a pathological document to completion. */
export type StrippedSdl = { sdl: string | null; length: number; error?: unknown };

/** Takes a validated SDL only, and returns re-serialized YAML that must never stand in for the raw SDL anywhere a hash is taken over it. */
export function stripSdlSecrets(rawSdl: string, maxLength: number): StrippedSdl {
  let sdl: SDLInput;
  try {
    sdl = yaml.raw<SDLInput>(rawSdl);
  } catch (error) {
    return { sdl: null, length: rawSdl.length, error };
  }

  for (const service of serviceDefinitionsOf(sdl)) {
    stripEnvValues(service);
    delete service.credentials;
  }

  if (mayShareNodes(rawSdl)) {
    const estimatedLength = estimateSerializedLength(sdl, maxLength);

    if (estimatedLength > maxLength) {
      return { sdl: null, length: estimatedLength };
    }
  }

  const stripped = dump(sdl, { lineWidth: -1 });

  return stripped.length > maxLength ? { sdl: null, length: stripped.length } : { sdl: stripped, length: stripped.length };
}

function serviceDefinitionsOf(sdl: SDLInput | undefined): SdlServiceDefinition[] {
  const services = sdl?.services;

  if (!services || typeof services !== "object") {
    return [];
  }

  return Object.values(services).filter((service): service is SdlServiceDefinition => !!service && typeof service === "object");
}

/** A non-list `env` is left alone rather than failing, because the manifest generator the caller runs first already rejects that shape. */
function stripEnvValues(service: SdlServiceDefinition): void {
  const env = service.env;

  if (!Array.isArray(env)) {
    return;
  }

  env.forEach((entry, index) => {
    if (typeof entry === "string") {
      env[index] = withoutValue(entry);
    }
  });
}

/** Keeps the variable name and drops its value, unless the entry declares no value or names one by reference. */
function withoutValue(entry: string): string {
  const valueStart = entry.indexOf("=");

  if (valueStart === -1) return entry;

  return isSdlReference(entry.slice(valueStart + 1)) ? entry : entry.slice(0, valueStart + 1);
}

/** Reads the raw text rather than the parsed tree, because an anchored scalar loads as a plain string and loses the identity a tree walk would look for. */
function mayShareNodes(rawSdl: string): boolean {
  return rawSdl.includes("&") && rawSdl.includes("*");
}

/** Every node must add at least one character before its children are visited, or an aliased DAG walks exponentially instead of stopping at `budget`. */
function estimateSerializedLength(document: unknown, budget: number): number {
  const ancestors = new Set<object>();
  let total = 0;

  function visit(node: unknown): void {
    if (total > budget) {
      return;
    }

    if (node === null || typeof node !== "object") {
      total += String(node).length + 1;
      return;
    }

    if (ancestors.has(node)) {
      return;
    }

    ancestors.add(node);

    if (Array.isArray(node)) {
      total += node.length + 1;
      node.forEach(visit);
    } else {
      for (const [key, value] of Object.entries(node)) {
        total += key.length + 1;
        visit(value);
      }
    }

    ancestors.delete(node);
  }

  visit(document);

  return total;
}
