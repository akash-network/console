import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import axios from "axios";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import type { GpuVendor, ProviderConfigGpusType } from "@src/types/gpu";
import { getGpuInterface } from "@src/utils/gpu";

const route = createRoute({
  method: "get",
  path: "/gpu-models",
  summary:
    "Get a list of gpu models per vendor. Based on the content from https://raw.githubusercontent.com/akash-network/provider-configs/main/devices/pcie/gpus.json.",
  tags: ["Gpu"],
  responses: {
    200: {
      description: "List of gpu models per.",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              name: z.string(),
              models: z.array(
                z.object({
                  name: z.string(),
                  memory: z.array(z.string()),
                  interface: z.array(z.string())
                })
              )
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const response = await cacheResponse(60 * 2, cacheKeys.getGpuModels, async () => {
    const res = await axios.get<ProviderConfigGpusType>("https://raw.githubusercontent.com/akash-network/provider-configs/main/devices/pcie/gpus.json");
    return res.data;
  });

  const gpuModels: GpuVendor[] = [];

  // Loop over vendors
  for (const [, vendorValue] of Object.entries(response)) {
    const vendor: GpuVendor = {
      name: vendorValue.name,
      models: []
    };

    // Loop over models
    for (const [, modelValue] of Object.entries(vendorValue.devices)) {
      const _modelValue = modelValue as {
        name: string;
        memory_size: string;
        interface: string;
      };
      const existingModel = vendor.models.find(x => x.name === _modelValue.name);

      if (existingModel) {
        if (!existingModel.memory.includes(_modelValue.memory_size)) {
          existingModel.memory.push(_modelValue.memory_size);
        }
        if (!existingModel.interface.includes(getGpuInterface(_modelValue.interface))) {
          existingModel.interface.push(getGpuInterface(_modelValue.interface));
        }
      } else {
        vendor.models.push({
          name: _modelValue.name,
          memory: [_modelValue.memory_size],
          interface: [getGpuInterface(_modelValue.interface)]
        });
      }
    }

    gpuModels.push(vendor);
  }

  return c.json(gpuModels);
});
