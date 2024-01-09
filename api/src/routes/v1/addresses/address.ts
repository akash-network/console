import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getAddressBalance } from "@src/providers/apiNodeProvider";
import { isValidBech32Address } from "@src/utils/addresses";

const route = createRoute({
  method: "get",
  path: "/addresses/{address}",
  request: {
    params: z.object({
      address: z.string().openapi({
        param: { name: "address", in: "path" },
        description: "Wallet Address",
        example: "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm"
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
                // TODO
                //   property) results: {
                //     height: number;
                //     datetime: Date;
                //     hash: string;
                //     isSuccess: boolean;
                //     error: string;
                //     gasUsed: number;
                //     gasWanted: number;
                //     fee: number;
                //     memo: string;
                //     isSigner: boolean;
                //     messages: {
                //         id: string;
                //         type: string;
                //         amount: number;
                //         isReceiver: boolean;
                //     }[];
                // }[]
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
