import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Amplitude } from "@src/core/providers/amplitude.provider";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { AnalyticsService } from "./analytics.service";

describe(AnalyticsService.name, () => {
  describe("constructor", () => {
    it("creates the logger with the service context", () => {
      const { createLogger } = setup();

      expect(createLogger).toHaveBeenCalledWith({ context: AnalyticsService.name });
    });
  });

  describe("track", () => {
    it("tracks event", () => {
      const { service, amplitude, logger } = setup();

      const userId = faker.string.uuid();
      const eventName = "user_registered";
      const properties = {
        property1: faker.lorem.word(),
        timestamp: faker.date.recent().toISOString()
      };

      service.track(userId, eventName, properties);

      expect(amplitude.track).toHaveBeenCalledWith(eventName, properties, {
        user_id: userId
      });
      expect(logger.debug).toHaveBeenCalledWith({
        event: "ANALYTICS_EVENT_REPORTED",
        userId,
        eventName
      });
    });

    it("uses empty object for properties when none provided", () => {
      const { service, amplitude } = setup();

      const userId = faker.string.uuid();
      const eventName = "user_registered";

      service.track(userId, eventName);

      expect(amplitude.track).toHaveBeenCalledWith(
        eventName,
        {},
        {
          user_id: userId
        }
      );
    });
  });

  describe("identify", () => {
    it("identifies user with properties", () => {
      const { service, amplitude, logger } = setup();

      const userId = faker.string.uuid();
      const properties = {
        property1: faker.lorem.word(),
        timestamp: faker.date.recent().toISOString()
      };

      service.identify(userId, properties);

      expect(amplitude.identify).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({
        event: "ANALYTICS_USER_IDENTIFIED",
        userId
      });
    });

    it("handles empty properties", () => {
      const { service, amplitude } = setup();

      const userId = faker.string.uuid();

      service.identify(userId);

      expect(amplitude.identify).toHaveBeenCalled();
    });
  });

  function setup() {
    const mockIdentifyInstance = {
      set: vi.fn()
    };
    const IdentifyConstructor = vi.fn().mockImplementation(function () {
      return mockIdentifyInstance;
    });
    const amplitude = mock<Amplitude>({
      Identify: IdentifyConstructor
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new AnalyticsService(amplitude, createLogger);

    return {
      amplitude,
      logger,
      createLogger,
      service
    };
  }
});
