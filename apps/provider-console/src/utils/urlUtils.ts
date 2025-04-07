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

export const domainName = "https://provider.akash.network";

export class UrlService {
  static home = () => "/";
  static becomeProvider = () => "/become-provider";
  static getStarted = () => "/get-started";
  static getStartedWallet = (section?: string) => `/get-started/wallet${appendSearchParams({ section })}`;
  static deployments = () => "/deployments";
  static attributes = () => "/attributes";
  static settings = () => "/settings";
  static privacyPolicy = () => "/privacy-policy";
  static termsOfService = () => "/terms-of-service";
  static activityLogs = () => "/activity-logs";
  static pricing = () => "/pricing";
  static persistentStorage = () => "/persistent-storage";
  static nodes = () => "/nodes";
}

export const stripProviderPrefixAndPort = (url: string) => {
  return url
    .replace(/^https?:\/\/provider\./, "") // Remove https://provider. or http://provider.
    .replace(/:\d+$/, ""); // Remove port number at the end
};
