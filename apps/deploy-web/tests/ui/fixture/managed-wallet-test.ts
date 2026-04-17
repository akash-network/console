import { Auth0ManagementService } from "../services/auth0-management.service";
import { test as baseTest } from "./base-test";

export { expect } from "./base-test";

const auth0Management = new Auth0ManagementService();

export const test = baseTest.extend<{ auth0: Auth0ManagementService }>({
  // eslint-disable-next-line no-empty-pattern
  auth0: async ({}, use) => {
    await use(auth0Management);
  }
});
