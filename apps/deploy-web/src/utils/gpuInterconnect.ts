import type { DeploymentGroup } from "@src/types/deployment";
import { GPU_INTERCONNECT_CAPABILITY_KEY, GPU_INTERCONNECT_FABRIC_PREFIX } from "@src/utils/sdl/gpuInterconnect";

/**
 * GPU interconnect helpers for the deployment detail and list views.
 *
 * Interconnect is an on-chain group placement requirement: `group_spec.requirements.attributes` carries
 * `capabilities/gpu-interconnect: "true"` (so only interconnect-capable providers can bid/match) plus an
 * optional pinned-fabric attribute `capabilities/gpu-interconnect/fabric/<fabric>: "true"`. It is therefore
 * authoritative and available for every deployment without the stored SDL manifest, mirroring the
 * Confidential Compute (`tee/type`) read path in `confidentialCompute.ts`.
 *
 * This is the read side; the builder-side write helpers in `utils/sdl/gpuInterconnect.ts` operate on
 * form-state placement attributes instead. (A future dedup with the fabric helpers in PR #3566 is possible
 * once that lands.)
 */

export interface DeclaredGpuInterconnect {
  enabled: boolean;
  /** Pinned fabric slugs (e.g. "infiniband", "roce"); empty when the provider is left to choose. */
  fabrics: string[];
}

const ENABLED_VALUE = "true";

/** Known interconnect fabric display names; unknown slugs fall back to a title-cased slug. */
const FABRIC_LABELS: Record<string, string> = {
  infiniband: "InfiniBand",
  roce: "RoCE"
};

/** Human-readable label for a pinned fabric slug. */
export function formatGpuInterconnectFabricLabel(slug: string): string {
  return FABRIC_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

interface GroupGpuInterconnect {
  enabled: boolean;
  fabric?: string;
}

/**
 * Reads a single group's interconnect opt-in from its on-chain placement requirements. Returns the pinned
 * fabric only when the base capability is present — an orphaned fabric pin (capability removed but a pin left
 * behind) is ignored, matching how the builder strips both together. Never throws on missing/malformed input.
 */
export function getGroupGpuInterconnect(group: DeploymentGroup | undefined | null): GroupGpuInterconnect {
  const attributes = group?.group_spec?.requirements?.attributes;
  if (!Array.isArray(attributes)) return { enabled: false };

  const enabled = attributes.some(attribute => attribute?.key === GPU_INTERCONNECT_CAPABILITY_KEY && attribute?.value === ENABLED_VALUE);
  if (!enabled) return { enabled: false };

  const fabricAttribute = attributes.find(attribute => attribute?.key?.startsWith(GPU_INTERCONNECT_FABRIC_PREFIX) && attribute?.value === ENABLED_VALUE);
  const fabric = fabricAttribute?.key.slice(GPU_INTERCONNECT_FABRIC_PREFIX.length) || undefined;

  return { enabled: true, fabric };
}

/**
 * Aggregates interconnect across all of a deployment's groups: enabled when any group opts in, with the
 * distinct set of pinned fabrics in first-seen order. Never throws — a missing or malformed group list yields
 * a disabled result so the deployment view stays intact.
 */
export function getDeclaredGpuInterconnect(groups: DeploymentGroup[] | undefined | null): DeclaredGpuInterconnect {
  let enabled = false;
  const fabrics = new Set<string>();

  if (Array.isArray(groups)) {
    for (const group of groups) {
      const { enabled: groupEnabled, fabric } = getGroupGpuInterconnect(group);
      if (groupEnabled) enabled = true;
      if (fabric) fabrics.add(fabric);
    }
  }

  return { enabled, fabrics: [...fabrics] };
}
