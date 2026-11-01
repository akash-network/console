import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { UserRepository } from "@src/user/repositories/user/user.repository";
import { EmailVerificationCodeRepository } from "./email-verification-code.repository";

describe(EmailVerificationCodeRepository.name, () => {
  describe("claimAttempt", () => {
    it("counts an attempt and answers the code while the limit is not reached", async () => {
      const { repository, seedCode } = setup();
      const record = await seedCode();

      const claimed = await repository.claimAttempt(record.id, 5);

      expect(claimed).toMatchObject({ id: record.id, code: record.code, attempts: 1 });
      expect(await repository.findByUserId(record.userId)).toMatchObject({ attempts: 1 });
    });

    it("answers nothing and counts nothing once the limit is reached", async () => {
      const { repository, seedCode } = setup();
      const record = await seedCode({ attempts: 5 });

      const claimed = await repository.claimAttempt(record.id, 5);

      expect(claimed).toBeUndefined();
      expect(await repository.findByUserId(record.userId)).toMatchObject({ attempts: 5 });
    });

    it("lets concurrent attempts through only up to the limit", async () => {
      const { repository, seedCode } = setup();
      const record = await seedCode();

      const claims = await Promise.all(Array.from({ length: 12 }, () => repository.claimAttempt(record.id, 5)));

      expect(claims.filter(Boolean)).toHaveLength(5);
      expect(await repository.findByUserId(record.userId)).toMatchObject({ attempts: 5 });
    });
  });

  function setup() {
    const repository = container.resolve(EmailVerificationCodeRepository);
    const userRepository = container.resolve(UserRepository);

    async function seedCode(input: { attempts?: number } = {}) {
      const user = await userRepository.create({ userId: faker.string.uuid(), email: faker.internet.email() });
      const record = await repository.upsert({
        userId: user.id,
        email: user.email!,
        code: faker.string.hexadecimal({ length: 64, prefix: "" }),
        expiresAt: faker.date.soon()
      });

      if (input.attempts) {
        await repository.updateById(record.id, { attempts: input.attempts });
      }

      return { ...record, attempts: input.attempts ?? 0 };
    }

    return { repository, seedCode };
  }
});
