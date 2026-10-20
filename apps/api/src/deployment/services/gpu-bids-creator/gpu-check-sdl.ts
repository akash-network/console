import type { SDLInput } from "@akashnetwork/chain-sdk";

/** Kept tiny so a bid prices the gpu rather than the cpu, memory and storage around it; the price service spots the bot's bids by this cpu. */
const PRICING_RESOURCES = {
  cpu: { units: 0.1 },
  memory: { size: "256Mi" },
  storage: { size: "256Mi" }
};

/** One placement per model, so each model becomes an order of its own that a provider bids on regardless of the others. */
export function buildGpuCheckSdl(models: string[]): SDLInput {
  const sdl: SDLInput = { version: "2.0", services: {}, profiles: { compute: {}, placement: {} }, deployment: {} };

  models.forEach((model, index) => {
    const name = toPlacementName(index);

    sdl.services[name] = {
      image: "ubuntu:22.04",
      command: ["sh", "-c"],
      args: ["uptime; nvidia-smi; sleep infinity"],
      expose: [{ port: 8080, as: 80, to: [{ global: true }] }]
    };
    sdl.profiles.compute[name] = {
      resources: { ...PRICING_RESOURCES, gpu: { units: 1, attributes: { vendor: { nvidia: [{ model }] } } } }
    };
    sdl.profiles.placement[name] = { pricing: { [name]: { denom: "uact", amount: 100_000 } } };
    sdl.deployment[name] = { [name]: { profile: name, count: 1 } };
  });

  return sdl;
}

/** Zero padded so that ordering placements by name keeps them in the order the models came in. */
export function toPlacementName(index: number): string {
  return `gpu${String(index).padStart(2, "0")}`;
}
