import { faker } from "@faker-js/faker";
import nock from "nock";

import { app } from "@src/app";

import { setupUser, type SetupUserOptions } from "@test/setup/setup-user";

jest.setTimeout(20000);

describe("Balances", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  it("should get balances for the current user", async () => {
    const { apiKey } = await setup();

    const response = await app.request("/v1/balances", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-api-key": apiKey
      })
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;

    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("balance");
    expect(result.data).toHaveProperty("deployments");
    expect(result.data).toHaveProperty("total");

    expect(typeof result.data.balance).toBe("number");
    expect(typeof result.data.deployments).toBe("number");
    expect(typeof result.data.total).toBe("number");

    expect(result.data.total).toBe(result.data.balance + result.data.deployments);

    expect(result.data.deployments).toBe(2000000);
  });

  it("should get balances for a specific address", async () => {
    await setup();

    const differentAddress = faker.string.alphanumeric(44);

    const response = await app.request(`/v1/balances?address=${differentAddress}`, {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json"
      })
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;

    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("balance");
    expect(result.data).toHaveProperty("deployments");
    expect(result.data).toHaveProperty("total");

    expect(typeof result.data.balance).toBe("number");
    expect(typeof result.data.deployments).toBe("number");
    expect(typeof result.data.total).toBe("number");

    expect(result.data.total).toBe(result.data.balance + result.data.deployments);

    expect(result.data.deployments).toBe(2000000);
  });

  it("should return 404 when user wallet is not found", async () => {
    const { apiKey } = await setup({ walletNotFound: true });

    const response = await app.request("/v1/balances", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-api-key": apiKey
      })
    });

    expect(response.status).toBe(404);
  });

  async function setup(options?: SetupUserOptions) {
    return await setupUser(options);
  }
});
