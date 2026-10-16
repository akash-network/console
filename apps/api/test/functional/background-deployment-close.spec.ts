import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { BILLING_CONFIG } from "@src/billing/providers";
import { type ApiPgDatabase, CORE_CONFIG, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { CloseDeploymentAcceptedResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CloseDeploymentHandler } from "@src/deployment/services/close-deployment/close-deployment.handler";
import { CloseDeployment, closeDeploymentKeyFor } from "@src/deployment/services/close-deployment/close-deployment.job";
import { app } from "@src/rest-app";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createDeploymentInfoErrorSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

type Revocation = "membership" | "projectGrant" | "team";

const jobWorkers = useJobWorkers(() => [container.resolve(CloseDeploymentHandler)]);

describe("Background close of a team deployment", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("closes the deployment with the team wallet once the job runs for a member who still has access to its project", async () => {
    const { requestClose, runCloseJobs, findActivity, broadcasts } = await setup();

    const response = await requestClose();
    await runCloseJobs();

    expect(response.status).toBe(202);
    expect(broadcasts()).toBe(1);
    expect(await findActivity(response)).toMatchObject({ status: "succeeded" });
  });

  it.each([
    { change: "is removed from the team", revoke: "membership" },
    { change: "loses access to the deployment's project", revoke: "projectGrant" },
    { change: "sees the team deleted", revoke: "team" }
  ] as const)("signs nothing and records the close as failed when the member $change before the job runs", async ({ revoke }) => {
    const { requestClose, revokeAccess, runCloseJobs, findActivity, broadcasts } = await setup();

    const response = await requestClose();
    await revokeAccess(revoke);
    await runCloseJobs();

    expect(response.status).toBe(202);
    expect(broadcasts()).toBe(0);
    expect(await findActivity(response)).toMatchObject({
      status: "failed",
      meta: { error: { code: "access_revoked", message: "You no longer have access to this deployment." } }
    });
  });

  it("records as succeeded a close that landed on chain before the job ran, though the member was removed since", async () => {
    const { requestClose, revokeAccess, closeOnChain, runCloseJobs, findActivity, broadcasts } = await setup();

    const response = await requestClose();
    await revokeAccess("membership");
    closeOnChain();
    await runCloseJobs();

    expect(response.status).toBe(202);
    expect(broadcasts()).toBe(0);
    expect(await findActivity(response)).toMatchObject({ status: "succeeded" });
  });

  async function setup() {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);
    const { organization } = await seedOrganizationWithOwner();
    const project = await seedProject({ organizationId: organization.id });
    const member = await seedUser();
    const membership = await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });
    const grant = await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id, role: "member" });
    const wallet = await seedOrganizationWallet({ organizationId: organization.id, activatedAt: new Date() });
    const { dseq } = await seedDeploymentSetting({ userId: member.id, organizationId: organization.id, projectId: project.id });
    const apiKey = await seedApiKey({ userId: member.id, organizationId: organization.id });
    const chain = answerDeploymentOnChain(wallet.address, dseq);
    const broadcasts = answerSigning();

    const revocations: Record<Revocation, () => Promise<unknown>> = {
      membership: () => db.delete(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").id, membership.id)),
      projectGrant: () => db.delete(resolveTable("ProjectMembers")).where(eq(resolveTable("ProjectMembers").id, grant.id)),
      team: () =>
        db
          .update(resolveTable("Organizations"))
          .set({ deletedAt: new Date() })
          .where(eq(resolveTable("Organizations").id, organization.id))
    };

    return {
      broadcasts,
      closeOnChain: chain.close,
      requestClose: () => app.request(`/v1/deployments/${dseq}?async=true`, { method: "DELETE", headers: { "x-api-key": apiKey } }),
      revokeAccess: async (revocation: Revocation) => await revocations[revocation](),
      runCloseJobs: async () => {
        const { startWorkers } = await jobWorkers();
        await startWorkers();
        await expectJobCompleted(CloseDeployment[JOB_NAME], { singletonKey: closeDeploymentKeyFor({ userId: member.id, dseq }) });
      },
      findActivity: async (response: Response) => {
        const { data } = (await response.clone().json()) as { data: Extract<CloseDeploymentAcceptedResponse["data"], { activityId: string }> };
        const activities = resolveTable("Activities");
        const [activity] = await db.select().from(activities).where(eq(activities.id, data.activityId));

        return activity;
      }
    };
  }

  async function seedApiKey(input: { userId: string; organizationId: string }) {
    const generator = container.resolve(ApiKeyGeneratorService);
    const secret = generator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      ...input,
      name: "ci",
      hashedKey: generator.hashApiKeySha256(secret),
      keyFormat: generator.obfuscateApiKey(secret)
    });

    return secret;
  }

  function answerDeploymentOnChain(owner: string, dseq: string) {
    let state = "active";
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(uri => uri.includes("/deployments/info"))
      .reply(uri => {
        const query = new URL(uri, "http://chain").searchParams;
        const isDeployed = query.get("id.owner") === owner && query.get("id.dseq") === dseq;

        return isDeployed ? [200, createDeploymentInfoSeed({ owner, dseq, state })] : [404, createDeploymentInfoErrorSeed()];
      })
      .get(uri => uri.includes("/leases/list"))
      .reply(200, { leases: [], pagination: { next_key: null, total: "0" } });

    return { close: () => (state = "closed") };
  }

  function answerSigning() {
    let broadcasts = 0;
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowances?\/.*/)
      .reply(200, uri => (uri.includes("/allowances/") ? { allowances: [createFeeAllowanceResponse()] } : createFeeAllowanceResponse({ amount: "5000000" })))
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(200, createDeploymentGrantResponseSeed({ amount: "5000000", grantType: "/akash.escrow.v1.DepositAuthorization" }));
    nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL)
      .persist()
      .post(/\/v1\/tx\/.*/)
      .reply(200, () => {
        broadcasts += 1;
        return { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } };
      });

    return () => broadcasts;
  }
});
