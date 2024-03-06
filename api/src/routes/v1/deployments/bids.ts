import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getDeploymentWonBids } from "@src/services/db/deploymentService";
import { isValidBech32Address } from "@src/utils/addresses";
import { openApiExampleAddress } from "@src/utils/constants";
import { uint8arrayToString } from "@src/utils/protobuf";

const route = createRoute({
  method: "get",
  path: "/deployment/{owner}/{dseq}/bids",
  summary: "Get deployment bids",
  tags: ["Deployments"],
  request: {
    params: z.object({
      owner: z.string().openapi({
        description: "Owner's Address",
        example: openApiExampleAddress
      }),
      dseq: z.string().optional().openapi({
        description: "Deployment DSEQ",
        example: "1000000"
      })
    })
  },
  responses: {
    200: {
      description: "Returns deployment details",
      content: {
        "application/json": {
          schema: z.object({
            owner: z.string(),
            dseq: z.string(),
            balance: z.number(),
            denom: z.string(),
            status: z.string(),
            totalMonthlyCostUDenom: z.number(),
            leases: z.array(
              z.object({
                gseq: z.number(),
                oseq: z.number(),
                provider: z.object({
                  address: z.string(),
                  hostUri: z.string(),
                  isDeleted: z.boolean(),
                  attributes: z.array(
                    z.object({
                      key: z.string(),
                      value: z.string()
                    })
                  )
                }),
                status: z.string(),
                monthlyCostUDenom: z.number(),
                cpuUnits: z.number(),
                gpuUnits: z.number(),
                memoryQuantity: z.number(),
                storageQuantity: z.number()
              })
            ),
            events: z.array(z.object({})), // TODO
            other: z.object({}) // TODO
          })
        }
      }
    },
    400: {
      description: "Invalid address or dseq"
    },
    404: {
      description: "Deployment not found"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  if (isNaN(parseInt(c.req.valid("param").dseq))) {
    return c.text("Invalid dseq.", 400);
  }

  if (!isValidBech32Address(c.req.valid("param").owner, "akash")) {
    return c.text("Invalid address", 400);
  }

  const bids = await getDeploymentWonBids(c.req.valid("param").owner, c.req.valid("param").dseq);

  return c.json(
    bids.map((bid) => ({
      owner: bid.order.owner,
      dseq: bid.order.dseq.toNumber(),
      gseq: bid.order.gseq,
      oseq: bid.order.oseq,
      provider: bid.provider,
      price: {
        denom: bid.price.denom,
        amount: bid.price.amount
      },
      resources:
        "resourcesOffer" in bid
          ? bid.resourcesOffer.map((x) => ({
              count: x.count,
              cpu: {
                units: parseInt(uint8arrayToString(x.resources.cpu.units.val)),
                attributes: x.resources.cpu.attributes.map((a) => ({ key: a.key, value: a.value }))
              },
              memory: {
                quantity: parseInt(uint8arrayToString(x.resources.memory.quantity.val)),
                attributes: x.resources.memory.attributes.map((a) => ({ key: a.key, value: a.value }))
              },
              storage: x.resources.storage.map((s) => ({
                quantity: parseInt(uint8arrayToString(s.quantity.val)),
                attributes: s.attributes.map((a) => ({ key: a.key, value: a.value }))
              })),
              gpu: {
                units: parseInt(uint8arrayToString(x.resources.gpu.units.val)),
                attributes: x.resources.gpu.attributes.map((a) => ({ key: a.key, value: a.value }))
              }
            }))
          : []
    }))
  );
});
