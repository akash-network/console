import axios, { AxiosInstance } from 'axios';
import { Memoize } from '@src/caching/helpers';

interface Node {
  id: string;
  api: string;
  rpc: string
}

export class NodeClient {
  constructor(private readonly http: AxiosInstance = axios.create({
    baseURL: "https://raw.githubusercontent.com/akash-network",
  })) {}

  @Memoize()
  async getMainnetNodes() {
    return await this.get<Node[]>(
      "cloudmos/main/config/mainnet-nodes.json"
    );
  }

  @Memoize()
  async getMainnetVersion() {
    return await this.get<string>(
      "net/master/mainnet/version.txt"
    );
  }

  @Memoize()
  async getSandboxNodes() {
    return await this.get<Node[]>(
      "cloudmos/main/config/sandbox-nodes.json"
    );
  }

  @Memoize()
  async getSandboxVersion() {
    return await this.get<string>(
      "net/master/sandbox/version.txt"
    );
  }

  @Memoize()
  async getTestnetNodes() {
    return await this.get<Node[]>(
      "cloudmos/main/config/testnet-nodes.json"
    );
  }

  @Memoize()
  async getTestnetVersion() {
    return await this.get<string>(
      "net/master/testnet-02/version.txt"
    );
  }

  private async get<T>(path: string) {
    const response = await this.http.get<T>(
      path
    );

    return response.data;
  }
}

export const nodeClient = new NodeClient();
