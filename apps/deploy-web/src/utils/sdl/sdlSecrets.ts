import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";

/** Mirrors the api's SDL Reference grammar; anchored, so a value merely containing the spelling is not a reference. */
export const SDL_REFERENCE_PATTERN = /^ac-([a-z]{1,16}):\/\/([A-Za-z_][A-Za-z0-9_]{0,63})$/;

/** The api refuses any value opening with this, whether or not it spells a valid reference. */
export const SDL_REFERENCE_PREFIX = "ac-";

const SECRET_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

const SECRET_REFERENCE_KIND = "secret";

export const REGISTRY_USERNAME_SECRET_NAME = "REGISTRY_USERNAME";
export const REGISTRY_PASSWORD_SECRET_NAME = "REGISTRY_PASSWORD";

const CREDENTIAL_SECRET_FIELDS = ["username", "password"] as const;

type CredentialSecretField = (typeof CREDENTIAL_SECRET_FIELDS)[number];

/** Typed secret values keyed by the name their SDL reference carries. */
export type SdlSecretValues = Record<string, string>;

/** A secret the SDL references but nothing has a value for yet, located for the user by service and field. */
export interface UnresolvedSdlSecret {
  serviceTitle: string;
  label: string;
  name: string;
}

export interface ResolvedSdlSecrets {
  /** The reference standing in for each secret slot of the generated SDL, keyed by `envSecretSlotKey`/`credentialSecretSlotKey`. */
  references: ReadonlyMap<string, string>;
  /** Everything typed in this session that a create must seal. */
  values: SdlSecretValues;
  unresolved: UnresolvedSdlSecret[];
}

export interface ResolveSdlSecretsOptions {
  /** Withholds every secret value behind a reference; without it the values stay in the document, as a deployment created without a seal needs. */
  sealSecrets?: boolean;
  /** Names some other holder answers for, such as the deployment being redeployed, so a kept reference to one is not unresolved. */
  heldNames?: Iterable<string>;
}

/** The message naming a secret the SDL references that nothing has a value for, shared by the quote and deploy gates. */
export function unresolvedSecretMessage(secret: UnresolvedSdlSecret): string {
  return `Secret "${secret.label}" in service "${secret.serviceTitle}" needs a value.`;
}

export function isSdlReference(value: string): boolean {
  return SDL_REFERENCE_PATTERN.test(value);
}

export function isReservedSdlValue(value: string): boolean {
  return value.startsWith(SDL_REFERENCE_PREFIX);
}

export function isValidSecretName(name: string): boolean {
  return SECRET_NAME_PATTERN.test(name);
}

export function secretReferenceOf(name: string): string {
  return `${SDL_REFERENCE_PREFIX}${SECRET_REFERENCE_KIND}://${name}`;
}

export function secretNameOf(value: string): string | null {
  const reference = SDL_REFERENCE_PATTERN.exec(value);
  return reference && reference[1] === SECRET_REFERENCE_KIND ? reference[2] : null;
}

export function envSecretSlotKey(serviceIndex: number, envIndex: number): string {
  return `${serviceIndex}/env/${envIndex}`;
}

export function credentialSecretSlotKey(serviceIndex: number, field: CredentialSecretField): string {
  return `${serviceIndex}/credentials/${field}`;
}

/** Names are minted deterministically from the env key and never reuse one a kept reference already stands on, so the same form always yields the same SDL. */
export function resolveSdlSecrets(values: SdlBuilderFormValuesType, options: ResolveSdlSecretsOptions = {}): ResolvedSdlSecrets {
  const taken = namesAlreadyReferencedIn(values.services);
  const held = new Set(options.heldNames ?? []);
  const references = new Map<string, string>();
  const secretValues: SdlSecretValues = {};
  const unresolved: UnresolvedSdlSecret[] = [];

  function keepReference(slotKey: string, reference: string, location: { serviceTitle: string; label: string }) {
    references.set(slotKey, reference);
    const name = secretNameOf(reference);
    if (name !== null && !held.has(name)) unresolved.push({ ...location, name });
  }

  values.services.forEach((service, serviceIndex) => {
    (service.env ?? []).forEach((variable, envIndex) => {
      if (!options.sealSecrets || !variable.isSecret) return;
      const slotKey = envSecretSlotKey(serviceIndex, envIndex);
      const value = variable.value ?? "";
      const location = { serviceTitle: service.title, label: variable.key };

      if (isSdlReference(value)) {
        keepReference(slotKey, value, location);
        return;
      }

      const name = mintSecretName(variable.key.trim(), taken);
      references.set(slotKey, secretReferenceOf(name));
      if (value === "") {
        unresolved.push({ ...location, name });
      } else {
        secretValues[name] = value;
      }
    });

    if (!options.sealSecrets || !service.hasCredentials || !service.credentials) return;

    CREDENTIAL_SECRET_FIELDS.forEach(field => {
      const slotKey = credentialSecretSlotKey(serviceIndex, field);
      const value = service.credentials?.[field] ?? "";

      if (isSdlReference(value)) {
        keepReference(slotKey, value, { serviceTitle: service.title, label: `registry ${field}` });
        return;
      }
      if (value === "") return;

      const name = mintSecretName(field === "username" ? REGISTRY_USERNAME_SECRET_NAME : REGISTRY_PASSWORD_SECRET_NAME, taken);
      references.set(slotKey, secretReferenceOf(name));
      secretValues[name] = value;
    });
  });

  return { references, values: secretValues, unresolved };
}

/** Read in full before any name is minted, so a typed secret can never land on a name a kept reference elsewhere still stands on. */
function namesAlreadyReferencedIn(services: ServiceType[]): Set<string> {
  const names = new Set<string>();

  services.forEach(service => {
    (service.env ?? []).forEach(variable => addSecretName(names, variable.value));
    CREDENTIAL_SECRET_FIELDS.forEach(field => addSecretName(names, service.credentials?.[field]));
  });

  return names;
}

function addSecretName(names: Set<string>, value: string | undefined) {
  const name = value === undefined ? null : secretNameOf(value);
  if (name !== null) names.add(name);
}

/** The api refuses a name over this, so a suffix has to displace the tail of a long key rather than extend past it. */
const MAX_SECRET_NAME_LENGTH = 64;

function mintSecretName(preferred: string, taken: Set<string>): string {
  let candidate = preferred.slice(0, MAX_SECRET_NAME_LENGTH);
  let suffix = 2;

  while (taken.has(candidate)) {
    const marker = `_${suffix}`;
    candidate = `${preferred.slice(0, MAX_SECRET_NAME_LENGTH - marker.length)}${marker}`;
    suffix++;
  }

  taken.add(candidate);
  return candidate;
}
