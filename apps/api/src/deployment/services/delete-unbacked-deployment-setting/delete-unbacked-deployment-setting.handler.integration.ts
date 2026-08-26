import { faker } from "@faker-js/faker";
import { addMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JobQueueService, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { UserRepository } from "@src/user/repositories";
import { DeleteUnbackedDeploymentSetting, DeleteUnbackedDeploymentSettingHandler } from "./delete-unbacked-deployment-setting.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const DEPLOYMENT_INFO_PATH = "/akash/deployment/v1beta4/deployments/info";
const LATEST_BLOCK_PATH = "/cosmos/base/tendermint/v1beta1/blocks/latest";
const BLOCK_HEIGHT_HEADER = "x-cosmos-block-height";

/** Comfortably past the margin the presence check requires between the row and the block it will trust. */
const CHAIN_MINUTES_AHEAD = 30;
const CHAIN_HEIGHT = "28343549";

/** The response two independent mainnet REST nodes returned for a deployment that was never created. */
const ABSENT_FROM_CHAIN = {
  status: 404,
  body: { code: 5, message: "codespace deployment code 4: Deployment not found", details: [] }
};

/** What a node behind the pinned height actually answers, captured against mainnet. Note it is not code 5. */
const HEIGHT_ABOVE_THEIR_CHAIN = {
  status: 500,
  body: { code: 2, message: "codespace sdk code 26: invalid height: cannot query with height in the future; please provide a valid height", details: [] }
};

/** The shape of a real answer, trimmed to the fields the presence check can see. */
function presentOnChain(owner: string, dseq: string) {
  return {
    status: 200,
    body: {
      deployment: { id: { owner, dseq }, state: "active", hash: "bLTCo5xFV2obtovLJ/rUZDHLkzAbB8vlXpF2iJGKpaY=", created_at: "16122572", reclamation: null },
      groups: [],
      escrow_account: null
    }
  };
}

let jobQueueReady: Promise<JobQueueService> | undefined;

/** pg-boss owns its own schema and creates it on start, so the queue this suite uses is bootstrapped once per file. */
function bootstrapJobQueue() {
  jobQueueReady ??= (async () => {
    const jobQueue = container.resolve(JobQueueService);
    await jobQueue.setup();
    await jobQueue.registerHandlers([container.resolve(DeleteUnbackedDeploymentSettingHandler)]);

    return jobQueue;
  })();

  return jobQueueReady;
}

/**
 * Covers the compensation against a real database and a real chain response, because both halves of its decision
 * are about things a mock cannot get wrong on its behalf: what the node actually replies for a deployment that
 * does not exist, and whether the delete reaches the row.
 */
describe(DeleteUnbackedDeploymentSettingHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("deletes a setting no deployment backs, run the way a worker runs it", async () => {
    const { settingId, answerChainWith, enqueueCompensation, startWorkers, findSetting } = await setup();
    answerChainWith(ABSENT_FROM_CHAIN);

    await enqueueCompensation();
    await startWorkers();

    await vi.waitFor(async () => expect(await findSetting(settingId)).toBeUndefined(), { timeout: 20_000, interval: 250 });
  });

  it("keeps a setting the chain does have a deployment for", async () => {
    const { owner, dseq, settingId, payload, handler, answerChainWith, findSetting } = await setup();
    answerChainWith(presentOnChain(owner, dseq));

    await handler.handle(payload);

    expect(await findSetting(settingId)).toBeDefined();
  });

  it("keeps a setting and throws when the node answers with an error, so the queue retries", async () => {
    const { settingId, payload, handler, answerChainWith, findSetting } = await setup();
    answerChainWith({ status: 503, body: { code: 14, message: "upstream connect error", details: [] } });

    await expect(handler.handle(payload)).rejects.toThrow();

    expect(await findSetting(settingId)).toBeDefined();
  });

  it("keeps a setting and throws when the node cannot be reached at all", async () => {
    const { settingId, payload, handler, failChainWith, findSetting } = await setup();
    failChainWith(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));

    await expect(handler.handle(payload)).rejects.toThrow();

    expect(await findSetting(settingId)).toBeDefined();
  });

  it("keeps a setting and throws when the node answers with something unparseable", async () => {
    const { settingId, payload, handler, answerChainWith, findSetting } = await setup();
    answerChainWith({ status: 502, body: "<html>Bad Gateway</html>" });

    await expect(handler.handle(payload)).rejects.toThrow();

    expect(await findSetting(settingId)).toBeDefined();
  });

  it("pins the lookup to the height it proved is past the row", async () => {
    const { payload, handler, answerChainWith, pinnedHeights } = await setup();
    answerChainWith(ABSENT_FROM_CHAIN);

    await handler.handle(payload);

    expect(pinnedHeights()).toEqual([CHAIN_HEIGHT]);
  });

  it("keeps a setting and throws when the answering node has not reached the pinned height", async () => {
    const { settingId, payload, handler, answerChainWith, findSetting } = await setup();
    answerChainWith(HEIGHT_ABOVE_THEIR_CHAIN);

    await expect(handler.handle(payload)).rejects.toThrow();

    expect(await findSetting(settingId)).toBeDefined();
  });

  it("keeps a setting and throws when the chain has not progressed past the row", async () => {
    const { settingId, payload, handler, answerChainWith, findSetting } = await setup({ chainMinutesAhead: -1 });
    answerChainWith(ABSENT_FROM_CHAIN);

    await expect(handler.handle(payload)).rejects.toThrow(/not past/);

    expect(await findSetting(settingId)).toBeDefined();
  });

  it("keeps a setting and throws when the latest block cannot be read", async () => {
    const { settingId, payload, handler, answerChainWith, failLatestBlock, findSetting } = await setup();
    answerChainWith(ABSENT_FROM_CHAIN);
    failLatestBlock();

    await expect(handler.handle(payload)).rejects.toThrow();

    expect(await findSetting(settingId)).toBeDefined();
  });

  it("deletes the setting once across two deliveries of the same compensation", async () => {
    const { settingId, payload, handler, answerChainWith, findSetting } = await setup();
    answerChainWith(ABSENT_FROM_CHAIN, 2);

    await handler.handle(payload);
    await handler.handle(payload);

    expect(await findSetting(settingId)).toBeUndefined();
  });

  async function setup(input: { chainMinutesAhead?: number } = {}) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const restApiNodeUrl = container.resolve(CoreConfigService).get("REST_API_NODE_URL");
    const jobQueue = await bootstrapJobQueue();

    const owner = createAkashAddress();
    const dseq = faker.number.int({ min: 100000, max: 999999 }).toString();
    const user = await container.resolve(UserRepository).create({});
    const [setting] = await db
      .insert(deploymentSettingsTable)
      .values({ userId: user.id, dseq, autoTopUpEnabled: true, sdl: 'version: "2.0"', manifestVersion: "BAUG" })
      .returning();

    answerLatestBlockWith(addMinutes(new Date(setting.createdAt ?? new Date()), input.chainMinutesAhead ?? CHAIN_MINUTES_AHEAD));

    /**
     * Matches the exact deployment the compensation is about, so a lookup that asked for anything else finds no
     * interceptor and fails the test rather than quietly receiving the answer meant for another deployment.
     */
    const pinned: string[] = [];

    function answerLatestBlockWith(time: Date) {
      nock(restApiNodeUrl)
        .persist()
        .get(LATEST_BLOCK_PATH)
        .query(true)
        .reply(200, { block_id: {}, block: { header: { height: CHAIN_HEIGHT, time: time.toISOString(), chain_id: "akashnet-2" } } });
    }

    function failLatestBlock() {
      nock.cleanAll();
      nock(restApiNodeUrl)
        .persist()
        .get(LATEST_BLOCK_PATH)
        .query(true)
        .replyWithError(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));
      nock(restApiNodeUrl).get(DEPLOYMENT_INFO_PATH).query(true).reply(ABSENT_FROM_CHAIN.status, ABSENT_FROM_CHAIN.body);
    }

    function pinnedHeights() {
      return pinned;
    }

    function answerChainWith({ status, body }: { status: number; body: unknown }, times = 1) {
      nock(restApiNodeUrl)
        .get(DEPLOYMENT_INFO_PATH)
        .query({ "id.owner": owner, "id.dseq": dseq })
        .times(times)
        .reply(function reply(this: nock.ReplyFnContext) {
          const header = this.req.headers[BLOCK_HEIGHT_HEADER] as string | string[] | undefined;
          pinned.push(Array.isArray(header) ? header[0] : header ?? "(none)");

          return [status, body as nock.Body];
        });
    }

    function failChainWith(error: Error) {
      nock(restApiNodeUrl).get(DEPLOYMENT_INFO_PATH).query({ "id.owner": owner, "id.dseq": dseq }).replyWithError(error);
    }

    async function findSetting(id: string) {
      const [row] = await db.select().from(deploymentSettingsTable).where(eq(deploymentSettingsTable.id, id));

      return row;
    }

    return {
      handler: container.resolve(DeleteUnbackedDeploymentSettingHandler),
      payload: { deploymentSettingId: setting.id, owner, dseq, version: 1 as const },
      owner,
      dseq,
      settingId: setting.id,
      answerChainWith,
      failChainWith,
      failLatestBlock,
      pinnedHeights,
      findSetting,
      enqueueCompensation: () => jobQueue.enqueue(new DeleteUnbackedDeploymentSetting({ deploymentSettingId: setting.id, owner, dseq })),
      startWorkers: () => jobQueue.startWorkers({ concurrency: 1, pollingIntervalSeconds: 0.5 })
    };
  }
});
