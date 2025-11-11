import { HTTPException } from "hono/http-exception";
import { mock } from "jest-mock-extended";

import type { AppContext } from "../../types/app-context";
import { HonoErrorHandlerService } from "./hono-error-handler.service";

describe("HonoErrorHandlerService", () => {
  describe("HTTPException handling", () => {
    it("should handle HTTPException with 400 status for malformed JSON", async () => {
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

    it("should handle HTTPException with 401 status", async () => {
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

    it("should handle HTTPException with 404 status", async () => {
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

    it("should handle HTTPException with 500 status", async () => {
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

  function setup() {
    const service = new HonoErrorHandlerService();
    const mockContext = mock<AppContext>();

    mockContext.json.mockImplementation((data: any, options?: any) => {
      return new Response(JSON.stringify(data), { status: options?.status || 200 }) as any;
    });

    return {
      service,
      mockContext
    };
  }
});
