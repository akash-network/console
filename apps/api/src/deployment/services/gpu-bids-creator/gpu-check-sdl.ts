import type { SDLInput } from "@akashnetwork/chain-sdk";

export type GpuCheckShape = "pricing" | "typical";

export interface GpuCheck {
  model: string;
  shape: GpuCheckShape;
}

export const GPU_CHECK_SHAPES: GpuCheckShape[] = ["pricing", "typical"];

const RESOURCES: Record<GpuCheckShape, { cpu: { units: number }; memory: { size: string }; storage: { size: string } }> = {
  /** Kept tiny so a bid prices the gpu rather than the cpu, memory and storage around it; the price service spots the bot's bids by this cpu. */
  pricing: { cpu: { units: 0.1 }, memory: { size: "256Mi" }, storage: { size: "256Mi" } },
  /** The low end of what mainnet gpu deployments ask for per gpu, so a provider that turns down tiny orders is not read as never bidding. */
  typical: { cpu: { units: 4 }, memory: { size: "16Gi" }, storage: { size: "40Gi" } }
};

/** One placement per check, so each check becomes an order of its own that a provider bids on regardless of the others. */
export function buildGpuCheckSdl(checks: GpuCheck[]): SDLInput {
  const sdl: SDLInput = { version: "2.0", services: {}, profiles: { compute: {}, placement: {} }, deployment: {} };

  checks.forEach(({ model, shape }, index) => {
    const name = toPlacementName(index);

    sdl.services[name] = {
      image: "ubuntu:22.04",
      command: ["sh", "-c"],
      args: ["uptime; nvidia-smi; sleep infinity"],
      expose: [{ port: 8080, as: 80, to: [{ global: true }] }]
    };
    sdl.profiles.compute[name] = {
      resources: { ...RESOURCES[shape], gpu: { units: 1, attributes: { vendor: { nvidia: [{ model }] } } } }
    };
    sdl.profiles.placement[name] = { pricing: { [name]: { denom: "uact", amount: 100_000 } } };
    sdl.deployment[name] = { [name]: { profile: name, count: 1 } };
  });

  return sdl;
}

/** Zero padded so that ordering placements by name keeps them in the order the checks came in. */
export function toPlacementName(index: number): string {
  return `gpu${String(index).padStart(2, "0")}`;
}
