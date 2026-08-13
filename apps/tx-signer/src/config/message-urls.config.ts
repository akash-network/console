import { DepositAuthorization, MsgAccountDeposit, MsgCreateCertificate, MsgMintACT } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { MsgGrant, MsgGrantAllowance, MsgRevokeAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { BasicAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";

/**
 * The funding wallet holds real funds, so it may only issue the grant lifecycle and mint messages the API's
 * wallet provisioning relies on. Anything else is rejected before it reaches the signer.
 */
export const FUNDING_WALLET_MESSAGE_TYPE_URLS = [
  `/${MsgGrantAllowance.$type}`,
  `/${MsgRevokeAllowance.$type}`,
  `/${MsgGrant.$type}`,
  `/${MsgMintACT.$type}`
] as const;

/**
 * Derived wallets act on behalf of managed users, so they are limited to the deployment lifecycle messages the API
 * broadcasts on their behalf. Anything else is rejected before it reaches the signer.
 */
export const DERIVED_WALLET_MESSAGE_TYPE_URLS = [
  `/${MsgCreateDeployment.$type}`,
  `/${MsgUpdateDeployment.$type}`,
  `/${MsgCloseDeployment.$type}`,
  `/${MsgCreateLease.$type}`,
  `/${MsgAccountDeposit.$type}`,
  `/${MsgCreateCertificate.$type}`
] as const;

export const BASIC_ALLOWANCE_TYPE_URL = `/${BasicAllowance.$type}`;
export const DEPOSIT_AUTHORIZATION_TYPE_URL = `/${DepositAuthorization.$type}`;

/**
 * Every message type either wallet may be asked to sign. `TxPolicyService` must declare an actor binding rule for each
 * one, so widening the wire contract without widening the policy is a compile error rather than a runtime 403.
 */
export type SignableMessageTypeUrl = (typeof FUNDING_WALLET_MESSAGE_TYPE_URLS)[number] | (typeof DERIVED_WALLET_MESSAGE_TYPE_URLS)[number];
