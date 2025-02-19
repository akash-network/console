import { Identify, identify, init, setUserId, track } from "@amplitude/analytics-browser";
import { faker } from "@faker-js/faker";
import { event } from "nextjs-google-analytics";

import { type AnalyticsCategory, type AnalyticsEvent, AnalyticsService } from "./analytics.service";

jest.mock("@amplitude/analytics-browser");
jest.mock("nextjs-google-analytics");

const MOCK_EVENT_NAMES: AnalyticsEvent[] = ["connect_wallet", "connect_managed_wallet", "disconnect_wallet"];

describe(AnalyticsService.name, () => {
  let service: AnalyticsService;
  const mockAmplitudeApiKey = faker.string.alphanumeric(32);
  const mockGaMeasurementId = `G-${faker.string.alphanumeric(10)}`;

  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(window, "gtag", {
      writable: true,
      value: jest.fn()
    });
  });

  describe("initialization", () => {
    it("should initialize Amplitude when enabled", () => {
      service = new AnalyticsService({
        amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
        ga: { enabled: false, measurementId: mockGaMeasurementId }
      });

      expect(init).toHaveBeenCalledWith(mockAmplitudeApiKey, {
        serverUrl: "/api/analytics"
      });
    });

    it("should not initialize Amplitude when disabled", () => {
      service = new AnalyticsService({
        amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
        ga: { enabled: false, measurementId: mockGaMeasurementId }
      });

      expect(init).not.toHaveBeenCalled();
    });
  });

  describe("identify", () => {
    beforeEach(() => {
      service = new AnalyticsService({
        amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
        ga: { enabled: true, measurementId: mockGaMeasurementId }
      });
    });

    it("should identify user in both GA and Amplitude", () => {
      const user = {
        id: faker.string.uuid(),
        anonymous: faker.datatype.boolean(),
        emailVerified: faker.datatype.boolean()
      };
      service.identify(user);

      expect(window.gtag).toHaveBeenCalledWith("config", mockGaMeasurementId, {
        user_id: user.id
      });

      expect(identify).toHaveBeenCalled();
      expect(setUserId).toHaveBeenCalledWith(user.id);

      const mockIdentify = (Identify as jest.Mock).mock.instances[0];
      expect(mockIdentify.set).toHaveBeenCalledWith("is_anonymous", user.anonymous);
      expect(mockIdentify.set).toHaveBeenCalledWith("is_email_verified", user.emailVerified);
    });

    it("should only identify in enabled services", () => {
      service = new AnalyticsService({
        amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
        ga: { enabled: true, measurementId: mockGaMeasurementId }
      });

      const user = { id: faker.string.uuid() };
      service.identify(user);

      expect(window.gtag).toHaveBeenCalled();
      expect(identify).not.toHaveBeenCalled();
      expect(setUserId).not.toHaveBeenCalled();
    });
  });

  describe("track", () => {
    beforeEach(() => {
      service = new AnalyticsService({
        amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
        ga: { enabled: true, measurementId: mockGaMeasurementId }
      });
    });

    it("should track events in both GA and Amplitude when no target specified", () => {
      const eventName = faker.helpers.arrayElement(MOCK_EVENT_NAMES);
      const properties = {
        category: "wallet" as AnalyticsCategory,
        someProperty: faker.word.sample()
      };

      service.track(eventName, properties);

      expect(track).toHaveBeenCalledWith(eventName, properties);
      expect(event).toHaveBeenCalledWith(eventName, properties);
    });

    it("should track events only in specified target", () => {
      const eventName = faker.helpers.arrayElement(MOCK_EVENT_NAMES);
      const properties = { category: "wallet" as AnalyticsCategory };

      service.track(eventName, properties, "Amplitude");

      expect(track).toHaveBeenCalledWith(eventName, properties);
      expect(event).not.toHaveBeenCalled();
    });

    it("should transform GA event names correctly", () => {
      const eventName = "successful_tx";
      const properties = { category: "transactions" as AnalyticsCategory };

      service.track(eventName, properties);

      expect(event).toHaveBeenCalledWith("successful_transaction", properties);
    });

    it("should handle navigate_tab events specially for GA", () => {
      const eventName = "navigate_tab";
      const properties = {
        category: "user" as AnalyticsCategory,
        tab: faker.helpers.arrayElement(["settings", "profile", "dashboard"])
      };

      service.track(eventName, properties);

      expect(event).toHaveBeenCalledWith(`navigate_tab_${properties.tab}`, properties);
    });

    it("should only track in enabled services", () => {
      service = new AnalyticsService({
        amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
        ga: { enabled: true, measurementId: mockGaMeasurementId }
      });

      const eventName = faker.helpers.arrayElement(MOCK_EVENT_NAMES);
      const properties = { category: "wallet" as AnalyticsCategory };

      service.track(eventName, properties);

      expect(track).not.toHaveBeenCalled();
      expect(event).toHaveBeenCalled();
    });
  });
});
