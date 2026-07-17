import { HonoAdapter } from "@x402/hono";
import { container } from "tsyringe";

import { X402Controller } from "@src/billing/controllers/x402/x402.controller";
import {
  X402DeployFailedResponseSchema,
  X402DeployRequestSchema,
  X402DeployResponseSchema,
  X402DiscoveryResponseSchema,
  X402PaymentRequiredResponseSchema,
  X402TopUpQuerySchema,
  X402TopUpResponseSchema,
  X402TransactionListQuerySchema,
  X402TransactionListResponseSchema
} from "@src/billing/http-schemas/x402.schema";
import { X402_ERROR_CODES } from "@src/billing/services/x402/x402-error-codes";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

export const x402Router = new OpenApiHonoHandler();

const topUpRoute = createRoute({
  method: "post",
  operationId: "createUsdcTopUp",
  path: "/v1/x402/top-up",
  summary: "Top up Console credits with a USDC payment (x402)",
  description:
    "Pay-per-request wallet top-up using the x402 payment protocol. " +
    "Call without an X-PAYMENT header to receive a 402 response describing the accepted payment (network, asset, amount, payTo). " +
    "Retry with a signed X-PAYMENT header to settle the payment on-chain and credit your Console balance. " +
    "The amount query parameter is the top-up size in USD.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    query: X402TopUpQuerySchema
  },
  responses: {
    200: {
      description: "Payment settled and Console balance credited",
      content: {
        "application/json": {
          schema: X402TopUpResponseSchema
        }
      }
    },
    402: {
      description: "Payment required or payment invalid/failed to settle",
      content: {
        "application/json": {
          schema: X402PaymentRequiredResponseSchema
        }
      }
    },
    409: {
      description: "Payment already used for a previous top-up"
    }
  }
});
x402Router.openapi(topUpRoute, async function x402TopUp(c) {
  const { amount } = c.req.valid("query");
  const adapter = new HonoAdapter(c);
  const result = await container.resolve(X402Controller).topUp(
    {
      adapter,
      path: c.req.path,
      method: c.req.method,
      paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment")
    },
    amount
  );

  switch (result.type) {
    case "payment-required":
    case "payment-rejected": {
      Object.entries(result.response.headers).forEach(([key, value]) => c.header(key, value));
      if (result.response.isHtml) {
        return c.html(String(result.response.body ?? ""), result.response.status as 402);
      }
      const body = result.response.body && typeof result.response.body === "object" ? result.response.body : {};
      // Surface a stable machine-readable code alongside the x402 SDK's payment-required body.
      return c.json({ ...body, code: result.code }, result.response.status as 402);
    }
    case "duplicate-payment":
      return c.json(
        {
          error: "Conflict",
          code: X402_ERROR_CODES.DUPLICATE_PAYMENT,
          message: "This payment was already used for a top-up",
          transactionId: result.transactionId
        },
        409
      );
    case "success": {
      Object.entries(result.headers).forEach(([key, value]) => c.header(key, value));
      return c.json({ data: result.data }, 200);
    }
  }
});

const deployRoute = createRoute({
  method: "post",
  operationId: "createUsdcDeployment",
  path: "/v1/x402/deploy",
  summary: "Create and fund an Akash deployment with a single USDC payment (x402)",
  description:
    "Pay-per-deploy: one x402-paid call settles USDC, credits your Console balance, and creates a funded deployment — no prior balance required. " +
    "Call without an X-PAYMENT header (but with the sdl + deposit body) to receive a 402 describing the accepted payment. " +
    "Retry with a signed X-PAYMENT header to settle on-chain, credit your balance, and create the deployment. " +
    "If settlement succeeds but deployment creation fails, the funds stay in your Console balance and a 502 with code DEPLOY_FAILED_FUNDS_CREDITED is returned.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: X402DeployRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Payment settled, Console balance credited, and deployment created",
      content: {
        "application/json": {
          schema: X402DeployResponseSchema
        }
      }
    },
    402: {
      description: "Payment required, payment invalid/failed to settle, or per-user cost ceiling exceeded",
      content: {
        "application/json": {
          schema: X402PaymentRequiredResponseSchema
        }
      }
    },
    409: {
      description: "Payment already used for a previous deployment"
    },
    429: {
      description: "Per-user rate limit exceeded for x402-paid requests"
    },
    502: {
      description: "Payment settled and balance credited, but deployment creation failed (funds remain spendable)",
      content: {
        "application/json": {
          schema: X402DeployFailedResponseSchema
        }
      }
    }
  }
});

const listTransactionsRoute = createRoute({
  method: "get",
  operationId: "listUsdcTopUps",
  path: "/v1/x402/transactions",
  summary: "List your x402 USDC top-up transactions",
  description:
    "Returns the authenticated caller's x402 top-up history, newest first. " +
    "Each row exposes the transaction status, credited amount, network, settlement transaction hash and creation time. " +
    "Only the caller's own transactions are ever returned.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    query: X402TransactionListQuerySchema
  },
  responses: {
    200: {
      description: "Paginated list of the caller's x402 top-up transactions",
      content: {
        "application/json": {
          schema: X402TransactionListResponseSchema
        }
      }
    }
  }
});
x402Router.openapi(deployRoute, async function x402Deploy(c) {
  const body = c.req.valid("json");
  const adapter = new HonoAdapter(c);
  const result = await container.resolve(X402Controller).deploy(
    {
      adapter,
      path: c.req.path,
      method: c.req.method,
      paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment")
    },
    { sdl: body.sdl, deposit: body.deposit }
  );

  switch (result.type) {
    case "payment-required":
    case "payment-rejected": {
      Object.entries(result.response.headers).forEach(([key, value]) => c.header(key, value));
      if (result.response.isHtml) {
        return c.html(String(result.response.body ?? ""), result.response.status as 402);
      }
      const body = result.response.body && typeof result.response.body === "object" ? result.response.body : {};
      // Surface a stable machine-readable code alongside the x402 SDK's payment-required body.
      return c.json({ ...body, code: result.code }, result.response.status as 402);
    }
    case "cost-ceiling-exceeded":
      return c.json({ error: "Payment Required", message: "x402 cost ceiling exceeded for this user", ceilingUsdCents: result.ceilingUsdCents }, 402);
    case "rate-limited":
      c.header("Retry-After", String(result.retryAfterSeconds));
      return c.json({ error: "Too Many Requests", message: "x402 rate limit exceeded for this user" }, 429);
    case "duplicate-payment":
      return c.json(
        {
          error: "Conflict",
          code: X402_ERROR_CODES.DUPLICATE_PAYMENT,
          message: "This payment was already used for a deployment",
          transactionId: result.transactionId
        },
        409
      );
    case "deploy-failed": {
      Object.entries(result.headers).forEach(([key, value]) => c.header(key, value));
      return c.json(
        {
          error: "Bad Gateway",
          code: "DEPLOY_FAILED_FUNDS_CREDITED" as const,
          message:
            "Your payment settled and your Console balance was credited, but the deployment could not be created. " +
            "The funds remain in your Console balance; retry deployment via POST /v1/deployments.",
          transactionId: result.transactionId,
          amountUsdCents: result.amountUsdCents,
          settlementTxHash: result.settlementTxHash
        },
        502
      );
    }
    case "success": {
      Object.entries(result.headers).forEach(([key, value]) => c.header(key, value));
      return c.json({ data: result.data }, 200);
    }
  }
});

x402Router.openapi(listTransactionsRoute, async function x402ListTransactions(c) {
  const query = c.req.valid("query");
  const response = await container.resolve(X402Controller).listTransactions(query);
  return c.json(response, 200);
});

const discoveryRoute = createRoute({
  method: "get",
  operationId: "listPayableResources",
  path: "/v1/x402/discovery",
  summary: "Discover x402 payable resources and their accepted payments",
  description:
    "Public discovery document listing every x402-protected resource and the payments it accepts " +
    "(route, scheme, network, asset/amount bounds, payTo). Mirrors the accepts returned in a 402 response, " +
    "derived from the same canonical source, so agents can plan a payment without first triggering a 402.",
  tags: ["Payment"],
  security: SECURITY_NONE,
  request: {},
  responses: {
    200: {
      description: "The x402 discovery document",
      content: {
        "application/json": {
          schema: X402DiscoveryResponseSchema
        }
      }
    },
    404: {
      description: "x402 payments are not enabled"
    }
  }
});
x402Router.openapi(discoveryRoute, async function x402Discovery(c) {
  const result = container.resolve(X402Controller).getDiscovery();
  return c.json(result, 200);
});
