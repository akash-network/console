import { ErrorHandlerService } from "./error-handler.service";

describe(ErrorHandlerService.name, () => {
  it("should handle all successful operations", async () => {
    const errorHandlerService = new ErrorHandlerService();
    const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];
    const context = { totalPods: 3 };
    const operationName = "pod log collection";

    const result = await errorHandlerService.aggregateConcurrentResults(promises, context, operationName);

    expect(result).toEqual([1, 2, 3]);
  });

  it("should aggregate errors when operations fail", async () => {
    const errorHandlerService = new ErrorHandlerService();
    const error1 = new Error("Error 1");
    const error2 = new Error("Error 2");

    const promises = [Promise.resolve(1), Promise.reject(error1), Promise.reject(error2)];
    const context = { totalPods: 3 };
    const operationName = "pod log collection";

    await expect(errorHandlerService.aggregateConcurrentResults(promises, context, operationName)).rejects.toThrow(AggregateError);

    try {
      await errorHandlerService.aggregateConcurrentResults(promises, context, operationName);
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      if (error instanceof AggregateError) {
        expect(error.message).toBe("pod log collection failed for 2 item(s)");
        expect(error.errors).toHaveLength(2);
        expect(error.errors).toContain(error1);
        expect(error.errors).toContain(error2);
      }
    }
  });

  it("should handle empty promises array", async () => {
    const errorHandlerService = new ErrorHandlerService();
    const promises = [] as Promise<number>[];
    const context = { totalPods: 0 };
    const operationName = "pod log collection";

    const result = await errorHandlerService.aggregateConcurrentResults(promises, context, operationName);

    expect(result).toEqual([]);
  });
});
