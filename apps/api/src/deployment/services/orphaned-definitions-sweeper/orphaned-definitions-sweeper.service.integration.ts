import { DeploymentHttpService, type DeploymentInfo, type DeploymentListResponse } from "@akashnetwork/http-sdk";
import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { hoursToMilliseconds } from "date-fns";
import { and, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TopUpDeploymentsController } from "@src/deployment/controllers/deployment/top-up-deployments.controller";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { OrphanedDefinitionsSweeperService } from "./orphaned-definitions-sweeper.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

/**
 * Covers which rows the sweep deletes, which is the whole of its risk: the chain is stubbed at the
 * http-sdk boundary because what an owner's deployment list contains has its own tests, while whether a
 * given row survives the answer does not.
 */
describe(OrphanedDefinitionsSweeperService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a definition whose create transaction never reached the chain", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseq = "700001";
    await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(2) });
    chainKnows(address, []);

    const result = await sweeper.sweep({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(await findSetting(user.id, dseq)).toBeUndefined();
  });

  it("keeps the definition of a deployment that is live on chain", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseq = "700002";
    await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(2) });
    chainKnows(address, [{ dseq, state: "active" }]);

    await sweeper.sweep({ dryRun: false });

    expect(await findSetting(user.id, dseq)).toBeDefined();
  });

  /**
   * The shape a hand-closed deployment actually has. `closed` on the settings row is only ever set by the
   * funding sweep and the runtime-limit closer, so a deployment its owner closed through the API is still
   * `closed = false` here and does reach the chain check. Only the unfiltered listing keeps its record.
   */
  it("keeps the definition of a deployment closed on chain but not yet marked closed locally", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows, findAll } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseq = "700003";
    await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(48), closed: false });
    chainKnows(address, [{ dseq, state: "closed" }]);

    await sweeper.sweep({ dryRun: false });

    expect(await findSetting(user.id, dseq)).toBeDefined();
    expect(findAll).toHaveBeenCalledWith({ owner: address });
  });

  it("keeps the definition of a deployment already marked closed locally", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseq = "700011";
    await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(48), closed: true });
    chainKnows(address, [{ dseq, state: "closed" }]);

    await sweeper.sweep({ dryRun: false });

    expect(await findSetting(user.id, dseq)).toBeDefined();
  });

  it("keeps a definition still inside the grace period, without asking the chain about it", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, findAll } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "700004";
    await rememberDefinition(user.id, dseq, { createdAt: minutesAgo(5) });

    await sweeper.sweep({ dryRun: false });

    expect(findAll).not.toHaveBeenCalled();
    expect(await findSetting(user.id, dseq)).toBeDefined();
  });

  it("keeps a row a settings read created lazily, which remembers no definition", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseq = "700005";
    await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(2), sdl: null, manifestVersion: null });
    chainKnows(address, []);

    await sweeper.sweep({ dryRun: false });

    expect(await findSetting(user.id, dseq)).toBeDefined();
  });

  it("keeps every definition of an owner whose chain lookup fails", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, findAll } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "700006";
    await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(2) });
    findAll.mockRejectedValue(new Error("chain unreachable"));

    const result = await sweeper.sweep({ dryRun: false });

    expect(result.ok).toBe(false);
    expect(await findSetting(user.id, dseq)).toBeDefined();
  });

  it("deletes nothing on a dry run", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseq = "700007";
    await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(2) });
    chainKnows(address, []);

    await sweeper.sweep({ dryRun: true });

    expect(await findSetting(user.id, dseq)).toBeDefined();
  });

  it("deletes nothing on a second pass over the rows a first pass already swept", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows } = await setup();
    const { user, address } = await createUserWithWallet();
    const orphanDseq = "700008";
    const liveDseq = "700009";
    await rememberDefinition(user.id, orphanDseq, { createdAt: hoursAgo(2) });
    await rememberDefinition(user.id, liveDseq, { createdAt: hoursAgo(2) });
    chainKnows(address, [{ dseq: liveDseq, state: "active" }]);

    await sweeper.sweep({ dryRun: false });
    const secondPass = await sweeper.sweep({ dryRun: false });

    expect(secondPass.ok).toBe(true);
    expect(await findSetting(user.id, orphanDseq)).toBeUndefined();
    expect(await findSetting(user.id, liveDseq)).toBeDefined();
  });

  /**
   * The page size must never become a limit on how much history a run covers: an unexamined record is always
   * among the oldest of its cohort, and the next run reads the newest first, so anything a record cap left
   * behind would sit under a waterline that only rises. Real Postgres, real paging, more records than fit in
   * one page.
   */
  it("sweeps every orphan across pages, including the oldest one on the last page", async () => {
    const { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows, withPageSize } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseqs = ["700020", "700021", "700022", "700023", "700024"];

    for (const [index, dseq] of dseqs.entries()) {
      await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(dseqs.length - index + 1) });
    }
    chainKnows(address, [{ dseq: "700022", state: "active" }]);
    withPageSize(2);

    const result = await sweeper.sweep({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(await findSetting(user.id, "700020")).toBeUndefined();
    expect(await findSetting(user.id, "700024")).toBeUndefined();
    expect(await findSetting(user.id, "700022")).toBeDefined();
  });

  /**
   * The sweep runs from the CLI, whose principal holds an empty ability that grants nothing. A row-level
   * `accessibleBy` filter anywhere on this path would match no rows under that ability, so the sweep would
   * find nothing in production while every test supplying its own ability stayed green. This runs the real
   * CLI entrypoint inside the very context `console.ts` installs, so that failure cannot ship unnoticed.
   */
  it("sweeps through the CLI entrypoint under the empty ability the CLI runs with", async () => {
    const { createUserWithWallet, rememberDefinition, findSetting, chainKnows, runAsCli } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseq = "700010";
    await rememberDefinition(user.id, dseq, { createdAt: hoursAgo(2) });
    chainKnows(address, []);

    const result = await runAsCli(controller => controller.sweepOrphanedDefinitions({ dryRun: false }));

    expect(await findSetting(user.id, dseq)).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  function hoursAgo(hours: number) {
    return new Date(Date.now() - hoursToMilliseconds(hours));
  }

  function minutesAgo(minutes: number) {
    return new Date(Date.now() - minutes * 60 * 1000);
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWalletsTable = resolveTable("UserWallets");
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userRepository = container.resolve(UserRepository);
    const sweeper = container.resolve(OrphanedDefinitionsSweeperService);
    const config = container.resolve(DeploymentConfigService);

    /** Forces the sweep to page, so a test can seed more records than one read returns. */
    function withPageSize(pageSize: number) {
      const actual = config.get.bind(config);
      vi.spyOn(config, "get").mockImplementation(key => (key === "ORPHANED_DEFINITION_SWEEP_PAGE_SIZE" ? pageSize : actual(key)));
    }
    const executionContextService = container.resolve(ExecutionContextService);

    await db.delete(deploymentSettingsTable);

    const emptyList: DeploymentListResponse = { deployments: [], pagination: { next_key: null, total: "0" } };
    const findAll = vi.spyOn(container.resolve(DeploymentHttpService), "findAll").mockResolvedValue(emptyList);

    /**
     * Answers like the chain does: an unfiltered listing returns every deployment whatever its state, and
     * `filters.state=active` returns only the running ones. Narrowing the sweep's request to active would
     * therefore hide the closed deployments here too, and the tests that expect their records kept go red.
     */
    function chainKnows(owner: string, deployments: Array<{ dseq: string; state: string }>) {
      findAll.mockImplementation(async params => {
        if (params.owner !== owner) {
          return emptyList;
        }

        const visible = params.state ? deployments.filter(deployment => deployment.state === params.state) : deployments;

        return {
          deployments: visible.map(({ dseq, state }) => mock<DeploymentInfo>({ deployment: { id: { owner, dseq }, state } })),
          pagination: { next_key: null, total: visible.length.toString() }
        };
      });
    }

    async function createUserWithWallet() {
      const address = createAkashAddress();
      const user = await userRepository.create({});
      await db
        .insert(userWalletsTable)
        .values({ userId: user.id, address, deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing: false })
        .returning();

      return { user, address };
    }

    async function rememberDefinition(
      userId: string,
      dseq: string,
      overrides: { createdAt: Date; closed?: boolean; sdl?: string | null; manifestVersion?: string | null }
    ) {
      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId,
          dseq,
          autoTopUpEnabled: true,
          closed: overrides.closed ?? false,
          sdl: overrides.sdl === undefined ? "version: '2.0'\nservices:\n  web:\n    image: nginx" : overrides.sdl,
          manifestVersion: overrides.manifestVersion === undefined ? "bWFuaWZlc3Q=" : overrides.manifestVersion,
          createdAt: overrides.createdAt
        })
        .returning();

      return setting;
    }

    async function findSetting(userId: string, dseq: string) {
      const [setting] = await db
        .select()
        .from(deploymentSettingsTable)
        .where(and(eq(deploymentSettingsTable.userId, userId), eq(deploymentSettingsTable.dseq, dseq)));

      return setting;
    }

    async function runAsCli<R>(cb: (controller: TopUpDeploymentsController) => Promise<R>): Promise<R> {
      return executionContextService.runWithContext(async () => {
        executionContextService.set("CURRENT_USER", mock<UserOutput>({ id: "cli-user", userId: "system:cli-user", username: "___cli_user___" }));
        executionContextService.set("ABILITY", createMongoAbility<MongoAbility>());
        return cb(container.resolve(TopUpDeploymentsController));
      });
    }

    return { sweeper, createUserWithWallet, rememberDefinition, findSetting, chainKnows, findAll, runAsCli, withPageSize };
  }
});
