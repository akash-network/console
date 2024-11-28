import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";

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

export class TemplateHttpService extends ApiHttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async findById(id: string) {
    return await this.extractApiData(await this.get<TemplateOutput>(`/v1/templates/${id}`));
  }
}
