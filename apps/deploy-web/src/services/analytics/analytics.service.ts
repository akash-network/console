"use client";

import * as amplitude from "@amplitude/analytics-browser";
import { event } from "nextjs-google-analytics";

export type AnalyticsUser = {
  id?: string;
  anonymous?: boolean;
  emailVerified?: boolean;
  custodialWallet?: boolean;
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
  | "password_auth_submit"
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
  | "trial_completed"
  | "create_api_key"
  | "delete_api_key"
  | "close_deposit_modal"
  | "buy_credits_btn_clk"
  | "resend_verification_email_btn_clk"
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
  | "sdl_uploaded"
  | "deposit_deployment_btn_clk"
  | "add_funds_btn_clk"
  | "add_funds_coupon_btn_clk"
  | "add_funds_coupon_claim_amount_btn_clk"
  | "redeploy_btn_clk"
  | "edit_name_btn_clk"
  | "payment_cancelled"
  | "payment_success"
  | "create_deployment_btn_clk"
  | "onboarding_step_started"
  | "onboarding_step_completed"
  | "onboarding_free_trial_started"
  | "onboarding_account_created"
  | "onboarding_email_verified"
  | "onboarding_payment_method_added"
  | "onboarding_completed"
  | "onboarding_logout";

export type AnalyticsCategory =
  | "user"
  | "billing"
  | "deployments"
  | "wallet"
  | "sdl_builder"
  | "transactions"
  | "certificates"
  | "profile"
  | "settings"
  | "onboarding";

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
  emailVerified: "is_email_verified",
  custodialWallet: "custodial_wallet",
  managedWallet: "managed_wallet"
};

const isBrowser = typeof window !== "undefined";

export type Amplitude = Pick<typeof amplitude, "init" | "Identify" | "identify" | "track" | "setUserId">;
export type GoogleAnalytics = { event: typeof event };

export class AnalyticsService {
  private readonly STORAGE_KEY = "analytics_values_cache";

  private readonly valuesCache: Map<string, string> = this.loadSwitchValuesFromStorage();

  private readonly isAmplitudeEnabled: boolean;
  private amplitudeInitialized = false;

  private get gtag() {
    return this.getGtag();
  }

  constructor(
    private readonly options: AnalyticsOptions,
    private readonly amplitudeClient: Amplitude = amplitude,
    private readonly ga: GoogleAnalytics = { event },
    private readonly getGtag: () => Gtag.Gtag | undefined = () => (isBrowser ? window.gtag : undefined),
    private readonly storage: Pick<Storage, "getItem" | "setItem"> | undefined = isBrowser ? window.localStorage : undefined
  ) {
    this.isAmplitudeEnabled = this.options.amplitude.enabled;
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

    if (this.options.ga.enabled && this.gtag && user.id) {
      this.gtag("config", this.options.ga.measurementId, { user_id: user.id });
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
    this.amplitudeClient.init(this.options.amplitude.apiKey, undefined, initOptions);
    this.amplitudeInitialized = true;
  }

  trackSwitch(eventName: "connect_wallet", value: "managed" | "custodial", target?: AnalyticsTarget): void;
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

    if (this.isAmplitudeEnabled && (!analyticsTarget || analyticsTarget === "Amplitude")) {
      this.initAmplitude();
      this.amplitudeClient.track(eventName, eventProperties);
    }

    if (this.options.ga.enabled && (!analyticsTarget || analyticsTarget === "GA")) {
      this.ga?.event(...this.transformGaEvent(eventName, eventProperties));
    }
  }

  private transformGaEvent(eventName: AnalyticsEvent, eventProperties: EventProperties): [string, Record<string, unknown>] {
    if (eventName === "navigate_tab") {
      return [`${eventName}_${eventProperties.tab}`, eventProperties];
    }

    return [GA_EVENTS[eventName as keyof typeof GA_EVENTS] || eventName, eventProperties];
  }
}
