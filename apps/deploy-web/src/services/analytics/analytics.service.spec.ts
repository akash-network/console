import { faker } from "@faker-js/faker";

import { Amplitude, AnalyticsOptions, AnalyticsService, GoogleAnalytics, HashFn } from "./analytics.service";

type Mocked<T> = {
  [K in keyof T]?: jest.Mock;
};

describe(AnalyticsService.name, () => {
  const mockAmplitudeApiKey = faker.string.uuid();
  const mockGaMeasurementId = faker.string.uuid();

  describe("initialization", () => {
    it("should not initialize Amplitude when disabled", () => {
      const init = jest.fn();
      const service = setup({
        amplitude: { init },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.identify({ id: faker.string.uuid() });
      expect(init).not.toHaveBeenCalled();
    });

    it("should initialize Amplitude only for sampled users when enabled", () => {
      const init = jest.fn();
      const service = setup({
        amplitude: { init },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.identify({ id: faker.string.uuid() });
      expect(init).toHaveBeenCalled();
    });
  });

  describe("user sampling", () => {
    it("should sample amplitude users based on hash value", () => {
      const init = jest.fn();
      const hashFn = jest.fn().mockImplementation(() => 120);
      const service = setup({
        amplitude: { init },
        hashFn,
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });
      service.identify({ id: faker.string.uuid() });

      expect(hashFn).toHaveBeenCalled();
      expect(init).toHaveBeenCalled();
    });

    it("should not sample amplitude users based on hash value", () => {
      const init = jest.fn();
      const hashFn = jest.fn().mockImplementation(() => 125);
      const service = setup({
        amplitude: { init },
        hashFn,
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });
      service.identify({ id: faker.string.uuid() });

      expect(hashFn).toHaveBeenCalled();
      expect(init).not.toHaveBeenCalled();
    });
  });

  describe("switch value caching", () => {
    it("should only track when switch value changes", () => {
      const track = jest.fn();
      const service = setup({
        amplitude: {
          track
        },
        storage: {
          getItem: jest.fn().mockReturnValue(
            JSON.stringify({
              connect_wallet: "custodial"
            })
          ),
          setItem: jest.fn()
        },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });
      service.identify({ id: faker.string.uuid() });
      service.trackSwitch("connect_wallet", "managed", "Amplitude");
      service.trackSwitch("connect_wallet", "managed", "Amplitude");

      expect(track).toHaveBeenCalledWith("connect_wallet", {
        value: "managed"
      });
      expect(track).toHaveBeenCalledTimes(1);
    });
  });

  describe("identify", () => {
    it("should identify user in both GA and Amplitude", () => {
      const identify = jest.fn();
      const setUserId = jest.fn();
      const service = setup({
        amplitude: { identify, setUserId },
        ga: { event: jest.fn() },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });
      service.identify({ id: faker.string.uuid() });

      expect(identify).toHaveBeenCalled();
      expect(setUserId).toHaveBeenCalled();
    });

    it("should only identify in enabled services", () => {
      const identify = jest.fn();
      const setUserId = jest.fn();
      const gtag = jest.fn();
      const service = setup({
        amplitude: { identify, setUserId },
        gtag,
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const user = { id: faker.string.uuid() };
      service.identify(user);

      expect(gtag).toHaveBeenCalledWith("config", mockGaMeasurementId, { user_id: user.id });
      expect(identify).not.toHaveBeenCalled();
      expect(setUserId).not.toHaveBeenCalled();
    });
  });

  describe("track", () => {
    it("should track events in both GA and Amplitude when no target specified", () => {
      const track = jest.fn();
      const event = jest.fn();
      const service = setup({
        amplitude: { track },
        ga: { event },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = {
        category: "wallet" as const,
        someProperty: faker.word.sample()
      };

      service.identify({ id: faker.string.uuid() }); // Initialize sampling
      service.track("connect_wallet", properties);

      expect(track).toHaveBeenCalledWith("connect_wallet", properties);
      expect(event).toHaveBeenCalledWith("connect_wallet", properties);
    });

    it("should track events only in specified target", () => {
      const track = jest.fn();
      const event = jest.fn();
      const service = setup({
        amplitude: { track },
        ga: { event },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = { category: "wallet" as const };

      service.identify({ id: faker.string.uuid() }); // Initialize sampling
      service.track("connect_wallet", properties, "Amplitude");

      expect(track).toHaveBeenCalledWith("connect_wallet", properties);
      expect(event).not.toHaveBeenCalled();
    });

    it("should transform GA event names correctly", () => {
      const event = jest.fn();
      const service = setup({
        ga: { event },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = { category: "transactions" as const };
      service.track("successful_tx", properties);

      expect(event).toHaveBeenCalledWith("successful_transaction", properties);
    });

    it("should handle navigate_tab events specially for GA", () => {
      const event = jest.fn();
      const service = setup({
        ga: { event },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = {
        category: "user" as const,
        tab: "settings"
      };

      service.track("navigate_tab", properties);
      expect(event).toHaveBeenCalledWith("navigate_tab_settings", properties);
    });

    it("should only track in enabled services", () => {
      const track = jest.fn();
      const event = jest.fn();
      const service = setup({
        amplitude: { track },
        ga: { event },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 0.25 },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = { category: "wallet" as const };
      service.track("connect_wallet", properties);

      expect(track).not.toHaveBeenCalled();
      expect(event).toHaveBeenCalled();
    });
  });

  function setup(params: {
    amplitude?: Mocked<Amplitude>;
    ga?: Mocked<GoogleAnalytics>;
    gtag?: Gtag.Gtag;
    hashFn?: HashFn;
    options?: AnalyticsOptions;
    storage?: Pick<Storage, "getItem" | "setItem">;
  }): AnalyticsService {
    const amplitude = {
      init: jest.fn(),
      Identify: jest.fn().mockImplementation(() => ({
        set: jest.fn()
      })),
      identify: jest.fn(),
      track: jest.fn(),
      setUserId: jest.fn(),
      ...(params.amplitude ?? {})
    };
    const ga = {
      event: jest.fn(),
      ...(params.ga ?? {})
    };
    const hash: HashFn = params.hashFn ?? jest.fn().mockImplementation(() => 0);
    const storage = params.storage ?? {
      getItem: jest.fn(),
      setItem: jest.fn()
    };

    return new AnalyticsService(
      params.options ?? {
        amplitude: { enabled: false, apiKey: mockAmplitudeApiKey, samplingRate: 1 },
        ga: { enabled: false, measurementId: mockGaMeasurementId }
      },
      amplitude,
      hash,
      ga,
      params.gtag ?? jest.fn(),
      storage
    );
  }
});
