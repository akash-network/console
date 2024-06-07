import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { round } from "@src/utils/math";
import { getAkashPricing, getAWSPricing, getAzurePricing, getGCPPricing } from "@src/utils/pricing";

const specsType = z.object({
  cpu: z.number().openapi({ description: "CPU in tousandths of a core. 1000 = 1 core", example: 1000 }),
  memory: z.number().openapi({ description: "Memory in bytes", type: "number", example: 1000000000 }),
  storage: z.number().openapi({ description: "Storage in bytes", type: "number", example: 1000000000 })
});

const estimationType = z.object({
  specs: specsType,
  akash: z.number().openapi({ description: "Akash price estimation (USD/month)" }),
  aws: z.number().openapi({ description: "AWS price estimation (USD/month)" }),
  gcp: z.number().openapi({ description: "GCP price estimation (USD/month)" }),
  azure: z.number().openapi({ description: "Azure price estimation (USD/month)" })
});

const route = createRoute({
  method: "post",
  path: "/pricing",
  tags: ["Other"],
  summary: "Estimate the price of a deployment on akash and other cloud providers.",
  request: {
    body: {
      description:
        "Deployment specs to use for the price estimation. **An array of specs can also be sent, in that case an array of estimations will be returned in the same order.**",
      content: {
        "application/json": {
          schema: specsType.or(z.array(specsType))
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a list of deployment templates grouped by cateogories",
      content: {
        "application/json": {
          schema: estimationType.or(z.array(estimationType))
        }
      }
    },
    400: {
      description: "Invalid parameters"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const body = await c.req.json();
  const isArray = Array.isArray(body);
  const specs = isArray ? body : [body];

  const pricing = [];

  for (const spec of specs) {
    const cpu = parseInt(spec.cpu);
    const memory = parseInt(spec.memory);
    const storage = parseInt(spec.storage);

    if (isNaN(cpu) || isNaN(memory) || isNaN(storage)) {
      return c.text("Invalid parameters.", 400);
    }

    const akashPricing = getAkashPricing(cpu, memory, storage);
    const awsPricing = getAWSPricing(cpu, memory, storage);
    const gcpPricing = getGCPPricing(cpu, memory, storage);
    const azurePricing = getAzurePricing(cpu, memory, storage);

    pricing.push({
      spec: spec,
      akash: round(akashPricing, 2),
      aws: round(awsPricing, 2),
      gcp: round(gcpPricing, 2),
      azure: round(azurePricing, 2)
    });
  }

  return c.json(isArray ? pricing : pricing[0]);
});
