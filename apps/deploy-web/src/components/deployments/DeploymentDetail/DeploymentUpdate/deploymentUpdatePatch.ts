import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import type { SdlSecretValues } from "@src/utils/sdl/sdlSecrets";
import {
  isSdlReference,
  mintSecretName,
  REGISTRY_PASSWORD_SECRET_NAME,
  REGISTRY_USERNAME_SECRET_NAME,
  secretReferenceNamesIn,
  secretReferenceOf
} from "@src/utils/sdl/sdlSecrets";
import type { ServicesPatch } from "@src/utils/sdl/sdlServicesPatch";
import { servicesPatchBetween } from "@src/utils/sdl/sdlServicesPatch";
import type { DeploymentUpdateFormValues } from "./deploymentUpdateFormSchema";

export interface SealedDeploymentUpdate {
  services: ServicesPatch;
  /** Only the values this update typed, keyed by the name each is sealed under. */
  secrets: SdlSecretValues;
  /** The submitted values with every typed secret standing as its reference, fit to become the next baseline. */
  values: SdlBuilderFormValuesType;
}

type Credentials = NonNullable<ServiceType["credentials"]>;

type MintReference = (preferredName: string, value: string) => string;

/** Both sides are generated from form values, so a difference is always an edit and never how the stored document happened to be spelled. */
export function sealedUpdateOf(seed: DeploymentUpdateFormValues, current: DeploymentUpdateFormValues): SealedDeploymentUpdate {
  const { secretValues = {}, ...submitted } = current;
  const seedSdl = generateSdl(seed);
  const taken = new Set([...secretReferenceNamesIn(seedSdl), ...secretReferenceNamesIn(generateSdl(submitted))]);
  const minted: SdlSecretValues = {};
  const mintReference: MintReference = (preferredName, value) => {
    const name = mintSecretName(preferredName, taken);
    minted[name] = value;
    return secretReferenceOf(name);
  };

  const values: SdlBuilderFormValuesType = {
    ...submitted,
    services: submitted.services.map(service =>
      withTypedSecretsReferenced(
        service,
        seed.services.find(candidate => candidate.id === service.id),
        mintReference
      )
    )
  };
  const valuesSdl = generateSdl(values);

  return {
    services: servicesPatchBetween(seedSdl, valuesSdl),
    secrets: { ...replacementsStillReferenced(secretValues, secretReferenceNamesIn(valuesSdl)), ...minted },
    values
  };
}

function withTypedSecretsReferenced(service: ServiceType, seedService: ServiceType | undefined, mintReference: MintReference): ServiceType {
  const env = service.env?.map(variable => (isTypedSecret(variable) ? { ...variable, value: mintReference(variable.key.trim(), variable.value) } : variable));

  return { ...service, ...(env ? { env } : {}), credentials: credentialsOf(service, seedService, mintReference) };
}

function isTypedSecret(variable: { value?: string; isSecret?: boolean }): variable is { value: string; isSecret: true } {
  return !!variable.isSecret && !!variable.value && !isSdlReference(variable.value);
}

/** A patch replaces credentials whole, so once they change every half typed in the clear is sealed rather than resent as a value. */
function credentialsOf(service: ServiceType, seedService: ServiceType | undefined, mintReference: MintReference): Credentials | undefined {
  const credentials = service.credentials;
  if (!service.hasCredentials || !credentials) return credentials;
  if (seedService?.hasCredentials && isSameCredentials(credentials, seedService.credentials)) return credentials;

  return {
    ...credentials,
    username: credentialReferenceOf(credentials.username, REGISTRY_USERNAME_SECRET_NAME, mintReference),
    password: credentialReferenceOf(credentials.password, REGISTRY_PASSWORD_SECRET_NAME, mintReference)
  };
}

function isSameCredentials(credentials: Credentials, seedCredentials: Credentials | undefined): boolean {
  return (
    !!seedCredentials &&
    credentials.host === seedCredentials.host &&
    credentials.username === seedCredentials.username &&
    credentials.password === seedCredentials.password
  );
}

function credentialReferenceOf(value: string, preferredName: string, mintReference: MintReference): string {
  return value === "" || isSdlReference(value) ? value : mintReference(preferredName, value);
}

/** A blank box keeps the stored value, and a removed secret takes its replacement with it, since the api refuses a value nothing references. */
function replacementsStillReferenced(secretValues: Record<string, string | undefined>, referenced: ReadonlySet<string>): SdlSecretValues {
  return Object.fromEntries(Object.entries(secretValues).flatMap(([name, value]) => (value && referenced.has(name) ? [[name, value]] : [])));
}
