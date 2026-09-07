import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";

const SDL_REFERENCE_PREFIX = "ac-";

const SDL_REFERENCE = /^ac-([a-z]{1,16}):\/\/([A-Za-z_][A-Za-z0-9_]{0,63})$/;

/** Must stay equal to the bound the grammar above accepts, because the seal budget is computed from it. */
export const MAX_SDL_REFERENCE_NAME_LENGTH = 64;

/** The whole message is logged by the error handler, and an offending value is only bounded by the request body limit. */
export const MAX_ECHOED_REFERENCE_LENGTH = 120;

/** The halves of a private registry credential a reference may stand in for: `host` and `email` are left out because neither carries a secret. */
const CREDENTIAL_REFERENCE_FIELDS = ["username", "password"] as const;

type SdlReferenceRead = { type: "plain" } | { type: "reserved" } | { type: "reference"; kind: string; name: string };

/** Tests the whole grammar, because a value that merely opens with the prefix is not a reference and must not be treated as one. */
export function isSdlReference(value: string): boolean {
  return SDL_REFERENCE.test(value);
}

function readSdlReference(value: string): SdlReferenceRead {
  if (!value.startsWith(SDL_REFERENCE_PREFIX)) {
    return { type: "plain" };
  }

  const reference = SDL_REFERENCE.exec(value);

  if (!reference) {
    return { type: "reserved" };
  }

  return { type: "reference", kind: reference[1], name: reference[2] };
}

function readEnvDeclaration(entry: string): { key: string; value: string } | null {
  const valueStart = entry.indexOf("=");

  return valueStart === -1 ? null : { key: entry.slice(0, valueStart), value: entry.slice(valueStart + 1) };
}

export interface SdlReferenceContext {
  secrets: SdlSecrets;
}

export interface SdlReferenceTarget {
  serviceName: string;
  name: string;
}

export interface SdlReferenceResolver {
  readonly kind: string;
  resolve(target: SdlReferenceTarget, context: SdlReferenceContext): string | undefined;
}

/** One position in an SDL where a reference may stand, holding the write back so a caller of the walk never has to know how that position spells a value. */
export interface SdlReferenceSlot {
  serviceName: string;
  /** Where the service falls in `Object.entries` order — not the document's own order, since an integer-like name sorts first — because a name may spell anything and a reference name may not. */
  serviceIndex: number;
  instancePath: string;
  /** The container the value lives on, so a caller can tell two positions apart from one position two services share through a YAML anchor. */
  node: object;
  /** Where in `node` the value sits: unique within it, and spelled so it can form part of an SDL Reference name. */
  position: string;
  value: string;
  /** Whether a value here may be quoted back to the caller, which a private registry credential never may: A1 makes it a secret whatever it holds. */
  valueIsAlwaysSecret: boolean;
  replace(resolved: string): void;
}

/** One reference an SDL declares, as a caller comparing an SDL against a request's supplied names needs to see it. */
export interface SdlReferenceDeclaration extends SdlReferenceTarget {
  kind: string;
  reference: string;
  instancePath: string;
}

type SdlReferenceVisitor = (reference: SdlReferenceDeclaration, slot: SdlReferenceSlot) => ValidationError | undefined;

/** A reference name may spell an `Object.prototype` member, and a bare lookup would answer such a name with an inherited function. */
export function ownValue<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

const secretReferenceResolver: SdlReferenceResolver = {
  kind: "secret",
  resolve: ({ name }, { secrets }) => ownValue(secrets, name)
};

function referenceError(instancePath: string, message: string, params: Record<string, unknown>): ValidationError {
  return { schemaPath: "", instancePath, keyword: "sdl-reference", params, message };
}

/** Shared so the intake and substitution cannot report the same missing value in two wordings. */
export function missingSdlReferenceValueError(reference: SdlReferenceDeclaration): ValidationError {
  const echoedServiceName = reference.serviceName.slice(0, MAX_ECHOED_REFERENCE_LENGTH);

  return referenceError(reference.instancePath, `no value supplied for SDL Reference "${reference.reference}" in service "${echoedServiceName}"`, {
    kind: reference.kind,
    name: reference.name,
    serviceName: echoedServiceName
  });
}

function reservedValueError(slot: SdlReferenceSlot): ValidationError {
  const echoed = slot.value.slice(0, MAX_ECHOED_REFERENCE_LENGTH);

  return referenceError(slot.instancePath, `"${echoed}" is not a recognized SDL Reference and values beginning with "${SDL_REFERENCE_PREFIX}" are reserved`, {
    value: echoed
  });
}

/** Names the position rather than what stands in it, because an error payload is echoed to the caller and logged, and this position always holds a secret. */
function reservedPositionError(slot: SdlReferenceSlot): ValidationError {
  return referenceError(
    slot.instancePath,
    `the value at "${slot.instancePath}" is not a recognized SDL Reference and values beginning with "${SDL_REFERENCE_PREFIX}" are reserved`,
    {}
  );
}

function unknownKindError(reference: SdlReferenceDeclaration): ValidationError {
  return referenceError(reference.instancePath, `"${reference.reference}" uses unknown SDL Reference kind "${reference.kind}"`, {
    kind: reference.kind
  });
}

type ServiceLocation = { serviceName: string; serviceIndex: number };

function envSlotsOf({ serviceName, serviceIndex }: ServiceLocation, service: SDLInput["services"][string]): SdlReferenceSlot[] {
  const env = service?.env;

  if (!Array.isArray(env)) return [];

  return env.flatMap((entry, index) => {
    const declaration = typeof entry === "string" ? readEnvDeclaration(entry) : null;

    if (!declaration) return [];

    return {
      serviceName,
      serviceIndex,
      instancePath: `/services/${serviceName}/env/${index}`,
      node: env,
      position: `e${index}`,
      value: declaration.value,
      valueIsAlwaysSecret: false,
      replace: (resolved: string) => {
        env[index] = `${declaration.key}=${resolved}`;
      }
    };
  });
}

function credentialSlotsOf({ serviceName, serviceIndex }: ServiceLocation, service: SDLInput["services"][string]): SdlReferenceSlot[] {
  const credentials = service?.credentials;

  if (!credentials || typeof credentials !== "object") return [];

  return CREDENTIAL_REFERENCE_FIELDS.flatMap(field => {
    const value = credentials[field];

    if (typeof value !== "string") return [];

    return {
      serviceName,
      serviceIndex,
      instancePath: `/services/${serviceName}/credentials/${field}`,
      node: credentials,
      position: `c_${field}`,
      value,
      valueIsAlwaysSecret: true,
      replace: (resolved: string) => {
        credentials[field] = resolved;
      }
    };
  });
}

@singleton()
export class SdlReferenceService {
  readonly #resolvers = new Map<string, SdlReferenceResolver>();

  constructor() {
    this.register(secretReferenceResolver);
  }

  register(resolver: SdlReferenceResolver): void {
    if (this.#resolvers.has(resolver.kind)) {
      throw new Error(`SDL Reference kind "${resolver.kind}" is already registered`);
    }

    this.#resolvers.set(resolver.kind, resolver);
  }

  validate(sdl: SDLInput): ValidationError[] {
    return this.#eachReference(sdl, reference => (this.#resolvers.has(reference.kind) ? undefined : unknownKindError(reference)));
  }

  /** Writes through the slot, so a resolved value can never be re-read as YAML nor rescanned for references. */
  substitute(sdl: SDLInput, context: SdlReferenceContext): ValidationError[] {
    return this.#eachReference(sdl, (reference, slot) => {
      const resolver = this.#resolvers.get(reference.kind);

      if (!resolver) {
        return unknownKindError(reference);
      }

      const value = resolver.resolve(reference, context);

      if (typeof value !== "string") {
        return missingSdlReferenceValueError(reference);
      }

      slot.replace(value);

      return undefined;
    });
  }

  /** Substitution alone cannot report what a request supplied and the SDL never asked for, because it only ever visits what the SDL names. */
  declarationsOf(sdl: SDLInput, kind: string): SdlReferenceDeclaration[] {
    const declarations: SdlReferenceDeclaration[] = [];

    this.#eachReference(sdl, declaration => {
      if (declaration.kind === kind) declarations.push(declaration);

      return undefined;
    });

    return declarations;
  }

  #eachReference(sdl: SDLInput, visit: SdlReferenceVisitor): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const slot of this.slotsOf(sdl)) {
      const error = this.#readSlot(slot, visit);

      if (error) errors.push(error);
    }

    return errors;
  }

  /** Read in full before anything is written, because two services sharing one `env` list or `credentials` block through a YAML anchor share the node behind both slots, and a lazy walk would read what an earlier slot had already resolved. */
  slotsOf(sdl: SDLInput): SdlReferenceSlot[] {
    return Object.entries(this.#servicesOf(sdl)).flatMap(([serviceName, service], serviceIndex) => [
      ...envSlotsOf({ serviceName, serviceIndex }, service),
      ...credentialSlotsOf({ serviceName, serviceIndex }, service)
    ]);
  }

  #readSlot(slot: SdlReferenceSlot, visit: SdlReferenceVisitor): ValidationError | undefined {
    const read = readSdlReference(slot.value);

    if (read.type === "plain") return undefined;

    if (read.type === "reserved") {
      return slot.valueIsAlwaysSecret ? reservedPositionError(slot) : reservedValueError(slot);
    }

    return visit({ kind: read.kind, name: read.name, serviceName: slot.serviceName, instancePath: slot.instancePath, reference: slot.value }, slot);
  }

  #servicesOf(sdl: SDLInput): SDLInput["services"] {
    const services = sdl?.services;

    return services && typeof services === "object" ? services : {};
  }
}
