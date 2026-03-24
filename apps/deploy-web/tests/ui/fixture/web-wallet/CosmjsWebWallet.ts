import type { SignDoc } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { AuthInfo } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { AminoSignResponse, StdSignature, StdSignDoc } from "@cosmjs/amino";
import { Secp256k1HdWallet, serializeSignDoc } from "@cosmjs/amino";
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { fromBase64, fromBech32 } from "@cosmjs/encoding";
import type { AccountData, DirectSignResponse } from "@cosmjs/proto-signing";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";

export type FeeType = "low" | "medium" | "high";

const GAS_MULTIPLIERS: Record<FeeType, number> = {
  low: 1,
  medium: 1.3,
  high: 1.6
};

export class CosmjsWebWallet {
  #nextFeeType: FeeType = "low";
  #currentMnemonic = "";
  #wallets: Record<string, WalletEntry> = {};
  #suggestedChains: Record<string, ChainInfo> = {};
  #stargateClients: Record<string, SigningStargateClient> = {};

  setFeeType(feeType: FeeType): void {
    this.#nextFeeType = feeType;
  }

  async switchWallet(mnemonic: string): Promise<void> {
    this.#currentMnemonic = mnemonic;
    const chainIds = Object.keys(this.#suggestedChains);
    for (const chainId of chainIds) {
      delete this.#wallets[chainId];
      this.#stargateClients[chainId]?.disconnect();
      delete this.#stargateClients[chainId];
    }
    for (const chainId of chainIds) {
      const chainInfo = this.#suggestedChains[chainId];
      const prefix = chainInfo.bech32Config?.bech32PrefixAccAddr || "cosmos";
      await this.#getOrCreateWallet(mnemonic, chainId, prefix);
    }
  }

  async suggestChain(chainInfo: ChainInfo): Promise<void> {
    this.#suggestedChains[chainInfo.chainId] = chainInfo;
    const prefix = chainInfo.bech32Config?.bech32PrefixAccAddr || "cosmos";
    await this.#getOrCreateWallet(this.#currentMnemonic, chainInfo.chainId, prefix);
  }

  async getKey(chainId: string): Promise<{
    name: string;
    algo: string;
    pubKey: Uint8Array;
    address: Uint8Array;
    bech32Address: string;
    ethereumHexAddress: string;
    isNanoLedger: boolean;
    isKeystone: boolean;
  }> {
    const w = this.#getWallet(chainId);
    return {
      name: "e2e-test-wallet",
      algo: w.account.algo,
      pubKey: w.account.pubkey,
      address: fromBech32(w.account.address).data,
      bech32Address: w.account.address,
      ethereumHexAddress: "",
      isNanoLedger: false,
      isKeystone: false
    };
  }

  async getAccounts(chainId: string): Promise<AccountData[]> {
    const w = this.#getWallet(chainId);
    return [{ address: w.account.address, algo: w.account.algo, pubkey: w.account.pubkey }];
  }

  async signDirect(chainId: string, signer: string, serializedDoc: SignDoc): Promise<DirectSignResponse> {
    const w = this.#getWallet(chainId);
    let { authInfoBytes } = serializedDoc;
    const multiplier = GAS_MULTIPLIERS[this.#nextFeeType];
    if (multiplier !== 1) {
      let authInfo = AuthInfo.decode(authInfoBytes);
      if (authInfo.fee) {
        authInfo = AuthInfo.fromPartial({
          ...authInfo,
          fee: {
            ...authInfo.fee,
            gasLimit: BigInt(Math.ceil(Number(authInfo.fee.gasLimit) * multiplier))
          }
        });
      }
      authInfoBytes = AuthInfo.encode(authInfo).finish();
      this.#nextFeeType = "low";
    }
    const signDoc: SignDoc = {
      bodyBytes: serializedDoc.bodyBytes,
      authInfoBytes,
      chainId: serializedDoc.chainId,
      accountNumber: serializedDoc.accountNumber
    };
    const result = await w.direct.signDirect(signer, signDoc as any);
    return result;
  }

  async signAmino(chainId: string, signer: string, signDoc: StdSignDoc): Promise<AminoSignResponse> {
    const w = this.#getWallet(chainId);
    const result = await w.amino.signAmino(signer, signDoc);
    return result;
  }

  async signArbitrary(chainId: string, signer: string, data: string): Promise<StdSignature> {
    const w = this.#getWallet(chainId);
    const b64Data = btoa(data);
    const signDoc: StdSignDoc = {
      chain_id: "",
      account_number: "0",
      sequence: "0",
      fee: { gas: "0", amount: [] },
      msgs: [{ type: "sign/MsgSignData", value: { signer, data: b64Data } }],
      memo: ""
    };
    const result = await w.amino.signAmino(signer, signDoc);
    return { pub_key: result.signature.pub_key, signature: result.signature.signature };
  }

  async verifyArbitrary(_: unknown, signer: string, data: string, signature: StdSignature): Promise<boolean> {
    const b64Data = btoa(data);
    const signDoc: StdSignDoc = {
      chain_id: "",
      account_number: "0",
      sequence: "0",
      fee: { gas: "0", amount: [] },
      msgs: [{ type: "sign/MsgSignData", value: { signer, data: b64Data } }],
      memo: ""
    };
    const serialized = serializeSignDoc(signDoc);
    const hash = sha256(serialized);
    const pubkeyBytes = fromBase64(signature.pub_key.value);
    const sigBytes = fromBase64(signature.signature);
    const sig = Secp256k1Signature.fromFixedLength(sigBytes);
    return await Secp256k1.verifySignature(sig, hash, pubkeyBytes);
  }

  async sendTx(chainId: string, tx: Uint8Array): Promise<Uint8Array> {
    const w = this.#getWallet(chainId);
    const chainInfo = this.#suggestedChains[chainId];
    if (!chainInfo?.rpc) throw new Error(`No RPC for chain ${chainId}.`);
    if (!this.#stargateClients[chainId]) {
      this.#stargateClients[chainId] = await SigningStargateClient.connectWithSigner(chainInfo.rpc, w.direct);
    }
    const txBytes = tx instanceof Uint8Array ? tx : fromBase64(tx as unknown as string);
    const result = await this.#stargateClients[chainId].broadcastTx(txBytes);
    if (result.code !== 0) throw new Error(`Broadcast failed: code ${result.code}`);
    const hashBytes = new Uint8Array(result.transactionHash.length / 2);
    for (let i = 0; i < hashBytes.length; i++) {
      hashBytes[i] = parseInt(result.transactionHash.substring(i * 2, i * 2 + 2), 16);
    }
    return hashBytes;
  }

  #getWallet(chainId: string): WalletEntry {
    const w = this.#wallets[chainId];
    if (!w) throw new Error(`Chain ${chainId} not registered. Call experimentalSuggestChain first.`);
    return w;
  }

  async #getOrCreateWallet(mnemonic: string, chainId: string, prefix: string): Promise<WalletEntry> {
    if (this.#wallets[chainId]) return this.#wallets[chainId];

    const direct = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
    const amino = await Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
    const [account] = await direct.getAccounts();

    this.#wallets[chainId] = { direct, amino, account };
    return this.#wallets[chainId];
  }
}

interface WalletEntry {
  direct: DirectSecp256k1HdWallet;
  amino: Secp256k1HdWallet;
  account: AccountData;
}

interface ChainInfo {
  chainId: string;
  rpc: string;
  rest: string;
  bech32Config?: {
    bech32PrefixAccAddr: string;
    bech32PrefixAccPub: string;
    bech32PrefixValAddr: string;
    bech32PrefixValPub: string;
    bech32PrefixConsAddr: string;
    bech32PrefixConsPub: string;
  };
}
