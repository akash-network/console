import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { getPostgresError } from "@src/core/repositories/base.repository";
import { UserRepository } from "@src/user/repositories";
import { normalizeEmailDomain } from "@src/workload-abuse/lib/email-domain/email-domain";
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

  describe("findNearestRule", () => {
    it("returns the row on the domain itself", async () => {
      const { repository, domain } = await setup();
      await repository.create({ domain, status: "blocked" });

      await expect(repository.findNearestRule(domain)).resolves.toMatchObject({ domain, status: "blocked" });
    });

    it("returns the row on a parent domain for any of its subdomains", async () => {
      const { repository, domain } = await setup();
      await repository.create({ domain, status: "blocked" });

      await expect(repository.findNearestRule(`eu.mail.${domain}`)).resolves.toMatchObject({ domain, status: "blocked" });
    });

    it("prefers the row nearest to the domain over the ones above it", async () => {
      const { repository, domain } = await setup();
      await repository.create({ domain, status: "blocked" });
      await repository.create({ domain: `mail.${domain}`, status: "allowed" });
      await repository.create({ domain: `eu.mail.${domain}`, status: "blocked" });

      const [subdomain, nestedSubdomain, deeperSubdomain] = await Promise.all([
        repository.findNearestRule(`mail.${domain}`),
        repository.findNearestRule(`eu.mail.${domain}`),
        repository.findNearestRule(`x.eu.mail.${domain}`)
      ]);

      expect(subdomain).toMatchObject({ domain: `mail.${domain}`, status: "allowed" });
      expect(nestedSubdomain).toMatchObject({ domain: `eu.mail.${domain}`, status: "blocked" });
      expect(deeperSubdomain).toMatchObject({ domain: `eu.mail.${domain}`, status: "blocked" });
    });

    it("ignores rows on sibling, child and lookalike domains", async () => {
      const { repository, domain } = await setup();
      await repository.create({ domain: `mail.${domain}`, status: "blocked" });
      await repository.create({ domain: `x${domain}`, status: "blocked" });

      const [parent, sibling] = await Promise.all([repository.findNearestRule(domain), repository.findNearestRule(`eu.${domain}`)]);

      expect([parent, sibling]).toEqual([undefined, undefined]);
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
    it.each([
      ["Attacker.com"],
      [" attacker.com"],
      ["attacker.com "],
      ["miner@attacker.com"],
      ["localhost"],
      ["attacker.com."],
      ["attacker..com"],
      ["-attacker.com"],
      ["attacker-.com"],
      ["attac ker.com"],
      ["attac_ker.com"]
    ])("rejects %s, so an unnormalized row can never sit in the table unmatched", async domain => {
      const { repository } = await setup();

      const error = await repository.create({ domain }).catch((caught: unknown) => caught);

      expect(getPostgresError(error)?.constraint_name).toBe("blocked_email_domains_domain_normalized");
      expect(normalizeEmailDomain(domain)).not.toBe(domain);
    });

    it("accepts a normalized domain", async () => {
      const { repository, domain } = await setup();

      expect(normalizeEmailDomain(domain)).toBe(domain);
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
