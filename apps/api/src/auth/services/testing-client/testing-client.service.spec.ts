import { describe, expect, it } from "vitest";

import type { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";
import { TestingClientService } from "./testing-client.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

describe(TestingClientService.name, () => {
  describe("isTestingClient", () => {
    it("recognises a user agent that ends with the configured testing token", () => {
      const { service } = setup({ token: "e2e-token" });

      expect(service.isTestingClient(`${CHROME} UIT/e2e-token.`)).toBe(true);
    });

    it("does not recognise a user agent carrying another token", () => {
      const { service } = setup({ token: "e2e-token" });

      expect(service.isTestingClient(`${CHROME} UIT/guessed-token.`)).toBe(false);
    });

    it("does not recognise a token that only starts with the configured one", () => {
      const { service } = setup({ token: "e2e-token" });

      expect(service.isTestingClient(`${CHROME} UIT/e2e-token-and-more.`)).toBe(false);
    });

    it("does not recognise the token anywhere but at the end of the user agent", () => {
      const { service } = setup({ token: "e2e-token" });

      expect(service.isTestingClient(`UIT/e2e-token. ${CHROME}`)).toBe(false);
      expect(service.isTestingClient(`${CHROME} UIT/e2e-token. Edg/130.0.0.0`)).toBe(false);
    });

    it("does not recognise a token glued to the browser name instead of following a space", () => {
      const { service } = setup({ token: "e2e-token" });

      expect(service.isTestingClient(`${CHROME}UIT/e2e-token.`)).toBe(false);
    });

    it("recognises a configured token that contains a dot", () => {
      const { service } = setup({ token: "e2e.token" });

      expect(service.isTestingClient(`${CHROME} UIT/e2e.token.`)).toBe(true);
      expect(service.isTestingClient(`${CHROME} UIT/e2e.`)).toBe(false);
    });

    it("does not recognise an ordinary browser", () => {
      const { service } = setup({ token: "e2e-token" });

      expect(service.isTestingClient(CHROME)).toBe(false);
    });

    it("does not recognise a request without a user agent", () => {
      const { service } = setup({ token: "e2e-token" });

      expect(service.isTestingClient(undefined)).toBe(false);
    });

    it("recognises nobody while no testing token is configured", () => {
      const { service } = setup({ token: undefined });

      expect(service.isTestingClient(`${CHROME} UIT/undefined.`)).toBe(false);
      expect(service.isTestingClient(`${CHROME} UIT/.`)).toBe(false);
    });
  });

  function setup(input: { token: string | undefined }) {
    const config = mockConfigService<AuthConfigService>({ E2E_TESTING_CLIENT_TOKEN: input.token });
    const service = new TestingClientService(config);
    return { service, config };
  }
});
