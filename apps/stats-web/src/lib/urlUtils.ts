import { selectedNetworkId } from "./constants";

function getSelectedNetworkQueryParam() {
  if (selectedNetworkId) {
    return selectedNetworkId;
  } else if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).get("network");
  }

  return undefined;
}

export class UrlService {
  static home = () => "/";
  static graph = (snapshot: string) => `/graph/${snapshot}`;
  static providerGraph = (snapshot: string) => `/provider-graph/${snapshot}`;
  static blocks = () => `/blocks`;
  static block = (height: number) => `/blocks/${height}${appendSearchParams({ network: getSelectedNetworkQueryParam() as string })}`;
  static transactions = () => `/transactions`;
  static transaction = (hash: string) => `/transactions/${hash}${appendSearchParams({ network: getSelectedNetworkQueryParam() as string })}`;
  static address = (address: string) => `/addresses/${address}${appendSearchParams({ network: getSelectedNetworkQueryParam() as string })}`;
  static addressTransactions = (address: string) => `/addresses/${address}/transactions`;
  static addressDeployments = (address: string) => `/addresses/${address}/deployments`;
  static deployment = (owner: string, dseq: string) =>
    `/addresses/${owner}/deployments/${dseq}${appendSearchParams({ network: getSelectedNetworkQueryParam() as string })}`;
  static validators = () => "/validators";
  static validator = (address: string) => `/validators/${address}${appendSearchParams({ network: getSelectedNetworkQueryParam() as string })}`;
  static proposals = () => "/proposals";
  static proposal = (id: number) => `/proposals/${id}`;
}

export function appendSearchParams(params: { [key: string]: string | number | boolean }) {
  const urlParams = new URLSearchParams("");
  Object.keys(params).forEach(p => {
    if (params[p]) {
      urlParams.set(p, params[p].toString());
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

export function handleDocClick(ev: Event, url: string) {
  ev.preventDefault();

  window.open(url, "_blank");
}
