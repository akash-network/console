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
  "testnet-7": {
    version: null,
    faucetUrl: "https://faucet.dev.akash.pub/",
    apiUrls: ["https://testnetapi.akashnet.net"],
    rpcUrls: ["https://testnetrpc.akashnet.net:443"]
  }
};
