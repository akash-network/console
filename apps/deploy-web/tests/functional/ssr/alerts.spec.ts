import { AppHttpClient } from "@tests/helpers/AppHttpClient";

describe("Alerts", () => {
  describe("GET /alerts", () => {
    it("display alerts for logged in user", async () => {
      const client = await setup({ authenticated: true, withManagedWallet: true });

      const response = await client.get(`/alerts`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchSnapshot();
    });

    it("displays 404 for non authenticated user", async () => {
      const client = await setup({ authenticated: false, withManagedWallet: true });

      const response = await client.get("/alerts");

      expect(response.status).toBe(404);
      expect(response.data).toMatchSnapshot();
    });
  });

  async function setup(input?: { authenticated?: boolean; withManagedWallet?: boolean }) {
    const client = new AppHttpClient("http://localhost:3000");

    if (input?.authenticated) {
      await client.loginViaOauth();
    }

    if (input?.withManagedWallet) {
      await client.startTrial();
    }

    return client;
  }
});
