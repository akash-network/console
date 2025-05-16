import { HttpService } from "@akashnetwork/http-sdk";

export class ConfigService extends HttpService {
  async getConfig(): Promise<RemoteConfig> {
    return this.extractData(await this.get<RemoteConfig>("/api/config"));
  }
}

export interface RemoteConfig {
  TURNSTILE_SITE_KEY: string;
}
