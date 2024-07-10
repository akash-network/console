import { EncodeObject } from "@cosmjs/proto-signing/build/registry";
import { DeliverTxResponse } from "@cosmjs/stargate";

import { ApiHttpService } from "@src/services/api-http/api-http.service";
import { customRegistry } from "@src/utils/customRegistry";

export interface TxInput {
  userId: string;
  messages: EncodeObject[];
}

export type TxOutput = Pick<DeliverTxResponse, "code" | "transactionHash" | "rawLog">;

export class TxHttpService extends ApiHttpService {
  async signAndBroadcastTx(input: TxInput) {
    const messages = input.messages.map(m => ({ ...m, value: Buffer.from(customRegistry.encode(m)).toString("base64") }));

    return this.extractData(
      await this.post<TxOutput>("v1/tx", {
        data: {
          userId: input.userId,
          messages: messages
        }
      })
    );
  }
}

export const txHttpService = new TxHttpService();
