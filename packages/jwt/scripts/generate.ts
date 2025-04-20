import * as fsp from "fs/promises";
import { join as joinPath, normalize } from "path";

const PROJECT_DIR = normalize(joinPath(__dirname, "..", "..", ".."));
const PACKAGE_DIR = normalize(joinPath(__dirname, ".."));
const OUT_DIR = joinPath(PACKAGE_DIR, "src", "generated");
const JWT_SCHEMA_URL = "https://raw.githubusercontent.com/akash-network/akash-api/refs/heads/main/specs/jwt-schema.json";

async function main() {
  console.log(`Generating JWT schema from ${JWT_SCHEMA_URL}`);

  try {
    const schema = await fetchJson(JWT_SCHEMA_URL);

    await fsp.mkdir(OUT_DIR, { recursive: true });
    await fsp.writeFile(joinPath(OUT_DIR, "jwtSchemaData.ts"), `export const jwtSchemaData = ${JSON.stringify(schema, null, 2)}`);

    console.log(`JWT schema was written to ${OUT_DIR.replace(PROJECT_DIR, ".")}/jwtSchemaData.ts`);
  } catch (error) {
    console.error("Failed to generate JWT schema:", error);
    process.exit(1);
  }
}

function fetchJson(url: string): Promise<any> {
  return fetch(url).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return res.json();
  });
}

main().catch(console.error);
