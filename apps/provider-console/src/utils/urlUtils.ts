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
  static getStarted = () => "/get-started";
  static privacyPolicy = () => "/privacy-policy";
  static termsOfService = () => "/terms-of-service";
}