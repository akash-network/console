import { BuyCreditsCard } from "./BuyCreditsCard/BuyCreditsCard";
import { SendManifestAgainCard } from "./SendManifestAgainCard/SendManifestAgainCard";
import type { ActionCardRegistry } from "./actionCardTypes";

/** One card per action type; an action missing here falls back to `GenericActionCard`. */
export const ACTION_CARD_REGISTRY: ActionCardRegistry = {
  send_manifest_again: SendManifestAgainCard,
  buy_credits: BuyCreditsCard
};
