import { faker } from "@faker-js/faker";
import { describe, expect, it, type Mock, vi } from "vitest";

import type { Amplitude, AnalyticsOptions, GoogleAnalytics } from "./analytics.service";
import { AnalyticsService } from "./analytics.service";

type Mocked<T> = {
  [K in keyof T]?: Mock;
};

describe(AnalyticsService.name, () => {
  const mockAmplitudeApiKey = faker.string.uuid();
  const mockGaMeasurementId = faker.string.uuid();

  describe("initialization", () => {
    it("does not initialize Amplitude when disabled", () => {
      const init = vi.fn();
      const service = setup({
        amplitude: { init },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.identify({ id: faker.string.uuid() });
      expect(init).not.toHaveBeenCalled();
    });

    it("initializes Amplitude when enabled", () => {
      const init = vi.fn();
      const service = setup({
        amplitude: { init },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.identify({ id: faker.string.uuid() });
      expect(init).toHaveBeenCalled();
    });
  });

  describe("switch value caching", () => {
    it("should only track when switch value changes", () => {
      const track = vi.fn();
      const service = setup({
        amplitude: {
          track
        },
        storage: {
          getItem: vi.fn().mockReturnValue(
            JSON.stringify({
              connect_wallet: "custodial"
            })
          ),
          setItem: vi.fn()
        },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
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
      const identify = vi.fn();
      const setUserId = vi.fn();
      const service = setup({
        amplitude: { identify, setUserId },
        ga: { event: vi.fn() },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });
      service.identify({ id: faker.string.uuid() });

      expect(identify).toHaveBeenCalled();
      expect(setUserId).toHaveBeenCalled();
    });

    it("should only identify in enabled services", () => {
      const identify = vi.fn();
      const setUserId = vi.fn();
      const gtag = vi.fn();
      const service = setup({
        amplitude: { identify, setUserId },
        gtag,
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
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
      const track = vi.fn();
      const event = vi.fn();
      const service = setup({
        amplitude: { track },
        ga: { event },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
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
      const track = vi.fn();
      const event = vi.fn();
      const service = setup({
        amplitude: { track },
        ga: { event },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
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
      const event = vi.fn();
      const service = setup({
        ga: { event },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = { category: "transactions" as const };
      service.track("successful_tx", properties);

      expect(event).toHaveBeenCalledWith("successful_transaction", properties);
    });

    it("should handle navigate_tab events specially for GA", () => {
      const event = vi.fn();
      const service = setup({
        ga: { event },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
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
      const track = vi.fn();
      const event = vi.fn();
      const service = setup({
        amplitude: { track },
        ga: { event },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
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
    options?: AnalyticsOptions;
    storage?: Pick<Storage, "getItem" | "setItem">;
  }) {
    const amplitude = {
      init: vi.fn(),
      Identify: class {
        set = vi.fn();
      } as unknown as Amplitude["Identify"],
      identify: vi.fn(),
      track: vi.fn(),
      setUserId: vi.fn(),
      ...(params.amplitude ?? {})
    };
    const ga = {
      event: vi.fn(),
      ...(params.ga ?? {})
    };
    const storage = params.storage ?? {
      getItem: vi.fn(),
      setItem: vi.fn()
    };

    return new AnalyticsService(
      params.options ?? {
        amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
        ga: { enabled: false, measurementId: mockGaMeasurementId }
      },
      amplitude,
      ga,
      () => params.gtag ?? vi.fn(),
      storage
    );
  }
});
