import type { LoggerService } from "@akashnetwork/logging";
import { mock } from "jest-mock-extended";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { services } from "@src/services/http/http-server.service";
import type { NextApiRequestWithServices } from "./defineApiHandler";
import { defineApiHandler, REQ_SERVICES_KEY } from "./defineApiHandler";

describe("defineApiHandler", () => {
  it("creates a handler that calls the provided handler function", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const req = createRequest({
      query: { a: "1" },
      body: { b: "2" }
    });
    const res = mock<NextApiResponse>();
    await setup({
      context: {
        req,
        res
      },
      handler
    });

    expect(handler).toHaveBeenCalledWith({
      req,
      res,
      services,
      query: req.query,
      body: req.body
    });
  });

  it("validates request with schema when provided", async () => {
    const schema = z.object({
      query: z.object({
        id: z.string()
      }),
      body: z.object({
        name: z.string(),
        age: z.string().transform(Number)
      })
    });

    const handler = jest.fn().mockResolvedValue(undefined);
    const req = createRequest({
      query: { id: "123" },
      body: { name: "test", age: "10" }
    });

    await setup({
      schema,
      handler,
      context: {
        req
      }
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        query: { id: "123" },
        body: { name: "test", age: 10 }
      })
    );
  });

  it("returns 400 error and logs warning when schema validation fails", async () => {
    const schema = z.object({
      query: z.object({
        id: z.string()
      }),
      body: z.object({
        name: z.string()
      })
    });

    const handler = jest.fn();
    const logger = mock<LoggerService>();
    const req = createRequest({
      query: { id: "123" },
      body: { invalid: "data" }
    });
    const res = mock<NextApiResponse>();

    await setup({
      schema,
      handler,
      context: {
        req,
        res,
        services: {
          logger
        }
      }
    });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      errors: expect.arrayContaining([
        expect.objectContaining({
          message: expect.any(String),
          path: expect.any(Array)
        })
      ])
    });
    expect(logger.warn).toHaveBeenCalledWith({
      error: expect.any(z.ZodError),
      event: "INVALID_API_REQUEST"
    });
  });

  function setup(input: {
    route?: string;
    schema?: z.ZodSchema<any>;
    handler?: (context: any) => Promise<any> | any;
    context?: Partial<{
      req?: NextApiRequest;
      res?: NextApiResponse;
      services?: Partial<typeof services>;
    }>;
  }) {
    const req = input.context?.req || createRequest();
    const res = input.context?.res || mock<NextApiResponse>();

    (req as NextApiRequestWithServices)[REQ_SERVICES_KEY] = {
      ...services,
      ...input.context?.services
    };

    const handler = defineApiHandler({
      route: input.route || "/test",
      schema: input.schema,
      handler: input.handler || (() => {})
    });

    return handler(req, res);
  }

  function createRequest(input?: Partial<NextApiRequest>) {
    return mock<NextApiRequest>({
      headers: {
        "content-type": "application/json"
      },
      ...input
    });
  }
});
