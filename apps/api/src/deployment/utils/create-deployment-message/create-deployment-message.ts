import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

export type CreateDeploymentMessage = { typeUrl: string; value: MsgCreateDeployment };

/** Carried as its protobuf encoding, because the bytes and bigints in it do not survive a job payload's JSON. */
export function encodeCreateDeploymentMessage(message: MsgCreateDeployment): string {
  return Buffer.from(MsgCreateDeployment.encode(message).finish()).toString("base64");
}

export function decodeCreateDeploymentMessage(encoded: string): CreateDeploymentMessage {
  return { typeUrl: `/${MsgCreateDeployment.$type}`, value: MsgCreateDeployment.decode(new Uint8Array(Buffer.from(encoded, "base64"))) };
}
