import fsp from "fs/promises";
import { dirname, join as joinPath, normalize } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = normalize(joinPath(scriptDir, "..", "..", ".."));
const PACKAGE_DIR = normalize(joinPath(scriptDir, ".."));
const OUT_DIR = joinPath(PACKAGE_DIR, "src", "generated");
const AKASH_NET_BASE = "https://raw.githubusercontent.com/akash-network/net/main";
const networks = ["mainnet", "sandbox", "testnet-7"];

async function main() {
  console.log(`Generate network configuration: ${networks.join(", ")}`);
  const config: Record<string, unknown> = {};
  for (const network of networks) {
    const baseConfigUrl = `${AKASH_NET_BASE}/${network}`;
    const [apiUrls, rpcUrls, version, faucetUrl] = await Promise.all([
      fetchText(`${baseConfigUrl}/api-nodes.txt`),
      fetchText(`${baseConfigUrl}/rpc-nodes.txt`),
      fetchText(`${baseConfigUrl}/version.txt`).catch(() => null),
      fetchText(`${baseConfigUrl}/faucet-url.txt`).catch(() => null)
    ]);

    const networkConfig = {
      version: version?.trim() ?? null,
      faucetUrl: faucetUrl?.trim() ?? null,
      apiUrls: apiUrls.trim().split("\n"),
      rpcUrls: rpcUrls.trim().split("\n")
    };

    if (network === "mainnet") {
      // networkConfig.apiUrls.unshift("https://public-proxy.akt.dev/rest");
    }

    config[network] = networkConfig;
  }

  await fsp.mkdir(OUT_DIR, { recursive: true });
  await fsp.writeFile(joinPath(OUT_DIR, "netConfigData.ts"), `export const netConfigData = ${JSON.stringify(config, null, 2)}`);

  console.log(`Network configuration was written to ${OUT_DIR.replace(PROJECT_DIR, ".")}/net-config.ts`);
}

function fetchText(url: string): Promise<string> {
  return fetch(url).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return res.text();
  });
}

main().catch(console.error);
