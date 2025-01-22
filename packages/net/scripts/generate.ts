import fsp from "fs/promises";
import { join as joinPath, normalize } from "path";

const PROJECT_DIR = normalize(joinPath(__dirname, "..", "..", ".."));
const PACKAGE_DIR = normalize(joinPath(__dirname, ".."));
const OUT_DIR = joinPath(PACKAGE_DIR, "src", "generated");
const AKASH_NET_BASE = "https://raw.githubusercontent.com/akash-network/net/main";
const networks = ["mainnet", "sandbox", "testnet-02"];

async function main() {
  console.log(`Generate network configuration: ${networks.join(", ")}`);
  const config: Record<string, unknown> = {};
  for (const network of networks) {
    const baseConfigUrl = `${AKASH_NET_BASE}/${network}`;
    const [apiUrls, rpcUrls, version] = await Promise.all([
      fetchText(`${baseConfigUrl}/api-nodes.txt`),
      fetchText(`${baseConfigUrl}/rpc-nodes.txt`),
      fetchText(`${baseConfigUrl}/version.txt`)
    ]);

    config[network] = {
      version: version.trim(),
      apiUrls: apiUrls.trim().split("\n"),
      rpcUrls: rpcUrls.trim().split("\n")
    };
  }

  await fsp.mkdir(OUT_DIR, { recursive: true });
  await fsp.writeFile(joinPath(OUT_DIR, "netConfigData.ts"), `export const netConfigData = ${JSON.stringify(config, null, 2)}`);

  console.log(`Network configuration was written to ${OUT_DIR.replace(PROJECT_DIR, ".")}/net-config.ts`);
}

function fetchText(url: string): Promise<string> {
  return fetch(url).then(res => res.text());
}

main().catch(console.error);
