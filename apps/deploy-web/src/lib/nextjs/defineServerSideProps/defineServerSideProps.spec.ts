import type { LoggerService } from "@akashnetwork/logging";
import { AxiosError } from "axios";
import { mock } from "jest-mock-extended";
import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import type { z } from "zod";
import { z as zod, ZodError } from "zod";

import { services } from "@src/services/http/http-server.service";
import { requestExecutionContext } from "../requestExecutionContext";
import type { AppTypedContext } from "./defineServerSideProps";
import { defineServerSideProps } from "./defineServerSideProps";

describe(defineServerSideProps, () => {
  it("returns empty props when no schema, if condition, or handler provided", async () => {
    const result = await setup({ route: "/test" });

    expect(result).toEqual({ props: {} });
  });

  it("executes handler and returns its result", async () => {
    const mockHandler = jest.fn().mockResolvedValue({ props: { data: "test" } });

    const result = await setup({
      route: "/test",
      handler: mockHandler
    });

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        services
      })
    );
    expect(result).toEqual({ props: { data: "test" } });
  });

  it("validates context with schema when provided", async () => {
    const schema = zod.object({
      query: zod.object({
        id: zod.string().transform(Number)
      }),
      params: zod.object({
        username: zod.string()
      })
    });

    const mockHandler = jest.fn().mockResolvedValue({ props: { validated: true } });

    const result = await setup({
      route: "/test",
      schema,
      handler: mockHandler,
      context: {
        query: { id: "123" },
        params: { username: "test" }
      }
    });

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { id: 123 },
        params: { username: "test" }
      })
    );
    expect(result).toEqual({ props: { validated: true } });
  });

  it("return NOT_FOUND when schema validation fails", async () => {
    const schema = zod.object({
      query: zod.object({
        id: zod.string()
      })
    });

    const logger = mock<LoggerService>();
    const result = await setup({
      route: "/test",
      schema,
      context: {
        query: {},
        services: mock<typeof services>({
          logger
        })
      }
    });

    expect(logger.warn).toHaveBeenCalledWith({
      message: "Invalid context for route /test",
      error: expect.any(ZodError)
    });
    expect(result).toEqual({ notFound: true });
  });

  it("returns notFound when if condition returns false", async () => {
    let result = await setup({
      route: "/test",
      if: () => false
    });

    expect(result).toEqual({ notFound: true });

    result = await setup({
      route: "/test",
      if: () => Promise.resolve(false)
    });

    expect(result).toEqual({ notFound: true });
  });

  it("returns redirect when if condition returns redirect result", async () => {
    const redirectResult = {
      redirect: {
        destination: "/login",
        permanent: false
      }
    };
    const mockIf = jest.fn().mockReturnValue(redirectResult);

    const result = await setup({
      route: "/test",
      if: mockIf
    });

    expect(result).toEqual(redirectResult);
  });

  it("calls handler when if condition returns true", async () => {
    const mockIf = jest.fn().mockReturnValue(true);
    const mockHandler = jest.fn().mockResolvedValue({ props: { data: "test" } });

    const result = await setup({
      route: "/test",
      if: mockIf,
      handler: mockHandler
    });

    expect(mockHandler).toHaveBeenCalled();
    expect(result).toEqual({ props: { data: "test" } });
  });

  it("executes handler when if condition returns Promise<true>", async () => {
    const mockIf = jest.fn().mockResolvedValue(true);
    const mockHandler = jest.fn().mockResolvedValue({ props: { data: "test" } });

    const result = await setup({
      route: "/test",
      if: mockIf,
      handler: mockHandler
    });

    expect(mockHandler).toHaveBeenCalled();
    expect(result).toEqual({ props: { data: "test" } });
  });

  it("handles async if condition that returns GetServerSidePropsResult", async () => {
    const asyncIfResult = {
      redirect: {
        destination: "/error",
        permanent: true
      }
    };
    const mockIf = jest.fn().mockResolvedValue(asyncIfResult);

    const result = await setup({
      route: "/test",
      if: mockIf
    });

    expect(result).toEqual(asyncIfResult);
  });

  it("exposes request headers in async context", async () => {
    const headers = { "x-forwarded-for": "127.0.0.1", host: "localhost" };
    type Result = Extract<GetServerSidePropsResult<{ headers?: Headers }>, { props: Record<string, any> }>;
    const result = (await setup({
      route: "/test",
      context: {
        req: createRequest({ headers })
      },
      handler: async (): Promise<Result> => ({ props: { headers: requestExecutionContext.getStore()?.headers } })
    })) as Result;

    expect(Object.fromEntries((result.props as any).headers.entries())).toEqual(expect.objectContaining(headers));
  });

  it("executes async & sync handlers", async () => {
    let result = await setup({
      route: "/test",
      handler: () => ({ props: { async: true } })
    });

    expect(result).toEqual({ props: { async: true } });

    result = await setup({
      route: "/test",
      handler: () => Promise.resolve({ props: { sync: true } })
    });

    expect(result).toEqual({ props: { sync: true } });
  });

  it("handles if condition that returns undefined and null", async () => {
    const mockHandler = jest.fn().mockResolvedValue({ props: { handled: true } });

    let result = await setup({
      route: "/test",
      if: jest.fn().mockReturnValue(undefined),
      handler: mockHandler
    });

    expect(mockHandler).toHaveBeenCalled();
    expect(result).toEqual({ props: { handled: true } });

    result = await setup({
      route: "/test",
      if: jest.fn().mockReturnValue(null),
      handler: mockHandler
    });

    expect(mockHandler).toHaveBeenCalled();
  });

  it("returns NOT_FOUND when handler throws 400 AxiosError", async () => {
    const validationError = new AxiosError("Bad request", "400", undefined, undefined, {
      status: 400,
      statusText: "Bad request",
      data: { message: "bad request" },
      headers: {},
      config: {} as any
    });
    const logger = mock<LoggerService>();
    const result = await setup({
      route: "/test",
      handler: () => Promise.reject(validationError),
      context: {
        services: mock<typeof services>({
          logger
        })
      }
    });

    expect(logger.warn).toHaveBeenCalledWith({
      message: "Error in handler for route /test",
      error: validationError
    });
    expect(result).toEqual({ notFound: true });
  });

  it("returns NOT_FOUND when handler throws 404 AxiosError", async () => {
    const notFoundError = new AxiosError("Not Found", "404", undefined, undefined, {
      status: 404,
      statusText: "Not Found",
      data: { message: "Resource not found" },
      headers: {},
      config: {} as any
    });

    const logger = mock<LoggerService>();

    const result = await setup({
      route: "/test",
      handler: () => Promise.reject(notFoundError),
      context: {
        services: mock<typeof services>({
          logger
        })
      }
    });

    expect(logger.warn).toHaveBeenCalledWith({
      message: "Error in handler for route /test",
      error: notFoundError
    });
    expect(result).toEqual({ notFound: true });
  });

  it("throws other AxiosError status codes", async () => {
    const axiosError = new AxiosError("Internal Server Error", "500", undefined, undefined, {
      status: 500,
      statusText: "Internal Server Error",
      data: { message: "Server error" },
      headers: {},
      config: {} as any
    });

    const mockHandler = jest.fn().mockRejectedValue(axiosError);

    await expect(
      setup({
        route: "/test",
        handler: mockHandler
      })
    ).rejects.toThrow("Internal Server Error");
  });

  it("throws non-AxiosError exceptions", async () => {
    const error = new Error("Custom error");
    const mockHandler = jest.fn().mockRejectedValue(error);

    await expect(
      setup({
        route: "/test",
        handler: mockHandler
      })
    ).rejects.toThrow("Custom error");
  });

  function setup(input: {
    route: string;
    schema?: z.ZodSchema<any>;
    if?: (context: any) => boolean | Promise<boolean> | GetServerSidePropsResult<any> | Promise<GetServerSidePropsResult<any>>;
    handler?: (context: any) => Promise<any> | any;
    context?: Partial<AppTypedContext>;
  }) {
    const context: GetServerSidePropsContext = {
      req: createRequest(),
      res: mock<GetServerSidePropsContext["res"]>(),
      query: {},
      params: {},
      resolvedUrl: "/test",
      locale: "en",
      locales: ["en"],
      defaultLocale: "en",
      ...input.context
    };

    return defineServerSideProps({
      route: input.route,
      schema: input.schema,
      if: input.if,
      handler: input.handler
    })(context);
  }

  function createRequest({ headers, ...input }: Partial<GetServerSidePropsContext["req"]> = {}) {
    return mock<GetServerSidePropsContext["req"]>({
      url: "/test",
      headers: {
        host: "localhost",
        "content-type": "application/json",
        "x-forwarded-host": "localhost",
        "x-forwarded-for": "127.0.0.1",
        "x-forwarded-proto": "http",
        ...headers
      },
      ...input
    });
  }
});
