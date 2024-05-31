export const isProd = process.env.NODE_ENV === "production";
export const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";
export const BASE_API_URL = getApiUrl();

// Cloudmos validator
export const validatorAddress = "akashvaloper14mt78hz73d9tdwpdvkd59ne9509kxw8yj7qy8f";
export const donationAddress = "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm";

function getApiUrl() {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (typeof window === "undefined") return "http://localhost:3080";
  if (window.location?.hostname === "beta.cloudmos.io") return "https://apibeta.cloudmos.io";
  if (window.location?.hostname === "cloudmos.io") return "https://api.cloudmos.io";
  return "http://localhost:3080";
}

// UI
export const headerHeight = 80;
export const mobileHeaderHeight = 70;
