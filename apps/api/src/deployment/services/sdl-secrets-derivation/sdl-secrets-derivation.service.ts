import type { SDLInput } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import type { SdlReferenceSlot } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { isSdlReference, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";

/** The kind every derived reference is written as, because a derived value is a secret like any other and nothing downstream needs to know it was not supplied. */
const DERIVED_REFERENCE_KIND = "secret";

/** Takes the values a submitted SDL carries in the clear out of the document and hands them back as secrets, leaving an `ac-secret://NAME` reference where each one stood. */
@singleton()
export class SdlSecretsDerivationService {
  constructor(private readonly sdlReferenceService: SdlReferenceService) {}

  /** Mutates the document it is given, and `onlyAt` bounds the walk to positions the caller wrote, or a stored document's untouched plaintext would be sealed away from its owner. */
  derive(document: SDLInput, options: { includeEnvValues: boolean; onlyAt?: ReadonlySet<string> }): SdlSecrets {
    const secrets: SdlSecrets = {};
    const takenByNode = new Map<object, Set<string>>();
    const takenNames = this.#namesAlreadyReferencedIn(document);

    for (const slot of this.sdlReferenceService.slotsOf(document)) {
      if (options.onlyAt && !options.onlyAt.has(slot.instancePath)) continue;

      if (!this.#isDerivable(slot, options)) continue;

      const takenInNode = takenByNode.get(slot.node) ?? new Set<string>();
      takenByNode.set(slot.node, takenInNode);

      if (takenInNode.has(slot.position)) continue;

      const name = mintName(`s${slot.serviceIndex}_${slot.position}`, takenNames);
      takenInNode.add(slot.position);
      secrets[name] = slot.value;
      slot.replace(`ac-${DERIVED_REFERENCE_KIND}://${name}`);
    }

    return secrets;
  }

  /** Read before anything is written, or a name could be minted onto a spelling another slot is still standing on and one value would resolve into two places. */
  #namesAlreadyReferencedIn(document: SDLInput): Set<string> {
    return new Set(this.sdlReferenceService.declarationsOf(document, DERIVED_REFERENCE_KIND).map(declaration => declaration.name));
  }

  #isDerivable(slot: SdlReferenceSlot, options: { includeEnvValues: boolean }): boolean {
    if (isSdlReference(slot.value)) return false;

    return slot.valueIsAlwaysSecret || options.includeEnvValues;
  }
}

/** Only names the document already stands on are avoided: no two slots prefer the same name, because a position spells `e0` or `c_password`, never `e0_2`. */
function mintName(preferred: string, taken: Set<string>): string {
  let candidate = preferred;
  let suffix = 2;

  while (taken.has(candidate)) {
    candidate = `${preferred}_${suffix}`;
    suffix++;
  }

  return candidate;
}
