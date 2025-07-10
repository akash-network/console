import { mock } from "jest-mock-extended";
import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import type { z } from "zod";
import { z as zod } from "zod";

import { services } from "@src/services/http/http-server.service";
import { requestExecutionContext } from "../requestExecutionContext";
import { defineServerSideProps } from "./defineServerSideProps";

jest.mock("@src/config/server-env.config", () => ({
  serverEnvConfig: {}
}));

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

  it("throws error when schema validation fails", async () => {
    const schema = zod.object({
      query: zod.object({
        id: zod.string()
      })
    });

    await expect(
      setup({
        route: "/test",
        schema,
        context: {
          query: {}
        }
      })
    ).rejects.toThrow(/invalid_type/);
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
        req: mock<Request>({ headers, originalUrl: "/test", url: "/test" })
      },
      handler: async (): Promise<Result> => ({ props: { headers: requestExecutionContext.getStore()?.headers } })
    })) as Result;

    expect(Object.fromEntries((result.props as any).headers.entries())).toEqual(headers);
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

  function setup(input: {
    route: string;
    schema?: z.ZodSchema<any>;
    if?: (context: any) => boolean | Promise<boolean> | GetServerSidePropsResult<any> | Promise<GetServerSidePropsResult<any>>;
    handler?: (context: any) => Promise<any> | any;
    context?: Partial<GetServerSidePropsContext>;
  }) {
    const context: GetServerSidePropsContext = {
      req: mock<Request>({ url: "/test", originalUrl: "/test", headers: { host: "localhost" } }),
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
});

type Request = GetServerSidePropsContext["req"] & { originalUrl?: string };
