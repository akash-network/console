/**
 * CAIP-2 network ids for EVM chains that x402 can settle on. This is the single
 * source of truth for classifying an `X402_NETWORK` value as mainnet vs testnet.
 *
 * The classification powers the sandbox firewall (see `env.config.ts`): a testnet
 * settlement network is only allowed when the Akash `NETWORK` is not `mainnet`, so a
 * testnet payment can never be settled against and credit a real (mainnet) balance.
 */
export const X402_TESTNET_NETWORKS = new Set<string>([
  "eip155:84532", // Base Sepolia
  "eip155:11155111", // Ethereum Sepolia
  "eip155:421614", // Arbitrum Sepolia
  "eip155:11155420", // Optimism Sepolia
  "eip155:80002", // Polygon Amoy
  "eip155:43113", // Avalanche Fuji
  "eip155:97", // BNB Smart Chain Testnet
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" // Solana Devnet
]);

/**
 * Returns true when the given CAIP-2 network id is a known x402 testnet network.
 */
export function isX402TestnetNetwork(network: string): boolean {
  return X402_TESTNET_NETWORKS.has(network);
}
