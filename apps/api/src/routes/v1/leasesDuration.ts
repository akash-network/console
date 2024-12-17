import { Block } from "@akashnetwork/database/dbSchemas";
import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { differenceInSeconds } from "date-fns";
import { Op } from "sequelize";

import { openApiExampleAddress } from "@src/utils/constants";

const route = createRoute({
  method: "get",
  path: "/leases-duration/{owner}",
  summary: "Get leases durations.",
  request: {
    params: z.object({
      owner: z.string().openapi({ example: openApiExampleAddress })
    }),
    query: z.object({
      dseq: z.string().regex(/^\d+$/, "Invalid dseq, must be a positive integer").optional().openapi({ type: "integer" }),
      startDate: z.string().optional().openapi({ format: "YYYY-MM-DD" }),
      endDate: z.string().optional().openapi({ format: "YYYY-MM-DD" })
    })
  },
  responses: {
    200: {
      description: "List of leases durations and total duration.",
      content: {
        "application/json": {
          schema: z.object({
            leaseCount: z.number(),
            totalDurationInSeconds: z.number(),
            totalDurationInHours: z.number(),
            leases: z.array(
              z.object({
                dseq: z.number(),
                oseq: z.number(),
                gseq: z.number(),
                provider: z.string(),
                startHeight: z.number(),
                startDate: z.string(),
                closedHeight: z.number(),
                closedDate: z.string(),
                durationInBlocks: z.number(),
                durationInSeconds: z.number(),
                durationInHours: z.number()
              })
            )
          })
        }
      }
    },
    400: {
      description: "Invalid start date, must be in the following format: YYYY-MM-DD"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

  let startTime: Date = new Date("2000-01-01");
  let endTime: Date = new Date("2100-01-01");

  const { dseq, startDate, endDate } = c.req.query();

  if (startDate) {
    if (!startDate.match(dateFormat)) return c.text("Invalid start date, must be in the following format: YYYY-MM-DD", 400);

    const startMs = Date.parse(startDate);

    if (isNaN(startMs)) return c.text("Invalid start date", 400);

    startTime = new Date(startMs);
  }

  if (endDate) {
    if (!endDate.match(dateFormat)) return c.text("Invalid end date, must be in the following format: YYYY-MM-DD", 400);

    const endMs = Date.parse(endDate);

    if (isNaN(endMs)) return c.text("Invalid end date", 400);

    endTime = new Date(endMs);
  }

  if (endTime <= startTime) {
    return c.text("End time must be greater than start time", 400);
  }

  const closedLeases = await Lease.findAll({
    where: {
      owner: c.req.param("owner"),
      closedHeight: { [Op.not]: null },
      "$closedBlock.datetime$": { [Op.gte]: startTime, [Op.lte]: endTime },
      ...(dseq ? { dseq: dseq } : {})
    },
    include: [
      { model: Block, as: "createdBlock" },
      { model: Block, as: "closedBlock" }
    ]
  });

  const leases = closedLeases.map(x => ({
    dseq: x.dseq,
    oseq: x.oseq,
    gseq: x.gseq,
    provider: x.providerAddress,
    startHeight: x.createdHeight,
    startDate: x.createdBlock.datetime,
    closedHeight: x.closedHeight,
    closedDate: x.closedBlock.datetime,
    durationInBlocks: x.closedHeight - x.createdHeight,
    durationInSeconds: differenceInSeconds(x.closedBlock.datetime, x.createdBlock.datetime),
    durationInHours: differenceInSeconds(x.closedBlock.datetime, x.createdBlock.datetime) / 3600
  }));

  const totalSeconds = leases.map(x => x.durationInSeconds).reduce((a, b) => a + b, 0);

  return c.json({
    leaseCount: leases.length,
    totalDurationInSeconds: totalSeconds,
    totalDurationInHours: totalSeconds / 3600,
    leases
  });
});
