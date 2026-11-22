import type { ApiOutput } from "../api-http/api-http.service";
import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";

export interface TemplateOutput {
  id: string;
  name: string;
  path: string;
  logoUrl: string;
  summary: string;
  readme: string;
  deploy: string;
  persistentStorageEnabled: boolean;
  guide: string;
  githubUrl: string;
  config: {
    ssh?: boolean;
  };
}

export interface TemplateHardware {
  cpu: number;
  memoryBytes: number;
  storageBytes: number;
  gpu?: { units: number; models: string[] };
}

export interface TemplateOutputSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  summary: string;
  deploy: string;
  tags?: string[];
  hardware?: TemplateHardware;
}

export interface TemplateCategory {
  title: string;
  templates: TemplateOutputSummary[];
}

export interface TemplateReadOptions {
  signal?: AbortSignal;
}

export class TemplateHttpService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async findById(id: string, options: TemplateReadOptions = {}): Promise<TemplateOutput> {
    const response = extractData(await this.#httpClient.get<{ data: TemplateOutput }>(`/v1/templates/${id}.json`, { signal: options.signal }));
    return response.data;
  }

  async findGroupedByCategory(options: TemplateReadOptions = {}): Promise<ApiOutput<TemplateCategory[]>> {
    return extractData(await this.#httpClient.get<{ data: TemplateCategory[] }>("/v1/templates-list.json", { signal: options.signal }));
  }
}
