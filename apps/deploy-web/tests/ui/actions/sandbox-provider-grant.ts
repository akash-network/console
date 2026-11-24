import { BasicAllowance, MsgGrantAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { netConfig } from "@akashnetwork/net";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { DeliverTxResponse } from "@cosmjs/stargate";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";

const GRANT_LIFETIME_MS = 2 * 60 * 60 * 1000;

export type GrantClient = {
  granter: string;
  signAndBroadcast(messages: EncodeObject[]): Promise<DeliverTxResponse>;
  disconnect(): void;
};

export type SandboxProviderGrantDependencies = {
  networkId: string;
  granterMnemonic: string | undefined;
  connect: (mnemonic: string) => Promise<GrantClient>;
  now: () => Date;
};

export function isSandboxProviderAccessEnabled({ networkId, granterMnemonic }: Pick<SandboxProviderGrantDependencies, "networkId" | "granterMnemonic">) {
  return networkId === "sandbox" && !!granterMnemonic;
}

/** The sandbox E2E provider only bids for tenants holding a fee grant from the granter, which faucet and console-beta accounts never get. */
export async function grantSandboxProviderAccess(grantee: string, dependencies: SandboxProviderGrantDependencies) {
  if (!isSandboxProviderAccessEnabled(dependencies)) return;

  const client = await dependencies.connect(dependencies.granterMnemonic!);
  try {
    const expiration = new Date(dependencies.now().getTime() + GRANT_LIFETIME_MS);
    const result = await client.signAndBroadcast([createGrantMessage(client.granter, grantee, expiration)]);
    if (result.code !== 0) throw new Error(`granting sandbox provider access failed: ${result.rawLog || `code ${result.code}`}`);
  } finally {
    client.disconnect();
  }
}

export async function connectGranter(mnemonic: string): Promise<GrantClient> {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "akash" });
  const [{ address: granter }] = await wallet.getAccounts();
  const client = await SigningStargateClient.connectWithSigner(netConfig.getBaseRpcUrl("sandbox"), wallet, {
    gasPrice: GasPrice.fromString("0.025uakt")
  });

  return {
    granter,
    signAndBroadcast: messages => client.signAndBroadcast(granter, messages, "auto"),
    disconnect: () => client.disconnect()
  };
}

function createGrantMessage(granter: string, grantee: string, expiration: Date): EncodeObject {
  return {
    typeUrl: `/${MsgGrantAllowance.$type}`,
    value: MsgGrantAllowance.fromPartial({
      granter,
      grantee,
      allowance: {
        typeUrl: `/${BasicAllowance.$type}`,
        value: Uint8Array.from(BasicAllowance.encode({ spendLimit: [{ denom: "uakt", amount: "1" }], expiration }).finish())
      }
    })
  };
}
