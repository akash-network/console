import type { SDLInput } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { singleton } from "tsyringe";

import type { PatchService } from "@src/deployment/http-schemas/deployment.schema";
import { MAX_ECHOED_REFERENCE_LENGTH, ownValue, readEnvDeclaration } from "@src/deployment/services/sdl-reference/sdl-reference.service";

type SdlServiceNode = SDLInput["services"][string];
type SdlExposeNode = NonNullable<SdlServiceNode["expose"]>[number];
type SdlHttpOptionsNode = NonNullable<SdlExposeNode["http_options"]>;
type SdlStorageNode = NonNullable<NonNullable<SdlServiceNode["params"]>["storage"]>[string];
type PatchExpose = NonNullable<PatchService["expose"]>[string];
type PatchStorage = NonNullable<PatchService["storage"]>[string];

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

/** An empty record names no variable, so it neither writes nor deserves the refusal an anchored env node would otherwise earn it. */
function assignsEnv(patch: PatchService["env"]): patch is NonNullable<PatchService["env"]> {
  return patch !== undefined && Object.keys(patch).length > 0;
}

function echo(key: string): string {
  return key.slice(0, MAX_ECHOED_REFERENCE_LENGTH);
}

/** An empty options object assigns nothing, and synthesising the node for it would leave a read showing an `http_options: {}` the user never wrote. */
function assignsHttpOptions(patch: PatchExpose): boolean {
  return patch.httpOptions !== undefined && Object.values(patch.httpOptions).some(value => value !== undefined);
}

/** A port has to be declared before it is compared, because `String(undefined)` is `"undefined"` and a patch key spelled that way would otherwise match an entry declaring no port at all. */
function declaresPort(entry: SdlExposeNode | undefined, port: string): boolean {
  return entry?.port !== undefined && String(entry.port) === port;
}

function assignsExpose(patch: PatchExpose): boolean {
  return patch.accept !== undefined || assignsHttpOptions(patch);
}

function assignsStorage(patch: PatchStorage): boolean {
  return patch.mount !== undefined || patch.readOnly !== undefined;
}

/** Naming a field a patch leaves untouched is not a write, so an anchored service is only refused once the patch would actually change it. */
function assignsService(patch: PatchService): boolean {
  const { expose, storage, env, ...fields } = patch;

  return (
    Object.values(fields).some(value => value !== undefined) ||
    assignsEnv(env) ||
    Object.values(expose ?? {}).some(assignsExpose) ||
    Object.values(storage ?? {}).some(assignsStorage)
  );
}

/** Every node a patch could write through, so sharing is judged against the object that would actually be mutated. */
function writableNodesOf(service: SdlServiceNode): object[] {
  const nodes: unknown[] = [service, service.env, service.credentials, service.expose, service.params, service.params?.storage];

  if (Array.isArray(service.expose)) {
    for (const entry of service.expose) nodes.push(entry, entry?.http_options);
  }

  const storage = service.params?.storage;

  if (isNode(storage)) {
    for (const volume of Object.values(storage)) nodes.push(volume);
  }

  return nodes.filter(isNode);
}

/** A node reachable twice is one a write would change in a place the request did not name, whether the second reacher is another service or another part of the same one. */
function sharedNodesOf(services: SDLInput["services"]): Set<object> {
  const seen = new Set<object>();
  const shared = new Set<object>();

  for (const service of Object.values(services)) {
    if (!isNode(service)) continue;

    for (const node of writableNodesOf(service)) {
      if (seen.has(node)) shared.add(node);

      seen.add(node);
    }
  }

  return shared;
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
    if (assignsService(patch)) this.#assertNotShared(service, { ...at, field: "definition" });

    if (patch.image !== undefined) service.image = patch.image;

    this.#applyClearableList(service, "command", patch.command);
    this.#applyClearableList(service, "args", patch.args);

    if (assignsEnv(patch.env)) {
      this.#assertNotShared(service.env, { ...at, field: "env" });
      this.#applyEnv(service, patch.env, at);
    }

    if (patch.credentials !== undefined) {
      this.#assertNotShared(service.credentials, { ...at, field: "credentials" });
      this.#applyCredentials(service, patch.credentials, at);
    }

    if (patch.expose !== undefined) this.#applyExpose(service, patch.expose, at);

    if (patch.storage !== undefined) this.#applyStorage(service, patch.storage, at);
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

  /**
   * Matched on the container port the endpoint declares, because an endpoint's kind and count are fixed
   * at create; the grammar allows two endpoints to share one port and differ only by `proto` or `as`, so
   * an address matching more than one is refused rather than resolved to the first.
   */
  #applyExpose(service: SdlServiceNode, patch: NonNullable<PatchService["expose"]>, at: PatchTarget): void {
    const exposed = Array.isArray(service.expose) ? service.expose : [];

    for (const [port, entryPatch] of Object.entries(patch)) {
      const matches = exposed.filter(candidate => declaresPort(candidate, port));

      if (matches.length === 0) {
        throw this.#reject(`service "${echo(at.serviceName)}" exposes no port "${echo(port)}"`);
      }

      if (matches.length > 1) {
        throw this.#reject(
          `service "${echo(at.serviceName)}" exposes port "${echo(port)}" ${matches.length} times, so this patch cannot say which endpoint it means`
        );
      }

      if (!assignsExpose(entryPatch)) continue;

      this.#assertNotShared(matches[0], { ...at, field: `expose on port ${echo(port)}` });
      this.#applyExposeEntry(matches[0], entryPatch, at, port);
    }
  }

  #applyExposeEntry(entry: SdlExposeNode, patch: PatchExpose, at: PatchTarget, port: string): void {
    if (patch.accept !== undefined) entry.accept = patch.accept;

    if (!assignsHttpOptions(patch)) return;

    this.#assertNotShared(entry.http_options, { ...at, field: `http options on port ${echo(port)}` });
    entry.http_options ??= {};
    this.#applyHttpOptions(entry.http_options, patch.httpOptions!);
  }

  /** Spelled out one key at a time so the compiler checks the SDL key each camelCase field lands on; `nextCases` is cast because the request accepts any string where the SDL names a closed set. */
  #applyHttpOptions(target: SdlHttpOptionsNode, patch: NonNullable<PatchExpose["httpOptions"]>): void {
    if (patch.maxBodySize !== undefined) target.max_body_size = patch.maxBodySize;
    if (patch.readTimeout !== undefined) target.read_timeout = patch.readTimeout;
    if (patch.sendTimeout !== undefined) target.send_timeout = patch.sendTimeout;
    if (patch.nextTries !== undefined) target.next_tries = patch.nextTries;
    if (patch.nextTimeout !== undefined) target.next_timeout = patch.nextTimeout;
    if (patch.nextCases !== undefined) target.next_cases = patch.nextCases as SdlHttpOptionsNode["next_cases"];
  }

  /** Volume sizes are fixed at create, so only the mount point moves and a volume the profile does not declare is refused rather than added. */
  #applyStorage(service: SdlServiceNode, patch: NonNullable<PatchService["storage"]>, at: PatchTarget): void {
    const declared = service.params?.storage;

    for (const [volumeName, volumePatch] of Object.entries(patch)) {
      const volume: SdlStorageNode | undefined = declared ? ownValue(declared, volumeName) : undefined;

      if (!volume) {
        throw this.#reject(`service "${echo(at.serviceName)}" declares no storage volume "${echo(volumeName)}"`);
      }

      if (!assignsStorage(volumePatch)) continue;

      this.#assertNotShared(volume, { ...at, field: `storage volume ${echo(volumeName)}` });

      if (volumePatch.mount !== undefined) volume.mount = volumePatch.mount;
      if (volumePatch.readOnly !== undefined) volume.readOnly = volumePatch.readOnly;
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
