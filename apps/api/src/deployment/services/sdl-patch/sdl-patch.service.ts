import type { SDLInput } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { singleton } from "tsyringe";

import type { PatchService } from "@src/deployment/http-schemas/deployment.schema";
import { MAX_ECHOED_REFERENCE_LENGTH, ownValue, readEnvDeclaration } from "@src/deployment/services/sdl-reference/sdl-reference.service";

type SdlServiceNode = SDLInput["services"][string];

type PatchTarget = { serviceName: string; written: Set<string> };

/** One service resolved and cleared for mutation, so nothing is written until every service in the patch has passed. */
type ResolvedPatch = { serviceName: string; service: SdlServiceNode; patch: PatchService };

/** A bare `env` entry is its own name, because it asks for the variable to be inherited from the host. */
function envKeyOf(entry: string): string {
  return readEnvDeclaration(entry)?.key ?? entry;
}

function isNode(value: unknown): value is object {
  return !!value && typeof value === "object";
}

/** A node reachable twice is one a write would change in a place the request did not name, whether the second reacher is another service or another part of the same one. */
function sharedNodesOf(services: SDLInput["services"]): Set<object> {
  const seen = new Set<object>();
  const shared = new Set<object>();

  for (const service of Object.values(services)) {
    for (const node of [service, service?.env, service?.credentials]) {
      if (!isNode(node)) continue;

      if (seen.has(node)) shared.add(node);

      seen.add(node);
    }
  }

  return shared;
}

function echo(key: string): string {
  return key.slice(0, MAX_ECHOED_REFERENCE_LENGTH);
}

/** Applies a partial service definition to the stored SDL, naming only keys the caller sent and never a value, because its messages are echoed back and logged. */
@singleton()
export class SdlPatchService {
  /** Returns the instance paths it wrote a value into, spelled as the SDL Reference walk spells them, so a caller can seal exactly what the request supplied. */
  apply(document: SDLInput, patches: Record<string, PatchService>): Set<string> {
    const services = this.#servicesOf(document);
    const shared = sharedNodesOf(services);
    const resolved = this.#resolveAll(services, patches, shared);
    const written = new Set<string>();

    for (const { serviceName, service, patch } of resolved) {
      this.#applyToService(service, patch, { serviceName, written });
    }

    return written;
  }

  /** Every service and every node it would write through is checked before the first mutation, so a patch rejected on its last key leaves the document as it found it. */
  #resolveAll(services: SDLInput["services"], patches: Record<string, PatchService>, shared: Set<object>): ResolvedPatch[] {
    return Object.entries(patches).map(([serviceName, patch]) => {
      const service = ownValue(services, serviceName);

      if (!service) {
        throw this.#reject(`"${echo(serviceName)}" is not a service of this deployment`);
      }

      this.#assertNotShared(service, { serviceName, shared, field: "definition" });

      if (patch.env !== undefined) this.#assertNotShared(service.env, { serviceName, shared, field: "env" });
      if (patch.credentials !== undefined) this.#assertNotShared(service.credentials, { serviceName, shared, field: "credentials" });

      return { serviceName, service, patch };
    });
  }

  #applyToService(service: SdlServiceNode, patch: PatchService, at: PatchTarget): void {
    if (patch.image !== undefined) service.image = patch.image;

    this.#applyClearableList(service, "command", patch.command);
    this.#applyClearableList(service, "args", patch.args);

    if (patch.env !== undefined) this.#applyEnv(service, patch.env, at);

    if (patch.credentials !== undefined) this.#applyCredentials(service, patch.credentials, at);
  }

  /** A cleared list is removed rather than written as `null`, so a read never shows a field the user did not write. */
  #applyClearableList(service: SdlServiceNode, field: "command" | "args", value: string[] | null | undefined): void {
    if (value === undefined) return;

    if (value === null) delete service[field];
    else service[field] = value;
  }

  /** Rewrites a named variable at every index it already occupies, so an `ac-secret://` reference keeps the position its stored name was minted from and no stale duplicate survives. */
  #applyEnv(service: SdlServiceNode, patch: NonNullable<PatchService["env"]>, target: PatchTarget): void {
    const env: string[] = Array.isArray(service.env) ? service.env : [];

    for (const [key, value] of Object.entries(patch)) {
      const at = indicesOfEnvKey(env, key);

      if (value === null) {
        for (const index of [...at].reverse()) env.splice(index, 1);

        continue;
      }

      if (at.length === 0) env.push(`${key}=${value}`);
      else for (const index of at) env[index] = `${key}=${value}`;
    }

    if (env.length === 0) delete service.env;
    else service.env = env;

    this.#recordWrittenEnv(env, patch, target);
  }

  /** Read after every write, because a removal shifts the entries below it and only the final array says where a value ended up. */
  #recordWrittenEnv(env: string[], patch: NonNullable<PatchService["env"]>, target: PatchTarget): void {
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) continue;

      for (const index of indicesOfEnvKey(env, key)) {
        target.written.add(`/services/${target.serviceName}/env/${index}`);
      }
    }
  }

  /** Merges rather than replaces, so the `email` the schema has no field for survives a credential rotation. */
  #applyCredentials(service: SdlServiceNode, patch: NonNullable<PatchService["credentials"]> | null, target: PatchTarget): void {
    if (patch === null) {
      delete service.credentials;

      return;
    }

    service.credentials = { ...service.credentials, ...patch };

    for (const field of ["username", "password"] as const) {
      if (patch[field] !== undefined) target.written.add(`/services/${target.serviceName}/credentials/${field}`);
    }
  }

  #assertNotShared(node: unknown, at: { serviceName: string; shared: Set<object>; field: string }): void {
    if (!isNode(node) || !at.shared.has(node)) return;

    throw this.#reject(
      `an SDL anchor makes service "${echo(at.serviceName)}" share its ${at.field} with another part of the document, so patching it would change both`
    );
  }

  #servicesOf(document: SDLInput): SDLInput["services"] {
    const services = document?.services;

    return services && typeof services === "object" ? services : {};
  }

  #reject(message: string) {
    return createError(400, message);
  }
}

function indicesOfEnvKey(env: string[], key: string): number[] {
  return env.flatMap((entry, index) => (typeof entry === "string" && envKeyOf(entry) === key ? [index] : []));
}
