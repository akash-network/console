import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { getPredictedBlockDate } from "@src/db/blocksProvider";
import { z } from "zod";

const defaultBlockWindow = 10_000;

const route = createRoute({
  method: "get",
  path: "/predicted-block-date/{height}",
  request: {
    params: z.object({
      height: z.string().openapi({ param: { name: "height", in: "path" }, type: "number", description: "Block height", example: "20000000" })
    }),
    query: z.object({
      blockWindow: z
        .string()
        .optional()
        .openapi({
          param: { name: "blockWindow", in: "query" },
          description: "Block window",
          example: defaultBlockWindow.toString(),
          default: defaultBlockWindow.toString()
        })
    })
  },
  responses: {
    200: {
      description: "Returns predicted block date",
      content: {
        "application/json": {
          schema: z.object({
            predictedDate: z.string(),
            height: z.number().openapi({ example: 10_000_000 }),
            blockWindow: z.number().openapi({ example: defaultBlockWindow })
          })
        }
      }
    },
    400: {
      description: "Invalid height or block window",
      content: {
        "application/json": {
          schema: z.object({
            param: z.string().openapi({
              example: "height"
            }),
            error: z.string().openapi({
              example: "Invalid height."
            })
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const height = parseInt(c.req.valid("param").height);
  const blockWindow = c.req.valid("query").blockWindow ? parseInt(c.req.valid("query").blockWindow) : defaultBlockWindow;

  if (isNaN(height)) {
    return c.json({ param: "height", error: "Invalid height." }, 400);
  }

  if (isNaN(blockWindow)) {
    return c.json({ param: "blockWindow", error: "Invalid block window." }, 400);
  }

  const date = await getPredictedBlockDate(height, blockWindow);

  return c.json({
    predictedDate: date,
    height: height,
    blockWindow: blockWindow
  });
});
