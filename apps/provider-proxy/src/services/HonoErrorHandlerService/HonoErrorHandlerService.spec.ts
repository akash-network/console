import type { LoggerService } from "@akashnetwork/logging";
import { mock } from "jest-mock-extended";
import { ZodError } from "zod";

import type { AppContext } from "../../types/AppContext";
import { HonoErrorHandlerService } from "./HonoErrorHandlerService";

describe(HonoErrorHandlerService.name, () => {
  it("returns 400 status error on ZodError", async () => {
    const service = setup();
    const error = new ZodError([]);
    const response = {};
    const json = jest.fn(() => response);

    const result = await service.handle(error, { json } as unknown as AppContext);

    expect(result).toEqual(response);
    expect(json).toHaveBeenCalledWith({ error: "BadRequestError", data: error.errors }, { status: 400 });
  });

  it("returns 500 status error on unknown error", async () => {
    const service = setup();
    const error = new Error("Unknown error");
    const response = {};
    const json = jest.fn(() => response);

    const result = await service.handle(error, { json } as unknown as AppContext);

    expect(result).toEqual(response);
    expect(json).toHaveBeenCalledWith({ error: "InternalServerError" }, { status: 500 });
  });

  it("logs error", async () => {
    const logger = mock<LoggerService>();
    const service = setup({ logger });
    const error = new Error("Unknown error");
    const json = jest.fn();
    await service.handle(error, { json } as unknown as AppContext);

    expect(logger.error).toHaveBeenCalledWith({ error });
  });

  function setup(input?: { logger?: LoggerService }) {
    return new HonoErrorHandlerService(input?.logger ?? mock<LoggerService>());
  }
});
