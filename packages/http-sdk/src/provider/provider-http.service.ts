import { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import { GetProviderResponse } from "./types";

export class ProviderHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getProvider(address: string): Promise<GetProviderResponse> {
    return this.extractData(await this.get<GetProviderResponse>(`/akash/provider/v1beta3/providers/${address}`));
  }
}
