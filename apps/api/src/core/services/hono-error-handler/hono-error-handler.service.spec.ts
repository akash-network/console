import { HTTPException } from "hono/http-exception";
import createHttpError from "http-errors";
import { mock } from "vitest-mock-extended";
import { z } from "zod";

import type { AppContext } from "../../types/app-context";
import { HonoErrorHandlerService } from "./hono-error-handler.service";

describe(HonoErrorHandlerService.name, () => {
  describe("when error is HTTPException instance", () => {
    it("handles HTTPException with 400 status for malformed JSON", async () => {
      const { service, mockContext } = setup();
      const error = new HTTPException(400, { message: "Malformed JSON in request body" });

      await service.handle(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          message: "Malformed JSON in request body",
          code: "bad_request",
          type: "client_error"
        }),
        { status: 400 }
      );
    });

    it("handles HTTPException with 401 status", async () => {
      const { service, mockContext } = setup();
      const error = new HTTPException(401, { message: "Unauthorized" });

      await service.handle(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Unauthorized",
          code: "unauthorized",
          type: "client_error"
        }),
        { status: 401 }
      );
    });

    it("handles HTTPException with 404 status", async () => {
      const { service, mockContext } = setup();
      const error = new HTTPException(404, { message: "Not found" });

      await service.handle(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Not found",
          code: "not_found",
          type: "client_error"
        }),
        { status: 404 }
      );
    });

    it("handles HTTPException with 500 status", async () => {
      const { service, mockContext } = setup();
      const error = new HTTPException(500, { message: "Internal server error" });

      await service.handle(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Internal server error",
          type: "server_error"
        }),
        { status: 500 }
      );
    });
  });

  describe("when error contains non-JSON values", () => {
    it("handles bigint values in http errors", async () => {
      const { service, mockContext } = setup();
      const error = createHttpError(400);
      Object.assign(error, { data: { bigintValue: BigInt(123) } });

      await expect(service.handle(error, mockContext)).resolves.toEqual(expect.any(Response));
      expect(mockContext.body).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 400,
          headers: {
            "Content-Type": expect.stringContaining("application/json")
          }
        })
      );
    });

    it("handles bigint values in ZodError", async () => {
      const { service, mockContext } = setup();
      const result = z.bigint({ coerce: true }).positive().safeParse("-123");

      expect(result.error).toBeDefined();
      await expect(service.handle(result.error!, mockContext)).resolves.toEqual(expect.any(Response));
      expect(mockContext.body).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 400,
          headers: {
            "Content-Type": expect.stringContaining("application/json")
          }
        })
      );
    });
  });

  function setup() {
    const service = new HonoErrorHandlerService();
    const mockContext = mock<AppContext>({
      body: jest.fn(() => new Response())
    });

    mockContext.json.mockImplementation(((data: unknown, options?: { status?: number }) => {
      return new Response(JSON.stringify(data), { status: options?.status || 200 });
    }) as AppContext["json"]);

    return {
      service,
      mockContext
    };
  }
});
