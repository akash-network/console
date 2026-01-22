import "@test/mocks/logger-service.mock";

import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import { ErrorService } from "./error.service";

describe(ErrorService.name, () => {
  it("should execute callback and return its result", async () => {
    const { service } = setup();
    const result = faker.lorem.sentence();
    const cb = jest.fn().mockResolvedValue(result);
    const extraLog = { test: "test" };

    const actual = await service.execWithErrorHandler(extraLog, cb);

    expect(cb).toHaveBeenCalled();
    expect(actual).toBe(result);
  });

  it("should handle errors and call onError handler", async () => {
    const { service, logger } = setup();
    const error = new Error("test");
    const cb = jest.fn().mockRejectedValue(error);
    const extraLog = { test: "test" };
    const onError = jest.fn();

    const actual = await service.execWithErrorHandler(extraLog, cb, onError);

    expect(cb).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error, ...extraLog }));
    expect(actual).toBeUndefined();
  });

  it("should handle errors without onError handler", async () => {
    const { service, logger } = setup();
    const error = new Error("test");
    const cb = jest.fn().mockRejectedValue(error);
    const extraLog = { test: "test" };

    const actual = await service.execWithErrorHandler(extraLog, cb);

    expect(cb).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error, ...extraLog }));
    expect(actual).toBeUndefined();
  });

  function setup() {
    const logger = mock<LoggerService>();
    const service = new ErrorService(logger);
    return { service, logger };
  }
});
