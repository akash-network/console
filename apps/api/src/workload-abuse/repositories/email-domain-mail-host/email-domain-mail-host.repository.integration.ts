import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import { EmailDomainMailHostRepository } from "./email-domain-mail-host.repository";

describe(EmailDomainMailHostRepository.name, () => {
  describe("upsertProfile", () => {
    it("stores a new profile", async () => {
      const { repository, domain, mxIp } = setup();

      await repository.upsertProfile({ domain, mxHosts: [`mail.${domain}`], selfHostedMxIps: [mxIp], hasWebsite: true });

      await expect(repository.find({ domain })).resolves.toMatchObject([{ domain, mxHosts: [`mail.${domain}`], selfHostedMxIps: [mxIp], hasWebsite: true }]);
    });

    it("overwrites an existing profile and refreshes its update time", async () => {
      const { repository, domain, mxIp } = setup();
      const previousUpdatedAt = new Date("2026-01-01T00:00:00Z");
      await repository.create({ domain, mxHosts: [`mail.${domain}`], selfHostedMxIps: [mxIp], hasWebsite: true, updatedAt: previousUpdatedAt });

      await repository.upsertProfile({ domain, mxHosts: ["route1.mx.cloudflare.net"], selfHostedMxIps: [], hasWebsite: false });

      const rows = await repository.find({ domain });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ domain, mxHosts: ["route1.mx.cloudflare.net"], selfHostedMxIps: [], hasWebsite: false });
      expect(rows[0].updatedAt.getTime()).toBeGreaterThan(previousUpdatedAt.getTime());
    });
  });

  describe("findBlockedDomainSharingMxIps", () => {
    it("returns a blocked domain that shares a mail server address", async () => {
      const { repository, blockedEmailDomainRepository, domain, mxIp, saveProfile } = setup();
      const sibling = `${faker.string.alphanumeric(12).toLowerCase()}.help`;
      await saveProfile(sibling, [mxIp, faker.internet.ipv4()]);
      await blockedEmailDomainRepository.create({ domain: sibling, status: "blocked" });

      await expect(repository.findBlockedDomainSharingMxIps([faker.internet.ipv4(), mxIp], domain)).resolves.toBe(sibling);
    });

    it("follows a block on a parent of the sharing domain", async () => {
      const { repository, blockedEmailDomainRepository, domain, mxIp, saveProfile } = setup();
      const parent = `${faker.string.alphanumeric(12).toLowerCase()}.mom`;
      await saveProfile(`eu.${parent}`, [mxIp]);
      await blockedEmailDomainRepository.create({ domain: parent, status: "blocked" });

      await expect(repository.findBlockedDomainSharingMxIps([mxIp], domain)).resolves.toBe(`eu.${parent}`);
    });

    it("lets an operator's allow on a subdomain outrank the block above it", async () => {
      const { repository, blockedEmailDomainRepository, domain, mxIp, saveProfile } = setup();
      const parent = `${faker.string.alphanumeric(12).toLowerCase()}.garden`;
      await saveProfile(`eu.${parent}`, [mxIp]);
      await blockedEmailDomainRepository.create({ domain: parent, status: "blocked" });
      await blockedEmailDomainRepository.create({ domain: `eu.${parent}`, status: "allowed" });

      await expect(repository.findBlockedDomainSharingMxIps([mxIp], domain)).resolves.toBeUndefined();
    });

    it("ignores domains sharing the address that are not blocked, and blocks on lookalike domains", async () => {
      const { repository, blockedEmailDomainRepository, domain, mxIp, saveProfile } = setup();
      const blocked = `${faker.string.alphanumeric(12).toLowerCase()}.makeup`;
      await saveProfile(`x${blocked}`, [mxIp]);
      await blockedEmailDomainRepository.create({ domain: blocked, status: "blocked" });

      await expect(repository.findBlockedDomainSharingMxIps([mxIp], domain)).resolves.toBeUndefined();
    });

    it("ignores a blocked domain on another mail server", async () => {
      const { repository, blockedEmailDomainRepository, domain, mxIp, saveProfile } = setup();
      const elsewhere = `${faker.string.alphanumeric(12).toLowerCase()}.help`;
      await saveProfile(elsewhere, [faker.internet.ipv6()]);
      await blockedEmailDomainRepository.create({ domain: elsewhere, status: "blocked" });

      await expect(repository.findBlockedDomainSharingMxIps([mxIp], domain)).resolves.toBeUndefined();
    });

    it("never links the domain to itself", async () => {
      const { repository, blockedEmailDomainRepository, domain, mxIp, saveProfile } = setup();
      await saveProfile(domain, [mxIp]);
      await blockedEmailDomainRepository.create({ domain, status: "blocked" });

      await expect(repository.findBlockedDomainSharingMxIps([mxIp], domain)).resolves.toBeUndefined();
    });

    it("returns nothing without an address to match", async () => {
      const { repository, domain } = setup();

      await expect(repository.findBlockedDomainSharingMxIps([], domain)).resolves.toBeUndefined();
    });
  });

  describe("findBlockedDomainsWithoutProfile", () => {
    it("returns blocked domains with no stored mail servers, newest block first", async () => {
      const { repository, blockedEmailDomainRepository, saveProfile } = setup();
      const [older, newer, profiled, allowed] = Array.from({ length: 4 }, () => `${faker.string.alphanumeric(12).toLowerCase()}.help`);
      await blockedEmailDomainRepository.create({ domain: older, status: "blocked", createdAt: new Date("2026-01-01T00:00:00Z") });
      await blockedEmailDomainRepository.create({ domain: newer, status: "blocked", createdAt: new Date("2026-02-01T00:00:00Z") });
      await blockedEmailDomainRepository.create({ domain: profiled, status: "blocked", createdAt: new Date("2026-03-01T00:00:00Z") });
      await blockedEmailDomainRepository.create({ domain: allowed, status: "allowed", createdAt: new Date("2026-04-01T00:00:00Z") });
      await saveProfile(profiled, []);

      const domains = await repository.findBlockedDomainsWithoutProfile(1000);

      expect(domains).toContain(older);
      expect(domains).toContain(newer);
      expect(domains).not.toContain(profiled);
      expect(domains).not.toContain(allowed);
      expect(domains.indexOf(newer)).toBeLessThan(domains.indexOf(older));
    });

    it("returns at most the requested number of domains", async () => {
      const { repository, blockedEmailDomainRepository } = setup();
      for (const index of [1, 2, 3]) {
        await blockedEmailDomainRepository.create({ domain: `${faker.string.alphanumeric(12).toLowerCase()}${index}.mom`, status: "blocked" });
      }

      await expect(repository.findBlockedDomainsWithoutProfile(2)).resolves.toHaveLength(2);
    });
  });

  function setup() {
    const repository = container.resolve(EmailDomainMailHostRepository);
    const blockedEmailDomainRepository = container.resolve(BlockedEmailDomainRepository);
    const domain = `${faker.string.alphanumeric(16).toLowerCase()}.com`;
    const mxIp = faker.internet.ipv6();

    async function saveProfile(profileDomain: string, selfHostedMxIps: string[]) {
      await repository.upsertProfile({ domain: profileDomain, mxHosts: [`mail.${profileDomain}`], selfHostedMxIps, hasWebsite: true });
    }

    return { repository, blockedEmailDomainRepository, domain, mxIp, saveProfile };
  }
});
