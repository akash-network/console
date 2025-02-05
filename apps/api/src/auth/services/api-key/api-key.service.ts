import { randomUUID } from "crypto";
import { singleton } from "tsyringe";

import { CreateApiKeyRequest, UpdateApiKeyRequest } from "@src/auth/http-schemas/api-key.schema";
import { ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { AuthService } from "@src/auth/services/auth.service";

@singleton()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly authService: AuthService
  ) {}

  async findAll(): Promise<ApiKeyOutput[]> {
    console.log("DEBUG", this.authService.currentUser);
    return await this.apiKeyRepository.accessibleBy(this.authService.ability, "read").find({ userId: this.authService.currentUser.id });
  }

  async findById(id: string): Promise<ApiKeyOutput | undefined> {
    return await this.apiKeyRepository.accessibleBy(this.authService.ability, "read").findOneBy({ id, userId: this.authService.currentUser.id });
  }

  async create(input: CreateApiKeyRequest["data"]): Promise<ApiKeyOutput> {
    const apiKey = `AKT_${randomUUID()}`;

    return await this.apiKeyRepository.accessibleBy(this.authService.ability, "create").create({
      ...input,
      userId: this.authService.currentUser.id,
      apiKey,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined
    });
  }

  async update(id: string, input: UpdateApiKeyRequest["data"]): Promise<ApiKeyOutput | undefined> {
    const updateData = {
      ...input,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      ...(input.isActive !== undefined && { lastUsedAt: new Date() })
    };

    return await this.apiKeyRepository
      .accessibleBy(this.authService.ability, "update")
      .updateBy({ id, userId: this.authService.currentUser.id }, updateData, { returning: true });
  }

  async delete(id: string): Promise<ApiKeyOutput | undefined> {
    return await this.apiKeyRepository
      .accessibleBy(this.authService.ability, "delete")
      .deleteBy({ id, userId: this.authService.currentUser.id }, { returning: true });
  }
}
