import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { getPostgresError } from "@src/core/repositories/base.repository";
import { UserRepository } from "@src/user/repositories";
import { BlockedEmailDomainRepository } from "./blocked-email-domain.repository";

describe(BlockedEmailDomainRepository.name, () => {
  describe("findByDomain", () => {
    it("matches the domain exactly", async () => {
      const { repository, domain, userId } = await setup();
      await repository.blockIfAbsent({ domain, reason: "workload_abuse", triggeredByUserId: userId });

      const [exact, subdomain, suffix, prefix] = await Promise.all([
        repository.findByDomain(domain),
        repository.findByDomain(`mail.${domain}`),
        repository.findByDomain(`x${domain}`),
        repository.findByDomain(`${domain}.attacker.net`)
      ]);

      expect(exact?.domain).toBe(domain);
      expect([subdomain, suffix, prefix]).toEqual([undefined, undefined, undefined]);
    });
  });

  describe("blockIfAbsent", () => {
    it("records an auto block with the wallet owner that triggered it", async () => {
      const { repository, domain, userId } = await setup();

      const blocked = await repository.blockIfAbsent({ domain, reason: "workload_abuse", triggeredByUserId: userId });

      expect(blocked).toMatchObject({ domain, status: "blocked", source: "auto", reason: "workload_abuse", triggeredByUserId: userId });
    });

    it("returns nothing to the second caller, so only one of two concurrent blocks owns the row", async () => {
      const { repository, domain, userId } = await setup();
      await repository.blockIfAbsent({ domain, reason: "workload_abuse", triggeredByUserId: userId });

      const second = await repository.blockIfAbsent({ domain, reason: "workload_abuse", triggeredByUserId: userId });

      expect(second).toBeUndefined();
    });

    it("leaves a domain an operator has allowed untouched", async () => {
      const { repository, domain, userId } = await setup();
      const allowed = await repository.create({ domain, status: "allowed", source: "manual", reason: "false positive" });

      const result = await repository.blockIfAbsent({ domain, reason: "workload_abuse", triggeredByUserId: userId });

      expect(result).toBeUndefined();
      expect(await repository.findById(allowed.id)).toMatchObject({ status: "allowed", source: "manual", reason: "false positive" });
    });
  });

  describe("the normalization constraint", () => {
    it.each([["Attacker.com"], [" attacker.com"], ["attacker.com "], ["miner@attacker.com"], ["localhost"]])(
      "rejects %s, so an unnormalized row can never sit in the table unmatched",
      async domain => {
        const { repository } = await setup();

        const error = await repository.create({ domain }).catch((caught: unknown) => caught);

        expect(getPostgresError(error)?.constraint_name).toBe("blocked_email_domains_domain_normalized");
      }
    );

    it("accepts a normalized domain", async () => {
      const { repository, domain } = await setup();

      await expect(repository.create({ domain })).resolves.toMatchObject({ domain });
    });
  });

  async function setup() {
    const repository = container.resolve(BlockedEmailDomainRepository);
    const userRepository = container.resolve(UserRepository);
    const user = await userRepository.create({ userId: faker.string.uuid() });

    return { repository, userId: user.id, domain: `${faker.string.alphanumeric(16).toLowerCase()}.com` };
  }
});
