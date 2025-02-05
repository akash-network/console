import { randomUUID } from "crypto";
import { singleton } from "tsyringe";

import { CreateUserApiKeyRequest, UpdateUserApiKeyRequest } from "@src/auth/http-schemas/api-key.schema";
import { UserApiKeyOutput, UserApiKeyRepository } from "@src/auth/repositories/user-api-key/api-key.repository";
import { AuthService } from "@src/auth/services/auth.service";

@singleton()
export class UserApiKeyService {
  constructor(
    private readonly userApiKeyRepository: UserApiKeyRepository,
    private readonly authService: AuthService
  ) {}

  async findAll(userId: string): Promise<UserApiKeyOutput[]> {
    return await this.userApiKeyRepository.accessibleBy(this.authService.ability, "read").find({ userId });
  }

  async findById(id: string, userId: string): Promise<UserApiKeyOutput | undefined> {
    return await this.userApiKeyRepository.accessibleBy(this.authService.ability, "read").findOneBy({ id, userId });
  }

  async create(userId: string, input: CreateUserApiKeyRequest["data"]): Promise<UserApiKeyOutput> {
    const apiKey = `AKT_${randomUUID()}`;

    return await this.userApiKeyRepository.accessibleBy(this.authService.ability, "create").create({
      userId,
      apiKey,
      description: input.description,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined
    });
  }

  async update(id: string, userId: string, input: UpdateUserApiKeyRequest["data"]): Promise<UserApiKeyOutput | undefined> {
    const updateData = {
      ...input,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      ...(input.isActive !== undefined && { lastUsedAt: new Date() })
    };

    return await this.userApiKeyRepository.accessibleBy(this.authService.ability, "update").updateBy({ id, userId }, updateData, { returning: true });
  }

  async delete(id: string, userId: string): Promise<UserApiKeyOutput | undefined> {
    return await this.userApiKeyRepository.accessibleBy(this.authService.ability, "delete").deleteBy({ id, userId }, { returning: true });
  }
}
