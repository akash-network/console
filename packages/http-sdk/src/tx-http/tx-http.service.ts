import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { DeliverTxResponse } from "@cosmjs/stargate";
import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";

export interface TxInput {
  userId: string;
  messages: EncodeObject[];
}

export type TxOutput = Pick<DeliverTxResponse, "code" | "transactionHash" | "rawLog">;

export class TxHttpService extends ApiHttpService {
  constructor(
    private readonly registry: Registry,
    config?: AxiosRequestConfig
  ) {
    super(config);
  }
  async signAndBroadcastTx(input: TxInput) {
    const messages = input.messages.map(m => ({ ...m, value: Buffer.from(this.registry.encode(m)).toString("base64") }));

    return this.extractApiData(
      await this.post<TxOutput>("v1/tx", {
        data: {
          userId: input.userId,
          messages: messages
        }
      })
    );
  }
}
