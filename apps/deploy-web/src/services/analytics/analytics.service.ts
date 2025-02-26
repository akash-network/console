import { Identify, identify, init, setUserId, track } from "@amplitude/analytics-browser";
import murmurhash from "murmurhash";
import { event } from "nextjs-google-analytics";

import { browserEnvConfig } from "@src/config/browser-env.config";

export type AnalyticsUser = {
  id: string;
  anonymous?: boolean;
  emailVerified?: boolean;
};

type AnalyticsOptions = {
  amplitude: {
    apiKey: string;
    enabled: boolean;
  };
  ga: {
    measurementId: string;
    enabled: boolean;
  };
};

type AnalyticsTarget = "Amplitude" | "GA";

export type AnalyticsEvent =
  | "connect_wallet"
  | "connect_managed_wallet"
  | "disconnect_wallet"
  | "successful_tx"
  | "failed_tx"
  | "revoke_certificate"
  | "revoke_all_certificates"
  | "create_certificate"
  | "regenerate_certificate"
  | "export_certificate"
  | "deployment_deposit"
  | "close_deployment"
  | "use_depositor"
  | "downloaded_logs"
  | "update_deployment"
  | "downloaded_shell_file"
  | "create_lease"
  | "send_manifest"
  | "create_deployment"
  | "create_gpu_deployment"
  | "authorize_spend"
  | "navigate_tab"
  | "leap_get_more_tokens"
  | "leap_tx_complete"
  | "deploy_sdl"
  | "preview_sdl"
  | "import_sdl"
  | "reset_sdl"
  | "create_sdl_template"
  | "create_sdl_template_link"
  | "update_sdl_template"
  | "click_sdl_profile"
  | "click_view_template"
  | "save_sdl_description"
  | "add_sdl_favorite"
  | "remove_sdl_favorite"
  | "click_edit_sdl_template"
  | "user_profile_click_template"
  | "user_profile_template_tab"
  | "user_settings_save"
  | "anonymous_user_created"
  | "trial_started"
  | "create_api_key"
  | "delete_api_key";

export type AnalyticsCategory = "user" | "billing" | "deployments" | "wallet" | "sdl_builder" | "transactions" | "certificates" | "profile" | "settings";

export type EventProperties = {
  category?: AnalyticsCategory;
  [key: string]: unknown;
};

const GA_EVENTS = {
  successful_tx: "successful_transaction",
  leap_tx_complete: "leap_transaction_complete",
  revoke_all_certificates: "revoke_all_certificate"
};

const AMPLITUDE_USER_PROPERTIES_MAP = {
  id: "user_id",
  anonymous: "is_anonymous",
  emailVerified: "is_email_verified"
};

const isBrowser = typeof window !== "undefined";

export class AnalyticsService {
  private readonly STORAGE_KEY = "analytics_values_cache";

  private readonly valuesCache: Map<string, string> = this.loadSwitchValuesFromStorage();

  private readonly SAMPLING_RATE = 0.25;

  private isAmplitudeEnabled: boolean | undefined;

  constructor(private readonly options: AnalyticsOptions) {
    if (this.options.amplitude.enabled === false) {
      this.isAmplitudeEnabled = false;
    }
  }

  private loadSwitchValuesFromStorage() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    }

    return new Map();
  }

  identify(user: AnalyticsUser): void {
    if (!isBrowser) {
      return;
    }

    if (this.options.ga.enabled && typeof window !== "undefined") {
      window.gtag("config", this.options.ga.measurementId, { user_id: user.id });
    }

    this.ensureAmplitudeFor(user);

    if (!this.isAmplitudeEnabled) {
      return;
    }

    const event = new Identify();

    for (const key in user) {
      if (key !== "id") {
        event.set(AMPLITUDE_USER_PROPERTIES_MAP[key] || AMPLITUDE_USER_PROPERTIES_MAP, user[key]);
      }
    }

    identify(event);

    if (user.id) {
      setUserId(user.id);
    }
  }

  private ensureAmplitudeFor(user: AnalyticsUser) {
    if (typeof this.isAmplitudeEnabled === "undefined" && user.id) {
      this.isAmplitudeEnabled = this.shouldSampleUser(user.id);

      if (this.isAmplitudeEnabled) {
        init(this.options.amplitude.apiKey, {
          serverUrl: "/api/analytics"
        });
      }
    }
  }

  trackSwitch(eventName: "connect_wallet", value: "managed" | "custodial", target?: AnalyticsTarget);
  trackSwitch(eventName: any, value: any, target?: AnalyticsTarget) {
    if (!isBrowser) {
      return;
    }

    if (this.valuesCache.get(eventName) === value) {
      return;
    }

    this.saveSwitchValue(eventName, value);

    return this.track(eventName, { tab: value }, target);
  }

  private saveSwitchValue(eventName: string, value: string) {
    this.valuesCache.set(eventName, value);
    const obj = Object.fromEntries(this.valuesCache);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
  }

  track(eventName: AnalyticsEvent, eventProperties: EventProperties, target?: AnalyticsTarget): void {
    if (!isBrowser) {
      return;
    }

    if (this.isAmplitudeEnabled && (!target || target === "Amplitude")) {
      track(eventName, eventProperties);
    }

    if (this.options.ga.enabled && (!target || target === "GA")) {
      event(...this.transformGaEvent(eventName, eventProperties));
    }
  }

  private transformGaEvent(eventName: AnalyticsEvent, eventProperties: EventProperties): [string, Record<string, unknown>] {
    if (eventName === "navigate_tab") {
      return [`${eventName}_${eventProperties.tab}`, eventProperties];
    }

    return [GA_EVENTS[eventName] || eventName, eventProperties];
  }

  private shouldSampleUser(userId: string): boolean {
    const hashValue = murmurhash.v3(userId);
    const percentage = Math.abs(hashValue) % 100;
    return percentage < this.SAMPLING_RATE * 100;
  }
}

export const analyticsService = new AnalyticsService({
  amplitude: {
    enabled: browserEnvConfig.NEXT_PUBLIC_AMPLITUDE_ENABLED,
    apiKey: browserEnvConfig.NEXT_PUBLIC_AMPLITUDE_API_KEY
  },
  ga: {
    measurementId: browserEnvConfig.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    enabled: browserEnvConfig.NEXT_PUBLIC_GA_ENABLED
  }
});
