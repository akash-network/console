import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, describe, expect, it } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { MAX_DEPLOYMENT_NAMES_PER_REQUEST } from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { app } from "@src/rest-app";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe("GET /v1/deployment-names", () => {
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

  afterAll(async () => {
    await container.dispose();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await getNames(undefined, ["1234"]);

    expect(response.status).toBe(401);
  });

  it("answers each dseq with the name the console holds, and null where it holds none", async () => {
    const { apiKey, recordName, recordUnnamed } = await setup();
    const named = await recordName("web");
    const unnamed = await recordUnnamed();
    const neverRecorded = someDseq();

    const response = await getNames(apiKey, [named, unnamed, neverRecorded]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { [named]: "web", [unnamed]: null, [neverRecorded]: null } });
  });

  it("answers a single dseq given once", async () => {
    const { apiKey, recordName } = await setup();
    const named = await recordName("web");

    const response = await getNames(apiKey, [named]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { [named]: "web" } });
  });

  it("answers a dseq repeated in the request once", async () => {
    const { apiKey, recordName } = await setup();
    const named = await recordName("web");

    const response = await getNames(apiKey, [named, named]);

    expect(await response.json()).toEqual({ data: { [named]: "web" } });
  });

  it("hands back none of what another user named the same dseq", async () => {
    const other = await setup();
    const dseq = await other.recordName("theirs");
    const { apiKey } = await setup();

    const response = await getNames(apiKey, [dseq]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { [dseq]: null } });
  });

  it("refuses a request naming no deployment", async () => {
    const { apiKey } = await setup();

    const response = await getNames(apiKey, []);

    expect(response.status).toBe(400);
  });

  it("refuses a request naming more deployments than one lookup may carry", async () => {
    const { apiKey } = await setup();
    const dseqs = Array.from({ length: MAX_DEPLOYMENT_NAMES_PER_REQUEST + 1 }, () => someDseq());

    const response = await getNames(apiKey, dseqs);

    expect(response.status).toBe(400);
  });

  it("answers a request naming exactly as many deployments as one lookup may carry", async () => {
    const { apiKey } = await setup();
    const dseqs = Array.from({ length: MAX_DEPLOYMENT_NAMES_PER_REQUEST }, () => someDseq());

    const response = await getNames(apiKey, dseqs);

    expect(response.status).toBe(200);
    expect(Object.keys(((await response.json()) as { data: Record<string, unknown> }).data)).toHaveLength(new Set(dseqs).size);
  });

  it("refuses a dseq spelled with a leading zero, so every answer is keyed by exactly what was asked", async () => {
    const { apiKey, recordName } = await setup();
    const named = await recordName("web");

    const response = await getNames(apiKey, [`0${named}`]);

    expect(response.status).toBe(400);
  });

  it("refuses a dseq that is not a deployment sequence number", async () => {
    const { apiKey } = await setup();

    const response = await getNames(apiKey, ["not-a-dseq"]);

    expect(response.status).toBe(400);
  });

  function someDseq() {
    return faker.string.numeric({ length: 7, allowLeadingZeros: false });
  }

  function getNames(apiKey: string | undefined, dseqs: string[]) {
    const query = new URLSearchParams(dseqs.map((dseq): [string, string] => ["dseq", dseq]));
    const headers = new Headers();
    if (apiKey) headers.set("x-api-key", apiKey);

    return app.request(`/v1/deployment-names${query.size > 0 ? `?${query}` : ""}`, { method: "GET", headers });
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

  async function setup() {
    const { user } = await seedUserWithWallet({ isTrialing: false, activatedAt: new Date() });
    const apiKey = await persistApiKeyFor(user.id);

    async function recordName(name: string) {
      const dseq = someDseq();
      await deploymentSettingRepository.create({ userId: user.id, dseq, name });

      return dseq;
    }

    async function recordUnnamed() {
      const dseq = someDseq();
      await deploymentSettingRepository.create({ userId: user.id, dseq });

      return dseq;
    }

    return { user, apiKey, recordName, recordUnnamed };
  }
});
