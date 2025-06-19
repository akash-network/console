import type { Deployment, Provider } from "@akashnetwork/database/dbSchemas/akash";
import map from "lodash/map";
import mcache from "memory-cache";
import nock from "nock";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";

import { createAkashBlock, createDay, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";

describe("Provider deployments", () => {
  let provider: Provider;
  let deployments: Deployment[];

  beforeAll(async () => {
    await initDb();

    const day = await createDay({
      date: new Date(),
      firstBlockHeight: 1,
      lastBlockHeight: 100,
      lastBlockHeightYet: 100
    });

    provider = await createProvider();

    deployments = await Promise.all([
      createDeployment({
        owner: provider.owner,
        dseq: "dseq1",
        denom: "denom1",
        createdHeight: 1,
        closedHeight: null
      }),
      createDeployment({
        owner: provider.owner,
        dseq: "dseq2",
        denom: "denom1",
        createdHeight: 2,
        closedHeight: null
      }),
      createDeployment({
        owner: provider.owner,
        dseq: "dseq3",
        denom: "denom1",
        createdHeight: 3,
        closedHeight: 4
      })
    ]);

    const deploymentGroups = await Promise.all([
      createDeploymentGroup({
        deploymentId: deployments[0].id
      }),
      createDeploymentGroup({
        deploymentId: deployments[1].id
      }),
      createDeploymentGroup({
        deploymentId: deployments[2].id
      })
    ]);

    await Promise.all([
      createLease({
        providerAddress: provider.owner,
        createdHeight: 1,
        closedHeight: null,
        deploymentId: deployments[0].id,
        deploymentGroupId: deploymentGroups[0].id,
        dseq: deployments[0].dseq,
        state: "active"
      }),
      createLease({
        providerAddress: provider.owner,
        createdHeight: 2,
        closedHeight: null,
        deploymentId: deployments[1].id,
        deploymentGroupId: deploymentGroups[1].id,
        dseq: deployments[1].dseq,
        state: "active"
      }),
      createLease({
        providerAddress: provider.owner,
        createdHeight: 3,
        closedHeight: 4,
        deploymentId: deployments[2].id,
        deploymentGroupId: deploymentGroups[2].id,
        dseq: deployments[2].dseq,
        state: "closed"
      })
    ]);

    await Promise.all([
      createAkashBlock({
        height: 1,
        timestamp: day.date
      }),
      createAkashBlock({
        height: 2,
        timestamp: day.date
      }),
      createAkashBlock({
        height: 3,
        timestamp: day.date
      }),
      createAkashBlock({
        height: 4,
        timestamp: day.date
      })
    ]);
  });

  afterAll(async () => {
    await closeConnections();
    mcache.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const expectDeployments = (deploymentsFound: Deployment[], deploymentsExpected: Deployment[]) => {
    expect(deploymentsFound.length).toBe(deploymentsExpected.length);

    const dseqsFound = map(deploymentsFound, "dseq");
    deploymentsExpected.forEach(deployment => {
      expect(dseqsFound).toContain(deployment.dseq);
    });
  };

  describe("GET /v1/providers/:providerAddress/deployments", () => {
    it("returns deployments", async () => {
      const response = await app.request(`/v1/providers/${provider.owner}/deployments/0/2`);

      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.total).toBe(3);
      expectDeployments(data.deployments, [deployments[2], deployments[1]]);
    });

    it("returns deployments, paginated", async () => {
      const response = await app.request(`/v1/providers/${provider.owner}/deployments/1/2`);

      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.total).toBe(3);
      expectDeployments(data.deployments, [deployments[1], deployments[0]]);
    });

    it("respects status filter", async () => {
      const response = await app.request(`/v1/providers/${provider.owner}/deployments/0/2?status=closed`);

      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.total).toBe(1);
      expectDeployments(data.deployments, [deployments[2]]);
    });
  });
});
