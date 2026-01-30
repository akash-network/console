import type { AkashBlock, Deployment, DeploymentGroup, Provider } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import { subWeeks } from "date-fns";

import { app, initDb } from "@src/rest-app";

import { createAkashBlock, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { formatUTCDate } from "@test/utils";

describe("GET /v1/leases-duration/{owner}", () => {
  let providers: Provider[];
  let blocks: AkashBlock[];
  let deployments: Deployment[];
  let deploymentGroups: DeploymentGroup[];
  let owners: string[];
  const now = new Date();
  now.setUTCHours(12, 0, 0, 0);

  const dates = [subWeeks(now, 6), subWeeks(now, 5), subWeeks(now, 4), subWeeks(now, 3), subWeeks(now, 2), subWeeks(now, 1), now];
  const blockDates = [dates[0], dates[2], dates[4], dates[6]];
  const searchDates = [dates[1], dates[5]];

  beforeAll(async () => {
    await initDb();

    providers = await Promise.all([createProvider({ deletedHeight: null }), createProvider({ deletedHeight: null })]);

    blocks = await Promise.all([
      createAkashBlock({
        datetime: blockDates[0],
        height: 1
      }),
      createAkashBlock({
        datetime: blockDates[1],
        height: 101
      }),
      createAkashBlock({
        datetime: blockDates[2],
        height: 201
      }),
      createAkashBlock({
        datetime: blockDates[3],
        height: 301
      })
    ]);

    deployments = await Promise.all([
      createDeployment({
        owner: providers[0].owner,
        dseq: "1",
        createdHeight: blocks[0].height,
        closedHeight: blocks[1].height
      }),
      createDeployment({
        owner: providers[0].owner,
        dseq: "2",
        createdHeight: blocks[1].height,
        closedHeight: blocks[2].height
      }),
      createDeployment({
        owner: providers[0].owner,
        dseq: "3",
        createdHeight: blocks[2].height,
        closedHeight: blocks[3].height
      }),
      createDeployment({
        owner: providers[1].owner,
        dseq: "4",
        createdHeight: blocks[2].height,
        closedHeight: blocks[3].height
      })
    ]);

    deploymentGroups = await Promise.all([
      createDeploymentGroup({
        deploymentId: deployments[0].id
      }),
      createDeploymentGroup({
        deploymentId: deployments[1].id
      }),
      createDeploymentGroup({
        deploymentId: deployments[2].id
      }),
      createDeploymentGroup({
        deploymentId: deployments[3].id
      })
    ]);

    owners = [faker.finance.ethereumAddress(), faker.finance.ethereumAddress()];

    await Promise.all([
      createLease({
        owner: owners[0],
        providerAddress: providers[0].owner,
        createdHeight: blocks[0].height,
        closedHeight: blocks[1].height,
        deploymentId: deployments[0].id,
        deploymentGroupId: deploymentGroups[0].id,
        dseq: deployments[0].dseq
      }),
      createLease({
        owner: owners[0],
        providerAddress: providers[0].owner,
        createdHeight: blocks[1].height,
        closedHeight: blocks[2].height,
        deploymentId: deployments[1].id,
        deploymentGroupId: deploymentGroups[1].id,
        dseq: deployments[1].dseq
      }),
      createLease({
        owner: owners[0],
        providerAddress: providers[0].owner,
        createdHeight: blocks[2].height,
        closedHeight: blocks[3].height,
        deploymentId: deployments[2].id,
        deploymentGroupId: deploymentGroups[2].id,
        dseq: deployments[2].dseq
      }),
      createLease({
        owner: owners[1],
        providerAddress: providers[1].owner,
        createdHeight: blocks[2].height,
        closedHeight: blocks[3].height,
        deploymentId: deployments[3].id,
        deploymentGroupId: deploymentGroups[3].id,
        dseq: deployments[3].dseq
      })
    ]);
  });

  const expectLeasesDuration = async (
    response: Response,
    expected: { leaseCount: number; totalDurationInSeconds: number; totalDurationInHours: number; dseqs: string[] }
  ) => {
    const data = (await response.json()) as any;

    expect(data.leaseCount).toBe(expected.leaseCount);
    expect(data.totalDurationInSeconds).toBe(expected.totalDurationInSeconds);
    expect(data.totalDurationInHours).toBe(expected.totalDurationInHours);
    expect(data.leases.map((lease: any) => lease.dseq)).toEqual(expected.dseqs);
  };

  it("returns duration info for closed leases", async () => {
    const response = await app.request(`/v1/leases-duration/${owners[0]}`);

    expect(response.status).toBe(200);
    await expectLeasesDuration(response, {
      leaseCount: 3,
      totalDurationInSeconds: 3628800,
      totalDurationInHours: 1008,
      dseqs: ["1", "2", "3"]
    });
  });

  it("can filter by dseq", async () => {
    const response = await app.request(`/v1/leases-duration/${owners[0]}?dseq=${deployments[0].dseq}`);

    expect(response.status).toBe(200);
    await expectLeasesDuration(response, {
      leaseCount: 1,
      totalDurationInSeconds: 1209600,
      totalDurationInHours: 336,
      dseqs: ["1"]
    });
  });

  it("can filter by startDate", async () => {
    const response = await app.request(`/v1/leases-duration/${owners[0]}?startDate=${formatUTCDate(searchDates[0])}`);

    expect(response.status).toBe(200);
    await expectLeasesDuration(response, {
      leaseCount: 2,
      totalDurationInSeconds: 2419200,
      totalDurationInHours: 672,
      dseqs: ["2", "3"]
    });
  });

  it("can filter by endDate", async () => {
    const response = await app.request(`/v1/leases-duration/${owners[0]}?endDate=${formatUTCDate(searchDates[1])}`);

    expect(response.status).toBe(200);
    await expectLeasesDuration(response, {
      leaseCount: 2,
      totalDurationInSeconds: 2419200,
      totalDurationInHours: 672,
      dseqs: ["1", "2"]
    });
  });

  it("can filter by startDate and endDate at the same time", async () => {
    const response = await app.request(`/v1/leases-duration/${owners[0]}?startDate=${formatUTCDate(searchDates[0])}&endDate=${formatUTCDate(searchDates[1])}`);

    expect(response.status).toBe(200);
    await expectLeasesDuration(response, {
      leaseCount: 1,
      totalDurationInSeconds: 1209600,
      totalDurationInHours: 336,
      dseqs: ["2"]
    });
  });

  it("responds with 400 for an invalid dseq", async () => {
    const response = await app.request(`/v1/leases-duration/${owners[0]}?dseq=invalid`);

    expect(response.status).toBe(400);
  });

  describe("responds with 400 for invalid dates", () => {
    const invalidDateTests = [
      { param: "startDate", value: "invalid-date", description: "non-date string" },
      { param: "startDate", value: "2025-16-06", description: "invalid month" },
      { param: "startDate", value: "2025-05-35", description: "invalid day" },
      { param: "endDate", value: "invalid-date", description: "non-date string" },
      { param: "endDate", value: "2025-16-06", description: "invalid month" },
      { param: "endDate", value: "2025-05-35", description: "invalid day" }
    ];

    invalidDateTests.forEach(({ param, value, description }) => {
      it(`for ${param} with ${description}`, async () => {
        const response = await app.request(`/v1/leases-duration/${owners[0]}?${param}=${value}`);
        expect(response.status).toBe(400);
      });
    });
  });

  it("responds with 400 if endDate is before startDate", async () => {
    const response = await app.request(`/v1/leases-duration/${owners[0]}?startDate=${formatUTCDate(searchDates[1])}&endDate=${formatUTCDate(searchDates[0])}`);

    expect(response.status).toBe(400);
  });
});
