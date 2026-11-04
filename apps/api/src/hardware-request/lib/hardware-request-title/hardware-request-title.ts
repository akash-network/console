import { describeSpecGpus } from "@src/hardware-request/lib/hardware-request-spec-summary/hardware-request-spec-summary";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

export function hardwareRequestTitle({ category, gpuModel, quantity, region, spec }: HardwareRequestOutput): string {
  switch (category) {
    case "gpu_model":
      return `GPU request: ${quantity}× ${gpuModel}`;
    case "capacity":
      return gpuModel ? `Capacity request: ${quantity}× ${gpuModel}` : `Capacity request: ${quantity} GPUs`;
    case "region":
      return `Region request: ${region}`;
    case "other":
      return "Hardware request";
    case "quote":
      return spec ? `Quote request: ${describeSpecGpus(spec)}` : `Quote request: ${quantity}× ${gpuModel}`;
  }
}
