import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";
import { HardwareRequestController } from "../controllers/hardware-request/hardware-request.controller";
import {
  CreateHardwareRequestRequestSchema,
  CreateHardwareRequestResponseSchema,
  HardwareRequestIdParamsSchema,
  HardwareRequestOfferIdParamsSchema,
  HardwareRequestResponseSchema,
  ListHardwareRequestOffersResponseSchema,
  ListHardwareRequestsResponseSchema,
  TenantHardwareRequestOfferResponseSchema
} from "../http-schemas/hardware-request.schema";

export const hardwareRequestRouter = new OpenApiHonoHandler();

const createHardwareRequestRoute = createRoute({
  method: "post",
  operationId: "createHardwareRequest",
  path: "/v1/hardware-requests",
  summary: "Ask the Akash team for a GPU model, more capacity or a region that is not available yet",
  tags: ["Hardware Requests"],
  security: SECURITY_BEARER,
  bodyLimit: { maxSize: 16 * 1024 },
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateHardwareRequestRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "The request was recorded and the Akash team will follow up by email",
      content: {
        "application/json": {
          schema: CreateHardwareRequestResponseSchema
        }
      }
    },
    400: { description: "Invalid request body" },
    401: { description: "Unauthorized" },
    429: { description: "Too many requests sent recently" }
  }
});

hardwareRequestRouter.openapi(createHardwareRequestRoute, async function routeCreateHardwareRequest(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(HardwareRequestController).create(data);
  return c.json(result, 201);
});

const listHardwareRequestsRoute = createRoute({
  method: "get",
  operationId: "listHardwareRequests",
  path: "/v1/hardware-requests",
  summary: "List the GPU requests of the active organization, newest first",
  tags: ["Hardware Requests"],
  security: SECURITY_BEARER,
  responses: {
    200: {
      description: "The organization's requests with their status",
      content: {
        "application/json": {
          schema: ListHardwareRequestsResponseSchema
        }
      }
    },
    401: { description: "Unauthorized" }
  }
});

hardwareRequestRouter.openapi(listHardwareRequestsRoute, async function routeListHardwareRequests(c) {
  const result = await container.resolve(HardwareRequestController).list();
  return c.json(result, 200);
});

const listHardwareRequestOffersRoute = createRoute({
  method: "get",
  operationId: "listHardwareRequestOffers",
  path: "/v1/hardware-requests/{id}/offers",
  summary: "List the offers the Akash team published for a GPU request, oldest first",
  tags: ["Hardware Requests"],
  security: SECURITY_BEARER,
  request: { params: HardwareRequestIdParamsSchema },
  responses: {
    200: {
      description: "The request's offers, without the provider behind each",
      content: {
        "application/json": {
          schema: ListHardwareRequestOffersResponseSchema
        }
      }
    },
    401: { description: "Unauthorized" },
    404: { description: "No request the caller can read has this id" }
  }
});

hardwareRequestRouter.openapi(listHardwareRequestOffersRoute, async function routeListHardwareRequestOffers(c) {
  const result = await container.resolve(HardwareRequestController).listOffers(c.req.valid("param").id);
  return c.json(result, 200);
});

const withdrawHardwareRequestRoute = createRoute({
  method: "post",
  operationId: "withdrawHardwareRequest",
  path: "/v1/hardware-requests/{id}/withdraw",
  summary: "Withdraw a GPU request before an offer is accepted",
  description: "Open to the requester and to the organization's owners and admins. Withdrawing twice changes nothing.",
  tags: ["Hardware Requests"],
  security: SECURITY_BEARER,
  request: { params: HardwareRequestIdParamsSchema },
  responses: {
    200: {
      description: "The withdrawn request",
      content: {
        "application/json": {
          schema: HardwareRequestResponseSchema
        }
      }
    },
    401: { description: "Unauthorized" },
    403: { description: "The caller is neither the requester nor an owner or admin of the organization" },
    404: { description: "No request the caller can read has this id" },
    409: { description: "The request was already accepted, fulfilled or closed" }
  }
});

hardwareRequestRouter.openapi(withdrawHardwareRequestRoute, async function routeWithdrawHardwareRequest(c) {
  const result = await container.resolve(HardwareRequestController).withdraw(c.req.valid("param").id);
  return c.json(result, 200);
});

const acceptHardwareRequestOfferRoute = createRoute({
  method: "post",
  operationId: "acceptHardwareRequestOffer",
  path: "/v1/hardware-requests/{id}/offers/{offerId}/accept",
  summary: "Accept an offer for a GPU request",
  description: "Open to the organization's owners and admins. Closes the request's other offers and tells the Akash team, who set up the capacity.",
  tags: ["Hardware Requests"],
  security: SECURITY_BEARER,
  request: { params: HardwareRequestOfferIdParamsSchema },
  responses: {
    200: { description: "The offer after the decision", content: { "application/json": { schema: TenantHardwareRequestOfferResponseSchema } } },
    401: { description: "Unauthorized" },
    403: { description: "The caller is not an owner or admin of the organization" },
    404: { description: "No request the caller can read, or no offer on it, has this id" },
    409: { description: "The offer is not open, has expired, or the request is already settled" }
  }
});

hardwareRequestRouter.openapi(acceptHardwareRequestOfferRoute, async function routeAcceptHardwareRequestOffer(c) {
  const { id, offerId } = c.req.valid("param");
  const result = await container.resolve(HardwareRequestController).acceptOffer(id, offerId);
  return c.json(result, 200);
});

const declineHardwareRequestOfferRoute = createRoute({
  method: "post",
  operationId: "declineHardwareRequestOffer",
  path: "/v1/hardware-requests/{id}/offers/{offerId}/decline",
  summary: "Decline an offer for a GPU request",
  description: "Open to the requester and to the organization's owners and admins. Declining twice changes nothing.",
  tags: ["Hardware Requests"],
  security: SECURITY_BEARER,
  request: { params: HardwareRequestOfferIdParamsSchema },
  responses: {
    200: { description: "The offer after the decision", content: { "application/json": { schema: TenantHardwareRequestOfferResponseSchema } } },
    401: { description: "Unauthorized" },
    403: { description: "The caller is neither the requester nor an owner or admin of the organization" },
    404: { description: "No request the caller can read, or no offer on it, has this id" },
    409: { description: "The offer was already accepted or closed, or the request is already settled" }
  }
});

hardwareRequestRouter.openapi(declineHardwareRequestOfferRoute, async function routeDeclineHardwareRequestOffer(c) {
  const { id, offerId } = c.req.valid("param");
  const result = await container.resolve(HardwareRequestController).declineOffer(id, offerId);
  return c.json(result, 200);
});
