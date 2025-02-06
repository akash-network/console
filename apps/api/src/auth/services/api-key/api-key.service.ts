import { singleton } from "tsyringe";

import { ApiKeyInput, ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { AuthService } from "@src/auth/services/auth.service";
import { ApiKeyGeneratorService } from "./api-key-generator.service";

@singleton()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly authService: AuthService,
    private readonly apiKeyGenerator: ApiKeyGeneratorService
  ) {}

  async findAll(): Promise<ApiKeyOutput[]> {
    const keys = await this.apiKeyRepository.accessibleBy(this.authService.ability, "read").find({ userId: this.authService.currentUser.id });

    return keys.map(key => ({
      ...key,
      apiKey: key.keyFormat
    }));
  }

  async findById(id: string): Promise<ApiKeyOutput | undefined> {
    const key = await this.apiKeyRepository.accessibleBy(this.authService.ability, "read").findOneBy({ id, userId: this.authService.currentUser.id });

    if (!key) return undefined;

    return {
      ...key,
      apiKey: key.keyFormat
    };
  }

  async create(input: ApiKeyInput): Promise<ApiKeyOutput> {
    const apiKey = this.apiKeyGenerator.generateApiKey();
    const hashedKey = this.apiKeyGenerator.hashApiKey(apiKey);
    const obfuscatedKey = this.apiKeyGenerator.obfuscateApiKey(apiKey);

    const created = await this.apiKeyRepository.accessibleBy(this.authService.ability, "create").create({
      ...input,
      userId: this.authService.currentUser.id,
      hashedKey,
      keyFormat: obfuscatedKey,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined
    });

    return {
      ...created,
      apiKey
    };
  }

  async update(id: string, input: ApiKeyInput): Promise<ApiKeyOutput | undefined> {
    const updateData = {
      ...input,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined
    };

    const updated = await this.apiKeyRepository
      .accessibleBy(this.authService.ability, "update")
      .updateBy({ id, userId: this.authService.currentUser.id }, updateData, { returning: true });

    return {
      ...updated,
      apiKey: updated.keyFormat
    };
  }

  async delete(id: string): Promise<ApiKeyOutput | undefined> {
    return await this.apiKeyRepository
      .accessibleBy(this.authService.ability, "delete")
      .deleteBy({ id, userId: this.authService.currentUser.id }, { returning: true });
  }
}
