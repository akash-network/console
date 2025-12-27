import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import { app } from "@src/rest-app";

jest.setTimeout(20000);

describe("start trial", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /v1/start-trial", () => {
    it("should throw 401 provided no auth header ", async () => {
      const createWalletResponse = await app.request("/v1/start-trial", {
        method: "POST",
        body: JSON.stringify({ data: { userId: faker.string.uuid() } }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(createWalletResponse.status).toBe(401);
      expect(await createWalletResponse.json()).toMatchObject({ error: "UnauthorizedError", message: "Unauthorized" });
    });
  });

  describe("GET /v1/wallets", () => {
    it("should throw 401 provided no auth header ", async () => {
      const getWalletsResponse = await app.request(`/v1/wallets?userId=${faker.string.uuid()}`);

      expect(getWalletsResponse.status).toBe(401);
      expect(await getWalletsResponse.json()).toMatchObject({ error: "UnauthorizedError", message: "Unauthorized" });
    });
  });
});
