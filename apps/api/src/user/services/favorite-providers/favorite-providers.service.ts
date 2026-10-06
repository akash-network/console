import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { MAX_FAVORITE_PROVIDERS } from "@src/user/http-schemas/favorite-providers.schema";
import { FavoriteProviderRepository } from "@src/user/repositories/favorite-provider/favorite-provider.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";

@singleton()
export class FavoriteProvidersService {
  constructor(
    private readonly favoriteProviderRepository: FavoriteProviderRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly txService: TxService
  ) {}

  async list(): Promise<string[]> {
    return await this.favoriteProviderRepository.accessibleBy(this.authService.ability, "read").findAddresses();
  }

  /** Locks the user so two requests adding at once cannot both slip under the cap. */
  async add(providerAddresses: string[]): Promise<string[]> {
    const userId = this.authService.currentUser.id;

    return await this.txService.transaction(async () => {
      await this.userRepository.findOneByAndLock({ id: userId });
      await this.favoriteProviderRepository.accessibleBy(this.authService.ability, "create").addAll(userId, [...new Set(providerAddresses)]);

      const favorites = await this.list();
      if (favorites.length > MAX_FAVORITE_PROVIDERS) {
        throw createError(422, `You can keep up to ${MAX_FAVORITE_PROVIDERS} favorite providers.`, { errorCode: "favorite_providers_limit" });
      }

      return favorites;
    });
  }

  async remove(providerAddress: string): Promise<string[]> {
    await this.favoriteProviderRepository.accessibleBy(this.authService.ability, "delete").deleteBy({ providerAddress });

    return await this.list();
  }
}
