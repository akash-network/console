import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";

const CONSOLE_REFERENCE_PREFIX = "ac-";

const CONSOLE_REFERENCE = /^ac-([a-z]{1,16}):\/\/([A-Za-z_][A-Za-z0-9_]{0,63})$/;

/** The whole message is logged by the error handler, and an offending value is only bounded by the request body limit. */
const MAX_ECHOED_REFERENCE_LENGTH = 120;

type ConsoleReferenceRead = { type: "plain" } | { type: "reserved" } | { type: "reference"; kind: string; name: string };

function readConsoleReference(value: string): ConsoleReferenceRead {
  if (!value.startsWith(CONSOLE_REFERENCE_PREFIX)) {
    return { type: "plain" };
  }

  const reference = CONSOLE_REFERENCE.exec(value);

  if (!reference) {
    return { type: "reserved" };
  }

  return { type: "reference", kind: reference[1], name: reference[2] };
}

function readEnvDeclaration(entry: string): { key: string; value: string } | null {
  const valueStart = entry.indexOf("=");

  return valueStart === -1 ? null : { key: entry.slice(0, valueStart), value: entry.slice(valueStart + 1) };
}

export interface ConsoleReferenceContext {
  secrets: SdlSecrets;
}

export interface ConsoleReferenceResolver {
  readonly kind: string;
  resolve(name: string, context: ConsoleReferenceContext): string | undefined;
}

interface EnvReference {
  kind: string;
  name: string;
  key: string;
  reference: string;
  instancePath: string;
}

type EnvReferenceVisitor = (reference: EnvReference, env: string[], index: number) => ValidationError | undefined;

/** A reference name may spell an `Object.prototype` member, and a bare lookup would answer such a name with an inherited function. */
const secretReferenceResolver: ConsoleReferenceResolver = {
  kind: "secret",
  resolve: (name, { secrets }) => (Object.hasOwn(secrets, name) ? secrets[name] : undefined)
};

function referenceError(instancePath: string, message: string, params: Record<string, unknown>): ValidationError {
  return { schemaPath: "", instancePath, keyword: "console-reference", params, message };
}

function unknownKindError(reference: EnvReference): ValidationError {
  return referenceError(reference.instancePath, `"${reference.reference}" uses unknown Console Reference kind "${reference.kind}"`, {
    kind: reference.kind
  });
}

@singleton()
export class SdlReferenceService {
  readonly #resolvers = new Map<string, ConsoleReferenceResolver>();

  constructor() {
    this.register(secretReferenceResolver);
  }

  register(resolver: ConsoleReferenceResolver): void {
    if (this.#resolvers.has(resolver.kind)) {
      throw new Error(`Console Reference kind "${resolver.kind}" is already registered`);
    }

    this.#resolvers.set(resolver.kind, resolver);
  }

  validate(sdl: SDLInput): ValidationError[] {
    return this.#eachReference(sdl, reference => (this.#resolvers.has(reference.kind) ? undefined : unknownKindError(reference)));
  }

  /** Sets the parsed env entry, so a resolved value can never be re-read as YAML nor rescanned for references. */
  substitute(sdl: SDLInput, context: ConsoleReferenceContext): ValidationError[] {
    return this.#eachReference(sdl, (reference, env, index) => {
      const resolver = this.#resolvers.get(reference.kind);

      if (!resolver) {
        return unknownKindError(reference);
      }

      const value = resolver.resolve(reference.name, context);

      if (value === undefined) {
        return referenceError(reference.instancePath, `no value supplied for Console Reference "${reference.reference}"`, {
          kind: reference.kind,
          name: reference.name
        });
      }

      env[index] = `${reference.key}=${value}`;

      return undefined;
    });
  }

  #eachReference(sdl: SDLInput, visit: EnvReferenceVisitor): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [serviceName, service] of Object.entries(this.#servicesOf(sdl))) {
      const env = service?.env;

      if (!Array.isArray(env)) continue;

      env.forEach((entry, index) => {
        const error = this.#readEntry(entry, `/services/${serviceName}/env/${index}`, reference => visit(reference, env, index));

        if (error) errors.push(error);
      });
    }

    return errors;
  }

  #readEntry(entry: unknown, instancePath: string, visit: (reference: EnvReference) => ValidationError | undefined): ValidationError | undefined {
    if (typeof entry !== "string") return undefined;

    const declaration = readEnvDeclaration(entry);

    if (!declaration) return undefined;

    const read = readConsoleReference(declaration.value);

    if (read.type === "plain") return undefined;

    if (read.type === "reserved") {
      const echoed = declaration.value.slice(0, MAX_ECHOED_REFERENCE_LENGTH);

      return referenceError(
        instancePath,
        `"${echoed}" is not a recognized Console Reference and values beginning with "${CONSOLE_REFERENCE_PREFIX}" are reserved`,
        {
          value: echoed
        }
      );
    }

    return visit({ ...read, key: declaration.key, reference: declaration.value, instancePath });
  }

  #servicesOf(sdl: SDLInput): SDLInput["services"] {
    const services = sdl?.services;

    return services && typeof services === "object" ? services : {};
  }
}
