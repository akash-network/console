import type { FallbackLeaseListResponse } from "@src/deployment/http-schemas/lease-rpc.schema";
import { app, initDb } from "@src/rest-app";

import { createLease } from "@test/seeders";
import { createDeployment } from "@test/seeders";
import { createDeploymentGroup } from "@test/seeders";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createAkashBlock } from "@test/seeders/akash-block.seeder";

describe("Lease Fallback API", () => {
  describe("GET /akash/market/v1beta4/leases/list", () => {
    it("should return correct response structure with seeded data", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0]
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
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0]
      });

      expect(result.leases.length).toBeGreaterThan(0);
      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.owner).toBe(addresses[0]);
      });
    });

    it("should filter by dseq", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        dseq: "1001"
      });

      expect(result.leases.length).toBeGreaterThan(0);
      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.dseq).toBe("1001");
      });
    });

    it("should filter by state active", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        state: "active"
      });

      result.leases.forEach(lease => {
        expect(lease.lease.state).toBe("active");
        expect(lease.escrow_payment.state).toBe("open");
      });
    });

    it("should filter by state closed", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        state: "closed"
      });

      result.leases.forEach(lease => {
        expect(lease.lease.state).toBe("closed");
        expect(lease.escrow_payment.state).toBe("closed");
      });
    });

    it("should filter by provider", async () => {
      const { addresses, providers } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        provider: providers[0]
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.provider).toBe(providers[0]);
      });
    });

    it("should filter by gseq", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        gseq: 1
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.gseq).toBe(1);
      });
    });

    it("should filter by oseq", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        oseq: 1
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.oseq).toBe(1);
      });
    });

    it("should handle pagination with limit", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        limit: 1
      });

      expect(result.leases.length).toBeLessThanOrEqual(1);
      expect(result.pagination).toHaveProperty("next_key");
      expect(result.pagination).toHaveProperty("total");
    });

    it("should handle pagination with offset", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        skip: 0,
        limit: 1
      });

      expect(result.leases.length).toBeLessThanOrEqual(1);
    });

    it("should handle reverse sorting", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
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
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        dseq: "999999"
      });

      expect(result.leases).toEqual([]);
      expect(result.pagination.total).toBe("0");
      expect(result.pagination.next_key).toBeNull();
    });

    it("should handle count_total parameter", async () => {
      const { addresses } = await setup({ createTestData: true });

      const resultWithCount = await makeRequest({
        owner: addresses[0],
        countTotal: true
      });

      const resultWithoutCount = await makeRequest({
        owner: addresses[0],
        countTotal: false
      });

      expect(resultWithCount.pagination.total).not.toBe("0");
      expect(resultWithoutCount.pagination.total).toBe("0");
    });

    it("should handle multiple filters together", async () => {
      const { addresses, providers } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        provider: providers[0],
        state: "closed",
        limit: 10
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.owner).toBe(addresses[0]);
        expect(lease.lease.lease_id.provider).toBe(providers[0]);
        expect(lease.lease.state).toBe("closed");
      });
    });

    it("should return correct data types", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0]
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

  async function setup(
    options: {
      initDatabase?: boolean;
      createTestData?: boolean;
      uniqueId?: string;
    } = {}
  ) {
    const { initDatabase = true, createTestData = false, uniqueId = Date.now().toString() } = options;

    if (initDatabase) {
      await initDb();
    }

    if (!createTestData) {
      return {
        addresses: [createAkashAddress(), createAkashAddress(), createAkashAddress()],
        providers: [createAkashAddress(), createAkashAddress()],
        leases: []
      };
    }

    // Generate random height numbers
    const height1 = 1000 + parseInt(uniqueId.slice(-3));
    const height2 = 2000 + parseInt(uniqueId.slice(-3));
    const height3 = 3000 + parseInt(uniqueId.slice(-3));
    const height4 = 4000 + parseInt(uniqueId.slice(-3));
    const height5 = 5000 + parseInt(uniqueId.slice(-3));

    const testData: {
      addresses: string[];
      providers: string[];
      leases?: any[];
    } = {
      addresses: [createAkashAddress(), createAkashAddress(), createAkashAddress()],
      providers: [createAkashAddress(), createAkashAddress()]
    };

    // Create blocks first
    const blocks = await Promise.all([
      createAkashBlock({
        datetime: new Date(),
        height: height1
      }),
      createAkashBlock({
        datetime: new Date(),
        height: height2
      }),
      createAkashBlock({
        datetime: new Date(),
        height: height3
      }),
      createAkashBlock({
        datetime: new Date(),
        height: height4
      }),
      createAkashBlock({
        datetime: new Date(),
        height: height5
      })
    ]);

    // Create deployments and deployment groups first
    const deployments = await Promise.all([
      createDeployment({
        owner: testData.addresses[0],
        dseq: "1001",
        createdHeight: blocks[0].height
      }),
      createDeployment({
        owner: testData.addresses[0],
        dseq: "1002",
        createdHeight: blocks[1].height
      }),
      createDeployment({
        owner: testData.addresses[1],
        dseq: "2001",
        createdHeight: blocks[2].height
      })
    ]);

    const deploymentGroups = await Promise.all([
      createDeploymentGroup({
        owner: testData.addresses[0],
        dseq: "1001",
        gseq: 1,
        deploymentId: deployments[0].id
      }),
      createDeploymentGroup({
        owner: testData.addresses[0],
        dseq: "1002",
        gseq: 1,
        deploymentId: deployments[1].id
      }),
      createDeploymentGroup({
        owner: testData.addresses[1],
        dseq: "2001",
        gseq: 1,
        deploymentId: deployments[2].id
      })
    ]);

    // Create test leases
    testData.leases = await Promise.all([
      createLease({
        owner: testData.addresses[0],
        dseq: "1001",
        gseq: 1,
        oseq: 1,
        providerAddress: testData.providers[0],
        createdHeight: blocks[0].height,
        closedHeight: blocks[2].height, // closed
        deploymentId: deployments[0].id,
        deploymentGroupId: deploymentGroups[0].id,
        price: 1.5,
        denom: "uakt",
        withdrawnAmount: 0.5,
        cpuUnits: 1000,
        gpuUnits: 0,
        memoryQuantity: 1024 * 1024 * 1024,
        ephemeralStorageQuantity: 1024 * 1024 * 1024,
        persistentStorageQuantity: 0
      }),
      createLease({
        owner: testData.addresses[0],
        dseq: "1002",
        gseq: 1,
        oseq: 1,
        providerAddress: testData.providers[1],
        createdHeight: blocks[1].height,
        closedHeight: null, // active
        deploymentId: deployments[1].id,
        deploymentGroupId: deploymentGroups[1].id,
        price: 2.0,
        denom: "uusdc",
        withdrawnAmount: 0.0,
        cpuUnits: 2000,
        gpuUnits: 1,
        memoryQuantity: 2 * 1024 * 1024 * 1024,
        ephemeralStorageQuantity: 2 * 1024 * 1024 * 1024,
        persistentStorageQuantity: 0
      }),
      createLease({
        owner: testData.addresses[1],
        dseq: "2001",
        gseq: 1,
        oseq: 1,
        providerAddress: testData.providers[0],
        createdHeight: blocks[2].height,
        closedHeight: null, // active
        deploymentId: deployments[2].id,
        deploymentGroupId: deploymentGroups[2].id,
        price: 3.0,
        denom: "uakt",
        withdrawnAmount: 1.0,
        cpuUnits: 3000,
        gpuUnits: 2,
        memoryQuantity: 4 * 1024 * 1024 * 1024,
        ephemeralStorageQuantity: 4 * 1024 * 1024 * 1024,
        persistentStorageQuantity: 0
      })
    ]);

    return testData;
  }

  async function makeRequest(input: {
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
  }): Promise<FallbackLeaseListResponse> {
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
    return await response.json();
  }
});
