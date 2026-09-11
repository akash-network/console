import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { app } from "@src/rest-app";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

const SDL = "version: '2.0'";

describe("GET /v1/deployment-names", () => {
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

  it("refuses an unauthenticated request", async () => {
    const response = await listNames(undefined);

    expect(response.status).toBe(401);
  });

  it("answers with the name of every deployment the caller named", async () => {
    const { apiKey } = await setup({ names: ["web", "db+web"] });

    const response = await listNames(apiKey);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { names: Array<{ dseq: string; name: string }> } };
    expect(data.names).toEqual(
      expect.arrayContaining([
        { dseq: expect.any(String), name: "web" },
        { dseq: expect.any(String), name: "db+web" }
      ])
    );
    expect(data.names).toHaveLength(2);
  });

  it("leaves out a deployment the console holds no name for", async () => {
    const { apiKey, dseqOf } = await setup({ names: ["web"], unnamed: 1 });

    const response = await listNames(apiKey);

    const { data } = (await response.json()) as { data: { names: Array<{ dseq: string }> } };
    expect(data.names.map(entry => entry.dseq)).toEqual([dseqOf("web")]);
  });

  it("answers with none of another user's names, even for the same dseq", async () => {
    const { apiKey, dseqOf } = await setup({ names: ["mine"] });
    const other = await seedUserWithWallet();
    await deploymentSettingRepository.upsertDefinition({
      userId: other.user.id,
      dseq: dseqOf("mine"),
      sdl: SDL,
      manifestVersion: "BAUG",
      name: "theirs"
    });

    const response = await listNames(apiKey);

    const { data } = (await response.json()) as { data: { names: Array<{ name: string }> } };
    expect(data.names.map(entry => entry.name)).toEqual(["mine"]);
  });

  it("hands back one page at a time, reporting whether more names remain", async () => {
    const { apiKey } = await setup({ names: ["first", "second", "third"] });

    const firstPage = await (await listNames(apiKey, { limit: 2 })).json();
    const lastPage = await (await listNames(apiKey, { skip: 2, limit: 2 })).json();

    expect(firstPage).toEqual({
      data: {
        names: [
          { dseq: expect.any(String), name: "third" },
          { dseq: expect.any(String), name: "second" }
        ],
        pagination: { skip: 0, limit: 2, hasMore: true }
      }
    });
    expect(lastPage).toEqual({
      data: {
        names: [{ dseq: expect.any(String), name: "first" }],
        pagination: { skip: 2, limit: 2, hasMore: false }
      }
    });
  });

  it("answers with an empty page for a caller who named nothing", async () => {
    const { apiKey } = await setup({ names: [] });

    const response = await listNames(apiKey);

    expect(await response.json()).toEqual({ data: { names: [], pagination: { skip: 0, limit: expect.any(Number), hasMore: false } } });
  });

  it("refuses a page larger than the endpoint serves", async () => {
    const { apiKey } = await setup({ names: [] });

    const response = await listNames(apiKey, { limit: 100000 });

    expect(response.status).toBe(400);
  });

  function listNames(apiKey: string | undefined, query?: { skip?: number; limit?: number }) {
    const headers = new Headers();
    if (apiKey) headers.set("x-api-key", apiKey);
    const search = new URLSearchParams();
    if (query?.skip !== undefined) search.set("skip", String(query.skip));
    if (query?.limit !== undefined) search.set("limit", String(query.limit));
    const queryString = search.size > 0 ? `?${search}` : "";

    return app.request(`/v1/deployment-names${queryString}`, { headers });
  }

  async function setup(input: { names: string[]; unnamed?: number }) {
    const { user } = await seedUserWithWallet();
    const apiKey = await persistApiKeyFor(user.id);
    const dseqs = new Map<string, string>();

    for (const name of input.names) {
      const dseq = newDseq();
      dseqs.set(name, dseq);
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", name });
    }

    for (let created = 0; created < (input.unnamed ?? 0); created++) {
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: newDseq(), sdl: SDL, manifestVersion: "BAUG" });
    }

    return { user, apiKey, dseqOf: (name: string) => dseqs.get(name) as string };
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

  function newDseq() {
    return faker.number.int({ min: 100000, max: 999999 }).toString();
  }
});
