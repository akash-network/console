import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { CreateFavoriteProvidersRequest, FavoriteProvidersResponse } from "@src/user/http-schemas/favorite-providers.schema";
import { FavoriteProvidersService } from "@src/user/services/favorite-providers/favorite-providers.service";

@singleton()
export class FavoriteProvidersController {
  constructor(private readonly favoriteProvidersService: FavoriteProvidersService) {}

  @Protected([{ action: "read", subject: "FavoriteProvider" }])
  async list(): Promise<FavoriteProvidersResponse> {
    return { data: { providerAddresses: await this.favoriteProvidersService.list() } };
  }

  @Protected([{ action: "create", subject: "FavoriteProvider" }])
  async add({ providerAddresses }: CreateFavoriteProvidersRequest["data"]): Promise<FavoriteProvidersResponse> {
    return { data: { providerAddresses: await this.favoriteProvidersService.add(providerAddresses) } };
  }

  @Protected([{ action: "delete", subject: "FavoriteProvider" }])
  async remove(providerAddress: string): Promise<FavoriteProvidersResponse> {
    return { data: { providerAddresses: await this.favoriteProvidersService.remove(providerAddress) } };
  }
}
