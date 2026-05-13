"use client";

import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";

/** Shown until live pricing resolves or when no H100 models are returned. Keep in sync with marketing copy. */
const FALLBACK_H100_PRICE = 1.8;

export const DEPENDENCIES = {
  useServices
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function H100PriceStatus({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { api } = d.useServices();
  const { data } = api.v1.listGpuPrices.useQuery();
  const minPrice = getH100MinPrice(data) ?? FALLBACK_H100_PRICE;

  return (
    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" aria-hidden />
      <span>H100 GPUs: Starting at ${minPrice.toFixed(2)}/hr</span>
    </div>
  );
}

type GpuPricesData = paths["/v1/gpu-prices"]["get"]["responses"][200]["content"]["application/json"] | undefined;

function getH100MinPrice(data: GpuPricesData): number | undefined {
  if (!data) return undefined;
  const prices = data.models.map(m => (m.model === "h100" ? m.price?.min : undefined)).filter((price): price is number => Number.isFinite(price));
  if (prices.length === 0) return undefined;
  return Math.min(...prices);
}
