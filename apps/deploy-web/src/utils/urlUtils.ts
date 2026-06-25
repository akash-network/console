import { UrlReturnToStack } from "@src/hooks/useReturnTo/UrlReturnToStack";
import type { FaqAnchorType } from "@src/pages/faq";
import networkStore from "@src/store/networkStore";

export type NewDeploymentParams = {
  step?: string;
  dseq?: string | number;
  redeploy?: string | number;
  templateId?: string;
  page?: "new-deployment" | "deploy-linux";
  gitProvider?: string;
  gitProviderCode?: string | null;
  repoUrl?: string;
  branch?: string;
  buildCommand?: string;
  startCommand?: string;
  installCommand?: string;
  buildDirectory?: string;
  nodeVersion?: string;
};

export type ConfigureDeploymentParams = {
  dseq?: string | number;
  templateId?: string;
  sdlStrategy?: "default" | "edit";
  bidStrategy?: "auto" | "select";
};

export const domainName = "https://console.akash.network";
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return domainName;
}

type ReturnableOptions = { returnTo?: string };
const getSafeCurrentLocation = (preferredLocation?: string, fallbackLocation: string = "/") => {
  if (preferredLocation) {
    return preferredLocation;
  }

  if (typeof window !== "undefined") {
    return `${window.location.pathname}${window.location.search}`;
  }

  return fallbackLocation;
};

const getSafeReturnableUrl = (destination: string, currentLocation?: string, extraReturnToParams: Record<string, string> = {}) =>
  UrlReturnToStack.createReturnable(getSafeCurrentLocation(currentLocation), destination, { extraQueryParams: extraReturnToParams });

export const UrlService = {
  home: () => "/",
  getStarted: () => "/get-started",

  sdlBuilder: (id?: string) => `/sdl-builder${appendSearchParams({ id })}`,
  plainLinux: () => `/deploy-linux`,
  priceCompare: () => "/price-compare",
  analytics: () => "/analytics",
  graph: (snapshot: string) => `/graph/${snapshot}`,
  providerGraph: (snapshot: string) => `/provider-graph/${snapshot}`,
  priceCompareCustom: (cpu: number, memory: number, storage: number, memoryUnit: string, storageUnit: string) =>
    `/price-compare${appendSearchParams({ cpu, memory, storage, memoryUnit, storageUnit })}`,
  contact: () => "/contact",
  faq: (q?: FaqAnchorType) => `/faq${q ? "#" + q : ""}`,
  privacyPolicy: () => "/privacy-policy",
  termsOfService: () => "/terms-of-service",

  // User
  userSettings: () => "/user/settings",
  userApiKeys: () => "/user/api-keys",
  userFavorites: () => `/user/settings/favorites`,
  userProfile: (username: string) => `/profile/${username}`,
  usage: () => "/usage",
  paymentMethods: () => "/payment-methods",
  billing: ({ openPayment }: { openPayment?: boolean } = {}) => `/billing${appendSearchParams({ openPayment })}`,
  /** @deprecated use .newLogin instead */
  login: () => "/api/auth/login",
  /** @deprecated use .newSignup instead */
  signup: () => "/api/auth/signup",
  newLogin: ({ returnTo }: ReturnableOptions = {}) => getSafeReturnableUrl(`/login${appendSearchParams({ tab: "login" })}`, returnTo),
  newSignup: ({ returnTo, ...extraReturnToParams }: ReturnableOptions & Record<string, string> = {}) =>
    getSafeReturnableUrl(`/login${appendSearchParams({ tab: "signup" })}`, returnTo, extraReturnToParams),
  logout: () => "/api/auth/logout",
  onboarding: ({ returnTo }: ReturnableOptions = {}) => getSafeReturnableUrl("/signup", returnTo),
  template: (id: string) => `/template/${id}`,

  // Deploy
  deploymentList: () => `/deployments`,
  deploymentDetails: (dseq: string, tab?: string, logsMode?: string) => `/deployments/${dseq}${appendSearchParams({ tab, logsMode })}`,
  templates: (category?: string | null, search?: string) => `/templates${appendSearchParams({ category, search })}`,
  templateDetails: (templateId: string) => `/templates/${templateId}`,
  providers: (sort?: string) => `/providers${appendSearchParams({ sort })}`,
  providerDetail: (owner: string) => `/providers/${owner}${appendSearchParams({ network: networkStore.selectedNetworkId })}`,
  providerDetailLeases: (owner: string) => `/providers/${owner}/leases`,
  providerDetailRaw: (owner: string) => `/providers/${owner}/raw`,
  alerts: () => "/alerts",
  alertDetails: (id: string) => `/alerts/${id}`,
  notificationChannels: () => "/alerts/notification-channels",
  newNotificationChannel: () => "/alerts/notification-channels/new",
  notificationChannelDetails: (id: string) => `/alerts/notification-channels/${id}`,

  newDeployment: (params: NewDeploymentParams = {}) => {
    const {
      step,
      dseq,
      redeploy,
      templateId,
      gitProviderCode,
      gitProvider,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      installCommand,
      buildDirectory,
      nodeVersion
    } = params;
    const page = params.page || "new-deployment";
    return `/${page}${appendSearchParams({ dseq, step, templateId, redeploy, gitProvider, code: gitProviderCode, repoUrl, branch, buildCommand, startCommand, installCommand, buildDirectory, nodeVersion })}`;
  },

  configureDeployment: (params: ConfigureDeploymentParams = {}) => {
    const { dseq, templateId, sdlStrategy, bidStrategy } = params;
    const base = dseq ? `/new-deployment/configure/${dseq}` : "/new-deployment/configure";
    return `${base}${appendSearchParams({ templateId, "sdl-strategy": sdlStrategy, "bid-strategy": bidStrategy })}`;
  }
};

export function appendSearchParams(params: { [key: string]: string | number | boolean | null | undefined } = {}) {
  const urlParams = new URLSearchParams("");
  Object.keys(params).forEach(p => {
    const value = params[p];
    if (value) {
      urlParams.set(p, value.toString());
    }
  });

  const res = urlParams.toString();

  return res ? `?${res}` : res;
}

export function removeEmptyFilters(obj: { [key: string]: string }) {
  const copy = { ...obj };
  Object.keys(copy).forEach(key => {
    if (copy[key] === "*") {
      delete copy[key];
    }
  });

  return copy;
}

export function handleDocClick(ev: React.MouseEvent<any>, url: string): void {
  ev.preventDefault();

  window.open(url, "_blank");
}
