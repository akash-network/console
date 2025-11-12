import { HTTPException } from "hono/http-exception";
import { InternalServerError } from "http-errors";
import { mock } from "jest-mock-extended";

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

  describe("safe error serialization", () => {
    it("handles errors with BigInt values", async () => {
      const { service, mockContext, mockLogger } = setup();
      const error = new InternalServerError("Test error with BigInt");
      (error as unknown as { data: Record<string, unknown> }).data = {
        bigIntValue: BigInt("9007199254740991"),
        normalValue: 123
      };

      await service.handle(error, mockContext);

      // Verify logging was called and didn't throw
      expect(mockLogger.error).toHaveBeenCalled();
      const loggedError = mockLogger.error.mock.calls[0][0] as {
        data: { bigIntValue: string; normalValue: number };
      };
      expect(loggedError).toBeDefined();
      // Verify the BigInt was converted to string
      expect(loggedError.data.bigIntValue).toBe("9007199254740991");
      expect(loggedError.data.normalValue).toBe(123);
    });

    it("handles errors with typed arrays", async () => {
      const { service, mockContext, mockLogger } = setup();
      const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
      const error = new InternalServerError("Test error with typed array");
      (error as unknown as { data: Record<string, unknown> }).data = {
        buffer: uint8Array,
        otherValue: "test"
      };

      await service.handle(error, mockContext);

      expect(mockLogger.error).toHaveBeenCalled();
      const loggedError = mockLogger.error.mock.calls[0][0] as {
        data: { buffer: number[]; otherValue: string };
      };
      expect(loggedError).toBeDefined();
      // Verify typed array was converted to regular array
      expect(Array.isArray(loggedError.data.buffer)).toBe(true);
      expect(loggedError.data.buffer).toEqual([1, 2, 3, 4, 5]);
      expect(loggedError.data.otherValue).toBe("test");
    });

    it("handles errors with large typed arrays by truncating", async () => {
      const { service, mockContext, mockLogger } = setup();
      const largeArray = new Uint8Array(200).fill(42);
      const error = new InternalServerError("Test error with large typed array");
      (error as unknown as { data: Record<string, unknown> }).data = {
        largeBuffer: largeArray
      };

      await service.handle(error, mockContext);

      expect(mockLogger.error).toHaveBeenCalled();
      const loggedError = mockLogger.error.mock.calls[0][0] as {
        data: { largeBuffer: { type: string; length: number; preview: number[] } };
      };
      expect(loggedError).toBeDefined();
      // Verify large array was truncated with metadata
      expect(loggedError.data.largeBuffer).toHaveProperty("type", "Uint8Array");
      expect(loggedError.data.largeBuffer).toHaveProperty("length", 200);
      expect(loggedError.data.largeBuffer).toHaveProperty("preview");
      expect(loggedError.data.largeBuffer.preview).toHaveLength(10);
    });

    it("handles errors with circular references", async () => {
      const { service, mockContext, mockLogger } = setup();
      const circularObj: { name: string; self?: unknown } = { name: "test" };
      circularObj.self = circularObj;
      const error = new InternalServerError("Test error with circular reference");
      (error as unknown as { data: { name: string; self?: unknown } }).data = circularObj;

      await service.handle(error, mockContext);

      expect(mockLogger.error).toHaveBeenCalled();
      const loggedError = mockLogger.error.mock.calls[0][0] as { data: { name: string; self: string } };
      expect(loggedError).toBeDefined();
      // Verify circular reference was handled
      expect(loggedError.data.name).toBe("test");
      expect(loggedError.data.self).toBe("[Circular]");
    });

    it("handles errors with mixed problematic data", async () => {
      const { service, mockContext, mockLogger } = setup();
      const error = new InternalServerError("Complex error");
      (error as unknown as { data: Record<string, unknown> }).data = {
        bigInt: BigInt(123),
        buffer: new Uint8Array([10, 20, 30]),
        date: new Date("2025-01-01T00:00:00.000Z"),
        func: function test() {
          return "test";
        },
        symbol: Symbol("test"),
        nested: {
          value: "nested",
          bigInt: BigInt(456)
        }
      };

      await service.handle(error, mockContext);

      expect(mockLogger.error).toHaveBeenCalled();
      const loggedError = mockLogger.error.mock.calls[0][0] as {
        data: {
          bigInt: string;
          buffer: number[];
          date: string;
          func: string;
          symbol: string;
          nested: { value: string; bigInt: string };
        };
      };
      expect(loggedError).toBeDefined();
      expect(loggedError.data.bigInt).toBe("123");
      expect(loggedError.data.buffer).toEqual([10, 20, 30]);
      expect(loggedError.data.date).toBe("2025-01-01T00:00:00.000Z");
      expect(loggedError.data.func).toBe("[Function]");
      expect(loggedError.data.symbol).toMatch(/Symbol\(test\)/);
      expect(loggedError.data.nested.value).toBe("nested");
      expect(loggedError.data.nested.bigInt).toBe("456");
    });

    it("handles errors that mimic the real-world scenario from the issue", async () => {
      const { service, mockContext, mockLogger } = setup();
      // Simulate the error structure from the issue with a tx property containing numeric indices
      const txBuffer = new Uint8Array(300);

      for (let i = 0; i < 300; i++) {
        txBuffer[i] = i % 256;
      }
      const error = new InternalServerError("Failed to sign and broadcast tx");
      (error as unknown as { data: Record<string, unknown> }).data = {
        code: 11,
        gasUsed: BigInt(251360),
        gasWanted: BigInt(249373),
        height: BigInt(23035326),
        tx: txBuffer,
        rawLog: "out of gas in location: WriteFlat"
      };

      await service.handle(error, mockContext);

      expect(mockLogger.error).toHaveBeenCalled();
      const loggedError = mockLogger.error.mock.calls[0][0] as {
        data: {
          gasUsed: string;
          gasWanted: string;
          height: string;
          tx: { type: string; length: number; preview: number[] };
        };
      };
      expect(loggedError).toBeDefined();
      // Verify all BigInt values were serialized
      expect(loggedError.data.gasUsed).toBe("251360");
      expect(loggedError.data.gasWanted).toBe("249373");
      expect(loggedError.data.height).toBe("23035326");
      // Verify large tx buffer was truncated
      expect(loggedError.data.tx).toHaveProperty("type", "Uint8Array");
      expect(loggedError.data.tx).toHaveProperty("length", 300);
      expect(loggedError.data.tx).toHaveProperty("preview");
    });
  });

  function setup() {
    const service = new HonoErrorHandlerService();
    const mockContext = mock<AppContext>();
    const mockLogger = {
      error: jest.fn()
    };

    // Replace the logger with our mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).logger = mockLogger;

    mockContext.json.mockImplementation(((data: unknown, options?: { status?: number }) => {
      return new Response(JSON.stringify(data), { status: options?.status || 200 });
    }) as AppContext["json"]);

    return {
      service,
      mockContext,
      mockLogger
    };
  }
});
