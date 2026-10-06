import assert from "http-assert";
import { inject, singleton } from "tsyringe";

import { readProductUpdateUnsubscribeToken } from "@src/user/lib/product-update-unsubscribe-token/product-update-unsubscribe-token";
import { USER_CONFIG, type UserConfig } from "@src/user/providers/config.provider";
import { UserRepository } from "@src/user/repositories/user/user.repository";

@singleton()
export class ProductUpdateUnsubscriptionService {
  constructor(
    @inject(USER_CONFIG) private readonly config: UserConfig,
    private readonly userRepository: UserRepository
  ) {}

  async unsubscribe(token: string): Promise<void> {
    const secret = this.config.EMAIL_UNSUBSCRIBE_SECRET;
    assert(secret, 503, "Unsubscribe links are not configured");

    const userId = readProductUpdateUnsubscribeToken(secret, token);
    assert(userId, 400, "This unsubscribe link is invalid");

    await this.userRepository.updateBy({ id: userId, productUpdatesUnsubscribedAt: null }, { productUpdatesUnsubscribedAt: new Date() });
  }
}
