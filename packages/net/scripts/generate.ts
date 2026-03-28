import fsp from "fs/promises";
import { dirname, join as joinPath, normalize } from "path";
import { fileURLToPath } from "url";
import * as z from "zod";
import { ZodError } from "zod";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = normalize(joinPath(scriptDir, "..", "..", ".."));
const PACKAGE_DIR = normalize(joinPath(scriptDir, ".."));
const OUT_DIR = joinPath(PACKAGE_DIR, "src", "generated");
const AKASH_NET_BASE = "https://raw.githubusercontent.com/akash-network/net/main";
const networks = ["mainnet", "sandbox-2"];

const apiSchema = z.object({
  address: z.string()
});

const metaSchema = z.object({
  codebase: z.object({
    recommended_version: z.string()
  }),
  apis: z.object({
    rest: z.array(apiSchema),
    rpc: z.array(apiSchema)
  })
});

async function main() {
  console.log(`Generate network configuration: ${networks.join(", ")}`);
  const config: Record<string, unknown> = {};
  for (const network of networks) {
    const baseConfigUrl = `${AKASH_NET_BASE}/${network}`;
    const [meta, faucetUrl] = await Promise.all([
      fetchJson(`${baseConfigUrl}/meta.json`)
        .then(res => metaSchema.parse(res))
        .catch(error => {
          if (error instanceof ZodError) {
            console.log("meta.json is invalid", error);
          }

          return null;
        }),
      fetchText(`${baseConfigUrl}/faucet-url.txt`).catch(() => null)
    ]);

    const networkConfig = {
      version: meta?.codebase?.recommended_version ?? null,
      faucetUrl: faucetUrl?.trim() ?? null,
      apiUrls: meta?.apis?.rest?.map(({ address }) => address) ?? [],
      rpcUrls: meta?.apis?.rpc?.map(({ address }) => address) ?? []
    };

    if (networkConfig.apiUrls.length || networkConfig.rpcUrls.length) {
      config[network] = networkConfig;
    }
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

function fetchJson(url: string): Promise<unknown> {
  return fetch(url).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return res.json();
  });
}

main().catch(console.error);
