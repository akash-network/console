import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CoreConfig } from "@src/core/providers/config.provider";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { FallbackDeploymentReaderService } from "./fallback-deployment-reader.service";

describe(FallbackDeploymentReaderService.name, () => {
  describe("findAll", () => {
    it("clamps the page size to 100", async () => {
      const { service, deploymentRepository } = setup();

      await service.findAll({ owner: "akash1clamped", skip: 0, limit: 10000, countTotal: true });

      expect(deploymentRepository.findDeploymentsWithPagination).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    });

    it("computes next_key from the clamped limit", async () => {
      const { service } = setup({ count: 5000 });

      const result = await service.findAll({ owner: "akash1nextkey", skip: 0, limit: 10000, countTotal: true });

      expect(result.pagination.next_key).toBe("100");
    });

    it("passes a limit at or below 100 through unchanged", async () => {
      const { service, deploymentRepository } = setup();

      await service.findAll({ owner: "akash1small", skip: 0, limit: 50, countTotal: true });

      expect(deploymentRepository.findDeploymentsWithPagination).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
    });

    it("defaults the limit to 100 when omitted", async () => {
      const { service, deploymentRepository } = setup();

      await service.findAll({ owner: "akash1default", skip: 0, countTotal: true });

      expect(deploymentRepository.findDeploymentsWithPagination).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    });
  });

  function setup(input?: { count?: number }) {
    const deploymentRepository = mock<DeploymentRepository>();
    deploymentRepository.findDeploymentsWithPagination.mockResolvedValue({ count: input?.count ?? 0, rows: [] });
    const service = new FallbackDeploymentReaderService(deploymentRepository, mock<CoreConfig>());
    return { service, deploymentRepository };
  }
});
