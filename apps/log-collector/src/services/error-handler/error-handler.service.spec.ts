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
});
