import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

interface BlockResponse {
  block: {
    header: {
      height: string;
    };
  };
}

export class BlockHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getCurrentHeight() {
    const response = this.extractData(await this.get<BlockResponse>("cosmos/base/tendermint/v1beta1/blocks/latest"));

    return parseInt(response.block.header.height);
  }
}
