import { MsgAccountDeposit, MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { EncodeObject } from "@cosmjs/proto-signing";

export type CreateDeploymentMessage = { typeUrl: string; value: MsgCreateDeployment };

export type AccountDepositMessage = { typeUrl: string; value: MsgAccountDeposit };

const CREATE_DEPLOYMENT_TYPE_URL = `/${MsgCreateDeployment.$type}`;

const ACCOUNT_DEPOSIT_TYPE_URL = `/${MsgAccountDeposit.$type}`;

/** Every other message a managed wallet signs; none of them moves funds into an escrow account. */
const NON_SPENDING_TYPE_URLS: readonly string[] = [MsgCloseDeployment, MsgUpdateDeployment, MsgCreateLease, MsgCreateCertificate].map(type => `/${type.$type}`);

const WHOLE_NUMBER = /^\d+$/;

export function isCreateDeploymentMessage(message: EncodeObject): message is CreateDeploymentMessage {
  return message.typeUrl === CREATE_DEPLOYMENT_TYPE_URL;
}

export function isAccountDepositMessage(message: EncodeObject): message is AccountDepositMessage {
  return message.typeUrl === ACCOUNT_DEPOSIT_TYPE_URL;
}

export function isSpendingMessage(message: EncodeObject): message is CreateDeploymentMessage | AccountDepositMessage {
  return isCreateDeploymentMessage(message) || isAccountDepositMessage(message);
}

export function isNonSpendingMessage(message: EncodeObject): boolean {
  return NON_SPENDING_TYPE_URLS.includes(message.typeUrl);
}

/** The amount of a coin as the whole number the chain reads, or undefined for anything else: signs, decimals, exponents, whitespace, nothing. */
export function parseCoinAmount(amount: string | undefined): bigint | undefined {
  return amount !== undefined && WHOLE_NUMBER.test(amount) ? BigInt(amount) : undefined;
}
