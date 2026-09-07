import { faker } from "@faker-js/faker";
import { subHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { UserRepository } from "@src/user/repositories";
import { WorkloadAbuseDetectionRepository } from "./workload-abuse-detection.repository";

describe(WorkloadAbuseDetectionRepository.name, () => {
  describe("findRecentHardTargets", () => {
    it("lists each deployment with a confirmed detection inside the window once", async () => {
      const { repository, walletId, createDetection } = await setup();
      await createDetection({ dseq: "1", verdict: "hard" });
      await createDetection({ dseq: "1", verdict: "hard" });
      await createDetection({ dseq: "2", verdict: "soft" });
      await createDetection({ dseq: "3", verdict: "hard", createdAt: subHours(new Date(), 30) });

      const targets = await repository.findRecentHardTargets({ since: subHours(new Date(), 26) });

      expect(targets.filter(target => target.walletId === walletId)).toEqual([{ walletId, dseq: "1" }]);
    });
  });

  async function setup() {
    const userRepository = container.resolve(UserRepository);
    const repository = container.resolve(WorkloadAbuseDetectionRepository);
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const walletId = faker.number.int({ min: 1, max: 1_000_000_000 });

    async function createDetection(input: { dseq: string; verdict: "hard" | "soft" | "proxy"; createdAt?: Date }) {
      return repository.create({
        userId: user.id,
        walletId,
        dseq: input.dseq,
        provider: "akash1provider",
        verdict: input.verdict,
        probeStatus: "probed",
        signals: [],
        evidenceExcerpt: "",
        createdAt: input.createdAt
      });
    }

    return { repository, walletId, createDetection };
  }
});
