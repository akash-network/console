import assert from "assert";
import { Disposable, inject, registry, singleton } from "tsyringe";
import { Unleash, UnleashConfig } from "unleash-client";

import { APP_INITIALIZER, AppInitializer, ON_APP_START } from "@src/core/providers/app-initializer";
import type { AppContext } from "@src/core/types/app-context";
import { CoreConfigService } from "../core-config/core-config.service";
import { ExecutionContextService } from "../execution-context/execution-context.service";
import { FeatureFlagValue } from "./feature-flags";

@registry([{ token: APP_INITIALIZER, useToken: FeatureFlagsService }])
@singleton()
export class FeatureFlagsService implements Disposable, AppInitializer {
  private readonly configService: CoreConfigService;
  private readonly executionContext: ExecutionContextService;
  private client?: Unleash;
  private readonly createClient: typeof createUnleashClient;
  private readonly UNLEASH_COOKIE_KEY = "unleash-session-id=";

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

    const currentUser = this.executionContext.get("CURRENT_USER");
    const sessionId = this.extractSessionId();

    return this.client.isEnabled(featureFlag, {
      currentTime: new Date(),
      userId: currentUser?.id,
      sessionId,
      environment: this.configService.get("DEPLOYMENT_ENV"),
      properties: {
        chainNetwork: this.configService.get("NETWORK")
      }
    });
  }

  private extractSessionId(): string | undefined {
    const httpContext = this.executionContext.get("HTTP_CONTEXT") as AppContext | undefined;
    if (!httpContext) return undefined;

    const cookieHeader = httpContext.req.header("cookie");
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split(";").map(c => c.trim());
    const unleashCookie = cookies.find(c => c.startsWith(this.UNLEASH_COOKIE_KEY));
    return unleashCookie?.replace(this.UNLEASH_COOKIE_KEY, "");
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

  async [ON_APP_START](): Promise<void> {
    await this.initialize();
  }
}

export function createUnleashClient(config: UnleashConfig): Unleash {
  return new Unleash(config);
}
