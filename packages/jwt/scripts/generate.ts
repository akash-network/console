import * as fsp from "fs/promises";
import { join as joinPath, normalize } from "path";

const PROJECT_DIR = normalize(joinPath(__dirname, "..", "..", ".."));
const PACKAGE_DIR = normalize(joinPath(__dirname, ".."));
const OUT_DIR = joinPath(PACKAGE_DIR, "src", "generated");
const JWT_SCHEMA_URL = "https://raw.githubusercontent.com/akash-network/akash-api/refs/heads/main/specs/jwt-schema.json";
const JWT_TEST_CASES_URL = "https://raw.githubusercontent.com/akash-network/akash-api/refs/heads/main/testdata/jwt/cases_es256k.json";

async function main() {
  console.log(`Generating JWT schema from ${JWT_SCHEMA_URL}`);

  try {
    const [schema, testCases] = await Promise.all([fetchJson(JWT_SCHEMA_URL), fetchJson(JWT_TEST_CASES_URL)]);

    await fsp.mkdir(OUT_DIR, { recursive: true });

    await Promise.all([
      fsp.writeFile(joinPath(OUT_DIR, "jwtSchemaData.ts"), `export const jwtSchemaData = ${JSON.stringify(schema, null, 2)}`),
      fsp.writeFile(
        joinPath(OUT_DIR, "jwtTestCases.ts"),
        `// This file contains test cases for JWT validation\nexport const jwtTestCases = ${JSON.stringify(testCases, null, 2)};`
      )
    ]);

    console.log(`JWT schema and test cases were written to ${OUT_DIR.replace(PROJECT_DIR, ".")}/`);
  } catch (error) {
    console.error("Failed to generate JWT schema and test cases:", error);
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
