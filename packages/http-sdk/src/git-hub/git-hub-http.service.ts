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
  "hardware-disk": ProviderAttributeSchemaDetail;
  "hardware-memory": ProviderAttributeSchemaDetail;
  "network-provider": ProviderAttributeSchemaDetail;
  "network-speed-up": ProviderAttributeSchemaDetail;
  "network-speed-down": ProviderAttributeSchemaDetail;
  "feat-persistent-storage": ProviderAttributeSchemaDetail;
  "feat-persistent-storage-type": ProviderAttributeSchemaDetail;
  "workload-support-chia": ProviderAttributeSchemaDetail;
  "workload-support-chia-capabilities": ProviderAttributeSchemaDetail;
  "feat-endpoint-ip": ProviderAttributeSchemaDetail;
  "feat-endpoint-custom-domain": ProviderAttributeSchemaDetail;
};

export type Auditor = {
  id: string;
  name: string;
  address: string;
  website: string;
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

  async getAuditors() {
    return this.extractData(await this.get<Auditor[]>(this.getFullPath("/config/auditors.json")));
  }

  private getFullPath(path: string) {
    return `/${this.organization}/${this.repository}/${this.branch}${path}`;
  }
}
