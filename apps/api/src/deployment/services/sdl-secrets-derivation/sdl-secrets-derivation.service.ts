import type { SDLInput } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import type { SdlReferenceSlot } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { isSdlReference, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";

/** The kind every derived reference is written as, because a derived value is a secret like any other and nothing downstream needs to know it was not supplied. */
const DERIVED_REFERENCE_KIND = "secret";

/** Which env values are taken out beside the registry credentials, which always are: every one, or only those of the variables named. */
export type SealedEnv = "every-value" | ReadonlySet<string>;

/** A request that says nothing has every env value sealed, because nothing told the console which are secret; a seal says so by implication, and `secretEnv` outranks it by naming them. */
export function sealedEnvOf(input: { sealedSecrets?: string; secretEnv?: string[] }): SealedEnv {
  if (input.secretEnv) return new Set(input.secretEnv);

  return input.sealedSecrets ? new Set() : "every-value";
}

type DerivationOptions = { sealedEnv: SealedEnv; onlyAt?: ReadonlySet<string> };

/** Takes the values a submitted SDL carries in the clear out of the document and hands them back as secrets, leaving an `ac-secret://NAME` reference where each one stood. */
@singleton()
export class SdlSecretsDerivationService {
  constructor(private readonly sdlReferenceService: SdlReferenceService) {}

  /** Mutates the document it is given, and `onlyAt` bounds the walk to positions the caller wrote, or a stored document's untouched plaintext would be sealed away from its owner. */
  derive(document: SDLInput, options: DerivationOptions): SdlSecrets {
    const secrets: SdlSecrets = {};
    const takenByNode = new Map<object, Set<string>>();
    const takenNames = this.#namesAlreadyReferencedIn(document);

    for (const slot of this.#slotsWithin(document, options.onlyAt)) {
      if (!this.#isDerivable(slot, options.sealedEnv)) continue;

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

  /** A value left as the deployment stores it keeps what it holds, so resubmitting a document unchanged never seals away a variable its owner could read. */
  positionsToDeriveOnReplace(input: { document: SDLInput; storedDocument: SDLInput; secretEnv?: string[] }): ReadonlySet<string> {
    const storedValues = new Map(this.sdlReferenceService.slotsOf(input.storedDocument).map(slot => [slotIdentityOf(slot), slot.value]));
    const namedSecret = new Set(input.secretEnv ?? []);
    const positions = this.sdlReferenceService
      .slotsOf(input.document)
      .filter(slot => storedValues.get(slotIdentityOf(slot)) !== slot.value || (slot.envVariable !== undefined && namedSecret.has(slot.envVariable)));

    return new Set(positions.map(slot => slot.instancePath));
  }

  /** A variable named secret that nothing in reach sets is a misspelling, and sealing nothing for it would leave the value it was meant for readable. */
  unsetEnvVariablesOf(document: SDLInput, options: DerivationOptions): string[] {
    if (options.sealedEnv === "every-value") return [];

    const setVariables = new Set(this.#slotsWithin(document, options.onlyAt).map(slot => slot.envVariable));

    return [...options.sealedEnv].filter(variable => !setVariables.has(variable));
  }

  #slotsWithin(document: SDLInput, onlyAt?: ReadonlySet<string>): SdlReferenceSlot[] {
    const slots = this.sdlReferenceService.slotsOf(document);

    return onlyAt ? slots.filter(slot => onlyAt.has(slot.instancePath)) : slots;
  }

  /** Read before anything is written, or a name could be minted onto a spelling another slot is still standing on and one value would resolve into two places. */
  #namesAlreadyReferencedIn(document: SDLInput): Set<string> {
    return new Set(this.sdlReferenceService.declarationsOf(document, DERIVED_REFERENCE_KIND).map(declaration => declaration.name));
  }

  #isDerivable(slot: SdlReferenceSlot, sealedEnv: SealedEnv): boolean {
    if (isSdlReference(slot.value)) return false;

    if (slot.valueIsAlwaysSecret || sealedEnv === "every-value") return true;

    return slot.envVariable !== undefined && sealedEnv.has(slot.envVariable);
  }
}

/** A variable is matched by name rather than position, because a patch re-appends what it writes and so moves it. */
function slotIdentityOf(slot: SdlReferenceSlot): string {
  return JSON.stringify(slot.envVariable === undefined ? [slot.instancePath] : [slot.serviceName, slot.envVariable]);
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
