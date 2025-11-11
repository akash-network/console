import { HTTPException } from "hono/http-exception";

import { HonoErrorHandlerService } from "./hono-error-handler.service";

describe("HonoErrorHandlerService", () => {
  let service: HonoErrorHandlerService;
  let mockContext: any;

  beforeEach(() => {
    service = new HonoErrorHandlerService();
    mockContext = {
      json: jest.fn((data, options) => {
        return new Response(JSON.stringify(data), { status: options?.status || 200 });
      })
    };
  });

  describe("HTTPException handling", () => {
    it("should handle HTTPException with 400 status for malformed JSON", async () => {
      const error = new HTTPException(400, { message: "Malformed JSON in request body" });

      const response = await service.handle(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          message: "Malformed JSON in request body",
          code: "bad_request",
          type: "client_error"
        }),
        { status: 400 }
      );
      expect(response.status).toBe(400);
    });

    it("should handle HTTPException with 401 status", async () => {
      const error = new HTTPException(401, { message: "Unauthorized" });

      const response = await service.handle(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Unauthorized",
          code: "unauthorized",
          type: "client_error"
        }),
        { status: 401 }
      );
      expect(response.status).toBe(401);
    });

    it("should handle HTTPException with 404 status", async () => {
      const error = new HTTPException(404, { message: "Not found" });

      const response = await service.handle(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Not found",
          code: "not_found",
          type: "client_error"
        }),
        { status: 404 }
      );
      expect(response.status).toBe(404);
    });

    it("should handle HTTPException with 500 status", async () => {
      const error = new HTTPException(500, { message: "Internal server error" });

      const response = await service.handle(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Internal server error",
          type: "server_error"
        }),
        { status: 500 }
      );
      expect(response.status).toBe(500);
    });
  });
});
