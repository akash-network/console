export function initKeplrWebWalletMock(options: { rpcHandlerName: string }) {
  async function rpc(method: string, ...args: unknown[]): Promise<unknown> {
    const result: string = await (window as any)[options.rpcHandlerName](method, args);
    return result;
  }

  function makeSigner(chainId: string) {
    return {
      async getAccounts() {
        return rpc("getAccounts", chainId);
      },
      async signDirect(signerAddress: string, signDoc: any) {
        return rpc("signDirect", chainId, signerAddress, signDoc);
      },
      async signAmino(signerAddress: string, signDoc: any) {
        return rpc("signAmino", chainId, signerAddress, signDoc);
      }
    };
  }

  const keplr = {
    async enable() {},
    async disconnect() {},
    async experimentalSuggestChain(chainInfo: any) {
      await rpc("suggestChain", chainInfo);
    },
    async getKey(chainId: string) {
      return rpc("getKey", chainId);
    },
    getOfflineSigner(chainId: string) {
      return makeSigner(chainId);
    },
    async getOfflineSignerAuto(chainId: string) {
      return makeSigner(chainId);
    },
    getOfflineSignerOnlyAmino(chainId: string) {
      const s = makeSigner(chainId);
      return { getAccounts: s.getAccounts, signAmino: s.signAmino };
    },
    async signDirect(chainId: string, signer: string, signDoc: any) {
      return rpc("signDirect", chainId, signer, signDoc);
    },
    async signAmino(chainId: string, signer: string, signDoc: any) {
      return rpc("signAmino", chainId, signer, signDoc);
    },
    async signArbitrary(chainId: string, signer: string, data: string) {
      return rpc("signArbitrary", chainId, signer, data);
    },
    async verifyArbitrary(chainId: string, signer: string, data: string, signature: any) {
      return rpc("verifyArbitrary", chainId, signer, data, signature);
    },
    async sendTx(chainId: string, tx: Uint8Array, mode: string) {
      return rpc("sendTx", chainId, tx, mode);
    },
    defaultOptions: {
      sign: {
        preferNoSetFee: false,
        preferNoSetMemo: true,
        disableBalanceCheck: true
      }
    }
  };

  Object.defineProperty(window, "keplr", { value: keplr, writable: false, configurable: false });
}
