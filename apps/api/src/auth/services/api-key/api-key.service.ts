import assert from "http-assert";
import { singleton } from "tsyringe";

import { ApiKeyInput, ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { ApiKeyGeneratorService } from "./api-key-generator.service";

@singleton()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly authService: AuthService,
    private readonly apiKeyGenerator: ApiKeyGeneratorService,
    private readonly executionContextService: ExecutionContextService,
    private readonly featureFlagsService: FeatureFlagsService
  ) {}

  async findAll(): Promise<ApiKeyOutput[]> {
    return await this.apiKeyRepository.accessibleBy(this.authService.ability, "read").find(this.#reachableKeys());
  }

  async findById(id: string): Promise<ApiKeyOutput | undefined> {
    const key = await this.apiKeyRepository.accessibleBy(this.authService.ability, "read").findOneBy({ id, ...this.#reachableKeys() });

    if (!key) return undefined;

    return key;
  }

  async create(input: ApiKeyInput): Promise<ApiKeyOutput & { apiKey: string }> {
    const projectId = await this.#bindableProjectId(input.projectId ?? this.authService.currentApiKey?.projectId);
    const apiKey = this.apiKeyGenerator.generateApiKey();
    const hashedKey = this.apiKeyGenerator.hashApiKeySha256(apiKey);
    const obfuscatedKey = this.apiKeyGenerator.obfuscateApiKey(apiKey);

    const created = await this.apiKeyRepository.accessibleBy(this.authService.ability, "create").create({
      ...input,
      userId: this.authService.currentUser.id,
      projectId,
      hashedKey,
      keyFormat: obfuscatedKey,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      lastUsedAt: null
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
      .updateBy({ id, ...this.#reachableKeys() }, updateData, { returning: true });

    if (!updated) return undefined;

    return {
      ...updated
    };
  }

  async delete(id: string): Promise<void> {
    await this.apiKeyRepository.accessibleBy(this.authService.ability, "delete").deleteBy({ id, ...this.#reachableKeys() }, { returning: true });
  }

  #reachableKeys(): Pick<ApiKeyInput, "userId" | "projectId"> {
    const userId = this.authService.currentUser.id;
    const projectId = this.authService.currentApiKey?.projectId;

    return projectId ? { userId, projectId } : { userId };
  }

  async #bindableProjectId(projectId: string | null | undefined): Promise<string | null> {
    if (!projectId) return null;

    assert(await this.#isBindable(projectId), 404, "Project not found");

    return projectId;
  }

  async #isBindable(projectId: string): Promise<boolean> {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");

    if (!context || !this.featureFlagsService.isEnabled(FeatureFlags.ORGANIZATIONS, { userId: this.authService.currentUser.id })) return false;
    if (context.projectScope.kind === "projects" && !context.projectScope.projectIds.includes(projectId)) return false;

    return !!(await this.projectRepository.accessibleBy(this.authService.ability, "read").findOneBy({ id: projectId, deletedAt: null }));
  }
}
