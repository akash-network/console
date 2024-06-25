import { FaqAnchorType } from "@src/pages/faq";
import { mainnetId, selectedNetworkId } from "./constants";

export type NewDeploymentParams = {
  step?: string;
  dseq?: string | number;
  redeploy?: string | number;
  templateId?: string;
  page?: "new-deployment" | "deploy-linux";
};

function getSelectedNetworkQueryParam() {
  if (selectedNetworkId) {
    return selectedNetworkId;
  } else if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).get("network");
  } else {
    return mainnetId;
  }
}

export const domainName = "https://console.akash.network";

export class UrlService {
  static home = () => "/";
  static getStarted = () => "/get-started";
  static getStartedWallet = (section?: string) => `/get-started/wallet${appendSearchParams({ section })}`;

  static sdlBuilder = (id?: string) => `/sdl-builder${appendSearchParams({ id })}`;
  static rentGpus = () => `/rent-gpu`;
  static plainLinux = () => `/deploy-linux`;
  static priceCompare = () => "/price-compare";
  static analytics = () => "/analytics";
  static graph = (snapshot: string) => `/graph/${snapshot}`;
  static providerGraph = (snapshot: string) => `/provider-graph/${snapshot}`;
  static priceCompareCustom = (cpu: number, memory: number, storage: number, memoryUnit: string, storageUnit: string) =>
    `/price-compare${appendSearchParams({ cpu, memory, storage, memoryUnit, storageUnit })}`;
  static contact = () => "/contact";
  static faq = (q?: FaqAnchorType) => `/faq${q ? "#" + q : ""}`;
  static privacyPolicy = () => "/privacy-policy";
  static termsOfService = () => "/terms-of-service";

  // User
  static userSettings = () => "/user/settings";
  static userAddressBook = () => `/user/settings/address-book`;
  static userFavorites = () => `/user/settings/favorites`;
  static userProfile = (username: string) => `/profile/${username}`;
  static login = (returnUrl?: string) => {
    let from = "/";
    if (returnUrl) {
      from = returnUrl;
    } else if (typeof window !== "undefined") {
      from = window.location.pathname;
    }
    return `/api/auth/login${appendSearchParams({ from: from })}`;
  };
  static logout = () => "/api/auth/logout";
  static signup = () => "/api/auth/signup";
  static template = (id: string) => `/template/${id}`;

  // Deploy
  static deploymentList = () => `/deployments`;
  static deploymentDetails = (dseq: string, tab?: string, logsMode?: string) => `/deployments/${dseq}${appendSearchParams({ tab, logsMode })}`;
  static publicDeploymentDetails = (owner: string, dseq: string) =>
    `/deployment/${owner}/${dseq}${appendSearchParams({ network: getSelectedNetworkQueryParam() })}`;
  static templates = (category?: string, search?: string) => `/templates${appendSearchParams({ category, search })}`;
  static templateDetails = (templateId: string) => `/templates/${templateId}`;
  static providers = (sort?: string) => `/providers${appendSearchParams({ sort })}`;
  static providerDetail = (owner: string) => `/providers/${owner}${appendSearchParams({ network: getSelectedNetworkQueryParam() })}`;
  static providerDetailLeases = (owner: string) => `/providers/${owner}/leases`;
  static providerDetailRaw = (owner: string) => `/providers/${owner}/raw`;
  static providerDetailEdit = (owner: string) => `/providers/${owner}/edit`;
  static settings = () => "/settings";
  static settingsAuthorizations = () => "/settings/authorizations";

  // New deployment
  static newDeployment = (params: NewDeploymentParams = {}) => {
    const { step, dseq, redeploy, templateId } = params;
    const page = params.page || "new-deployment";
    return `/${page}${appendSearchParams({ dseq, step, templateId, redeploy })}`;
  };
}

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

export function isValidHttpUrl(str: string): boolean {
  let url;

  try {
    url = new URL(str);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

export function handleDocClick(ev, url) {
  ev.preventDefault();

  window.open(url, "_blank");
}
