import { RichError } from "./rich-error";

describe("RichError", () => {
  describe("extractMessage", () => {
    it("should return the same message if input is a string", () => {
      const msg = "Something went wrong";
      expect(RichError.extractMessage(msg)).toBe(msg);
    });

    it("should extract message from Error object", () => {
      const error = new Error("Boom!");
      expect(RichError.extractMessage(error)).toBe("Boom!");
    });

    it("should extract message from object with message property", () => {
      const error = { message: "Custom error" };
      expect(RichError.extractMessage(error)).toBe("Custom error");
    });

    it("should return default message if input is unrecognized", () => {
      expect(RichError.extractMessage(null)).toBe("Unknown error occurred.");
      expect(RichError.extractMessage({})).toBe("Unknown error occurred.");
      expect(RichError.extractMessage(123)).toBe("Unknown error occurred.");
    });
  });

  describe("extractStack", () => {
    it("should extract stack from Error object", () => {
      const error = new Error("Boom!");
      expect(RichError.extractStack(error)).toBe(error.stack);
    });

    it("should extract stack from object with stack property", () => {
      const stack = "some stack trace";
      const error = { stack };
      expect(RichError.extractStack(error)).toBe(stack);
    });

    it("should return undefined for invalid input", () => {
      expect(RichError.extractStack(null)).toBeUndefined();
      expect(RichError.extractStack({})).toBeUndefined();
      expect(RichError.extractStack(42)).toBeUndefined();
    });
  });

  describe("enrich", () => {
    it("should enrich an Error object correctly", () => {
      const originalError = new Error("Something broke");
      const code = "ERR_BROKEN";
      const data = { service: "test-service" };

      const rich = RichError.enrich(originalError, code, data);

      expect(rich).toBeInstanceOf(RichError);
      expect(rich.message).toBe("Something broke");
      expect(rich.code).toBe(code);
      expect(rich.data).toEqual(data);
      expect(rich.stack).toBe(originalError.stack);
    });

    it("should enrich a string error", () => {
      const rich = RichError.enrich("Boom!", "ERR_STRING");

      expect(rich).toBeInstanceOf(RichError);
      expect(rich.message).toBe("Boom!");
      expect(rich.code).toBe("ERR_STRING");
    });

    it("should handle unknown error input", () => {
      const rich = RichError.enrich(42);

      expect(rich.message).toBe("Unknown error occurred.");
      expect(rich.code).toBe("UNDEFINED");
    });
  });

  describe("constructor", () => {
    it("should assign all properties properly", () => {
      const err = new RichError("Test message", "ERR_TEST", { debug: true });

      expect(err.message).toBe("Test message");
      expect(err.code).toBe("ERR_TEST");
      expect(err.data).toEqual({ debug: true });
    });

    it("should default code and data when not provided", () => {
      const err = new RichError("Fallback test");

      expect(err.code).toBe("UNDEFINED");
      expect(err.data).toEqual({});
    });
  });
});
