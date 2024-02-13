import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getAddressBalance } from "@src/services/external/apiNodeService";
import { isValidBech32Address } from "@src/utils/addresses";
import { openApiExampleAddress } from "@src/utils/constants";

const route = createRoute({
  method: "get",
  path: "/addresses/{address}",
  summary: "Get address details",
  tags: ["Addresses"],
  request: {
    params: z.object({
      address: z.string().openapi({
        description: "Account Address",
        example: openApiExampleAddress
      })
    })
  },
  responses: {
    200: {
      description: "Returns predicted block date",
      content: {
        "application/json": {
          schema: z.object({
            total: z.number(),
            delegations: z.array(
              z.object({
                validator: z.object({
                  address: z.string(),
                  moniker: z.string().optional(),
                  operatorAddress: z.string().nullable(),
                  avatarUrl: z.string().nullable()
                }),
                amount: z.number(),
                reward: z.number()
              })
            ),
            available: z.number(),
            delegated: z.number(),
            rewards: z.number(),
            assets: z.array(
              z.object({
                symbol: z.string(),
                ibcToken: z.string(),
                logoUrl: z.string().nullable(),
                description: z.string().nullable(),
                amount: z.number()
              })
            ),
            redelegations: z.array(
              z.object({
                srcAddress: z.object({
                  address: z.string(),
                  moniker: z.string().optional(),
                  operatorAddress: z.string().nullable(),
                  avatarUrl: z.string().nullable()
                }),
                dstAddress: z.object({
                  address: z.string(),
                  moniker: z.string().optional(),
                  operatorAddress: z.string().nullable(),
                  avatarUrl: z.string().nullable()
                }),
                creationHeight: z.number(),
                completionTime: z.string(), // TODO: check
                amount: z.number()
              })
            ),
            commission: z.number(),
            latestTransactions: z.array(
              z.object({
                height: z.number(),
                datetime: z.string(),
                hash: z.string(),
                isSuccess: z.boolean(),
                error: z.string().nullable(),
                gasUsed: z.number(),
                gasWanted: z.number(),
                fee: z.number(),
                memo: z.string().nullable(),
                isSigner: z.boolean(),
                messages: z.array(
                  z.object({
                    id: z.string(),
                    type: z.string(),
                    amount: z.number(),
                    isReceiver: z.boolean()
                  })
                )
              })
            )
          })
        }
      }
    },
    400: {
      description: "Invalid address"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  if (!isValidBech32Address(c.req.valid("param").address, "akash")) {
    return c.text("Invalid address", 400);
  }

  const balances = await getAddressBalance(c.req.valid("param").address);

  return c.json(balances);
});
