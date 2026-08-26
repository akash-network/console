import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { dump } from "js-yaml";

type SdlServiceDefinition = SDLInput["services"][string];

/**
 * The stripped SDL, or nothing when storing it would cost more than the caller allows. `length` is
 * what the stripped document was measured at — an estimate once it exceeds the limit, since measuring
 * stops there rather than running a pathological document to completion.
 */
export type StrippedSdl = { sdl: string | null; length: number; error?: unknown };

/**
 * The submitted SDL with the value of every `env` entry and every private registry `credentials` block
 * removed. Variable names survive, so the stored definition still describes what the deployment expects
 * to be given.
 *
 * Both are removed where they are declared and nowhere else. An SDL that copies a secret somewhere else
 * itself — through a YAML anchor aliased into `args`, say — keeps that copy. Chasing those was tried and
 * withdrawn: it means collecting the secrets and deleting every string in the document equal to one,
 * which cannot tell a secret apart from an ordinary value that happens to match it. `DENOM=uakt` took
 * out `denom: uakt`, and a service named `db` referenced by another service's `WORDPRESS_DB_HOST=db`
 * took out the whole service. An SDL smuggling its own secret into `args` is a leak its author wrote on
 * purpose; quietly destroying an ordinary two-service SDL is a bug the author cannot even see.
 *
 * Only a validated SDL may be passed here: the caller runs it through the manifest generator first,
 * which rejects unknown root properties and so bounds where a service, and with it an env list, can hide.
 *
 * The result is re-serialized YAML and so never byte-identical to what arrived. It must never stand in
 * for the raw SDL anywhere a hash is taken over it.
 */
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

/**
 * An `env` that is not a list is left alone rather than treated as an error. The SDL schema only allows
 * the list form, so the manifest generator the caller runs first rejects a map before it can reach
 * here; this is the one shape where the stripper no-ops instead of failing loudly, and it is worth
 * knowing about if that validation ever loosens.
 */
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

/** Keeps the variable name and drops its value. An entry that declares no value is left as it is. */
function withoutValue(entry: string): string {
  const valueStart = entry.indexOf("=");

  return valueStart === -1 ? entry : entry.slice(0, valueStart + 1);
}

/**
 * Whether this document could possibly contain a node reachable more than once, which is the one thing
 * `estimateSerializedLength` exists to price. Skipping the estimator for a document that cannot share a
 * node is therefore safe *with respect to alias amplification* — and that is the whole of the claim.
 * It is deliberately not a claim that an alias-free document cannot serialize to much more than it
 * arrived as: one can, since flow style spells a nesting level in about four characters and block style
 * re-spells it as two spaces per level on every emitted line. The estimator never priced indentation
 * either, so that is a property of the SDL surface rather than of this guard.
 *
 * Sharing comes from one place: a YAML alias. An alias needs an anchor to point at, so a document that
 * shares anything has to spell both `&` and `*` somewhere in its bytes, and a document missing either
 * character cannot alias. That argument holds without knowing anything about YAML's grammar: no
 * assumption about quoting, flow style, block scalars, indentation or comments, because it never asks
 * *where* the characters are.
 *
 * Requiring both is what keeps it honest rather than merely cheap. Testing only `*` would send an
 * ordinary `command: ["sh", "-c", "a && b"]` down the estimator path for nothing; testing only `&`
 * would do the same for a `--include=*.log`. Requiring both narrows it to documents that could
 * genuinely alias, while still deciding on presence alone.
 *
 * This deliberately reads the raw text and not the parsed tree. An anchored *scalar* loads into an
 * ordinary string primitive and loses the identity a reference-walk would look for, so a tree walk
 * would report no sharing for exactly the document that amplifies worst. It also reads the submitted
 * text rather than the stripped document, both because the stripped one does not exist yet and because
 * stripping removes values, never sharing.
 *
 * False positives cost nothing — they take the path every document took before this existed. A false
 * negative would hand an amplifying document straight to `dump`, which is the failure this guards.
 */
function mayShareNodes(rawSdl: string): boolean {
  return rawSdl.includes("&") && rawSdl.includes("*");
}

/**
 * What serializing this document would cost, measured on the parsed tree instead of by serializing it.
 * Serializing first and measuring after is what a document built out of YAML aliases exploits: an
 * anchored scalar loads as an ordinary string and loses the identity that would let js-yaml re-emit it
 * as an alias, so every alias of a 100 KB scalar is written out in full. A request comfortably inside
 * the body limit can reach a gigabyte that way, and the size guard never gets to run because the
 * process is already dead.
 *
 * Walking the tree costs nothing by comparison: it allocates no strings, and it follows every alias
 * rather than collapsing them, which is what keeps the total an upper bound.
 *
 * An upper bound, and a loose one, because js-yaml only re-expands *some* aliases. An anchored scalar
 * loads into a string primitive whose identity is gone, so the serializer has no way to know it was
 * aliased and writes it out again every time; an anchored mapping or sequence keeps its identity and is
 * re-emitted as one anchor and N aliases. This walk cannot tell the two apart from the parsed tree, so
 * it charges every alias as though it were a scalar. That errs toward refusing to store, never toward
 * an unbounded serialize — but it does mean a document sharing large *objects* can be measured far
 * above what it would actually serialize to, and refused when it would have fitted.
 *
 * Following aliases rather than memoizing them is also what makes termination something this has to
 * earn. Aliases form a DAG, not a tree, so a document can double its node count per level and be walked
 * exponentially many times from a few hundred bytes of YAML. What bounds it is that *every* node adds
 * at least one character before its children are visited — a scalar its own length, a map entry its
 * key, and an array its element count, which is what the `- ` markers really cost. The running total
 * therefore rises at least once per node, so the walk stops after `budget` nodes however the document
 * is shaped. An array charging nothing was enough to break this: an array-only DAG kept the total near
 * zero while the node count doubled, and a 1.3 KB document took seconds.
 *
 * The ancestor set terminates on the true cycle `&a [*a]` parses into, which is otherwise endless. It
 * is a path set rather than a seen set on purpose: memoizing would collapse the aliases whose cost this
 * is trying to measure.
 */
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
