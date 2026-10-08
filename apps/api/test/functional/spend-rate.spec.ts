import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, describe, expect, it } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import type { GetSpendRateResponse } from "@src/deployment/http-schemas/deployment.schema";
import { app, initDb } from "@src/rest-app";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe("GET /v1/spend-rate", () => {
  afterAll(async () => {
    await container.dispose();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await getSpendRate(undefined);

    expect(response.status).toBe(401);
  });

  it("answers the summed price of the live leases of each running deployment", async () => {
    const { apiKey, address } = await setup();
    const [web, worker] = await Promise.all([seedDeployment(address), seedDeployment(address)]);
    await seedLease(web, { gseq: 1, price: 1.25 });
    await seedLease(web, { gseq: 2, price: 0.5 });
    await seedLease(worker, { gseq: 1, price: 3 });

    const response = await getSpendRate(apiKey);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as GetSpendRateResponse;
    expect(data.deployments).toHaveLength(2);
    expect(data.deployments).toEqual(
      expect.arrayContaining([
        { dseq: web.dseq, price: { denom: "uact", amount: "1.750000000000000000" } },
        { dseq: worker.dseq, price: { denom: "uact", amount: "3.000000000000000000" } }
      ])
    );
  });

  it("leaves out closed leases, and a deployment with no live lease", async () => {
    const { apiKey, address } = await setup();
    const [running, closed] = await Promise.all([seedDeployment(address), seedDeployment(address)]);
    await seedLease(running, { gseq: 1, price: 2 });
    await seedLease(running, { gseq: 2, price: 5, closedHeight: 10_000 });
    await seedLease(closed, { gseq: 1, price: 9, closedHeight: 10_000 });

    const response = await getSpendRate(apiKey);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { deployments: [{ dseq: running.dseq, price: { denom: "uact", amount: "2.000000000000000000" } }] }
    });
  });

  it("hands back none of another owner's running deployments", async () => {
    const { apiKey, address } = await setup();
    const [ours, theirs] = await Promise.all([seedDeployment(address), seedDeployment(createAkashAddress())]);
    await seedLease(ours, { gseq: 1, price: 2 });
    await seedLease(theirs, { gseq: 1, price: 8 });

    const response = await getSpendRate(apiKey);

    expect(await response.json()).toEqual({
      data: { deployments: [{ dseq: ours.dseq, price: { denom: "uact", amount: "2.000000000000000000" } }] }
    });
  });

  it("answers no deployment when nothing is running", async () => {
    const { apiKey } = await setup();

    const response = await getSpendRate(apiKey);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { deployments: [] } });
  });

  it("answers 404 for a user without a wallet", async () => {
    const user = await seedUser();
    const apiKey = await persistApiKeyFor(user.id);

    const response = await getSpendRate(apiKey);

    expect(response.status).toBe(404);
  });

  it("answers 403 for a wallet not yet given an address", async () => {
    const { user } = await seedUserWithWallet({ address: null });
    const apiKey = await persistApiKeyFor(user.id);

    const response = await getSpendRate(apiKey);

    expect(response.status).toBe(403);
  });

  function getSpendRate(apiKey: string | undefined) {
    const headers = new Headers();
    if (apiKey) headers.set("x-api-key", apiKey);

    return app.request("/v1/spend-rate", { method: "GET", headers });
  }

  async function persistApiKeyFor(userId: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();

    await container.resolve(ApiKeyRepository).create({
      userId,
      name: faker.company.name(),
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
    });

    return apiKey;
  }

  async function seedDeployment(owner: string) {
    const deployment = await createDeployment({ owner, dseq: faker.string.numeric({ length: 10, allowLeadingZeros: false }) });

    return { id: deployment.id, owner: deployment.owner, dseq: deployment.dseq };
  }

  async function seedLease(deployment: { id: string; owner: string; dseq: string }, lease: { gseq: number; price: number; closedHeight?: number }) {
    const provider = await createProvider();
    const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: deployment.owner, dseq: deployment.dseq, gseq: lease.gseq });

    await createLease({
      deploymentId: deployment.id,
      deploymentGroupId: group.id,
      owner: deployment.owner,
      dseq: deployment.dseq,
      gseq: lease.gseq,
      oseq: 1,
      providerAddress: provider.owner,
      price: lease.price,
      denom: "uact",
      closedHeight: lease.closedHeight
    });
  }

  async function setup() {
    await initDb();
    const { user, address } = await seedUserWithWallet({ isTrialing: false, activatedAt: new Date() });
    const apiKey = await persistApiKeyFor(user.id);

    return { user, address, apiKey };
  }
});
