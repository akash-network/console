import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getProposal } from "@src/services/external/apiNodeService";

const route = createRoute({
  method: "get",
  path: "/proposals/{id}",
  tags: ["Proposals"],
  request: {
    params: z.object({
      id: z.string().openapi({
        description: "Proposal ID",
        example: "1"
      })
    })
  },
  responses: {
    200: {
      description: "Return a proposal by id",
      content: {
        "application/json": {
          schema: z.object({
            id: z.number(),
            title: z.string(),
            description: z.string(),
            status: z.string(),
            submitTime: z.string(),
            votingStartTime: z.string(),
            votingEndTime: z.string(),
            totalDeposit: z.number(),
            proposer: z.string().nullable(),
            tally: z.object({
              yes: z.string(),
              abstain: z.string(),
              no: z.string(),
              noWithVeto: z.string()
            }),
            paramChanges: z.array(
              z.object({
                subspace: z.string(),
                key: z.string(),
                value: z.string()
              })
            )
          })
        }
      }
    },
    400: {
      description: "Invalid proposal id"
    },
    404: {
      description: "Proposal not found"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const proposalId = parseInt(c.req.valid("param").id);

  if (isNaN(proposalId)) {
    return c.text("Invalid proposal id.", 400);
  }

  const proposal = await getProposal(proposalId); // TODO improve typing

  if (!proposal) {
    return c.text("Proposal not found", 404);
  }

  return c.json(proposal);
});
