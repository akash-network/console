import "@test/mocks/logger-service.mock";

import { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";

import { Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";
import { ErrorService } from "./error.service";

describe(ErrorService.name, () => {
  const sentryEventService = new SentryEventService();
  let sentry: Sentry;
  let service: ErrorService;
  let sentryEventId: string;
  const error = new Error("test");
  const event = { message: error.name };
  jest.spyOn(sentryEventService, "toEvent").mockReturnValue(event);

  beforeEach(() => {
    sentryEventId = faker.string.uuid();
    sentry = {
      captureEvent: jest.fn().mockReturnValue(sentryEventId)
    } as unknown as Sentry;
    service = new ErrorService(sentry, sentryEventService);
  });

  it("should exec error handler", async () => {
    const cb = jest.fn().mockRejectedValue(new Error("test"));
    const extraLog = { test: "test" };
    await service.execWithErrorHandler(extraLog, cb);

    expect(cb).toHaveBeenCalled();
    expect(sentryEventService.toEvent).toHaveBeenCalledWith(error);
    expect(sentry.captureEvent).toHaveBeenCalledWith(event);
    expect(LoggerService.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(error.name), sentryEventId, ...extraLog })
    );
  });

  it("should resolve with callback value", async () => {
    const result = faker.lorem.sentence();
    const cb = jest.fn().mockResolvedValue(result);

    expect(await service.execWithErrorHandler({}, cb)).toBe(result);
  });
});
