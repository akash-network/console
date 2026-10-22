import "@src/app/providers/jobs.provider";

import { BidHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { eq } from "drizzle-orm";
import createError from "http-errors";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { type ApiPgDatabase, type EnqueueOptions, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ACCESS_REVOKED_ERROR_CODE } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { pendingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { CreateLeaseHandler } from "./create-lease.handler";
import { CREATE_LEASE_RETRY_OPTIONS, CreateLease, createLeaseKeyFor, leaseWalletRefOf } from "./create-lease.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBid } from "@test/seeders/bid.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const HELLO_WORLD_SDL = fs.readFileSync(path.resolve(__dirname, "../../../../test/mocks/hello-world-sdl.yml"), "utf8");

const ACCESS_REVOKED = { code: ACCESS_REVOKED_ERROR_CODE, message: "You no longer have access to this deployment." };

type Revocation = "membership" | "projectGrant" | "team";

const jobWorkers = useJobWorkers(() => [container.resolve(CreateLeaseHandler)]);

describe(CreateLeaseHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the leases and sends the manifest derived from the stored definition, run the way a worker runs it", async () => {
    const { createInBackground, findActivity, awaitCompleted, signerService, providerService, wallet, actorId } = await setup();

    await createInBackground();

    await awaitCompleted();
    expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id }), expect.any(Array), {
      actingUserId: actorId
    });
    expect(providerService.sendManifest).toHaveBeenCalledWith(
      expect.objectContaining({ dseq: expect.any(String), manifest: expect.stringContaining('"name":"web"') })
    );
    expect(providerService.toProviderAuth).toHaveBeenCalledWith({ walletId: wallet.id, provider: expect.any(String) });
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  it("creates a team wallet's leases with that wallet for a member who still has access to its project, from the definition another member filed", async () => {
    const { createInBackground, findActivity, awaitCompleted, signerService, providerService, wallet, actorId } = await setup({ inTeam: true });

    await createInBackground();

    await awaitCompleted();
    expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, userId: null }), expect.any(Array), {
      actingUserId: actorId
    });
    expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: expect.stringContaining('"name":"web"') }));
    expect(await findActivity()).toMatchObject({ userId: actorId, status: "succeeded" });
  });

  it.each([
    { change: "was removed from the team", revoke: "membership" },
    { change: "lost access to the deployment's project", revoke: "projectGrant" },
    { change: "saw the team deleted", revoke: "team" }
  ] as const)("signs nothing and records the lease as failed without a retry for a member who $change since the lease was queued", async ({ revoke }) => {
    const { createInBackground, findActivity, awaitCompleted, signerService, providerService } = await setup({ inTeam: true, revoke });

    await createInBackground();

    const job = await awaitCompleted();
    expect(job.retry_count).toBe(0);
    expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    expect(providerService.sendManifest).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "failed", meta: { error: ACCESS_REVOKED } });
  });

  it("records as succeeded a lease an earlier attempt landed on chain, even for a member removed from the team since", async () => {
    const { createInBackground, findActivity, awaitCompleted, signerService, providerService } = await setup({
      inTeam: true,
      revoke: "membership",
      leaseOnChain: "active"
    });

    await createInBackground();

    await awaitCompleted();
    expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    expect(signerService.followUpLandedLeases).toHaveBeenCalled();
    expect(providerService.sendManifest).toHaveBeenCalledTimes(1);
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  it("records a refusal on the first attempt as failed with its reason and ends the job", async () => {
    const { createInBackground, findActivity, awaitCompleted, signerService } = await setup();
    signerService.assertCanBroadcastByUserWallet.mockRejectedValue(createError(402, "Not enough credits to create this lease"));

    await createInBackground();

    await awaitCompleted();
    expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({
      status: "failed",
      meta: { error: { code: "lease_create_failed", message: "Not enough credits to create this lease" } }
    });
  });

  it("records the failure with its reason once the last attempt fails", async () => {
    const { createInBackground, findActivity, waitForJobIn, providerService } = await setup();
    providerService.sendManifest.mockRejectedValue(createError(503, "Provider service is temporarily unavailable"));

    await createInBackground({ retryLimit: 0 });

    await waitForJobIn("failed");
    expect(await findActivity()).toMatchObject({ status: "failed", meta: { error: { code: "manifest_not_delivered" } } });
  });

  it("records a lease its provider closed before receiving the manifest as undelivered on the last attempt, rather than as a closed bid", async () => {
    const { createInBackground, findActivity, waitForJobIn, bidHttpService, wallet, leases } = await setup({ leaseOnChain: "closed" });
    const closedBid = createBid({ owner: wallet.address!, ...leases[0] });
    closedBid.bid.state = "closed";
    bidHttpService.list.mockResolvedValue([closedBid]);

    await createInBackground({ retryLimit: 0 });

    await waitForJobIn("failed");
    expect(await findActivity()).toMatchObject({
      status: "failed",
      meta: {
        error: {
          code: "manifest_not_delivered",
          message: `The lease for deployment ${leases[0].dseq} was created, but it closed before provider ${leases[0].provider} received its manifest. Close the deployment and deploy again.`
        }
      }
    });
  });

  it("keeps the activity pending while the lease still has retries to come", async () => {
    const { createInBackground, findActivity, waitForJobIn, providerService } = await setup();
    providerService.sendManifest.mockRejectedValue(createError(503, "Provider service is temporarily unavailable"));

    await createInBackground({ retryLimit: 3, retryDelay: 3600 });

    await waitForJobIn("retry");
    expect(await findActivity()).toMatchObject({ status: "pending" });
  });

  async function setup(input: { inTeam?: boolean; revoke?: Revocation; leaseOnChain?: "active" | "closed" } = {}) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const team = input.inTeam ? await seedTeamDeployment() : undefined;
    if (team && input.revoke) await team.revoke(input.revoke);
    const { actorId, wallet, dseq } = team ?? (await seedPersonalDeployment());
    const leases = [{ dseq, gseq: 1, oseq: 1, provider: createAkashAddress() }];
    const activity = await activityRepository.create(pendingLeaseActivityOf({ userId: actorId, leases }));
    const singletonKey = createLeaseKeyFor({ owner: wallet.address!, dseq });
    const onChain = input.leaseOnChain
      ? [createLeaseApiResponse({ owner: wallet.address!, dseq, gseq: 1, oseq: 1, provider: leases[0].provider, state: input.leaseOnChain })]
      : [];

    vi.spyOn(container.resolve(LeaseHttpService), "list").mockResolvedValue({ leases: onChain, pagination: { next_key: null, total: String(onChain.length) } });
    const bidHttpService = container.resolve(BidHttpService);
    vi.spyOn(bidHttpService, "list").mockResolvedValue([]);
    const signerService = container.resolve(ManagedSignerService);
    vi.spyOn(signerService, "assertCanBroadcastByUserWallet").mockResolvedValue(undefined);
    vi.spyOn(signerService, "executeDecodedTxByUserWallet").mockResolvedValue({ code: 0, hash: "ABCDEF", transactionHash: "ABCDEF", rawLog: "" });
    vi.spyOn(signerService, "followUpLandedLeases").mockResolvedValue(undefined);
    const providerService = container.resolve(ProviderService);
    vi.spyOn(providerService, "assertReachable").mockResolvedValue(undefined);
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue({ type: "jwt", token: "jwt-token" });
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);

    return {
      wallet,
      actorId,
      leases,
      bidHttpService: vi.mocked(bidHttpService),
      signerService: vi.mocked(signerService),
      providerService: vi.mocked(providerService),
      awaitCompleted: () => expectJobCompleted(CreateLease[JOB_NAME], { singletonKey }),
      createInBackground: async (retryOverrides: EnqueueOptions = {}) => {
        await enqueue(new CreateLease({ userId: actorId, ...leaseWalletRefOf(wallet), leases, activityId: activity.id }), {
          singletonKey,
          ...CREATE_LEASE_RETRY_OPTIONS,
          ...retryOverrides
        });
        await startWorkers();
      },
      findActivity: async () => await activityRepository.findById(activity.id),
      waitForJobIn: async (state: "failed" | "retry") =>
        await vi.waitFor(
          async () => {
            const [row] = await findJobRows(CreateLease[JOB_NAME], { singletonKey });
            expect(row?.state).toBe(state);
          },
          { timeout: 15_000, interval: 100 }
        )
    };
  }

  async function seedPersonalDeployment() {
    const { wallet } = await seedUserWithWallet();
    const dseq = createDseq();
    await seedDeploymentSetting({ userId: wallet.userId!, dseq, sdl: HELLO_WORLD_SDL, manifestVersion: "AAAA" });

    return { actorId: wallet.userId!, wallet, dseq };
  }

  async function seedTeamDeployment() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const { organization, user: filer } = await seedOrganizationWithOwner();
    const project = await seedProject({ organizationId: organization.id });
    const member = await seedUser();
    const membership = await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });
    const grant = await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id, role: "member" });
    const wallet = await seedOrganizationWallet({ organizationId: organization.id, activatedAt: new Date() });
    const dseq = createDseq();
    await seedDeploymentSetting({
      userId: filer.id,
      organizationId: organization.id,
      projectId: project.id,
      dseq,
      sdl: HELLO_WORLD_SDL,
      manifestVersion: "AAAA"
    });

    const revocations: Record<Revocation, () => Promise<unknown>> = {
      membership: () => db.delete(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").id, membership.id)),
      projectGrant: () => db.delete(resolveTable("ProjectMembers")).where(eq(resolveTable("ProjectMembers").id, grant.id)),
      team: () =>
        db
          .update(resolveTable("Organizations"))
          .set({ deletedAt: new Date() })
          .where(eq(resolveTable("Organizations").id, organization.id))
    };

    return { actorId: member.id, wallet, dseq, revoke: async (revocation: Revocation) => await revocations[revocation]() };
  }
});
