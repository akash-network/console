import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import { MAX_FAVORITE_PROVIDERS } from "@src/user/http-schemas/favorite-providers.schema";
import type { FavoriteProviderRepository } from "@src/user/repositories/favorite-provider/favorite-provider.repository";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { FavoriteProvidersService } from "./favorite-providers.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(FavoriteProvidersService.name, () => {
  describe("list", () => {
    it("lists the favorites the user may read", async () => {
      const favorites = [createAkashAddress(), createAkashAddress()];
      const { service, favoriteProviderRepository, authService } = setup({ favorites });

      expect(await service.list()).toEqual(favorites);
      expect(favoriteProviderRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
    });
  });

  describe("add", () => {
    it("adds each provider once for the current user, holding the user's lock, and answers with the whole list", async () => {
      const added = createAkashAddress();
      const { service, favoriteProviderRepository, userRepository, authService, user } = setup({ favorites: [added] });

      expect(await service.add([added, added])).toEqual([added]);
      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: user.id });
      expect(favoriteProviderRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "create");
      expect(favoriteProviderRepository.addAll).toHaveBeenCalledWith(user.id, [added]);
    });

    it("accepts a list exactly at the cap", async () => {
      const { service } = setup({ favorites: addressesOf(MAX_FAVORITE_PROVIDERS) });

      expect(await service.add([createAkashAddress()])).toHaveLength(MAX_FAVORITE_PROVIDERS);
    });

    it("refuses a list past the cap, so the transaction rolls the additions back", async () => {
      const { service } = setup({ favorites: addressesOf(MAX_FAVORITE_PROVIDERS + 1) });

      await expect(service.add([createAkashAddress()])).rejects.toMatchObject({
        status: 422,
        errorCode: "favorite_providers_limit",
        message: `You can keep up to ${MAX_FAVORITE_PROVIDERS} favorite providers.`
      });
    });
  });

  describe("remove", () => {
    it("removes the provider from the favorites the user may delete and answers with what is left", async () => {
      const kept = createAkashAddress();
      const removed = createAkashAddress();
      const { service, favoriteProviderRepository, authService } = setup({ favorites: [kept] });

      expect(await service.remove(removed)).toEqual([kept]);
      expect(favoriteProviderRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "delete");
      expect(favoriteProviderRepository.deleteBy).toHaveBeenCalledWith({ providerAddress: removed });
    });
  });

  function addressesOf(count: number) {
    return Array.from({ length: count }, () => createAkashAddress());
  }

  function setup(input: { favorites?: string[] } = {}) {
    const user = createUser();
    const favoriteProviderRepository = mock<FavoriteProviderRepository>();
    favoriteProviderRepository.accessibleBy.mockReturnValue(favoriteProviderRepository);
    favoriteProviderRepository.findAddresses.mockResolvedValue(input.favorites ?? []);
    const userRepository = mock<UserRepository>();
    const authService = mock<AuthService>({ currentUser: user });
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());

    const service = new FavoriteProvidersService(favoriteProviderRepository, userRepository, authService, txService);

    return { service, favoriteProviderRepository, userRepository, authService, user };
  }
});
