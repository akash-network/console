import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { createProductUpdateUnsubscribeToken } from "@src/user/lib/product-update-unsubscribe-token/product-update-unsubscribe-token";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { ProductUpdateUnsubscriptionService } from "./product-update-unsubscription.service";

describe(ProductUpdateUnsubscriptionService.name, () => {
  describe("unsubscribe", () => {
    it("stamps the opt-out on the user the token was signed for, keeping an earlier one", async () => {
      const { service, userRepository, secret } = setup();
      const userId = faker.string.uuid();

      await service.unsubscribe(createProductUpdateUnsubscribeToken(secret, userId));

      expect(userRepository.updateBy).toHaveBeenCalledWith(
        { id: userId, productUpdatesUnsubscribedAt: null },
        { productUpdatesUnsubscribedAt: expect.any(Date) }
      );
    });

    it("refuses a token signed with another secret with a 400", async () => {
      const { service, userRepository } = setup();

      await expect(service.unsubscribe(createProductUpdateUnsubscribeToken(faker.string.alphanumeric(32), faker.string.uuid()))).rejects.toMatchObject({
        status: 400,
        message: "This unsubscribe link is invalid"
      });
      expect(userRepository.updateBy).not.toHaveBeenCalled();
    });

    it("refuses every token with a 503 while no secret is configured", async () => {
      const { service, userRepository } = setup({ secret: undefined });

      await expect(service.unsubscribe(createProductUpdateUnsubscribeToken("", faker.string.uuid()))).rejects.toMatchObject({
        status: 503,
        message: "Unsubscribe links are not configured"
      });
      expect(userRepository.updateBy).not.toHaveBeenCalled();
    });
  });

  function setup(input: { secret?: string } = { secret: faker.string.alphanumeric(32) }) {
    const userRepository = mock<UserRepository>();
    const service = new ProductUpdateUnsubscriptionService({ EMAIL_UNSUBSCRIBE_SECRET: input.secret }, userRepository);

    return { service, userRepository, secret: input.secret! };
  }
});
