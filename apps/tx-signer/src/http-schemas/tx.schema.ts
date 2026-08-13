import { MsgAccountDeposit, MsgCreateCertificate, MsgMintACT } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { MsgGrant, MsgGrantAllowance, MsgRevokeAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { z } from "zod";

/**
 * The funding wallet holds real funds, so it may only issue the grant lifecycle and mint messages the API's
 * wallet provisioning relies on. Anything else is rejected before it reaches the signer.
 */
const FUNDING_WALLET_MESSAGE_TYPE_URLS = [`/${MsgGrantAllowance.$type}`, `/${MsgRevokeAllowance.$type}`, `/${MsgGrant.$type}`, `/${MsgMintACT.$type}`] as const;

/**
 * Derived wallets act on behalf of managed users, so they are limited to the deployment lifecycle messages the API
 * broadcasts on their behalf. Anything else is rejected before it reaches the signer.
 */
const DERIVED_WALLET_MESSAGE_TYPE_URLS = [
  `/${MsgCreateDeployment.$type}`,
  `/${MsgUpdateDeployment.$type}`,
  `/${MsgCloseDeployment.$type}`,
  `/${MsgCreateLease.$type}`,
  `/${MsgAccountDeposit.$type}`,
  `/${MsgCreateCertificate.$type}`
] as const;

export const SignAndBroadcastFundingRequestInputSchema = z.object({
  data: z.object({
    messages: z
      .array(
        z.object({
          typeUrl: z.enum(FUNDING_WALLET_MESSAGE_TYPE_URLS),
          value: z.string()
        })
      )
      .min(1)
  })
});

export const SignAndBroadcastDerivedRequestInputSchema = z.object({
  data: z.object({
    derivationIndex: z.number().int().nonnegative(),
    messages: z
      .array(
        z.object({
          typeUrl: z.enum(DERIVED_WALLET_MESSAGE_TYPE_URLS),
          value: z.string()
        })
      )
      .min(1),
    options: z
      .object({
        fee: z.object({
          granter: z.string()
        })
      })
      .optional()
  })
});

export const SignAndBroadcastResponseOutputSchema = z.object({
  data: z
    .object({
      code: z.number(),
      hash: z.string(),
      rawLog: z.string()
    })
    .passthrough()
});

export type SignAndBroadcastFundingRequestInput = z.infer<typeof SignAndBroadcastFundingRequestInputSchema>;
export type SignAndBroadcastDerivedRequestInput = z.infer<typeof SignAndBroadcastDerivedRequestInputSchema>;
export type SignAndBroadcastResponseOutput = z.infer<typeof SignAndBroadcastResponseOutputSchema>;
