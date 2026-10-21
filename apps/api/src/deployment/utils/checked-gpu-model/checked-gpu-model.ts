import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import uniqBy from "lodash/uniqBy";

import type { CheckedGpuModel } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { extractRequestedGpusFromGroupSpecs } from "@src/deployment/utils/blocked-gpu/blocked-gpu";

/** Only a group pinned to one gpu model tells which model a silent provider passed on. */
export function findCheckedGpuModel(groupSpec: GroupSpec): CheckedGpuModel | null {
  const models = uniqBy(extractRequestedGpusFromGroupSpecs([groupSpec]), ({ vendor, model }) => `${vendor}/${model}`);

  return models.length === 1 && !models[0].model.includes("*") ? models[0] : null;
}
