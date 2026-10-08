import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";

import { isStaleProviderVersion } from "@src/utils/updateDeploymentFailure";
import type { RecordableDefinition } from "./recordableDefinition";
import type { SdlSecretsSealContext, SealSdlSecretsInput } from "./sealSdlSecrets";

const HTTP_CONFLICT = 409;
const DEFINITION_EXISTS_ERROR_CODE = "deployment_definition_exists";
const DEFINITION_MISMATCH_ERROR_CODE = "deployment_definition_mismatch";

export interface DefinitionSealing {
  contextOf: () => Promise<SdlSecretsSealContext>;
  seal: (input: SealSdlSecretsInput) => Promise<string>;
}

export function isDefinitionAlreadyRecorded(cause: unknown): boolean {
  return hasErrorCode(cause, DEFINITION_EXISTS_ERROR_CODE);
}

export function isDefinitionMismatch(cause: unknown): boolean {
  return hasErrorCode(cause, DEFINITION_MISMATCH_ERROR_CODE);
}

/** Every seal is bound to the sdl it travels with, since the routes that take a definition take the document whole. */
export async function sendSealedDefinition(
  definition: RecordableDefinition,
  sealing: DefinitionSealing,
  send: (sealedSecrets: string) => Promise<unknown>
): Promise<void> {
  await sealAndSend(definition, sealing, send, true);
}

async function sealAndSend(
  definition: RecordableDefinition,
  { contextOf, seal }: DefinitionSealing,
  send: (sealedSecrets: string) => Promise<unknown>,
  canResealOnce: boolean
): Promise<void> {
  const sealedSecrets = await seal({ context: await contextOf(), sdl: definition.sdl, secrets: definition.secrets });

  try {
    await send(sealedSecrets);
  } catch (cause) {
    if (!canResealOnce || !isStaleSeal(cause)) throw cause;
    await sealAndSend(definition, { contextOf, seal }, send, false);
  }
}

/** Only the definition and stale-provider conflicts are named; every other 409 on these routes answers a seal made against a retired key. */
function isStaleSeal(cause: unknown): boolean {
  return isApiError(cause) && cause.status === HTTP_CONFLICT && !isDefinitionAlreadyRecorded(cause) && !isStaleProviderVersion(cause);
}

function hasErrorCode(cause: unknown, code: string): boolean {
  return extractApiErrorCode(cause) === code;
}
