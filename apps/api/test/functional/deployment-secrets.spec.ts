import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedPersonalOrganizationIdOf, seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

const PLAIN_VALUE = "visible-plain-value";

const SDL_WITH_SECRETS = [
  'version: "2.0"',
  "services:",
  "  web:",
  "    image: registry.example.test/web",
  "    env:",
  `      - "MODE=${PLAIN_VALUE}"`,
  '      - "TOKEN=ac-secret://TOKEN"',
  '      - "DATABASE_URL=ac-secret://s0_e2"',
  "    credentials:",
  "      host: registry.example.test",
  '      username: "ac-secret://REGISTRY_USER"',
  '      password: "ac-secret://REGISTRY_PASSWORD"',
  "  worker:",
  "    image: nginx",
  "    env:",
  '      - "API_TOKEN=ac-secret://TOKEN"',
  ""
].join("\n");

describe("GET /v1/deployments/{dseq}/secrets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await listSecrets("1234", {});

    expect(response.status).toBe(401);
  });

  it("lists each secret of the deployment's definition once, sorted by name, with where it is used and no value", async () => {
    const { headers, record } = await setupPersonalCaller();
    const dseq = await record(SDL_WITH_SECRETS);

    const response = await listSecrets(dseq, headers);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toEqual({
      data: {
        secrets: [
          { name: "REGISTRY_PASSWORD", usedBy: [{ service: "web", credential: "password" }] },
          { name: "REGISTRY_USER", usedBy: [{ service: "web", credential: "username" }] },
          {
            name: "TOKEN",
            usedBy: [
              { service: "web", env: "TOKEN" },
              { service: "worker", env: "API_TOKEN" }
            ]
          },
          { name: "s0_e2", usedBy: [{ service: "web", env: "DATABASE_URL" }] }
        ]
      }
    });
    expect(body).not.toContain(PLAIN_VALUE);
  });

  it("answers not found alike for a deployment with no recorded definition and one the console never heard of", async () => {
    const { headers, recordWithoutDefinition } = await setupPersonalCaller();
    const withoutDefinitionDseq = await recordWithoutDefinition();

    const withoutDefinition = await listSecrets(withoutDefinitionDseq, headers);
    const unknown = await listSecrets(someDseq(), headers);

    expect(withoutDefinition.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await withoutDefinition.json()).toEqual(await unknown.json());
  });

  it("hands back nothing of another user's deployment under the same dseq", async () => {
    const owner = await setupPersonalCaller();
    const dseq = await owner.record(SDL_WITH_SECRETS);
    const { headers } = await setupPersonalCaller();

    const response = await listSecrets(dseq, headers);

    expect(response.status).toBe(404);
  });

  it("lists to a project-bound API key the secrets of a deployment in its project", async () => {
    const { owner, team, otherProject, record } = await setupTeam();
    const dseq = await record({ projectId: otherProject.id, by: owner.id });
    const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

    const response = await listSecrets(dseq, { "x-api-key": apiKey });

    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: { secrets: { name: string }[] } }).data.secrets.map(secret => secret.name)).toEqual([
      "REGISTRY_PASSWORD",
      "REGISTRY_USER",
      "TOKEN",
      "s0_e2"
    ]);
  });

  it("answers not found to a project-bound API key for a deployment in another project of the team", async () => {
    const { owner, team, defaultProject, otherProject, record } = await setupTeam();
    const dseq = await record({ projectId: defaultProject.id, by: owner.id });
    const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

    const response = await listSecrets(dseq, { "x-api-key": apiKey });

    expect(response.status).toBe(404);
  });

  it("lists to a member the secrets of a colleague's deployment in a project the member was granted", async () => {
    const { team, otherProject, colleague, record, signInMember } = await setupTeam();
    const dseq = await record({ projectId: otherProject.id, by: colleague.id });
    const authorization = await signInMember({ grants: [otherProject.id] });

    const response = await listSecrets(dseq, { authorization, "x-organization-id": team.id });

    expect(response.status).toBe(200);
  });

  it("answers not found to a member for a deployment in a project the member was not granted", async () => {
    const { team, defaultProject, otherProject, colleague, record, signInMember } = await setupTeam();
    const dseq = await record({ projectId: defaultProject.id, by: colleague.id });
    const authorization = await signInMember({ grants: [otherProject.id] });

    const response = await listSecrets(dseq, { authorization, "x-organization-id": team.id });

    expect(response.status).toBe(404);
  });

  function listSecrets(dseq: string, headers: Record<string, string>) {
    return app.request(`/v1/deployments/${dseq}/secrets`, { method: "GET", headers });
  }

  function someDseq() {
    return faker.string.numeric({ length: 7, allowLeadingZeros: false });
  }

  async function seedApiKey(input: { userId: string; organizationId: string; projectId?: string }) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      ...input,
      name: faker.company.name(),
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
    });

    return apiKey;
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  function signIn(externalUserId: string) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );

    return `Bearer ${token}`;
  }

  async function setupPersonalCaller() {
    const { user } = await seedUserWithWallet({ isTrialing: false, activatedAt: new Date() });
    const organizationId = await seedPersonalOrganizationIdOf(user.id);
    const apiKey = await seedApiKey({ userId: user.id, organizationId });

    async function record(sdl: string) {
      const dseq = someDseq();
      await seedDeploymentSetting({ userId: user.id, organizationId, dseq, sdl, manifestVersion: faker.string.alphanumeric(43) });

      return dseq;
    }

    async function recordWithoutDefinition() {
      const dseq = someDseq();
      await seedDeploymentSetting({ userId: user.id, organizationId, dseq });

      return dseq;
    }

    return { headers: { "x-api-key": apiKey }, record, recordWithoutDefinition };
  }

  async function setupTeam() {
    const { user: owner, organization: team, project: defaultProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const otherProject = await seedProject({ organizationId: team.id });
    const colleague = await seedUser(createSignedUpUserInput());
    await seedOrganizationMember({ organizationId: team.id, userId: colleague.id, role: "admin" });
    await seedOrganizationWallet({ organizationId: team.id });

    async function record({ projectId, by }: { projectId: string; by: string }) {
      const dseq = someDseq();
      await seedDeploymentSetting({
        userId: by,
        organizationId: team.id,
        projectId,
        dseq,
        sdl: SDL_WITH_SECRETS,
        manifestVersion: faker.string.alphanumeric(43)
      });

      return dseq;
    }

    async function signInMember({ grants }: { grants: string[] }) {
      const member = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: "member" });
      for (const projectId of grants) {
        await seedProjectMember({ organizationId: team.id, projectId, userId: member.id });
      }

      return signIn(member.userId!);
    }

    return { owner, team, defaultProject, otherProject, colleague, record, signInMember };
  }
});
