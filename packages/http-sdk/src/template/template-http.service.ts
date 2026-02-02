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

export interface TemplateOutputSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  summary: string;
  deploy: string;
}

export interface TemplateCategory {
  title: string;
  templates: TemplateOutputSummary[];
}

export class TemplateHttpService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async findById(id: string): Promise<TemplateOutput> {
    return extractData(await this.#httpClient.get<TemplateOutput>(`/v1/templates/${id}.json`));
  }

  async findGroupedByCategory(): Promise<ApiOutput<TemplateCategory[]>> {
    return extractData(await this.#httpClient.get<{ data: TemplateCategory[] }>("/v1/templates-list.json"));
  }
}
