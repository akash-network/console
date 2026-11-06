import yaml from "js-yaml";
import isEqual from "lodash/isEqual";

import type { AssistantAction } from "@src/types/assistant";

const PRICING_KEYS = new Set(["pricing", "price", "denom"]);

/** Its keys are variable names the user chose, not fields of the action, so a variable called `price` is not a pricing change. */
const ENV_KEY = "env";

export const PRICING_CHANGE_MESSAGE = "This change would touch pricing, which the assistant can't change. Edit pricing in the editor yourself.";

/** A bid's price is the provider's own and only ever shown, so a choice is the one place a price may ride along. */
export function carriesPricingChange(action: AssistantAction): boolean {
  if (action.type === "choose_bid") return action.choices.some(({ price: _bidPrice, ...choice }) => hasPricingKey(choice));
  return hasPricingKey(action);
}

function hasPricingKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasPricingKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => PRICING_KEYS.has(key) || (key !== ENV_KEY && hasPricingKey(nested)));
}

/** Compares every placement's pricing block, so a rewritten SDL can be refused when it would move a price or denom; an SDL that won't parse can't be vouched for. */
export function keepsPricing(sourceSdl: string, nextSdl: string): boolean {
  const sourcePricing = pricingOf(sourceSdl);
  return sourcePricing !== null && isEqual(sourcePricing, pricingOf(nextSdl));
}

function pricingOf(sdl: string): Record<string, unknown> | null {
  try {
    const document = yaml.load(sdl) as { profiles?: { placement?: Record<string, { pricing?: unknown }> } } | null;
    const placements = document?.profiles?.placement ?? {};
    return Object.fromEntries(Object.entries(placements).map(([name, placement]) => [name, placement?.pricing ?? null]));
  } catch {
    return null;
  }
}
