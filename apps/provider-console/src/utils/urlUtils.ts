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
  static deployments = () => "/deployments";
  static attributes = () => "/attributes";
  static settings = () => "/settings";
  static getStarted = () => "/get-started";
  static privacyPolicy = () => "/privacy-policy";
  static termsOfService = () => "/terms-of-service";
  static actions = () => "/actions";
  static pricing = () => "/pricing";
}

export const stripProviderPrefixAndPort = (url: string) => {
  return url
    .replace(/^https?:\/\/provider\./, '') // Remove https://provider. or http://provider.
    .replace(/:\d+$/, ''); // Remove port number at the end
};
