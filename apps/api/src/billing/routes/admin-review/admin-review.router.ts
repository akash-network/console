import { OpenAPIHono, z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { ReviewTrialService } from "@src/billing/services/review-trial/review-trial.service";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

const approveRoute = createRoute({
  method: "post",
  path: "/admin/review-trials/{walletId}/approve",
  summary: "Approve a review trial",
  security: SECURITY_NONE,
  request: {
    params: z.object({
      walletId: z.coerce.number()
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            reason: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Wallet approved",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({})
          })
        }
      }
    }
  }
});

const rejectRoute = createRoute({
  method: "post",
  path: "/admin/review-trials/{walletId}/reject",
  summary: "Reject a review trial",
  security: SECURITY_NONE,
  request: {
    params: z.object({
      walletId: z.coerce.number()
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            reason: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Wallet rejected",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({})
          })
        }
      }
    }
  }
});

export const adminReviewRouter = new OpenAPIHono();

adminReviewRouter.openapi(approveRoute, async c => {
  const { walletId } = c.req.valid("param");
  const body = c.req.valid("json");
  const reviewTrialService = container.resolve(ReviewTrialService);
  const result = await reviewTrialService.approve(walletId, body.reason);
  return c.json({ data: result });
});

adminReviewRouter.openapi(rejectRoute, async c => {
  const { walletId } = c.req.valid("param");
  const body = c.req.valid("json");
  const reviewTrialService = container.resolve(ReviewTrialService);
  const result = await reviewTrialService.reject(walletId, body.reason);
  return c.json({ data: result });
});
