import { Deployment } from "@akashnetwork/database/dbSchemas/akash";
import { Op } from "sequelize";

import { DeploymentRepository } from "./deployment.repository";

describe(DeploymentRepository.name, () => {
  describe("countByOwner", () => {
    it("counts all deployments for an owner when no status filter", async () => {
      const owner = "akash1abc123";
      const expectedCount = 42;
      const { repository, countSpy } = setup({ count: expectedCount });

      const result = await repository.countByOwner(owner);

      expect(countSpy).toHaveBeenCalledWith({ where: { owner } });
      expect(result).toBe(expectedCount);
    });

    it("counts only active deployments when status is 'active'", async () => {
      const owner = "akash1abc123";
      const expectedCount = 10;
      const { repository, countSpy } = setup({ count: expectedCount });

      const result = await repository.countByOwner(owner, "active");

      expect(countSpy).toHaveBeenCalledWith({
        where: { owner, closedHeight: null }
      });
      expect(result).toBe(expectedCount);
    });

    it("counts only closed deployments when status is 'closed'", async () => {
      const owner = "akash1abc123";
      const expectedCount = 32;
      const { repository, countSpy } = setup({ count: expectedCount });

      const result = await repository.countByOwner(owner, "closed");

      expect(countSpy).toHaveBeenCalledWith({
        where: { owner, closedHeight: { [Op.ne]: null } }
      });
      expect(result).toBe(expectedCount);
    });
  });

  function setup(input: { count: number }) {
    const countSpy = jest.spyOn(Deployment, "count").mockResolvedValue(input.count);
    const repository = new DeploymentRepository();

    return { repository, countSpy };
  }
});
