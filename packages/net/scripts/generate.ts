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
const networks = ["mainnet", "sandbox-2", "testnet-bme"];

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
  }),
  faucets: z.array(z.object({ url: z.string() })).optional()
});

main().catch(console.error);

async function main() {
  console.log(`Generate network configuration: ${networks.join(", ")}`);
  const config: Record<string, unknown> = {};
  for (const network of networks) {
    const baseConfigUrl = `${AKASH_NET_BASE}/${network}`;
    const [meta, faucetUrl, apiNodesTxt, rpcNodesTxt] = await Promise.all([
      fetchJson(`${baseConfigUrl}/meta.json`)
        .then(res => metaSchema.parse(res))
        .catch(error => {
          if (error instanceof ZodError) {
            console.log("meta.json is invalid", error);
          }

          return null;
        }),
      fetchText(`${baseConfigUrl}/faucet-url.txt`).catch(() => null),
      fetchOptionalText(`${baseConfigUrl}/api-nodes.txt`),
      fetchOptionalText(`${baseConfigUrl}/rpc-nodes.txt`)
    ]);

    const apiUrlsFromTxt = parseNodesTxt(apiNodesTxt);
    const rpcUrlsFromTxt = parseNodesTxt(rpcNodesTxt);

    const metaApiUrls = meta?.apis?.rest?.map(({ address }) => address) ?? [];
    const metaRpcUrls = meta?.apis?.rpc?.map(({ address }) => address) ?? [];

    const apiUrls = apiUrlsFromTxt.length ? mergeUrls(apiUrlsFromTxt, metaApiUrls) : metaApiUrls;
    const rpcUrls = rpcUrlsFromTxt.length ? mergeUrls(rpcUrlsFromTxt, metaRpcUrls) : metaRpcUrls;

    const firstRpcUrl = rpcUrls[0] ?? metaRpcUrls[0];
    const appVersion = firstRpcUrl ? await getAppVersion(firstRpcUrl) : null;

    const metaFaucetUrl = meta?.faucets?.[0]?.url ?? null;

    const networkConfig = {
      version: appVersion ?? meta?.codebase?.recommended_version ?? null,
      faucetUrl: faucetUrl?.trim() || metaFaucetUrl?.trim() || null,
      apiUrls,
      rpcUrls
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

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  });
}

async function fetchOptionalText(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function mergeUrls(primary: string[], secondary: string[]): string[] {
  const seen = new Set(primary.map(normalizeUrl));
  const additional = secondary.filter(url => !seen.has(normalizeUrl(url)));
  return [...primary, ...additional];
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  const defaultPort = parsed.protocol === "https:" ? "443" : "80";
  return `${parsed.protocol}//${parsed.hostname}:${parsed.port || defaultPort}${parsed.pathname.replace(/\/$/, "")}`;
}

function parseNodesTxt(content: string | null): string[] {
  if (!content) return [];
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.startsWith("http"));
}

async function getAppVersion(rpcUrl: string): Promise<string | null> {
  try {
    const abciInfo = await fetchJson<{ result: AbciInfo }>(`${rpcUrl}/abci_info`);
    const version = abciInfo.result.response.version?.trim();
    if (!version) return null;
    return version.startsWith("v") ? version : `v${version}`;
  } catch (error) {
    console.error(`Failed to fetch app version from ${rpcUrl}:`, error);
    return null;
  }
}

interface AbciInfo {
  response: {
    data: string;
    last_block_height: string;
    last_block_app_hash: string;
    version: string;
  };
}
