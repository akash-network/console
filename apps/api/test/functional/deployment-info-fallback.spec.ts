import type { Deployment } from "@akashnetwork/database/dbSchemas/akash";
import type { DeploymentGroup } from "@akashnetwork/database/dbSchemas/akash";
import type { DeploymentGroupResource } from "@akashnetwork/database/dbSchemas/akash";
import Long from "long";

import { app, initDb } from "@src/rest-app";
import type { RestAkashDeploymentInfoResponse } from "@src/types/rest/akashDeploymentInfoResponse";
import { deploymentVersion } from "@src/utils/constants";

import { createDeployment, createDeploymentGroup, createDeploymentGroupResource } from "@test/seeders";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("Deployment Info Fallback API", () => {
  describe("GET /akash/deployment/v1beta4/deployments/info", () => {
    it("should return correct response structure with seeded data", async () => {
      const { addresses, deployments } = await setup({ createTestData: true });

      const result = await makeRequest({
        "id.owner": addresses[0],
        "id.dseq": deployments![0].dseq
      });

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result).toHaveProperty("deployment");
        expect(result).toHaveProperty("groups");
        expect(result).toHaveProperty("escrow_account");

        // Check deployment structure
        expect(result.deployment).toHaveProperty("id");
        expect(result.deployment.id).toHaveProperty("owner", addresses[0]);
        expect(result.deployment.id).toHaveProperty("dseq", deployments![0].dseq);
        expect(result.deployment).toHaveProperty("state");
        expect(result.deployment).toHaveProperty("hash");
        expect(result.deployment).toHaveProperty("created_at");

        // Check groups structure
        expect(Array.isArray(result.groups)).toBe(true);
        expect(result.groups.length).toBeGreaterThan(0);

        const group = result.groups[0];
        expect(group).toHaveProperty("id");
        expect(group).toHaveProperty("state");
        expect(group).toHaveProperty("group_spec");
        expect(group.group_spec).toHaveProperty("name");
        expect(group.group_spec).toHaveProperty("resources");
        expect(Array.isArray(group.group_spec.resources)).toBe(true);

        // Check escrow account structure
        expect(result.escrow_account).toHaveProperty("id");
        expect(result.escrow_account).toHaveProperty("state");
        expect(result.escrow_account.state).toHaveProperty("owner");
        expect(result.escrow_account.state).toHaveProperty("funds");
        expect(result.escrow_account.state).toHaveProperty("transferred");
      }
    });

    it("should return 404 for non-existent deployment", async () => {
      await setup();

      const result = await makeRequest({
        "id.owner": "akash1nonexistent",
        "id.dseq": "999999"
      });

      expect(result).toHaveProperty("code", 5);
      expect(result).toHaveProperty("message", "deployment not found");
      expect(result).toHaveProperty("details");
    });

    it("should handle different deployment states", async () => {
      const { addresses, deployments } = await setup({ createTestData: true });

      const activeResult = await makeRequest({
        "id.owner": addresses[0],
        "id.dseq": deployments![0].dseq
      });

      expect(isSuccessResponse(activeResult)).toBe(true);
      if (isSuccessResponse(activeResult)) {
        expect(activeResult.deployment.state).toBe("active");
        expect(activeResult.escrow_account.state.state).toBe("open");
      }
    });

    it("should return proper resource information", async () => {
      const { addresses, deployments } = await setup({ createTestData: true });

      const result = await makeRequest({
        "id.owner": addresses[0],
        "id.dseq": deployments![0].dseq
      });

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        const group = result.groups[0];
        const resource = group.group_spec.resources[0];

        expect(resource.resource).toHaveProperty("cpu");
        expect(resource.resource).toHaveProperty("memory");
        expect(resource.resource).toHaveProperty("storage");
        expect(resource.resource).toHaveProperty("gpu");
        expect(resource.resource).toHaveProperty("endpoints");

        expect(resource.resource.cpu.units).toHaveProperty("val");
        expect(resource.resource.memory.quantity).toHaveProperty("val");
        expect(Array.isArray(resource.resource.storage)).toBe(true);
        expect(resource.resource.gpu.units).toHaveProperty("val");
        expect(Array.isArray(resource.resource.endpoints)).toBe(true);

        expect(resource).toHaveProperty("count");
        expect(resource).toHaveProperty("price");
        expect(resource.price).toHaveProperty("denom");
        expect(resource.price).toHaveProperty("amount");
      }
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
      deployments?: Deployment[];
      deploymentGroups?: DeploymentGroup[];
      deploymentGroupResources?: DeploymentGroupResource[];
    } = {
      addresses: [createAkashAddress(), createAkashAddress()]
    };

    const height1 = 100000 + parseInt(uniqueId.slice(-6));
    const height2 = 100001 + parseInt(uniqueId.slice(-6));

    testData.deployments = await Promise.all([
      createDeployment({
        owner: testData.addresses[0],
        createdHeight: height1,
        dseq: Long.fromNumber(1 + parseInt(uniqueId.slice(-3))).toString(),
        denom: "uakt",
        balance: 1000000,
        withdrawnAmount: 500000,
        lastWithdrawHeight: height1
      }),
      createDeployment({
        owner: testData.addresses[1],
        createdHeight: height2,
        dseq: Long.fromNumber(2 + parseInt(uniqueId.slice(-3))).toString(),
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

  function isSuccessResponse(
    response: RestAkashDeploymentInfoResponse
  ): response is Exclude<RestAkashDeploymentInfoResponse, { code: number; message: string; details: string[] }> {
    return !("code" in response);
  }

  async function makeRequest(input: { "id.owner": string; "id.dseq": string }): Promise<RestAkashDeploymentInfoResponse> {
    const params = new URLSearchParams(input);

    const url = `/akash/deployment/${deploymentVersion}/deployments/info?${params.toString()}`;
    const response = await app.request(url);

    return (await response.json()) as RestAkashDeploymentInfoResponse;
  }
});
