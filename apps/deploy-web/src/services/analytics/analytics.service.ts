"use client";

import * as amplitude from "@amplitude/analytics-browser";
import { sessionReplayPlugin } from "@amplitude/plugin-session-replay-browser";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type AnalyticsUser = {
  id?: string;
  anonymous?: boolean;
  emailVerified?: boolean;
  managedWallet?: boolean;
};

export type AnalyticsOptions = {
  amplitude: {
    apiKey: string;
    enabled: boolean;
    serverUrl?: string;
  };
  ga: {
    measurementId: string;
    enabled: boolean;
  };
};

type AnalyticsTarget = "Amplitude" | "GA";

export type AnalyticsEvent =
  | "social_login_init"
  | "email_login_init"
  | "terms_link_clk"
  | "privacy_policy_link_clk"
  | "wrong_email_clk"
  | "resend_code_clk"
  | "password_auth_submit"
  | "connect_wallet"
  | "connect_managed_wallet"
  | "disconnect_wallet"
  | "successful_tx"
  | "failed_tx"
  | "deployment_deposit"
  | "add_runtime_hours"
  | "remove_runtime_limit"
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
  | "account_created"
  | "trial_completed"
  | "create_api_key"
  | "delete_api_key"
  | "close_deposit_modal"
  | "buy_credits_btn_clk"
  | "send_verification_code_btn_clk"
  | "builder_mode_btn_clk"
  | "yml_mode_btn_clk"
  | "bid_selected"
  | "bids_received"
  | "filtered_by_favorite_providers"
  | "filtered_by_audited_providers"
  | "close_deployment_btn_clk"
  | "build_n_deploy_btn_clk"
  | "launch_container_vm_btn_clk"
  | "run_custom_container_btn_clk"
  | "deploy_with_agent_btn_clk"
  | "sdl_uploaded"
  | "deposit_deployment_btn_clk"
  | "add_runtime_hours_btn_clk"
  | "remove_runtime_limit_btn_clk"
  | "add_funds_btn_clk"
  | "add_funds_coupon_btn_clk"
  | "add_funds_coupon_claim_amount_btn_clk"
  | "redeploy_btn_clk"
  | "edit_name_btn_clk"
  | "create_deployment_btn_clk"
  | "log_collector_enabled"
  | "log_collector_disabled"
  | "log_collector_deployed"
  | "onboarding_deploy_click"
  | "onboarding_choose_provider_click"
  | "onboarding_skipped"
  | "add_credits_opened"
  | "add_credits_amount_selected"
  | "add_credits_payment_method_selected"
  | "add_credits_purchased"
  | "add_credits_cancelled"
  | "configure_page_viewed"
  | "configure_preset_selected"
  | "configure_gpu_type_selected"
  | "configure_gpu_count_changed"
  | "configure_cpu_count_changed"
  | "configure_sdl_imported"
  | "configure_sdl_downloaded"
  | "configure_sdl_copied"
  | "cancel_during_create"
  | "close_deployment_failed"
  | "cancelled_deployment_auto_close_failed"
  | "review_deploy_opened"
  | "review_deploy_confirmed"
  | "review_deploy_dismissed";

export type AnalyticsCategory = "user" | "billing" | "deployments" | "wallet" | "sdl_builder" | "transactions" | "profile" | "settings" | "onboarding";

export type EventProperties = {
  category?: AnalyticsCategory;
  [key: string]: unknown;
};

const GA_EVENTS = {
  successful_tx: "successful_transaction"
};

const AMPLITUDE_USER_PROPERTIES_MAP = {
  id: "user_id",
  anonymous: "is_anonymous",
  emailVerified: "is_email_verified",
  managedWallet: "managed_wallet"
};

const AMPLITUDE_PAGE_VIEWED_EVENT = "[Amplitude] Page Viewed";
const AMPLITUDE_PAGE_TITLE_PROPERTY = "[Amplitude] Page Title";
const AMPLITUDE_LOCATION_PROPERTIES = ["[Amplitude] Page Path", "[Amplitude] Page URL", "[Amplitude] Page Location"] as const;

/**
 * Deployment detail views embed the deployment sequence in both the page title (`Deployment detail #12345 |
 * Akash Console`, sometimes digit-masked by Amplitude as `#*****5`) and the URL (`/deployments/12345`), so the
 * inbuilt page-view event records a unique title and path per deployment and its views cannot be aggregated.
 * Collapsing the sequence to a static value lets every deployment detail view be filtered as a single page.
 */
const DEPLOYMENT_SEQUENCE_TITLE_MARKER = / #[\d*]+/;
const DEPLOYMENT_SEQUENCE_PATH = /\/deployments\/\d+/g;
const STATIC_DEPLOYMENT_PATH = "/deployments/[dseq]";

const UTM_PARAM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

const isBrowser = typeof window !== "undefined";

/**
 * Hosts that never belong to a real user: dev servers and jsdom test runs both report one of these, and every
 * device they invent is billed as a tracked user against the Amplitude MTU quota even though nobody is using the app.
 */
const UNTRACKABLE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isTrackableHostname(hostname: string): boolean {
  if (!hostname || UNTRACKABLE_HOSTNAMES.has(hostname)) {
    return false;
  }

  return !hostname.endsWith(".localhost") && !hostname.endsWith(".local");
}

export type Amplitude = Pick<typeof amplitude, "init" | "Identify" | "identify" | "track" | "setUserId" | "add" | "flush">;

export class AnalyticsService {
  private readonly STORAGE_KEY = "analytics_values_cache";
  private readonly UTM_STORAGE_KEY = "analytics_utm";

  private readonly valuesCache: Map<string, string> = this.loadSwitchValuesFromStorage();

  private readonly isAmplitudeEnabled: boolean;
  private amplitudeInitialized = false;

  /** First-touch UTM params, stamped onto every tracked event so acquisition funnels can be attributed to a campaign. */
  private readonly utmProperties: Record<string, string>;

  constructor(
    private readonly options: AnalyticsOptions,
    private readonly amplitudeClient: Amplitude = amplitude,
    private readonly getDataLayer: () => Record<string, unknown>[] | undefined = () => (isBrowser ? window.dataLayer : undefined),
    private readonly storage: Pick<Storage, "getItem" | "setItem"> | undefined = isBrowser ? window.localStorage : undefined,
    private readonly getLocationSearch: () => string = () => (isBrowser ? window.location.search : ""),
    private readonly getHostname: () => string = () => (isBrowser ? window.location.hostname : "")
  ) {
    this.isAmplitudeEnabled = this.options.amplitude.enabled && isTrackableHostname(this.getHostname());
    this.utmProperties = this.captureFirstTouchUtm();
  }

  /**
   * Captures `utm_*` from the first UTM-bearing visit and freezes it: once a snapshot is stored it is returned
   * unchanged, so a later visit from a different campaign can't blend its params into the original acquisition touch.
   */
  private captureFirstTouchUtm(): Record<string, string> {
    if (!isBrowser) {
      return {};
    }

    const storedUtm = this.readStoredUtm();
    if (Object.keys(storedUtm).length > 0) {
      return storedUtm;
    }

    const urlUtm = this.readUrlUtm();
    if (Object.keys(urlUtm).length > 0) {
      this.storage?.setItem(this.UTM_STORAGE_KEY, JSON.stringify(urlUtm));
    }

    return urlUtm;
  }

  private readUrlUtm(): Record<string, string> {
    const params = new URLSearchParams(this.getLocationSearch());
    return this.pickUtmParams(key => params.get(key));
  }

  private readStoredUtm(): Record<string, string> {
    const stored = this.storage?.getItem(this.UTM_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      return this.pickUtmParams(key => (typeof parsed[key] === "string" ? (parsed[key] as string) : null));
    } catch {
      return {};
    }
  }

  private pickUtmParams(getValue: (key: string) => string | null): Record<string, string> {
    const utm: Record<string, string> = {};
    for (const key of UTM_PARAM_KEYS) {
      const value = getValue(key);
      if (value) {
        utm[key] = value;
      }
    }
    return utm;
  }

  private loadSwitchValuesFromStorage() {
    if (typeof window !== "undefined") {
      const stored = this.storage?.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    }

    return new Map();
  }

  identify(user: AnalyticsUser): void {
    if (!isBrowser || !Object.keys(user).length) {
      return;
    }

    if (this.options.ga.enabled && user.id) {
      this.getDataLayer()?.push({ user_id: user.id });
    }

    if (!this.isAmplitudeEnabled) {
      return;
    }

    this.initAmplitude();
    const event = new this.amplitudeClient.Identify();

    for (const key in user) {
      if (key !== "id") {
        event.set(AMPLITUDE_USER_PROPERTIES_MAP[key as keyof AnalyticsUser] || key, String(user[key as keyof typeof user]));
      }
    }

    this.amplitudeClient.identify(event);

    if (user.id) {
      this.amplitudeClient.setUserId(user.id);
    }
  }

  private initAmplitude() {
    if (this.amplitudeInitialized) {
      return;
    }

    const { serverUrl } = this.options.amplitude;
    const initOptions = serverUrl ? { serverUrl } : undefined;

    const sessionReplayTracking = sessionReplayPlugin();
    this.amplitudeClient.add(sessionReplayTracking);
    this.amplitudeClient.add(createStaticDeploymentPageViewPlugin());

    this.amplitudeClient.init(this.options.amplitude.apiKey, undefined, initOptions);
    this.amplitudeInitialized = true;
  }

  trackSwitch(eventName: "connect_wallet", value: "managed", target?: AnalyticsTarget): void;
  trackSwitch(eventName: AnalyticsEvent, value: string, target?: AnalyticsTarget) {
    if (!isBrowser) {
      return;
    }

    if (this.valuesCache.get(eventName) === value) {
      return;
    }

    this.saveSwitchValue(eventName, value);

    return this.track(eventName, { value }, target);
  }

  private saveSwitchValue(eventName: string, value: string) {
    this.valuesCache.set(eventName, value);
    const obj = Object.fromEntries(this.valuesCache);
    this.storage?.setItem(this.STORAGE_KEY, JSON.stringify(obj));
  }

  track(eventName: AnalyticsEvent, target?: AnalyticsTarget): void;
  track(eventName: AnalyticsEvent, eventProperties: EventProperties, target?: AnalyticsTarget): void;
  track(eventName: AnalyticsEvent, eventPropertiesOrTarget?: EventProperties | AnalyticsTarget, target?: AnalyticsTarget): void {
    if (!isBrowser) {
      return;
    }

    const analyticsTarget = typeof eventPropertiesOrTarget === "string" ? eventPropertiesOrTarget : target;
    const eventProperties = typeof eventPropertiesOrTarget === "object" ? eventPropertiesOrTarget : {};
    const enrichedProperties = { ...this.utmProperties, ...eventProperties };

    if (this.isAmplitudeEnabled && (!analyticsTarget || analyticsTarget === "Amplitude")) {
      this.initAmplitude();
      this.amplitudeClient.track(eventName, enrichedProperties);
    }

    if (this.options.ga.enabled && (!analyticsTarget || analyticsTarget === "GA")) {
      const [name, props] = this.transformGaEvent(eventName, enrichedProperties);
      this.getDataLayer()?.push({ ...props, event: name });
    }
  }

  flush(): void {
    if (!isBrowser || !this.isAmplitudeEnabled) {
      return;
    }

    this.amplitudeClient.flush();
  }

  private transformGaEvent(eventName: AnalyticsEvent, eventProperties: EventProperties): [string, Record<string, unknown>] {
    if (eventName === "navigate_tab") {
      return [`${eventName}_${eventProperties.tab}`, eventProperties];
    }

    return [GA_EVENTS[eventName as keyof typeof GA_EVENTS] || eventName, eventProperties];
  }
}

function createStaticDeploymentPageViewPlugin(): amplitude.Types.EnrichmentPlugin {
  return {
    name: "static-deployment-page-view",
    type: "enrichment",
    execute: async event => {
      if (event.event_type !== AMPLITUDE_PAGE_VIEWED_EVENT) {
        return event;
      }

      const properties = event.event_properties;
      if (!properties) {
        return event;
      }

      const title = properties[AMPLITUDE_PAGE_TITLE_PROPERTY];
      if (typeof title === "string") {
        properties[AMPLITUDE_PAGE_TITLE_PROPERTY] = title.replace(DEPLOYMENT_SEQUENCE_TITLE_MARKER, "");
      }

      for (const property of AMPLITUDE_LOCATION_PROPERTIES) {
        const value = properties[property];
        if (typeof value === "string") {
          properties[property] = value.replace(DEPLOYMENT_SEQUENCE_PATH, STATIC_DEPLOYMENT_PATH);
        }
      }

      return event;
    }
  };
}
