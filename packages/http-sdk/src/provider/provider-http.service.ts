import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import type { GetProviderResponse } from "./types";

export class ProviderHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getProvider(address: string): Promise<GetProviderResponse> {
    return this.extractData(await this.get<GetProviderResponse>(`/akash/provider/v1beta3/providers/${address}`));
  }

  async sendManifest({ hostUri, dseq, jsonStr, jwtToken }: { hostUri: string; dseq: string; jsonStr: string; jwtToken: string }) {
    return this.extractData(
      await this.put(`/deployment/${dseq}/manifest`, {
        baseURL: hostUri,
        body: jsonStr,
        headers: this.getJwtTokenHeaders(jwtToken),
        timeout: 60000
      })
    );
  }

  async getLeaseStatus({ hostUri, dseq, gseq, oseq, jwtToken }: { hostUri: string; dseq: string; gseq: number; oseq: number; jwtToken: string }) {
    return this.extractData(
      await this.get(`/lease/${dseq}/${gseq}/${oseq}/status`, {
        baseURL: hostUri,
        headers: this.getJwtTokenHeaders(jwtToken),
        timeout: 30000
      })
    );
  }

  private getJwtTokenHeaders(jwtToken: string) {
    return {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json"
    };
  }
}
