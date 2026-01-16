import { app, initDb } from "@src/rest-app";
import type { RestAkashDeploymentListResponse } from "@src/types/rest/akashDeploymentListResponse";
import { deploymentVersion } from "@src/utils/constants";

import { createDeployment, createDeploymentGroup, createDeploymentGroupResource } from "@test/seeders";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("Deployment Fallback API", () => {
  describe("GET /akash/deployment/v1beta4/deployments/list", () => {
    it("should return correct response structure with seeded data", async () => {
      const { addresses } = await setup({ createTestData: true });

      const result = await makeRequest({
        owner: addresses[0],
        state: "active"
      });

      expect(result).toHaveProperty("deployments");
      expect(result).toHaveProperty("pagination");
      expect(Array.isArray(result.deployments)).toBe(true);
      expect(result.pagination).toHaveProperty("next_key");
      expect(result.pagination).toHaveProperty("total");

      // Should have at least one deployment
      expect(result.deployments.length).toBeGreaterThan(0);

      // Check deployment structure
      const deployment = result.deployments[0];
      expect(deployment).toHaveProperty("deployment");
      expect(deployment).toHaveProperty("groups");
      expect(deployment).toHaveProperty("escrow_account");

      // Check deployment details
      expect(deployment.deployment).toHaveProperty("id");
      expect(deployment.deployment).toHaveProperty("state");
      expect(deployment.deployment).toHaveProperty("hash");
      expect(deployment.deployment).toHaveProperty("created_at");

      // Check groups structure
      expect(Array.isArray(deployment.groups)).toBe(true);
      if (deployment.groups.length > 0) {
        const group = deployment.groups[0];
        expect(group).toHaveProperty("id");
        expect(group).toHaveProperty("state");
        expect(group).toHaveProperty("group_spec");
        expect(group).toHaveProperty("created_at");

        // Check group_spec structure
        expect(group.group_spec).toHaveProperty("name");
        expect(group.group_spec).toHaveProperty("requirements");
        expect(group.group_spec).toHaveProperty("resources");

        // Check resources structure
        if (group.group_spec.resources.length > 0) {
          const resource = group.group_spec.resources[0];
          expect(resource).toHaveProperty("resource");
          expect(resource).toHaveProperty("count");
          expect(resource).toHaveProperty("price");

          // Check resource details
          expect(resource.resource).toHaveProperty("id");
          expect(resource.resource).toHaveProperty("cpu");
          expect(resource.resource).toHaveProperty("memory");
          expect(resource.resource).toHaveProperty("storage");
          expect(resource.resource).toHaveProperty("gpu");
          expect(resource.resource).toHaveProperty("endpoints");
        }
      }
    });

    it("should handle pagination parameters correctly", async () => {
      await setup();

      const result = await makeRequest({
        skip: 0,
        limit: 5,
        countTotal: true
      });

      expect(result).toHaveProperty("deployments");
      expect(result).toHaveProperty("pagination");
      expect(result.pagination.total).toBeDefined();
      expect(parseInt(result.pagination.total)).toBeGreaterThanOrEqual(0);
    });

    it("should handle reverse sorting", async () => {
      await setup();

      const result = await makeRequest({
        reverse: true,
        limit: 5
      });

      expect(result).toHaveProperty("deployments");
      expect(result).toHaveProperty("pagination");
    });

    it("should handle key-based pagination", async () => {
      await setup();

      const result = await makeRequest({
        key: "0",
        limit: 5
      });

      expect(result).toHaveProperty("deployments");
      expect(result).toHaveProperty("pagination");
    });

    it("should filter by owner when provided", async () => {
      const { addresses } = await setup();

      const result = await makeRequest({
        owner: addresses![0],
        state: "active"
      });

      expect(result).toHaveProperty("deployments");
      expect(result).toHaveProperty("pagination");

      // All deployments should belong to the specified owner
      result.deployments.forEach((deployment: any) => {
        expect(deployment.deployment.id.owner).toBe(addresses![0]);
      });
    });

    it("should filter by state when provided", async () => {
      await setup();

      const result = await makeRequest({
        state: "active"
      });

      expect(result).toHaveProperty("deployments");
      expect(result).toHaveProperty("pagination");

      // All deployments should be active
      result.deployments.forEach((deployment: any) => {
        expect(deployment.deployment.state).toBe("active");
      });
    });

    it("should return 200 status for valid requests", async () => {
      await setup();

      const response = await app.request(`/akash/deployment/${deploymentVersion}/deployments/list`);
      expect(response.status).toBe(200);
    });

    it("should handle empty results gracefully", async () => {
      await setup();

      const result = await makeRequest({
        owner: "akash1nonexistent123456789",
        state: "active"
      });

      expect(result).toHaveProperty("deployments");
      expect(result).toHaveProperty("pagination");
      expect(Array.isArray(result.deployments)).toBe(true);
      expect(result.deployments.length).toBe(0);
      expect(result.pagination).toHaveProperty("next_key");
      expect(result.pagination).toHaveProperty("total");
      expect(result.pagination.total).toBe("0");
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
      return { addresses: [createAkashAddress(), createAkashAddress()] };
    }

    const testData: {
      addresses: string[];
      deployments?: any[];
      deploymentGroups?: any[];
      deploymentGroupResources?: any[];
    } = {
      addresses: [createAkashAddress(), createAkashAddress()]
    };

    // Generate random height numbers
    const height1 = 100000 + parseInt(uniqueId.slice(-6));
    const height2 = 100001 + parseInt(uniqueId.slice(-6));

    testData.deployments = await Promise.all([
      createDeployment({
        owner: testData.addresses[0],
        createdHeight: height1,
        dseq: 1 + parseInt(uniqueId.slice(-3)),
        denom: "uakt",
        balance: 1000000,
        withdrawnAmount: 500000,
        lastWithdrawHeight: height1
      }),
      createDeployment({
        owner: testData.addresses[1],
        createdHeight: height2,
        dseq: 2 + parseInt(uniqueId.slice(-3)),
        denom: "uakt",
        balance: 2000000,
        withdrawnAmount: 1000000,
        lastWithdrawHeight: height2
      })
    ]);

    testData.deploymentGroups = await Promise.all([
      createDeploymentGroup({
        deploymentId: testData.deployments[0].id,
        owner: testData.addresses[0],
        dseq: testData.deployments[0].dseq,
        gseq: 1
      }),
      createDeploymentGroup({
        deploymentId: testData.deployments[1].id,
        owner: testData.addresses[1],
        dseq: testData.deployments[1].dseq,
        gseq: 1
      })
    ]);

    testData.deploymentGroupResources = await Promise.all([
      createDeploymentGroupResource({
        deploymentGroupId: testData.deploymentGroups[0].id,
        cpuUnits: 1000,
        gpuUnits: 0,
        gpuVendor: "nvidia",
        gpuModel: "gpu0",
        memoryQuantity: 524288000,
        ephemeralStorageQuantity: 524288000,
        persistentStorageQuantity: 0,
        count: 1,
        price: 1000
      }),
      createDeploymentGroupResource({
        deploymentGroupId: testData.deploymentGroups[1].id,
        cpuUnits: 500,
        gpuUnits: 1,
        gpuVendor: "amd",
        gpuModel: "gpu1",
        memoryQuantity: 536870912,
        ephemeralStorageQuantity: 536870912,
        persistentStorageQuantity: 0,
        count: 1,
        price: 10000
      })
    ]);

    return testData;
  }

  async function makeRequest(input: {
    owner?: string;
    state?: "active" | "closed";
    skip?: number;
    limit?: number;
    key?: string;
    countTotal?: boolean;
    reverse?: boolean;
  }): Promise<RestAkashDeploymentListResponse> {
    const queryParams = new URLSearchParams();

    if (input.owner) queryParams.append("filters.owner", input.owner);
    if (input.state) queryParams.append("filters.state", input.state);
    if (input.skip !== undefined) queryParams.append("pagination.offset", input.skip.toString());
    if (input.limit !== undefined) queryParams.append("pagination.limit", input.limit.toString());
    if (input.key) queryParams.append("pagination.key", input.key);
    if (input.countTotal !== undefined) queryParams.append("pagination.count_total", input.countTotal.toString());
    if (input.reverse !== undefined) queryParams.append("pagination.reverse", input.reverse.toString());

    const queryString = queryParams.toString();
    const url = `/akash/deployment/${deploymentVersion}/deployments/list${queryString ? `?${queryString}` : ""}`;

    const response = await app.request(url);
    expect(response.status).toBe(200);
    return (await response.json()) as RestAkashDeploymentListResponse;
  }
});
