import { container } from "tsyringe";

import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProposalController } from "@src/proposal/controllers/proposal/proposal.controller";
import { GetProposalByIdParamsSchema, GetProposalByIdResponseSchema, GetProposalListResponseSchema } from "@src/proposal/http-schemas/proposal.schema";

export const proposalsRouter = new OpenApiHonoHandler();

const getProposalsRoute = createRoute({
  method: "get",
  path: "/v1/proposals",
  tags: ["Proposals"],
  security: SECURITY_NONE,
  responses: {
    200: {
      description: "Returns a list of proposals",
      content: {
        "application/json": {
          schema: GetProposalListResponseSchema
        }
      }
    }
  }
});
proposalsRouter.openapi(getProposalsRoute, async function routeGetProposalList(c) {
  const proposals = await container.resolve(ProposalController).getProposals();

  return c.json(proposals);
});

const getProposalByIdRoute = createRoute({
  method: "get",
  path: "/v1/proposals/{id}",
  tags: ["Proposals"],
  security: SECURITY_NONE,
  request: {
    params: GetProposalByIdParamsSchema
  },
  responses: {
    200: {
      description: "Return a proposal by id",
      content: {
        "application/json": {
          schema: GetProposalByIdResponseSchema
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
proposalsRouter.openapi(getProposalByIdRoute, async function routeGetProposalById(c) {
  const { id } = c.req.valid("param");
  const proposal = await container.resolve(ProposalController).getProposalById(id);
  if (proposal) {
    return c.json(proposal);
  } else {
    return c.text("Proposal not found", 404);
  }
});
