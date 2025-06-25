import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Env } from "hono";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import type { AppEnv } from "@src/core/types/app-context";
import { GpuController } from "@src/gpu/controllers/gpu.controller";
import {
  GpuBreakdownQuerySchema,
  GpuBreakdownResponseSchema,
  GpuPricesResponseSchema,
  ListGpuModelsResponseSchema,
  ListGpuQuerySchema,
  ListGpuResponseSchema
} from "@src/gpu/http-schemas/gpu.schema";
import { isValidBech32Address } from "@src/utils/addresses";

export const gpuRouter = new OpenApiHonoHandler();

const listGpusRoute = createRoute({
  method: "get",
  path: "/v1/gpu",
  summary: "Get a list of gpu models and their availability.",
  tags: ["Gpu"],
  request: {
    query: ListGpuQuerySchema
  },
  responses: {
    200: {
      description: "List of gpu models and their availability.",
      content: {
        "application/json": {
          schema: ListGpuResponseSchema
        }
      }
    },
    400: {
      description: "Invalid provider parameter, should be a valid akash address or host uri"
    }
  }
});
const handleListGpus = async <E extends Env>(
  c: Context<
    E,
    "/v1/gpu",
    {
      in: {
        query: {
          provider?: string;
          vendor?: string;
          model?: string;
          memory_size?: string;
        };
      };
      out: {
        query: {
          provider?: string;
          vendor?: string;
          model?: string;
          memory_size?: string;
        };
      };
    }
  >
) => {
  const { provider, vendor, model, memory_size } = c.req.valid("query");

  let providerAddress: string | undefined = undefined;
  let providerHostUri: string | undefined = undefined;
  if (provider) {
    if (isValidBech32Address(provider)) {
      providerAddress = provider;
    } else if (URL.canParse(provider)) {
      providerHostUri = provider;
    } else {
      return c.json({ error: "Invalid provider parameter, should be a valid akash address or host uri" }, 400);
    }
  }

  const blocks = await container.resolve(GpuController).getGpuList({ providerAddress, providerHostUri, vendor, model, memorySize: memory_size });

  return c.json(blocks);
};
gpuRouter.openapi(listGpusRoute, handleListGpus<AppEnv>);
export const listGpusInternalRouter = new OpenAPIHono().openapi(listGpusRoute, handleListGpus<Env>);

const listGpuModelsRoute = createRoute({
  method: "get",
  path: "/v1/gpu-models",
  summary:
    "Get a list of gpu models per vendor. Based on the content from https://raw.githubusercontent.com/akash-network/provider-configs/main/devices/pcie/gpus.json.",
  tags: ["Gpu"],
  responses: {
    200: {
      description: "List of gpu models per.",
      content: {
        "application/json": {
          schema: ListGpuModelsResponseSchema
        }
      }
    }
  }
});
const handleListGpuModels = async <E extends Env>(
  c: Context<
    E,
    "/v1/gpu-models",
    {
      in: {
        query: never;
      };
      out: {
        query: never;
      };
    }
  >
) => {
  const gpuModels = await container.resolve(GpuController).getGpuModels();

  return c.json(gpuModels, 200);
};
gpuRouter.openapi(listGpuModelsRoute, handleListGpuModels<AppEnv>);
export const listGpuModelsInternalRouter = new OpenAPIHono().openapi(listGpuModelsRoute, handleListGpuModels<Env>);

const gpuBreakdownRoute = createRoute({
  method: "get",
  path: "/v1/gpu-breakdown",
  tags: ["Gpu"],
  summary: "Gets gpu analytics breakdown by vendor and model. If no vendor or model is provided, all GPUs are returned.",
  request: {
    query: GpuBreakdownQuerySchema
  },
  responses: {
    200: {
      description: "Gets gpu analytics breakdown by vendor and model. If no vendor or model is provided, all GPUs are returned.",
      content: {
        "application/json": {
          schema: GpuBreakdownResponseSchema
        }
      }
    }
  }
});
gpuRouter.openapi(gpuBreakdownRoute, async function routeGpuBreakdown(c) {
  const query = c.req.valid("query");
  const gpuBreakdown = await container.resolve(GpuController).getGpuBreakdown(query);

  return c.json(gpuBreakdown, 200);
});

const getGpuPricesRoute = createRoute({
  method: "get",
  path: "/v1/gpu-prices",
  summary: "Get a list of gpu models with their availability and pricing.",
  tags: ["Gpu"],
  responses: {
    200: {
      description: "List of gpu models with their availability and pricing.",
      content: {
        "application/json": {
          schema: GpuPricesResponseSchema
        }
      }
    }
  }
});
const handleGetGpuPrices = async <E extends Env>(
  c: Context<
    E,
    "/v1/gpu-prices",
    {
      in: {
        query: never;
      };
      out: {
        query: never;
      };
    }
  >
) => {
  const debug = c.req.query("debug") === "true";
  const gpuPrices = await container.resolve(GpuController).getGpuPrices(debug);
  return c.json(gpuPrices, 200);
};
gpuRouter.openapi(getGpuPricesRoute, handleGetGpuPrices<AppEnv>);
export const getGpuPricesInternalRouter = new OpenAPIHono().openapi(getGpuPricesRoute, handleGetGpuPrices<Env>);
