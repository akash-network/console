import type { AxiosRequestConfig } from "axios";

import { ApiHttpService, ApiOutput } from "../api-http/api-http.service";

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

export class TemplateHttpService extends ApiHttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async findById(id: string): Promise<TemplateOutput> {
    return this.extractApiData(await this.get<TemplateOutput>(`/v1/templates/${id}`));
  }

  async findGroupedByCategory(): Promise<ApiOutput<TemplateCategory[]>> {
     return this.extractData(await this.get<TemplateCategory[]>('/v1/templates-list'));
  }
}

