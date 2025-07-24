import { HttpService } from "../http/http.service";

interface BlockResponse {
  block: {
    header: {
      height: string;
    };
  };
}

export class BlockHttpService extends HttpService {
  async getCurrentHeight() {
    const response = this.extractData(await this.get<BlockResponse>("blocks/latest"));

    return parseInt(response.block.header.height);
  }
}
