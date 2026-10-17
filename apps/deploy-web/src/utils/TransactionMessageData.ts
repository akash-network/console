import { MsgCloseDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

export class TransactionMessageData {
  static getCloseDeploymentMsg(address: string, dseq: string) {
    return {
      typeUrl: `/${MsgCloseDeployment.$type}`,
      value: MsgCloseDeployment.fromPartial({
        id: {
          owner: address,
          dseq
        }
      })
    };
  }
}
