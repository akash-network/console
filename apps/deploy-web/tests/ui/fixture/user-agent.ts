import { devices } from "@playwright/test";

export function getUserAgent() {
  return `${devices["Desktop Chrome"].userAgent} UIT/${process.env.E2E_TESTING_CLIENT_TOKEN}.`;
}
