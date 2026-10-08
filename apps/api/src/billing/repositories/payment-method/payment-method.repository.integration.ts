import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { PaymentMethodRepository } from "./payment-method.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(PaymentMethodRepository.name, () => {
  describe("hasSharedFingerprint", () => {
    it("returns true when both users saved a payment method with the same fingerprint", async () => {
      const { repository, payer, affiliate, savePaymentMethod } = await setup();
      const sharedFingerprint = faker.string.alphanumeric(16);
      await savePaymentMethod(payer.id, faker.string.alphanumeric(16));
      await savePaymentMethod(payer.id, sharedFingerprint);
      await savePaymentMethod(affiliate.id, sharedFingerprint);

      await expect(repository.hasSharedFingerprint(payer.id, affiliate.id)).resolves.toBe(true);
    });

    it("matches a shared Link account stored under its link_ fingerprint", async () => {
      const { repository, payer, affiliate, savePaymentMethod } = await setup();
      const linkFingerprint = `link_${faker.string.alphanumeric(32)}`;
      await savePaymentMethod(payer.id, linkFingerprint);
      await savePaymentMethod(affiliate.id, linkFingerprint);

      await expect(repository.hasSharedFingerprint(payer.id, affiliate.id)).resolves.toBe(true);
    });

    it("returns false when the users saved only different payment methods", async () => {
      const { repository, payer, affiliate, savePaymentMethod } = await setup();
      await savePaymentMethod(payer.id, faker.string.alphanumeric(16));
      await savePaymentMethod(affiliate.id, faker.string.alphanumeric(16));

      await expect(repository.hasSharedFingerprint(payer.id, affiliate.id)).resolves.toBe(false);
    });

    it("returns false when the fingerprint is shared with a third user only", async () => {
      const { repository, payer, affiliate, savePaymentMethod } = await setup();
      const stranger = await seedUser();
      const fingerprint = faker.string.alphanumeric(16);
      await savePaymentMethod(payer.id, fingerprint);
      await savePaymentMethod(stranger.id, fingerprint);
      await savePaymentMethod(affiliate.id, faker.string.alphanumeric(16));

      await expect(repository.hasSharedFingerprint(payer.id, affiliate.id)).resolves.toBe(false);
    });

    it("returns false when one of the users saved no payment method", async () => {
      const { repository, payer, affiliate, savePaymentMethod } = await setup();
      await savePaymentMethod(payer.id, faker.string.alphanumeric(16));

      await expect(repository.hasSharedFingerprint(payer.id, affiliate.id)).resolves.toBe(false);
    });
  });

  async function setup() {
    const repository = container.resolve(PaymentMethodRepository);
    const payer = await seedUser();
    const affiliate = await seedUser();

    async function savePaymentMethod(userId: string, fingerprint: string) {
      await repository.create({ userId, fingerprint, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` });
    }

    return { repository, payer, affiliate, savePaymentMethod };
  }
});
