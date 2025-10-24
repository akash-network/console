export const netConfigData = {
  mainnet: {
    version: "0.38.0",
    faucetUrl: null,
    apiUrls: [
      "https://api.akashnet.net:443",
      "https://akash-api.polkachu.com:443",
      "https://akash.c29r3.xyz:443/api",
      "https://akash-api.global.ssl.fastly.net:443"
    ],
    rpcUrls: [
      "https://rpc.akashnet.net:443",
      "https://rpc-akash.ecostake.com:443",
      "https://akash-rpc.polkachu.com:443",
      "https://akash.c29r3.xyz:443/rpc",
      "https://akash-rpc.europlots.com:443"
    ]
  },
  sandbox: {
    version: "0.38.0",
    faucetUrl: "http://faucet.sandbox-01.aksh.pw/",
    apiUrls: ["https://api.sandbox-01.aksh.pw:443"],
    rpcUrls: ["https://rpc.sandbox-01.aksh.pw:443"]
  },
  "sandbox-2": {
    version: "0.38.0",
    faucetUrl: "http://faucet.sandbox-2.aksh.pw/",
    apiUrls: ["https://api.sandbox-2.aksh.pw:443"],
    rpcUrls: ["https://rpc.sandbox-2.aksh.pw:443"]
  },
  "testnet-02": {
    version: "0.23.1-rc0",
    faucetUrl: "https://faucet.testnet-02.aksh.pw",
    apiUrls: ["https://api.testnet-02.aksh.pw:443", "https://akash-testnet-rest.cosmonautstakes.com:443"],
    rpcUrls: ["https://rpc.testnet-02.aksh.pw:443", "https://akash-testnet-rpc.cosmonautstakes.com:443"]
  },
  "testnet-7": {
    version: "1.0.0-rc55",
    faucetUrl: "https://faucet.dev.akash.pub/",
    apiUrls: ["https://testnetapi.akashnet.net"],
    rpcUrls: ["https://testnetrpc.akashnet.net:443"]
  }
};
