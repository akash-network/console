import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";

import { HttpService } from "../http/http.service";
import type { NetworkNode } from "./types";

const RETRY_COUNT = 3;
const RETRY_DELAY_MILLISECONDS = 100;

export class NodeHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);

    axiosRetry(this as unknown as AxiosInstance, {
      retries: RETRY_COUNT,
      retryDelay: retryCount => Math.pow(2, retryCount) * RETRY_DELAY_MILLISECONDS,
      retryCondition: (error: AxiosError) => axiosRetry.isNetworkError(error) || (error.response?.status !== undefined && error.response.status >= 500)
    });
  }

  async getNodes(network: "mainnet" | "testnet" | "sandbox") {
    return this.extractData(await this.get<NetworkNode[]>(`console/main/config/${network}-nodes.json`));
  }

  async getVersion(network: "mainnet" | "testnet" | "sandbox") {
    const networkPath = network === "testnet" ? "testnet-02" : network;
    return this.extractData(await this.get<string>(`net/master/${networkPath}/version.txt`));
  }
}
