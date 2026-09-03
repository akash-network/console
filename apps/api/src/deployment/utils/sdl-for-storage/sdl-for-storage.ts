import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { dump } from "js-yaml";

/** Why a document was not stored, so a caller can report which without reading a parse error, whose message quotes the line it failed on. */
export type StoredSdlRefusal = "unparseable" | "too-large";

/** Numbers only, counted from one: a `js-yaml` mark also carries `snippet` and `buffer`, which quote the document and must never leave this function. */
export type StoredSdlPosition = { line: number; column: number };

/** `mayShareNodes` is read off the raw text rather than the parsed tree, because an anchored scalar loads as a plain string and loses the identity a tree walk would look for. */
export type StorableSdl = { document: SDLInput; mayShareNodes: boolean };

export type ParsedSdl = StorableSdl | { document: null; mayShareNodes?: never; at?: StoredSdlPosition };

/** `length` becomes an estimate once it exceeds the limit, because measuring stops there rather than running a pathological document to completion. */
export type StoredSdl = { sdl: string | null; length: number };

/** Parses for storage only, before the manifest generator has validated anything, because it is the cheapest refusal a create has. */
export function parseSdlForStorage(rawSdl: string): ParsedSdl {
  try {
    return { document: yaml.raw<SDLInput>(rawSdl), mayShareNodes: mayShareNodesOf(rawSdl) };
  } catch (error) {
    return { document: null, at: positionOf(error) };
  }
}

/** Measures and serializes whatever the caller left in the parsed document, so that what the size guard bounds is exactly what gets stored, and returns YAML that must never stand in for the raw SDL anywhere a hash is taken over it. */
export function sdlForStorage(parsed: StorableSdl, maxLength: number): StoredSdl {
  if (parsed.mayShareNodes) {
    const estimatedLength = estimateSerializedLength(parsed.document, maxLength);

    if (estimatedLength > maxLength) {
      return { sdl: null, length: estimatedLength };
    }
  }

  const stored = dump(parsed.document, { lineWidth: -1 });

  return stored.length > maxLength ? { sdl: null, length: stored.length } : { sdl: stored, length: stored.length };
}

/** Reads `line` and `column` and nothing else, because the other fields of a `js-yaml` mark quote the document that failed to parse. */
function positionOf(error: unknown): StoredSdlPosition | undefined {
  const mark = (error as { mark?: { line?: unknown; column?: unknown } })?.mark;

  return typeof mark?.line === "number" && typeof mark?.column === "number" ? { line: mark.line + 1, column: mark.column + 1 } : undefined;
}

function mayShareNodesOf(rawSdl: string): boolean {
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
