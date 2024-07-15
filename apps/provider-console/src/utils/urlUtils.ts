import { mainnetId, selectedNetworkId } from "./constants";

type NewDeploymentParams = {
  step?: string;
  dseq?: string | number;
  redeploy?: string | number;
  templateId?: string;
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

export const domainName = "https://provider.akash.network";

export class UrlService {
  static home = () => "/";
  static getStarted = () => "/get-started";
  static privacyPolicy = () => "/privacy-policy";
  static termsOfService = () => "/terms-of-service";
}