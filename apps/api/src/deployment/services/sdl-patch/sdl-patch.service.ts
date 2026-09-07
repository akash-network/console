import type { SDLInput } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { singleton } from "tsyringe";

import type { PatchService } from "@src/deployment/http-schemas/deployment.schema";
import { MAX_ECHOED_REFERENCE_LENGTH, ownValue, readEnvDeclaration } from "@src/deployment/services/sdl-reference/sdl-reference.service";

type SdlServiceNode = SDLInput["services"][string];

type PatchTarget = { serviceName: string; shared: Set<object>; written: Set<string> };

/** A bare `env` entry is its own name, because it asks for the variable to be inherited from the host. */
function envKeyOf(entry: string): string {
  return readEnvDeclaration(entry)?.key ?? entry;
}

function declaresPatchedVariable(entry: unknown, patchedKeys: Set<string>): boolean {
  return typeof entry === "string" && patchedKeys.has(envKeyOf(entry));
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
  /** Returns the instance paths it wrote a value into, spelled as the SDL Reference walk spells them, so a caller can seal exactly what the request supplied and nothing else. */
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
    this.#assertNotShared(service, { ...at, field: "definition" });

    if (patch.image !== undefined) service.image = patch.image;

    this.#applyClearableList(service, "command", patch.command);
    this.#applyClearableList(service, "args", patch.args);

    if (patch.env !== undefined) {
      this.#assertNotShared(service.env, { ...at, field: "env" });
      this.#applyEnv(service, patch.env, at);
    }

    if (patch.credentials !== undefined) {
      this.#assertNotShared(service.credentials, { ...at, field: "credentials" });
      this.#applyCredentials(service, patch.credentials, at);
    }
  }

  /** A cleared list is removed rather than written as `null`, so a read never shows a field the user did not write. */
  #applyClearableList(service: SdlServiceNode, field: "command" | "args", value: string[] | null | undefined): void {
    if (value === undefined) return;

    if (value === null) delete service[field];
    else service[field] = value;
  }

  /**
   * A patched variable is dropped wherever it stood and appended, so it moves position and any
   * duplicate of it collapses into one entry; nothing downstream depends on where a value sits. The
   * recorded path is the appended index, which is what scopes derivation to the values this patch
   * supplied rather than every plaintext in the document.
   */
  #applyEnv(service: SdlServiceNode, patch: NonNullable<PatchService["env"]>, target: PatchTarget): void {
    const source: string[] = Array.isArray(service.env) ? service.env : [];
    const patchedKeys = new Set(Object.keys(patch));
    const env = source.filter(entry => !declaresPatchedVariable(entry, patchedKeys));

    for (const [key, value] of Object.entries(patch)) {
      if (value === null) continue;

      target.written.add(`/services/${target.serviceName}/env/${env.length}`);
      env.push(`${key}=${value}`);
    }

    if (env.length === 0) delete service.env;
    else service.env = env;
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
