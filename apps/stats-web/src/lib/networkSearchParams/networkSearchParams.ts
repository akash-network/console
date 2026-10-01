import { z } from "zod";

import { networkId } from "@/config/env-config.schema";

export function createNetworkSearchParamsSchema(defaultNetworkId: z.infer<typeof networkId>) {
  return z.object({
    network: networkId.default(defaultNetworkId)
  });
}
