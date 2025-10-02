import type { FallbackLeaseListResponse } from "@src/deployment/http-schemas/lease-rpc.schema";
import { app, initDb } from "@src/rest-app";

import { createLease } from "@test/seeders";
import { createDeployment } from "@test/seeders";
import { createDeploymentGroup } from "@test/seeders";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createAkashBlock } from "@test/seeders/akash-block.seeder";

describe("Lease Fallback API", () => {
  describe("GET /akash/market/v1beta4/leases/list", () => {
    let isDbInitialized = false;

    async function setup({ createTestData = false } = {}) {
      if (isDbInitialized) {
        return { addresses: [], providers: [], leases: [] };
      }

      await initDb();

      const addresses = [createAkashAddress(), createAkashAddress(), createAkashAddress()];

      const providers = [createAkashAddress(), createAkashAddress()];

      const blocks = await Promise.all([
        createAkashBlock({ height: 1000 }),
        createAkashBlock({ height: 2000 }),
        createAkashBlock({ height: 3000 }),
        createAkashBlock({ height: 4000 }),
        createAkashBlock({ height: 5000 })
      ]);

      let leases: any[] = [];

      if (createTestData) {
        // Create deployments and deployment groups first
        const deployments = await Promise.all([
          createDeployment({
            owner: addresses[0],
            dseq: "1001",
            createdHeight: blocks[0].height
          }),
          createDeployment({
            owner: addresses[0],
            dseq: "1002",
            createdHeight: blocks[1].height
          }),
          createDeployment({
            owner: addresses[1],
            dseq: "2001",
            createdHeight: blocks[2].height
          })
        ]);

        const deploymentGroups = await Promise.all([
          createDeploymentGroup({
            owner: addresses[0],
            dseq: "1001",
            gseq: 1,
            deploymentId: deployments[0].id
          }),
          createDeploymentGroup({
            owner: addresses[0],
            dseq: "1002",
            gseq: 1,
            deploymentId: deployments[1].id
          }),
          createDeploymentGroup({
            owner: addresses[1],
            dseq: "2001",
            gseq: 1,
            deploymentId: deployments[2].id
          })
        ]);

        // Create test leases
        leases = await Promise.all([
          createLease({
            owner: addresses[0],
            dseq: "1001",
            gseq: 1,
            oseq: 1,
            providerAddress: providers[0],
            createdHeight: blocks[0].height,
            closedHeight: blocks[2].height, // closed
            deploymentId: deployments[0].id,
            deploymentGroupId: deploymentGroups[0].id,
            price: 1.5,
            denom: "uakt",
            withdrawnAmount: 0.5
          }),
          createLease({
            owner: addresses[0],
            dseq: "1002",
            gseq: 1,
            oseq: 1,
            providerAddress: providers[1],
            createdHeight: blocks[1].height,
            closedHeight: null, // active
            deploymentId: deployments[1].id,
            deploymentGroupId: deploymentGroups[1].id,
            price: 2.0,
            denom: "uusdc",
            withdrawnAmount: 0.0
          }),
          createLease({
            owner: addresses[1],
            dseq: "2001",
            gseq: 1,
            oseq: 1,
            providerAddress: providers[0],
            createdHeight: blocks[2].height,
            closedHeight: null, // active
            deploymentId: deployments[2].id,
            deploymentGroupId: deploymentGroups[2].id,
            price: 3.0,
            denom: "uakt",
            withdrawnAmount: 1.0
          })
        ]);
      }

      isDbInitialized = true;

      return { addresses, providers, leases };
    }

    async function makeRequest(params: Record<string, any> = {}): Promise<FallbackLeaseListResponse> {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await app.request(`/akash/market/v1beta4/leases/list?${queryParams.toString()}`);
      return await response.json();
    }

    it("should return correct response structure with seeded data", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0]
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
        "filters.owner": addresses[0]
      });

      expect(result.leases.length).toBeGreaterThan(0);
      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.owner).toBe(addresses[0]);
      });
    });

    it("should filter by dseq", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "filters.dseq": "1001"
      });

      expect(result.leases.length).toBeGreaterThan(0);
      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.dseq).toBe("1001");
      });
    });

    it("should filter by state active", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "filters.state": "active"
      });

      result.leases.forEach(lease => {
        expect(lease.lease.state).toBe("active");
        expect(lease.escrow_payment.state).toBe("open");
      });
    });

    it("should filter by state closed", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "filters.state": "closed"
      });

      result.leases.forEach(lease => {
        expect(lease.lease.state).toBe("closed");
        expect(lease.escrow_payment.state).toBe("closed");
      });
    });

    it("should filter by provider", async () => {
      const { addresses, providers } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "filters.provider": providers[0]
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.provider).toBe(providers[0]);
      });
    });

    it("should filter by gseq", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "filters.gseq": 1
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.gseq).toBe(1);
      });
    });

    it("should filter by oseq", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "filters.oseq": 1
      });

      result.leases.forEach(lease => {
        expect(lease.lease.lease_id.oseq).toBe(1);
      });
    });

    it("should handle pagination with limit", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "pagination.limit": 1
      });

      expect(result.leases.length).toBeLessThanOrEqual(1);
      expect(result.pagination).toHaveProperty("next_key");
      expect(result.pagination).toHaveProperty("total");
    });

    it("should handle pagination with offset", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "pagination.offset": 0,
        "pagination.limit": 1
      });

      expect(result.leases.length).toBeLessThanOrEqual(1);
    });

    it("should handle reverse sorting", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "pagination.reverse": true
      });

      expect(result.leases.length).toBeGreaterThan(0);
      // Note: We can't easily test the actual order without more complex setup
    });

    it("should return empty result for non-existent owner", async () => {
      const nonExistentOwner = createAkashAddress();

      const result = await makeRequest({
        "filters.owner": nonExistentOwner
      });

      expect(result.leases).toEqual([]);
      expect(result.pagination.total).toBe("0");
      expect(result.pagination.next_key).toBeNull();
    });

    it("should return empty result for non-existent dseq", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "filters.dseq": "999999"
      });

      expect(result.leases).toEqual([]);
      expect(result.pagination.total).toBe("0");
      expect(result.pagination.next_key).toBeNull();
    });

    it("should handle count_total parameter", async () => {
      const { addresses } = await setup({ createTestData: true });

      const resultWithCount = await makeRequest({
        "filters.owner": addresses[0],
        "pagination.count_total": true
      });

      const resultWithoutCount = await makeRequest({
        "filters.owner": addresses[0],
        "pagination.count_total": false
      });

      expect(resultWithCount.pagination.total).not.toBe("0");
      expect(resultWithoutCount.pagination.total).toBe("0");
    });

    it("should handle multiple filters together", async () => {
      const { addresses, providers } = await setup({ createTestData: true });

      const result = await makeRequest({
        "filters.owner": addresses[0],
        "filters.provider": providers[0],
        "filters.state": "closed",
        "pagination.limit": 10
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
        "filters.owner": addresses[0]
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
});
