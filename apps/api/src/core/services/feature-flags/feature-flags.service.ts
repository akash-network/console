import assert from "assert";
import { Disposable, inject, singleton } from "tsyringe";
import { Unleash, UnleashConfig } from "unleash-client";

import { CoreConfigService } from "../core-config/core-config.service";
import { ExecutionContextService } from "../execution-context/execution-context.service";
import { FeatureFlagValue } from "./feature-flags";

@singleton()
export class FeatureFlagsService implements Disposable {
  private readonly configService: CoreConfigService;
  private readonly executionContext: ExecutionContextService;
  private client?: Unleash;
  private readonly createClient: typeof createUnleashClient;

  constructor(
    configService: CoreConfigService,
    executionContext: ExecutionContextService,
    @inject("createUnleashClient", { isOptional: true }) createClient = createUnleashClient
  ) {
    this.configService = configService;
    this.executionContext = executionContext;
    this.createClient = createClient;
  }

  isEnabled(featureFlag: FeatureFlagValue): boolean {
    if (this.configService.get("FEATURE_FLAGS_ENABLE_ALL")) return true;

    assert(this.client, "Feature flags service was not initialized. Call initialize() method first.");

    const clientInfo = this.executionContext.get("HTTP_CONTEXT")?.get("clientInfo");
    const currentUser = this.executionContext.get("CURRENT_USER");

    return this.client.isEnabled(featureFlag, {
      currentTime: new Date(),
      remoteAddress: clientInfo?.ip,
      userId: currentUser?.id,
      environment: this.configService.get("DEPLOYMENT_ENV"),
      properties: {
        userAgent: clientInfo?.userAgent,
        fingerprint: clientInfo?.fingerprint,
        nodeEnv: this.configService.get("NODE_ENV"),
        chainNetwork: this.configService.get("NETWORK")
      }
    });
  }

  onChanged(callback: () => void) {
    this.client?.on("changed", callback);
  }

  async initialize(): Promise<void> {
    if (this.configService.get("FEATURE_FLAGS_ENABLE_ALL")) return;

    const url = this.configService.get("UNLEASH_SERVER_API_URL");
    const token = this.configService.get("UNLEASH_SERVER_API_TOKEN");

    assert(url && token, "UNLEASH_SERVER_API_URL and UNLEASH_SERVER_API_TOKEN are required");
    const client = this.createClient({
      url,
      appName: this.configService.get("UNLEASH_APP_NAME"),
      customHeaders: { Authorization: token }
    });

    await new Promise((resolve, reject) => {
      client.once("synchronized", resolve);
      client.once("error", reject);
    });

    this.client = client;
  }

  dispose(): void {
    this.client?.destroyWithFlush();
    this.client?.removeAllListeners();
  }
}

export function createUnleashClient(config: UnleashConfig): Unleash {
  return new Unleash(config);
}
