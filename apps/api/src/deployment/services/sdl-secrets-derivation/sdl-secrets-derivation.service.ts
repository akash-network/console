import type { SDLInput } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import type { SdlReferenceSlot } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { isSdlReference, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";

/** The kind every derived reference is written as, because a derived value is a secret like any other and nothing downstream needs to know it was not supplied. */
const DERIVED_REFERENCE_KIND = "secret";

export interface DerivedSdlSecrets {
  /** Name to value, in the shape `sealForStorage` seals and the stored token carries. */
  secrets: SdlSecrets;
  /** How many positions were rewritten, for a log line that has to say something without saying a value. */
  derivedCount: number;
}

const NOTHING_DERIVED: DerivedSdlSecrets = { secrets: {}, derivedCount: 0 };

/**
 * Takes the values a submitted SDL carries in the clear out of the document and hands them back as
 * secrets, leaving an `ac-secret://NAME` reference in each place one stood. This is what lets a client
 * that names none of its secrets still have them stored as ciphertext rather than as text, and what keeps
 * the definition it leaves behind resolvable instead of blanked.
 *
 * `includeEnvValues` is the difference between the two callers. A request that sealed its values has
 * already said which of them are secret, so only a private registry credential is taken — that is a
 * secret whatever it holds, and there is no ordinary reading of it. A request that sealed nothing has
 * said nothing, so every value in `env` is taken as well.
 *
 * A value that is already a whole reference is left alone. It names a secret rather than carrying one,
 * and inventing a value for a name the author asked to be handed would turn a missing-value refusal into
 * a deployment configured with the literal text of its own reference.
 *
 * Mutates the document it is given, which must therefore be a copy the caller keeps to itself: the
 * manifest is generated from the submitted SDL and has to see the real values, so a document with
 * references written into it can only ever be the one being stored.
 */
@singleton()
export class SdlSecretsDerivationService {
  constructor(private readonly sdlReferenceService: SdlReferenceService) {}

  derive(document: SDLInput, options: { includeEnvValues: boolean }): DerivedSdlSecrets {
    const slots = this.sdlReferenceService.slotsOf(document).filter(slot => this.#isDerivable(slot, options));

    if (slots.length === 0) return NOTHING_DERIVED;

    const secrets: SdlSecrets = {};
    const namesByNode = new Map<object, Map<string, string>>();

    for (const slot of slots) {
      const namesInNode = namesByNode.get(slot.node) ?? new Map<string, string>();
      namesByNode.set(slot.node, namesInNode);

      if (namesInNode.has(slot.position)) continue;

      const name = `s${slot.serviceIndex}_${slot.position}`;
      namesInNode.set(slot.position, name);
      secrets[name] = slot.value;
      slot.replace(`ac-${DERIVED_REFERENCE_KIND}://${name}`);
    }

    return { secrets, derivedCount: Object.keys(secrets).length };
  }

  #isDerivable(slot: SdlReferenceSlot, options: { includeEnvValues: boolean }): boolean {
    if (isSdlReference(slot.value)) return false;

    return slot.valueIsAlwaysSecret || options.includeEnvValues;
  }
}
