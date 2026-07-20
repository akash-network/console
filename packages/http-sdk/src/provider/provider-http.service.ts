import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";
import type { GetProviderResponse } from "./types";

export class ProviderHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  async getProvider(address: string): Promise<GetProviderResponse> {
    return extractData(await this.httpClient.get<GetProviderResponse>(`/akash/provider/v1beta4/providers/${address}`));
  }

  async sendManifest({ hostUri, dseq, manifest, jwtToken }: { hostUri: string; dseq: string; manifest: string; jwtToken: string }): Promise<void> {
    return extractData(
      await this.httpClient.put(`/deployment/${dseq}/manifest`, {
        baseURL: hostUri,
        body: manifest,
        headers: this.getJwtTokenHeaders(jwtToken),
        timeout: 60000
      })
    );
  }

  async getLeaseStatus({ hostUri, dseq, gseq, oseq, jwtToken }: { hostUri: string; dseq: string; gseq: number; oseq: number; jwtToken: string }) {
    return extractData(
      await this.httpClient.get(`/lease/${dseq}/${gseq}/${oseq}/status`, {
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
