import type { SDLInput } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { singleton } from "tsyringe";

import type { PatchService } from "@src/deployment/http-schemas/deployment.schema";
import { MAX_ECHOED_REFERENCE_LENGTH, ownValue, readEnvDeclaration } from "@src/deployment/services/sdl-reference/sdl-reference.service";

type SdlServiceNode = SDLInput["services"][string];

/** Where a patch is being applied, plus the set it records each written value position into. */
type PatchTarget = { serviceName: string; shared: Set<object>; written: Set<string> };

/** Where an `env` entry with no `=` is its own name, because a bare entry asks for the variable to be inherited from the host. */
function envKeyOf(entry: string): string {
  return readEnvDeclaration(entry)?.key ?? entry;
}

/**
 * The `env` lists and `credentials` blocks reachable from more than one service, which a YAML anchor
 * makes possible: patching through such a node would silently rewrite a service the request never named.
 */
function sharedNodesOf(services: SDLInput["services"]): Set<object> {
  const seen = new Set<object>();
  const shared = new Set<object>();

  for (const service of Object.values(services)) {
    for (const node of [service?.env, service?.credentials]) {
      if (!node || typeof node !== "object") continue;

      if (seen.has(node)) shared.add(node);

      seen.add(node);
    }
  }

  return shared;
}

/**
 * Applies a partial service definition to the SDL the console stored, mutating the document it is given.
 * Every message it raises names only a key the caller itself sent, never a value, because those messages
 * are echoed to the caller and logged.
 */
@singleton()
export class SdlPatchService {
  /**
   * Returns the instance paths this patch wrote a value into, spelled the way the SDL Reference walk
   * spells them, so a caller can seal exactly what the request supplied and leave every other value in
   * the document as it found it.
   */
  apply(document: SDLInput, patches: Record<string, PatchService>): Set<string> {
    const services = this.#servicesOf(document);
    const shared = sharedNodesOf(services);
    const written = new Set<string>();

    for (const [serviceName, patch] of Object.entries(patches)) {
      const service = ownValue(services, serviceName);

      if (!service) {
        throw this.#reject(`"${echo(serviceName)}" is not a service of this deployment`);
      }

      this.#applyToService(service, patch, { serviceName, shared, written });
    }

    return written;
  }

  #applyToService(service: SdlServiceNode, patch: PatchService, at: PatchTarget): void {
    if (patch.image !== undefined) service.image = patch.image;
    if (patch.command !== undefined) service.command = patch.command;
    if (patch.args !== undefined) service.args = patch.args;

    if (patch.env !== undefined) {
      this.#assertNotShared(service.env, { ...at, field: "env" });
      this.#applyEnv(service, patch.env, at);
    }

    if (patch.credentials !== undefined) {
      this.#assertNotShared(service.credentials, { ...at, field: "credentials" });
      this.#applyCredentials(service, patch.credentials, at);
    }
  }

  /** Rewrites a named variable where it already stands, so an `ac-secret://` reference keeps the position its stored name was minted from. */
  #applyEnv(service: SdlServiceNode, patch: NonNullable<PatchService["env"]>, target: PatchTarget): void {
    const env: string[] = Array.isArray(service.env) ? service.env : [];

    for (const [key, value] of Object.entries(patch)) {
      const at = env.findIndex(entry => typeof entry === "string" && envKeyOf(entry) === key);

      if (value === null) {
        if (at !== -1) env.splice(at, 1);

        continue;
      }

      const entry = `${key}=${value}`;

      if (at === -1) env.push(entry);
      else env[at] = entry;
    }

    if (env.length === 0) delete service.env;
    else service.env = env;

    /** Recorded after every write, because a removal shifts the entries below it and only the final array says where a value ended up. */
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) continue;

      const index = env.findIndex(entry => typeof entry === "string" && envKeyOf(entry) === key);

      if (index !== -1) target.written.add(`/services/${target.serviceName}/env/${index}`);
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
    if (!node || typeof node !== "object" || !at.shared.has(node)) return;

    throw this.#reject(`an SDL anchor makes service "${echo(at.serviceName)}" share its ${at.field} with another service, so patching it would change both`);
  }

  #servicesOf(document: SDLInput): SDLInput["services"] {
    const services = document?.services;

    return services && typeof services === "object" ? services : {};
  }

  #reject(message: string) {
    return createError(400, message);
  }
}

function echo(key: string): string {
  return key.slice(0, MAX_ECHOED_REFERENCE_LENGTH);
}
