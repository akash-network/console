import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { app } from "@src/rest-app";
import { createProductUpdateUnsubscribeToken } from "@src/user/lib/product-update-unsubscribe-token/product-update-unsubscribe-token";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("Product update unsubscriptions", () => {
  const secret = faker.string.alphanumeric(32);
  const userRepository = container.resolve(UserRepository);

  beforeAll(() => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", secret);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  describe("POST /v1/product-update-unsubscriptions", () => {
    it("stops product updates for the user the one-click link was sent to", async () => {
      const user = await createUser();

      const response = await postOneClick(createProductUpdateUnsubscribeToken(secret, user.id), new URLSearchParams({ "List-Unsubscribe": "One-Click" }));

      expect(response.status).toBe(204);
      expect((await userRepository.findById(user.id))?.productUpdatesUnsubscribedAt).toBeInstanceOf(Date);
    });

    it("keeps the first opt-out time when the link is used again", async () => {
      const user = await createUser();
      const token = createProductUpdateUnsubscribeToken(secret, user.id);
      const oneClickForm = new FormData();
      oneClickForm.append("List-Unsubscribe", "One-Click");

      await postOneClick(token, oneClickForm);
      const firstUnsubscribedAt = (await userRepository.findById(user.id))?.productUpdatesUnsubscribedAt;
      const secondResponse = await postOneClick(token, oneClickForm);

      expect(secondResponse.status).toBe(204);
      expect(firstUnsubscribedAt).toBeInstanceOf(Date);
      expect((await userRepository.findById(user.id))?.productUpdatesUnsubscribedAt).toEqual(firstUnsubscribedAt);
    });

    it("refuses a forged link with a 400 and leaves the user subscribed", async () => {
      const user = await createUser();

      const response = await postOneClick(createProductUpdateUnsubscribeToken(faker.string.alphanumeric(32), user.id));

      expect(response.status).toBe(400);
      expect((await userRepository.findById(user.id))?.productUpdatesUnsubscribedAt).toBeNull();
    });

    it("refuses a request without a token with a 400", async () => {
      const response = await app.request("/v1/product-update-unsubscriptions", { method: "POST" });

      expect(response.status).toBe(400);
    });
  });

  async function createUser() {
    return userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}` });
  }

  async function postOneClick(token: string, body?: URLSearchParams | FormData) {
    return app.request(`/v1/product-update-unsubscriptions?token=${encodeURIComponent(token)}`, { method: "POST", body });
  }
});
