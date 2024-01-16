import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { getPredictedDateHeight } from "@src/db/blocksProvider";
import { z } from "zod";

const defaultBlockWindow = 10_000;

const route = createRoute({
  method: "get",
  path: "/predicted-date-height/{timestamp}",
  summary: "Get the estimated height of a future date and time.",
  tags: ["Blocks"],
  request: {
    params: z.object({
      timestamp: z.string().openapi({ type: "number", description: "Unix Timestamp", example: "1704392968" })
    }),
    query: z.object({
      blockWindow: z.string().optional().openapi({
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
            predictedHeight: z.number().openapi({ example: 10_000_000 }),
            date: z.string().openapi({ example: "2024-01-04T18:29:28.000Z" }),
            blockWindow: z.number().openapi({ example: defaultBlockWindow })
          })
        }
      }
    },
    400: {
      description: "Invalid timestamp or block window",
      content: {
        "application/json": {
          schema: z.object({
            param: z.string().openapi({
              example: "timestamp"
            }),
            error: z.string().openapi({
              example: "Invalid timestamp."
            })
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const timestamp = parseInt(c.req.param("timestamp"));
  const blockWindow = c.req.valid("query").blockWindow ? parseInt(c.req.valid("query").blockWindow) : defaultBlockWindow;

  if (isNaN(timestamp)) {
    return c.json({ param: "timestamp", error: "Invalid timestamp." }, 400);
  }

  if (isNaN(blockWindow)) {
    return c.json({ param: "blockWindow", error: "Invalid block window." }, 400);
  }

  const date = new Date(timestamp * 1000);
  const height = await getPredictedDateHeight(date, blockWindow);

  return c.json({
    predictedHeight: height,
    date: date,
    blockWindow: blockWindow
  });
});
