import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";

const SDL_REFERENCE_PREFIX = "ac-";

const SDL_REFERENCE = /^ac-([a-z]{1,16}):\/\/([A-Za-z_][A-Za-z0-9_]{0,63})$/;

/** Must stay equal to the bound the grammar above accepts, because the seal budget is computed from it. */
export const MAX_SDL_REFERENCE_NAME_LENGTH = 64;

/** The whole message is logged by the error handler, and an offending value is only bounded by the request body limit. */
export const MAX_ECHOED_REFERENCE_LENGTH = 120;

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

/** One namespace per service, so two services can reference the same name and receive their own value. */
export type NamespacedSdlSecrets = Record<string, SdlSecrets>;

export interface SdlReferenceContext {
  secrets: NamespacedSdlSecrets;
}

export interface SdlReferenceTarget {
  serviceName: string;
  name: string;
}

export interface SdlReferenceResolver {
  readonly kind: string;
  resolve(target: SdlReferenceTarget, context: SdlReferenceContext): string | undefined;
}

interface EnvReference extends SdlReferenceTarget {
  kind: string;
  key: string;
  reference: string;
  instancePath: string;
}

/** One reference an SDL declares, as a caller comparing an SDL against a request's supplied names needs to see it. */
export type SdlReferenceDeclaration = Omit<EnvReference, "key">;

type EnvReferenceVisitor = (reference: EnvReference, env: string[], index: number) => ValidationError | undefined;

/** A service or reference name may spell an `Object.prototype` member, and a bare lookup would answer such a name with an inherited function. */
export function ownValue<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

const secretReferenceResolver: SdlReferenceResolver = {
  kind: "secret",
  resolve: ({ serviceName, name }, { secrets }) => {
    const namespace = ownValue(secrets, serviceName);

    return typeof namespace === "object" && namespace !== null ? ownValue(namespace, name) : undefined;
  }
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

function unknownKindError(reference: EnvReference): ValidationError {
  return referenceError(reference.instancePath, `"${reference.reference}" uses unknown SDL Reference kind "${reference.kind}"`, {
    kind: reference.kind
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

  /** Sets the parsed env entry, so a resolved value can never be re-read as YAML nor rescanned for references. */
  substitute(sdl: SDLInput, context: SdlReferenceContext): ValidationError[] {
    return this.#eachReference(sdl, (reference, env, index) => {
      const resolver = this.#resolvers.get(reference.kind);

      if (!resolver) {
        return unknownKindError(reference);
      }

      const value = resolver.resolve(reference, context);

      if (typeof value !== "string") {
        return missingSdlReferenceValueError(reference);
      }

      env[index] = `${reference.key}=${value}`;

      return undefined;
    });
  }

  /** Substitution alone cannot report what a request supplied and the SDL never asked for, because it only ever visits what the SDL names. */
  declarationsOf(sdl: SDLInput, kind: string): SdlReferenceDeclaration[] {
    const declarations: SdlReferenceDeclaration[] = [];

    this.#eachReference(sdl, ({ key, ...declaration }) => {
      if (declaration.kind === kind) declarations.push(declaration);

      return undefined;
    });

    return declarations;
  }

  #eachReference(sdl: SDLInput, visit: EnvReferenceVisitor): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [serviceName, service] of Object.entries(this.#servicesOf(sdl))) {
      const env = service?.env;

      if (!Array.isArray(env)) continue;

      env.forEach((entry, index) => {
        const location = { serviceName, instancePath: `/services/${serviceName}/env/${index}` };
        const error = this.#readEntry(entry, location, reference => visit(reference, env, index));

        if (error) errors.push(error);
      });
    }

    return errors;
  }

  #readEntry(
    entry: unknown,
    location: { serviceName: string; instancePath: string },
    visit: (reference: EnvReference) => ValidationError | undefined
  ): ValidationError | undefined {
    if (typeof entry !== "string") return undefined;

    const declaration = readEnvDeclaration(entry);

    if (!declaration) return undefined;

    const read = readSdlReference(declaration.value);

    if (read.type === "plain") return undefined;

    if (read.type === "reserved") {
      const echoed = declaration.value.slice(0, MAX_ECHOED_REFERENCE_LENGTH);

      return referenceError(
        location.instancePath,
        `"${echoed}" is not a recognized SDL Reference and values beginning with "${SDL_REFERENCE_PREFIX}" are reserved`,
        {
          value: echoed
        }
      );
    }

    return visit({ kind: read.kind, name: read.name, ...location, key: declaration.key, reference: declaration.value });
  }

  #servicesOf(sdl: SDLInput): SDLInput["services"] {
    const services = sdl?.services;

    return services && typeof services === "object" ? services : {};
  }
}
