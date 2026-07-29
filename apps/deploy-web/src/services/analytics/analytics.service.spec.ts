import { faker } from "@faker-js/faker";
import { describe, expect, it, type Mock, vi } from "vitest";

import type { Amplitude, AnalyticsOptions } from "./analytics.service";
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
      const add = vi.fn();
      const service = setup({
        amplitude: { init, add },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.identify({ id: faker.string.uuid() });
      expect(init).toHaveBeenCalled();
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ name: "@amplitude/plugin-session-replay-browser" }));
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
      const dataLayer: Record<string, unknown>[] = [];
      const service = setup({
        amplitude: { identify, setUserId },
        dataLayer,
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const user = { id: faker.string.uuid() };
      service.identify(user);

      expect(dataLayer).toContainEqual({ user_id: user.id });
      expect(identify).not.toHaveBeenCalled();
      expect(setUserId).not.toHaveBeenCalled();
    });
  });

  describe("track", () => {
    it("should track events in both GA and Amplitude when no target specified", () => {
      const track = vi.fn();
      const dataLayer: Record<string, unknown>[] = [];
      const service = setup({
        amplitude: { track },
        dataLayer,
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = {
        category: "wallet" as const,
        someProperty: faker.word.sample()
      };

      service.identify({ id: faker.string.uuid() });
      service.track("connect_wallet", properties);

      expect(track).toHaveBeenCalledWith("connect_wallet", properties);
      expect(dataLayer).toContainEqual({ event: "connect_wallet", ...properties });
    });

    it("should track events only in specified target", () => {
      const track = vi.fn();
      const dataLayer: Record<string, unknown>[] = [];
      const service = setup({
        amplitude: { track },
        dataLayer,
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = { category: "wallet" as const };

      service.identify({ id: faker.string.uuid() });
      service.track("connect_wallet", properties, "Amplitude");

      expect(track).toHaveBeenCalledWith("connect_wallet", properties);
      expect(dataLayer).not.toContainEqual(expect.objectContaining({ event: "connect_wallet" }));
    });

    it("should transform GA event names correctly", () => {
      const dataLayer: Record<string, unknown>[] = [];
      const service = setup({
        dataLayer,
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = { category: "transactions" as const };
      service.track("successful_tx", properties);

      expect(dataLayer).toContainEqual({ event: "successful_transaction", ...properties });
    });

    it("should handle navigate_tab events specially for GA", () => {
      const dataLayer: Record<string, unknown>[] = [];
      const service = setup({
        dataLayer,
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
      expect(dataLayer).toContainEqual({ event: "navigate_tab_settings", ...properties });
    });

    it("should only track in enabled services", () => {
      const track = vi.fn();
      const dataLayer: Record<string, unknown>[] = [];
      const service = setup({
        amplitude: { track },
        dataLayer,
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      const properties = { category: "wallet" as const };
      service.track("connect_wallet", properties);

      expect(track).not.toHaveBeenCalled();
      expect(dataLayer).toContainEqual({ event: "connect_wallet", ...properties });
    });
  });

  describe("utm attribution", () => {
    it("stamps utm params from the landing url onto tracked events in both services", () => {
      const track = vi.fn();
      const dataLayer: Record<string, unknown>[] = [];
      const service = setup({
        amplitude: { track },
        dataLayer,
        locationSearch: "?utm_source=twitter&utm_campaign=launch",
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: true, measurementId: mockGaMeasurementId }
        }
      });

      service.track("onboarding_deploy_click", { category: "onboarding" });

      expect(track).toHaveBeenCalledWith("onboarding_deploy_click", {
        category: "onboarding",
        utm_source: "twitter",
        utm_campaign: "launch"
      });
      expect(dataLayer).toContainEqual({ event: "onboarding_deploy_click", category: "onboarding", utm_source: "twitter", utm_campaign: "launch" });
    });

    it("persists the captured utm params under the utm storage key", () => {
      const setItem = vi.fn();
      setup({
        storage: { getItem: vi.fn(), setItem },
        locationSearch: "?utm_source=twitter",
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      expect(setItem).toHaveBeenCalledWith("analytics_utm", JSON.stringify({ utm_source: "twitter" }));
    });

    it("freezes the first-touch snapshot and ignores params from a later visit", () => {
      const track = vi.fn();
      const setItem = vi.fn();
      const service = setup({
        amplitude: { track },
        storage: { getItem: key => (key === "analytics_utm" ? JSON.stringify({ utm_source: "google" }) : null), setItem },
        locationSearch: "?utm_source=twitter&utm_medium=cpc",
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.track("onboarding_deploy_click", { category: "onboarding" });

      expect(track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", utm_source: "google" });
      expect(setItem).not.toHaveBeenCalledWith("analytics_utm", expect.anything());
    });

    it("does not stamp any utm params when the landing url carries none", () => {
      const track = vi.fn();
      const service = setup({
        amplitude: { track },
        locationSearch: "",
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.track("onboarding_deploy_click", { category: "onboarding" });

      expect(track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding" });
    });
  });

  describe("static deployment page views", () => {
    it("strips the deployment sequence from the page title so every deployment detail view shares one title", async () => {
      const plugin = setupPageViewPlugin();

      const event = await plugin.execute({
        event_type: "[Amplitude] Page Viewed",
        event_properties: { "[Amplitude] Page Title": "Deployment detail #10244913 | Akash Console" }
      });

      expect(event.event_properties["[Amplitude] Page Title"]).toBe("Deployment detail | Akash Console");
    });

    it("strips a digit-masked deployment sequence from the page title", async () => {
      const plugin = setupPageViewPlugin();

      const event = await plugin.execute({
        event_type: "[Amplitude] Page Viewed",
        event_properties: { "[Amplitude] Page Title": "Deployment detail #*****5 | Akash Console" }
      });

      expect(event.event_properties["[Amplitude] Page Title"]).toBe("Deployment detail | Akash Console");
    });

    it("collapses the deployment sequence in page path, url and location so every view shares one page", async () => {
      const plugin = setupPageViewPlugin();

      const event = await plugin.execute({
        event_type: "[Amplitude] Page Viewed",
        event_properties: {
          "[Amplitude] Page Path": "/deployments/1785249677934",
          "[Amplitude] Page URL": "http://localhost:3000/deployments/1785249677934",
          "[Amplitude] Page Location": "http://localhost:3000/deployments/1785249677934?tab=LEASES"
        }
      });

      expect(event.event_properties["[Amplitude] Page Path"]).toBe("/deployments/[dseq]");
      expect(event.event_properties["[Amplitude] Page URL"]).toBe("http://localhost:3000/deployments/[dseq]");
      expect(event.event_properties["[Amplitude] Page Location"]).toBe("http://localhost:3000/deployments/[dseq]?tab=LEASES");
    });

    it("leaves pages without a deployment sequence unchanged", async () => {
      const plugin = setupPageViewPlugin();

      const event = await plugin.execute({
        event_type: "[Amplitude] Page Viewed",
        event_properties: { "[Amplitude] Page Title": "Deployments | Akash Console", "[Amplitude] Page Path": "/deployments" }
      });

      expect(event.event_properties["[Amplitude] Page Title"]).toBe("Deployments | Akash Console");
      expect(event.event_properties["[Amplitude] Page Path"]).toBe("/deployments");
    });

    it("ignores events that are not inbuilt page views", async () => {
      const plugin = setupPageViewPlugin();

      const event = await plugin.execute({
        event_type: "create_deployment",
        event_properties: { "[Amplitude] Page Path": "/deployments/1785249677934" }
      });

      expect(event.event_properties["[Amplitude] Page Path"]).toBe("/deployments/1785249677934");
    });

    function setupPageViewPlugin() {
      const add = vi.fn();
      const service = setup({
        amplitude: { add },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.identify({ id: faker.string.uuid() });

      return add.mock.calls.map(call => call[0]).find(plugin => plugin?.name === "static-deployment-page-view");
    }
  });

  describe("flush", () => {
    it("sends queued events immediately when Amplitude is enabled", () => {
      const flush = vi.fn();
      const service = setup({
        amplitude: { flush },
        options: {
          amplitude: { enabled: true, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.flush();

      expect(flush).toHaveBeenCalled();
    });

    it("does not flush when Amplitude is disabled", () => {
      const flush = vi.fn();
      const service = setup({
        amplitude: { flush },
        options: {
          amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
          ga: { enabled: false, measurementId: mockGaMeasurementId }
        }
      });

      service.flush();

      expect(flush).not.toHaveBeenCalled();
    });
  });

  function setup(params: {
    amplitude?: Mocked<Amplitude>;
    dataLayer?: Record<string, unknown>[];
    options?: AnalyticsOptions;
    storage?: Pick<Storage, "getItem" | "setItem">;
    locationSearch?: string;
  }) {
    const amplitude = {
      init: vi.fn(),
      Identify: class {
        set = vi.fn();
      } as unknown as Amplitude["Identify"],
      identify: vi.fn(),
      track: vi.fn(),
      setUserId: vi.fn(),
      add: vi.fn(),
      flush: vi.fn(),
      ...(params.amplitude ?? {})
    };
    const storage = params.storage ?? {
      getItem: vi.fn(),
      setItem: vi.fn()
    };
    const dataLayer = params.dataLayer ?? [];

    return new AnalyticsService(
      params.options ?? {
        amplitude: { enabled: false, apiKey: mockAmplitudeApiKey },
        ga: { enabled: false, measurementId: mockGaMeasurementId }
      },
      amplitude,
      () => dataLayer,
      storage,
      () => params.locationSearch ?? ""
    );
  }
});
