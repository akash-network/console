import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { dump } from "js-yaml";

import { isSdlReference } from "@src/deployment/services/sdl-reference/sdl-reference.service";

type SdlServiceDefinition = SDLInput["services"][string];

/** Why a document was not stored, so a caller can report which without reading a parse error, whose message quotes the line it failed on. */
export type StoredSdlRefusal = "unparseable" | "too-large";

/** Numbers only, counted from one: a `js-yaml` mark also carries `snippet` and `buffer`, which quote the document and must never leave this function. */
export type StoredSdlPosition = { line: number; column: number };

/** `length` becomes an estimate once it exceeds the limit, because measuring stops there rather than running a pathological document to completion. */
export type StoredSdl =
  | { sdl: string; length: number; refusal?: never; at?: never }
  | { sdl: null; length: number; refusal: StoredSdlRefusal; at?: StoredSdlPosition };

/** Either this drops what it cannot keep or a caller takes it out, never both, because a value dropped before `rewrite` sees it is a value that caller can no longer seal. */
export type StoredSdlOptions =
  | { keepOrdinaryEnvValues: boolean; rewrite?: never }
  /** Applied to the parsed document before it is measured and serialized, so that what the size guard bounds is exactly what gets stored. */
  | { keepOrdinaryEnvValues?: never; rewrite: (document: SDLInput) => void };

/** Runs before the manifest generator has validated anything, because it is the cheapest refusal a create has, and returns re-serialized YAML that must never stand in for the raw SDL anywhere a hash is taken over it. */
export function sdlForStorage(rawSdl: string, maxLength: number, options: StoredSdlOptions): StoredSdl {
  let sdl: SDLInput;
  try {
    sdl = yaml.raw<SDLInput>(rawSdl);
  } catch (error) {
    return { sdl: null, length: rawSdl.length, refusal: "unparseable", at: positionOf(error) };
  }

  if (options.rewrite) {
    options.rewrite(sdl);
  } else {
    for (const service of serviceDefinitionsOf(sdl)) {
      if (!options.keepOrdinaryEnvValues) dropEnvValues(service);
      delete service.credentials;
    }
  }

  if (mayShareNodes(rawSdl)) {
    const estimatedLength = estimateSerializedLength(sdl, maxLength);

    if (estimatedLength > maxLength) {
      return { sdl: null, length: estimatedLength, refusal: "too-large" };
    }
  }

  const stored = dump(sdl, { lineWidth: -1 });

  return stored.length > maxLength ? { sdl: null, length: stored.length, refusal: "too-large" } : { sdl: stored, length: stored.length };
}

/** Reads `line` and `column` and nothing else, because the other fields of a `js-yaml` mark quote the document that failed to parse. */
function positionOf(error: unknown): StoredSdlPosition | undefined {
  const mark = (error as { mark?: { line?: unknown; column?: unknown } })?.mark;

  return typeof mark?.line === "number" && typeof mark?.column === "number" ? { line: mark.line + 1, column: mark.column + 1 } : undefined;
}

function serviceDefinitionsOf(sdl: SDLInput | undefined): SdlServiceDefinition[] {
  const services = sdl?.services;

  if (!services || typeof services !== "object") {
    return [];
  }

  return Object.values(services).filter((service): service is SdlServiceDefinition => !!service && typeof service === "object");
}

/** A non-list `env` is left alone rather than failing, because the manifest generator the caller runs first already rejects that shape. */
function dropEnvValues(service: SdlServiceDefinition): void {
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
