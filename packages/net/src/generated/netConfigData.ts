export const netConfigData = {
  mainnet: {
    version: "v0.38.1",
    faucetUrl: null,
    apiUrls: [
      "https://rest-akash.ecostake.com",
      "https://rest.lavenderfive.com:443/akash",
      "https://akash-api.polkachu.com",
      "https://akash.c29r3.xyz:443/api",
      "https://akash-mainnet-lcd.autostake.com:443",
      "https://akash-api.kleomedes.network",
      "https://api-akash-01.stakeflow.io",
      "https://akash-mainnet-rest.cosmonautstakes.com:443",
      "https://akash-api.w3coins.io",
      "https://akash-rest.publicnode.com",
      "https://akash-api.validatornode.com",
      "https://lcd.akash.bronbro.io:443"
    ],
    rpcUrls: [
      "https://rpc-akash.ecostake.com:443",
      "https://rpc.lavenderfive.com:443/akash",
      "https://akash-rpc.polkachu.com",
      "https://akash.c29r3.xyz:80/rpc",
      "https://akash-rpc.kleomedes.network",
      "https://akash-mainnet-rpc.cosmonautstakes.com:443",
      "https://akash-rpc.w3coins.io",
      "https://akash-rpc.publicnode.com:443",
      "https://rpc.akash.bronbro.io:443"
    ]
  },
  sandbox: {
    version: "v0.38.1",
    faucetUrl: "http://faucet.sandbox-01.aksh.pw/",
    apiUrls: ["https://api.sandbox-01.aksh.pw:443"],
    rpcUrls: ["https://rpc.sandbox-01.aksh.pw:443"]
  },
  "sandbox-2": {
    version: "v0.38.2",
    faucetUrl: "http://faucet.sandbox-2.aksh.pw/",
    apiUrls: ["https://api.sandbox-2.aksh.pw:443"],
    rpcUrls: ["https://rpc.sandbox-2.aksh.pw:443"]
  },
  "testnet-02": {
    version: "v0.23.1-rc0",
    faucetUrl: "https://faucet.testnet-02.aksh.pw",
    apiUrls: ["https://api.testnet-02.aksh.pw:443"],
    rpcUrls: ["https://rpc.testnet-02.aksh.pw:443"]
  },
  "testnet-7": {
    version: "v1.0.0-rc60",
    faucetUrl: "https://faucet.dev.akash.pub/",
    apiUrls: ["https://testnetapi.akashnet.net"],
    rpcUrls: ["https://testnetrpc.akashnet.net:443"]
  }
};
