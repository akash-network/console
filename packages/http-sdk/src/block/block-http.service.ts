import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";

interface BlockResponse {
  block: {
    header: {
      height: string;
    };
  };
}

export class BlockHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  async getCurrentHeight(): Promise<number> {
    const response = extractData(await this.httpClient.get<BlockResponse>("cosmos/base/tendermint/v1beta1/blocks/latest"));

    return parseInt(response.block.header.height);
  }
}
