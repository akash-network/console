import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

type Reader = { userId: string; organizationId?: string };

describe("GET /internal/deployment-names/{owner}/{dseq}", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;

  afterAll(async () => {
    await container.dispose();
  });

  it("rejects a caller with no token", async () => {
    const { user, address } = await seedUserWithWallet();

    const response = await getName({ owner: address, dseq: createDseq(), reader: { userId: user.id } }, { token: undefined });

    expect(response.status).toBe(401);
  });

  it("rejects a caller with the wrong token", async () => {
    const { user, address } = await seedUserWithWallet();

    const response = await getName({ owner: address, dseq: createDseq(), reader: { userId: user.id } }, { token: faker.string.alphanumeric(32) });

    expect(response.status).toBe(401);
  });

  it("returns the name of a deployment on the reading user's own wallet", async () => {
    const { user, address } = await seedUserWithWallet();
    const { dseq } = await seedDeploymentSetting({ userId: user.id, name: "my-app" });

    const response = await getName({ owner: address, dseq, reader: { userId: user.id } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "my-app" });
  });

  it("returns the name of a deployment on the wallet of the team the reading alert is filed in", async () => {
    const { user, organization, project } = await seedOrganizationWithOwner();
    const wallet = await seedOrganizationWallet({ organizationId: organization.id });
    const { dseq } = await seedDeploymentSetting({ userId: user.id, organizationId: organization.id, projectId: project.id, name: "team-app" });

    const response = await getName({ owner: wallet.address, dseq, reader: { userId: user.id, organizationId: organization.id } });

    expect(await response.json()).toEqual({ name: "team-app" });
  });

  it("returns null for a deployment on another user's wallet", async () => {
    const { user, address } = await seedUserWithWallet();
    const { dseq } = await seedDeploymentSetting({ userId: user.id, name: "my-app" });
    const stranger = await seedUser();

    const response = await getName({ owner: address, dseq, reader: { userId: stranger.id } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: null });
  });

  it("returns null for a deployment on the wallet of a team the reading alert is not filed in", async () => {
    const { user, organization, project } = await seedOrganizationWithOwner();
    const wallet = await seedOrganizationWallet({ organizationId: organization.id });
    const { dseq } = await seedDeploymentSetting({ userId: user.id, organizationId: organization.id, projectId: project.id, name: "team-app" });
    const stranger = await seedOrganizationWithOwner();

    const response = await getName({ owner: wallet.address, dseq, reader: { userId: stranger.user.id, organizationId: stranger.organization.id } });

    expect(await response.json()).toEqual({ name: null });
  });

  it("returns a user's own deployment rather than a team deployment they filed under the same dseq", async () => {
    const { user, address } = await seedUserWithWallet();
    const team = await seedOrganization({ createdByUserId: user.id });
    await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: "owner" });
    const project = await seedProject({ organizationId: team.id, createdByUserId: user.id });
    const dseq = createDseq();
    await seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: project.id, dseq, name: "team-app" });

    const response = await getName({ owner: address, dseq, reader: { userId: user.id } });

    expect(await response.json()).toEqual({ name: null });
  });

  it("returns null for a deployment of the reading user's that was never named", async () => {
    const { user, address } = await seedUserWithWallet();
    const { dseq } = await seedDeploymentSetting({ userId: user.id, name: null });

    const response = await getName({ owner: address, dseq, reader: { userId: user.id } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: null });
  });

  it("returns null for an owner Console manages no wallet for", async () => {
    const response = await getName({ owner: createAkashAddress(), dseq: createDseq(), reader: { userId: faker.string.uuid() } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: null });
  });

  it("rejects a reader that names no user", async () => {
    const { address } = await seedUserWithWallet();

    const response = await requestName(`/internal/deployment-names/${address}/${createDseq()}`);

    expect(response.status).toBe(400);
  });

  it("rejects a dseq that is not a positive number", async () => {
    const { user, address } = await seedUserWithWallet();

    const response = await getName({ owner: address, dseq: "not-a-dseq", reader: { userId: user.id } });

    expect(response.status).toBe(400);
  });

  it("rejects an owner that is not an akash address", async () => {
    const response = await getName({ owner: "cosmos1notakash", dseq: createDseq(), reader: { userId: faker.string.uuid() } });

    expect(response.status).toBe(400);
  });

  it("stays out of the unauthenticated internal openapi document", async () => {
    const response = await app.request("/internal/doc");

    expect(JSON.stringify(await response.json())).not.toContain("getDeploymentName");
  });

  async function getName({ owner, dseq, reader }: { owner: string; dseq: string; reader: Reader }, options: { token?: string } = { token: internalToken }) {
    const query = new URLSearchParams({ userId: reader.userId, ...(reader.organizationId && { organizationId: reader.organizationId }) });

    return await requestName(`/internal/deployment-names/${owner}/${dseq}?${query}`, options);
  }

  async function requestName(path: string, options: { token?: string } = { token: internalToken }) {
    return await app.request(path, { headers: options.token ? { "x-console-internal-token": options.token } : {} });
  }
});
