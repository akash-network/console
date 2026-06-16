import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

type ProviderAttributeSchemaDetailValue = { key: string; description: string; value?: string };

type ProviderAttributeSchemaDetail = {
  key: string;
  type: "string" | "number" | "boolean" | "option" | "multiple-option";
  required: boolean;
  description: string;
  values?: Array<ProviderAttributeSchemaDetailValue> | null;
};

export type ProviderAttributesSchema = {
  host: ProviderAttributeSchemaDetail;
  email: ProviderAttributeSchemaDetail;
  "discord-username": ProviderAttributeSchemaDetail;
  organization: ProviderAttributeSchemaDetail;
  website: ProviderAttributeSchemaDetail;
  tier: ProviderAttributeSchemaDetail;
  "status-page": ProviderAttributeSchemaDetail;
  "location-region": ProviderAttributeSchemaDetail;
  country: ProviderAttributeSchemaDetail;
  city: ProviderAttributeSchemaDetail;
  timezone: ProviderAttributeSchemaDetail;
  "location-type": ProviderAttributeSchemaDetail;
  "hosting-provider": ProviderAttributeSchemaDetail;
  "hardware-cpu": ProviderAttributeSchemaDetail;
  "hardware-cpu-arch": ProviderAttributeSchemaDetail;
  "hardware-gpu": ProviderAttributeSchemaDetail;
  "hardware-gpu-model": ProviderAttributeSchemaDetail;
  "hardware-gpu-capability": ProviderAttributeSchemaDetail;
  "hardware-persistent-storage-class": ProviderAttributeSchemaDetail;
  "hardware-persistent-storage-capability": ProviderAttributeSchemaDetail;
  "hardware-cuda": ProviderAttributeSchemaDetail;
  datacenter: ProviderAttributeSchemaDetail;
  "hardware-memory": ProviderAttributeSchemaDetail;
  "network-provider": ProviderAttributeSchemaDetail;
  "network-speed-up": ProviderAttributeSchemaDetail;
  "network-speed-down": ProviderAttributeSchemaDetail;
  "feat-persistent-storage": ProviderAttributeSchemaDetail;
  "feat-shm": ProviderAttributeSchemaDetail;
  "hardware-shm": ProviderAttributeSchemaDetail;
  "feat-endpoint-ip": ProviderAttributeSchemaDetail;
  "feat-endpoint-custom-domain": ProviderAttributeSchemaDetail;
};

export class GitHubHttpService extends HttpService {
  private readonly organization = "akash-network";
  private readonly repository = "console";
  private readonly branch = "main";

  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getProviderAttributesSchema() {
    return this.extractData(await this.get<ProviderAttributesSchema>(this.getFullPath("/config/provider-attributes.json")));
  }

  private getFullPath(path: string) {
    return `/${this.organization}/${this.repository}/${this.branch}${path}`;
  }
}
