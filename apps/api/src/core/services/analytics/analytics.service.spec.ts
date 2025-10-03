import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { Amplitude } from "@src/core/providers/amplitude.provider";
import type { Hasher } from "@src/core/providers/hash.provider";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { AnalyticsService } from "./analytics.service";

describe(AnalyticsService.name, () => {
  describe("constructor", () => {
    it("should set logger context", () => {
      const { logger } = setup();

      expect(logger.setContext).toHaveBeenCalledWith("AnalyticsService");
    });
  });

  describe("track", () => {
    it("should track event when user is sampled", () => {
      const { service, amplitude, hasher, logger } = setup({ samplingRate: "0.5" });

      hasher.hash.mockReturnValue(5);

      const userId = faker.string.uuid();
      const eventName = "user_registered";
      const properties = {
        property1: faker.lorem.word(),
        timestamp: faker.date.recent().toISOString()
      };

      service.track(userId, eventName, properties);

      expect(hasher.hash).toHaveBeenCalledWith(userId);
      expect(amplitude.track).toHaveBeenCalledWith(eventName, properties, {
        user_id: userId
      });
      expect(logger.debug).toHaveBeenCalledWith({
        event: "ANALYTICS_EVENT_REPORTED",
        userId,
        eventName
      });
    });

    it("should not track event when user is not sampled", () => {
      const { service, amplitude, hasher, logger } = setup({ samplingRate: "0.5" });

      hasher.hash.mockReturnValue(75);

      const userId = faker.string.uuid();
      const eventName = "balance_top_up";

      service.track(userId, eventName);

      expect(hasher.hash).toHaveBeenCalledWith(userId);
      expect(amplitude.track).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it("should use empty object for properties when none provided", () => {
      const { service, amplitude, hasher } = setup({ samplingRate: "0.5" });

      hasher.hash.mockReturnValue(5);

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

  describe("shouldSampleUser", () => {
    it("should sample user when hash value is less than sampling threshold", () => {
      const { service, hasher } = setup({ samplingRate: "0.5" });

      hasher.hash.mockReturnValue(25);

      const userId = faker.string.uuid();

      const result = service["shouldSampleUser"](userId);

      expect(result).toBe(true);
      expect(hasher.hash).toHaveBeenCalledWith(userId);
    });

    it("should not sample user when hash value is greater than sampling threshold", () => {
      const { service, hasher } = setup({ samplingRate: "0.5" });

      hasher.hash.mockReturnValue(75);

      const userId = faker.string.uuid();

      const result = service["shouldSampleUser"](userId);

      expect(result).toBe(false);
      expect(hasher.hash).toHaveBeenCalledWith(userId);
    });

    it("should sample all users when sampling rate is 1", () => {
      const { service, hasher } = setup({ samplingRate: "1.0" });

      const testCases = [0, 25, 50, 75, 99];

      for (const hashValue of testCases) {
        hasher.hash.mockReturnValueOnce(hashValue);

        const userId = faker.string.uuid();
        const result = service["shouldSampleUser"](userId);

        expect(result).toBe(true);
      }
    });

    it("should sample no users when sampling rate is 0", () => {
      const { service, hasher } = setup({ samplingRate: "0" });

      const testCases = [0, 25, 50, 75, 99];

      for (const hashValue of testCases) {
        hasher.hash.mockReturnValueOnce(hashValue);

        const userId = faker.string.uuid();
        const result = service["shouldSampleUser"](userId);

        expect(result).toBe(false);
      }
    });

    it("should handle negative hash values correctly", () => {
      const { service, hasher } = setup({ samplingRate: "0.5" });

      hasher.hash.mockReturnValue(-25);

      const userId = faker.string.uuid();

      const result = service["shouldSampleUser"](userId);

      expect(result).toBe(true);
      expect(hasher.hash).toHaveBeenCalledWith(userId);
    });
  });

  function setup(input: { samplingRate?: string } = {}) {
    const amplitude = mock<Amplitude>();
    const hasher = mock<Hasher>();
    const config = mock<CoreConfigService>();
    const logger = mock<LoggerService>();

    config.get.mockReturnValue(input.samplingRate ?? "1.0");

    const service = new AnalyticsService(amplitude, hasher, config, logger);

    return {
      amplitude,
      hasher,
      config,
      logger,
      service
    };
  }
});
