import { format } from "date-fns";
import { subDays } from "date-fns";

import type { FallbackLeaseListResponse } from "@src/deployment/http-schemas/lease-rpc.schema";
import { app, initDb } from "@src/rest-app";

import { createProvider } from "@test/seeders";
import { createLease } from "@test/seeders";
import { createDeployment } from "@test/seeders";
import { createDeploymentGroup } from "@test/seeders";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createAkashBlock } from "@test/seeders/akash-block.seeder";
import { createDay } from "@test/seeders/day.seeder";

type LeaseListTestParams = {
  owner?: string;
  dseq?: string;
  gseq?: number;
  oseq?: number;
  provider?: string;
  state?: string;
  skip?: number;
  limit?: number;
  key?: string;
  countTotal?: boolean;
  reverse?: boolean;
};

describe("Lease Fallback API", () => {
  let isDbInitialized = false;
  let cachedOwners: string[] = [];

  describe("GET /akash/market/v1beta4/leases/list", () => {
    it("should return correct response structure with seeded data", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0]
      });

      expect(result).toHaveProperty("leases");
      expect(result).toHaveProperty("pagination");
      expect(Array.isArray(result.leases)).toBe(true);
      expect(result.pagination).toHaveProperty("next_key");
      expect(result.pagination).toHaveProperty("total");

      // Should have at least one lease
      expect(result.leases.length).toBeGreaterThan(0);

      // Check lease structure
      const lease = result.leases[0];
      expect(lease).toHaveProperty("lease");
      expect(lease).toHaveProperty("escrow_payment");

      // Check lease details
      expect(lease.lease).toHaveProperty("lease_id");
      expect(lease.lease).toHaveProperty("state");
      expect(lease.lease).toHaveProperty("price");
      expect(lease.lease).toHaveProperty("created_at");
      expect(lease.lease).toHaveProperty("closed_on");

      // Check lease_id structure
      expect(lease.lease.lease_id).toHaveProperty("owner");
      expect(lease.lease.lease_id).toHaveProperty("dseq");
      expect(lease.lease.lease_id).toHaveProperty("gseq");
      expect(lease.lease.lease_id).toHaveProperty("oseq");
      expect(lease.lease.lease_id).toHaveProperty("provider");

      // Check price structure
      expect(lease.lease.price).toHaveProperty("denom");
      expect(lease.lease.price).toHaveProperty("amount");

      // Check escrow_payment structure
      expect(lease.escrow_payment).toHaveProperty("account_id");
      expect(lease.escrow_payment).toHaveProperty("payment_id");
      expect(lease.escrow_payment).toHaveProperty("owner");
      expect(lease.escrow_payment).toHaveProperty("state");
      expect(lease.escrow_payment).toHaveProperty("rate");
      expect(lease.escrow_payment).toHaveProperty("balance");
      expect(lease.escrow_payment).toHaveProperty("withdrawn");

      // Check account_id structure
      expect(lease.escrow_payment.account_id).toHaveProperty("scope");
      expect(lease.escrow_payment.account_id).toHaveProperty("xid");

      // Check rate, balance, and withdrawn structures
      expect(lease.escrow_payment.rate).toHaveProperty("denom");
      expect(lease.escrow_payment.rate).toHaveProperty("amount");
      expect(lease.escrow_payment.balance).toHaveProperty("denom");
      expect(lease.escrow_payment.balance).toHaveProperty("amount");
      expect(lease.escrow_payment.withdrawn).toHaveProperty("denom");
      expect(lease.escrow_payment.withdrawn).toHaveProperty("amount");
    });

    it("should filter by owner", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0]
      });

      expect(result.leases.length).toBeGreaterThan(0);
      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.owner).toBe(owners[0]);
      });
    });

    it("should filter by dseq", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        dseq: "1001"
      });

      expect(result.leases.length).toBeGreaterThan(0);
      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.dseq).toBe("1001");
      });
    });

    it("should filter by state active", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        state: "active"
      });

      result.leases.forEach(lease => {
        expect(lease.lease.state).toBe("active");
        expect(lease.escrow_payment.state).toBe("open");
      });
    });

    it("should filter by state closed", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        state: "closed"
      });

      result.leases.forEach(lease => {
        expect(lease.lease.state).toBe("closed");
        expect(lease.escrow_payment.state).toBe("closed");
      });
    });

    it("should filter by provider", async () => {
      const { owners, providers } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        provider: providers[0].owner
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.provider).toBe(providers[0].owner);
      });
    });

    it("should filter by gseq", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        gseq: 1
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.gseq).toBe(1);
      });
    });

    it("should filter by oseq", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        oseq: 1
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.oseq).toBe(1);
      });
    });

    it("should handle pagination with limit", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        limit: 1
      });

      expect(result.leases.length).toBeLessThanOrEqual(1);
      expect(result.pagination).toHaveProperty("next_key");
      expect(result.pagination).toHaveProperty("total");
    });

    it("should handle pagination with offset", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        skip: 0,
        limit: 1
      });

      expect(result.leases.length).toBeLessThanOrEqual(1);
    });

    it("should handle reverse sorting", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        reverse: true
      });

      expect(result.leases.length).toBeGreaterThan(0);
      // Note: We can't easily test the actual order without more complex setup
    });

    it("should return empty result for non-existent owner", async () => {
      const nonExistentOwner = createAkashAddress();

      const result = await makeRequest({
        owner: nonExistentOwner
      });

      expect(result.leases).toEqual([]);
      expect(result.pagination.total).toBe("0");
      expect(result.pagination.next_key).toBeNull();
    });

    it("should return empty result for non-existent dseq", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        dseq: "999999"
      });

      expect(result.leases).toEqual([]);
      expect(result.pagination.total).toBe("0");
      expect(result.pagination.next_key).toBeNull();
    });

    it("should handle count_total parameter", async () => {
      const { owners } = await setup();

      const resultWithCount = await makeRequest({
        owner: owners[0],
        countTotal: true
      });

      const resultWithoutCount = await makeRequest({
        owner: owners[0],
        countTotal: false
      });

      expect(resultWithCount.pagination.total).not.toBe("0");
      expect(resultWithoutCount.pagination.total).toBe("0");
    });

    it("should handle multiple filters together", async () => {
      const { owners, providers } = await setup();

      const result = await makeRequest({
        owner: owners[0],
        provider: providers[0].owner,
        state: "closed",
        limit: 10
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.owner).toBe(owners[0]);
        expect(lease.lease.lease_id.provider).toBe(providers[0].owner);
        expect(lease.lease.state).toBe("closed");
      });
    });

    it("should return correct data types", async () => {
      const { owners } = await setup();

      const result = await makeRequest({
        owner: owners[0]
      });

      expect(result.leases.length).toBeGreaterThan(0);
      const lease = result.leases[0];

      // Check data types
      expect(typeof lease.lease.lease_id.owner).toBe("string");
      expect(typeof lease.lease.lease_id.dseq).toBe("string");
      expect(typeof lease.lease.lease_id.gseq).toBe("number");
      expect(typeof lease.lease.lease_id.oseq).toBe("number");
      expect(typeof lease.lease.lease_id.provider).toBe("string");
      expect(typeof lease.lease.state).toBe("string");
      expect(typeof lease.lease.price.denom).toBe("string");
      expect(typeof lease.lease.price.amount).toBe("string");
      expect(typeof lease.lease.created_at).toBe("string");
      expect(typeof lease.lease.closed_on).toBe("string");
      expect(typeof lease.escrow_payment.payment_id).toBe("string");
      expect(typeof lease.escrow_payment.owner).toBe("string");
      expect(typeof lease.escrow_payment.state).toBe("string");
      expect(typeof lease.escrow_payment.rate.denom).toBe("string");
      expect(typeof lease.escrow_payment.rate.amount).toBe("string");
      expect(typeof lease.escrow_payment.balance.denom).toBe("string");
      expect(typeof lease.escrow_payment.balance.amount).toBe("string");
      expect(typeof lease.escrow_payment.withdrawn.denom).toBe("string");
      expect(typeof lease.escrow_payment.withdrawn.amount).toBe("string");
    });
  });

  async function setup() {
    await initDb();

    const now = new Date();
    now.setHours(12, 0, 0, 0);

    const dates = [subDays(now, 7), subDays(now, 6), subDays(now, 5), subDays(now, 4), subDays(now, 3), subDays(now, 2), subDays(now, 1), now];

    const providers = await Promise.all([createProvider({ deletedHeight: null }), createProvider({ deletedHeight: null })]);

    let owners: string[];
    if (isDbInitialized) {
      owners = cachedOwners;
    } else {
      owners = [createAkashAddress(), createAkashAddress(), createAkashAddress()];
      cachedOwners = owners;
    }

    if (isDbInitialized) {
      return {
        now,
        dates,
        owners,
        providers
      };
    }

    await Promise.all([
      createDay({
        date: format(dates[0], "yyyy-MM-dd"),
        firstBlockHeight: 1,
        lastBlockHeight: 100,
        lastBlockHeightYet: 100,
        aktPrice: 2.5
      }),
      createDay({
        date: format(dates[1], "yyyy-MM-dd"),
        firstBlockHeight: 101,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200,
        aktPrice: 2.75
      }),
      createDay({
        date: format(dates[2], "yyyy-MM-dd"),
        firstBlockHeight: 201,
        lastBlockHeight: 300,
        lastBlockHeightYet: 300,
        aktPrice: 3.0
      }),
      createDay({
        date: format(dates[3], "yyyy-MM-dd"),
        firstBlockHeight: 301,
        lastBlockHeight: 400,
        lastBlockHeightYet: 400,
        aktPrice: 3.25
      }),
      createDay({
        date: format(dates[4], "yyyy-MM-dd"),
        firstBlockHeight: 401,
        lastBlockHeight: 500,
        lastBlockHeightYet: 500,
        aktPrice: 3.5
      }),
      createDay({
        date: format(dates[5], "yyyy-MM-dd"),
        firstBlockHeight: 501,
        lastBlockHeight: 600,
        lastBlockHeightYet: 600,
        aktPrice: 3.75
      }),
      createDay({
        date: format(dates[6], "yyyy-MM-dd"),
        firstBlockHeight: 601,
        lastBlockHeight: 700,
        lastBlockHeightYet: 700,
        aktPrice: 4.0
      }),
      createDay({
        date: format(dates[7], "yyyy-MM-dd"),
        firstBlockHeight: 701,
        lastBlockHeight: 800,
        lastBlockHeightYet: 800,
        aktPrice: 4.25
      })
    ]);

    const blocks = await Promise.all([
      createAkashBlock({
        datetime: dates[0],
        height: 50
      }),
      createAkashBlock({
        datetime: dates[1],
        height: 150
      }),
      createAkashBlock({
        datetime: dates[2],
        height: 250
      }),
      createAkashBlock({
        datetime: dates[3],
        height: 350
      }),
      createAkashBlock({
        datetime: dates[4],
        height: 450
      }),
      createAkashBlock({
        datetime: dates[5],
        height: 550
      }),
      createAkashBlock({
        datetime: dates[6],
        height: 650
      }),
      createAkashBlock({
        datetime: dates[7],
        height: 750
      })
    ]);

    const deployments = await Promise.all([
      createDeployment({
        owner: owners[0],
        dseq: "1001",
        createdHeight: blocks[0].height,
        closedHeight: blocks[3].height,
        denom: "uakt"
      }),
      createDeployment({
        owner: owners[0],
        dseq: "1002",
        createdHeight: blocks[1].height,
        closedHeight: blocks[5].height,
        denom: "uusdc"
      }),
      createDeployment({
        owner: owners[0],
        dseq: "1003",
        createdHeight: blocks[2].height,
        closedHeight: null,
        denom: "uakt"
      }),
      createDeployment({
        owner: owners[1],
        dseq: "2001",
        createdHeight: blocks[1].height,
        closedHeight: blocks[4].height,
        denom: "uakt"
      }),
      createDeployment({
        owner: owners[1],
        dseq: "2002",
        createdHeight: blocks[3].height,
        closedHeight: null,
        denom: "uusdc"
      }),
      createDeployment({
        owner: owners[2],
        dseq: "3001",
        createdHeight: blocks[4].height,
        closedHeight: blocks[6].height,
        denom: "uakt"
      })
    ]);

    const deploymentGroups = await Promise.all([
      createDeploymentGroup({
        deploymentId: deployments[0].id,
        owner: owners[0],
        dseq: "1001"
      }),
      createDeploymentGroup({
        deploymentId: deployments[1].id,
        owner: owners[0],
        dseq: "1002"
      }),
      createDeploymentGroup({
        deploymentId: deployments[2].id,
        owner: owners[0],
        dseq: "1003"
      }),
      createDeploymentGroup({
        deploymentId: deployments[3].id,
        owner: owners[1],
        dseq: "2001"
      }),
      createDeploymentGroup({
        deploymentId: deployments[4].id,
        owner: owners[1],
        dseq: "2002"
      }),
      createDeploymentGroup({
        deploymentId: deployments[5].id,
        owner: owners[2],
        dseq: "3001"
      })
    ]);

    await Promise.all([
      createLease({
        owner: owners[0],
        dseq: "1001",
        providerAddress: providers[0].owner,
        createdHeight: blocks[0].height,
        closedHeight: blocks[3].height,
        deploymentId: deployments[0].id,
        deploymentGroupId: deploymentGroups[0].id,
        price: 50,
        denom: "uakt"
      }),
      createLease({
        owner: owners[0],
        dseq: "1002",
        providerAddress: providers[1].owner,
        createdHeight: blocks[1].height,
        closedHeight: blocks[5].height,
        deploymentId: deployments[1].id,
        deploymentGroupId: deploymentGroups[1].id,
        price: 25000,
        denom: "uusdc"
      }),
      createLease({
        owner: owners[0],
        dseq: "1003",
        providerAddress: providers[0].owner,
        createdHeight: blocks[2].height,
        closedHeight: null,
        deploymentId: deployments[2].id,
        deploymentGroupId: deploymentGroups[2].id,
        price: 75,
        denom: "uakt",
        predictedClosedHeight: "1000"
      }),
      createLease({
        owner: owners[1],
        dseq: "2001",
        providerAddress: providers[1].owner,
        createdHeight: blocks[1].height,
        closedHeight: blocks[4].height,
        deploymentId: deployments[3].id,
        deploymentGroupId: deploymentGroups[3].id,
        price: 40,
        denom: "uakt"
      }),
      createLease({
        owner: owners[1],
        dseq: "2002",
        providerAddress: providers[0].owner,
        createdHeight: blocks[3].height,
        closedHeight: null,
        deploymentId: deployments[4].id,
        deploymentGroupId: deploymentGroups[4].id,
        price: 30000,
        denom: "uusdc",
        predictedClosedHeight: "1200"
      })
    ]);

    isDbInitialized = true;
    cachedOwners = owners;

    return {
      now,
      dates,
      owners,
      providers
    };
  }

  async function makeRequest(input: LeaseListTestParams): Promise<FallbackLeaseListResponse> {
    const queryParams = new URLSearchParams();

    if (input.owner) queryParams.append("filters.owner", input.owner);
    if (input.dseq) queryParams.append("filters.dseq", input.dseq);
    if (input.gseq !== undefined) queryParams.append("filters.gseq", input.gseq.toString());
    if (input.oseq !== undefined) queryParams.append("filters.oseq", input.oseq.toString());
    if (input.provider) queryParams.append("filters.provider", input.provider);
    if (input.state) queryParams.append("filters.state", input.state);
    if (input.skip !== undefined) queryParams.append("pagination.offset", input.skip.toString());
    if (input.limit !== undefined) queryParams.append("pagination.limit", input.limit.toString());
    if (input.key) queryParams.append("pagination.key", input.key);
    if (input.countTotal !== undefined) queryParams.append("pagination.count_total", input.countTotal.toString());
    if (input.reverse !== undefined) queryParams.append("pagination.reverse", input.reverse.toString());

    const queryString = queryParams.toString();
    const url = `/akash/market/v1beta4/leases/list${queryString ? `?${queryString}` : ""}`;

    const response = await app.request(url);
    return (await response.json()) as FallbackLeaseListResponse;
  }
});
