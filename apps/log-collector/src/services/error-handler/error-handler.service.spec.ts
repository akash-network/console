import { ErrorHandlerService } from "./error-handler.service";

describe(ErrorHandlerService.name, () => {
  it("should handle all successful operations", async () => {
    const errorHandlerService = new ErrorHandlerService();
    const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];
    const operationName = "pod log collection";

    const result = await errorHandlerService.aggregateConcurrentResults(promises, operationName);

    expect(result).toEqual([1, 2, 3]);
  });

  it("should aggregate errors when operations fail", async () => {
    const errorHandlerService = new ErrorHandlerService();
    const error1 = new Error("Error 1");
    const error2 = new Error("Error 2");

    const promises = [Promise.resolve(1), Promise.reject(error1), Promise.reject(error2)];
    const operationName = "pod log collection";

    await expect(errorHandlerService.aggregateConcurrentResults(promises, operationName)).rejects.toMatchObject({
      message: "pod log collection failed for 2 item(s)",
      errors: expect.arrayContaining([error1, error2])
    });
  });

  it("should handle empty promises array", async () => {
    const errorHandlerService = new ErrorHandlerService();
    const promises = [] as Promise<number>[];
    const operationName = "pod log collection";

    const result = await errorHandlerService.aggregateConcurrentResults(promises, operationName);

    expect(result).toEqual([]);
  });

  describe("isForbidden", () => {
    it("should return true for error with statusCode 403", () => {
      const errorHandlerService = new ErrorHandlerService();
      const error = Object.assign(new Error("Forbidden"), { statusCode: 403 });

      expect(errorHandlerService.isForbidden(error)).toBe(true);
    });

    it("should return true for error with code 403", () => {
      const errorHandlerService = new ErrorHandlerService();
      const error = Object.assign(new Error("Forbidden"), { code: 403 });

      expect(errorHandlerService.isForbidden(error)).toBe(true);
    });

    it("should return true for AggregateError where all errors are forbidden", () => {
      const errorHandlerService = new ErrorHandlerService();
      const error = new AggregateError([Object.assign(new Error("Forbidden"), { statusCode: 403 }), Object.assign(new Error("Forbidden"), { code: 403 })]);

      expect(errorHandlerService.isForbidden(error)).toBe(true);
    });

    it("should return false for empty AggregateError", () => {
      const errorHandlerService = new ErrorHandlerService();
      const error = new AggregateError([]);

      expect(errorHandlerService.isForbidden(error)).toBe(false);
    });

    it("should return false for non-forbidden errors", () => {
      const errorHandlerService = new ErrorHandlerService();

      expect(errorHandlerService.isForbidden(new Error("not forbidden"))).toBe(false);
      expect(errorHandlerService.isForbidden(null)).toBe(false);
      expect(errorHandlerService.isForbidden("string")).toBe(false);
    });
  });
});
