import * as fsp from "fs/promises";
import { join as joinPath, normalize } from "path";

const PROJECT_DIR = normalize(joinPath(__dirname, "..", "..", ".."));
const PACKAGE_DIR = normalize(joinPath(__dirname, ".."));
const OUT_DIR = joinPath(PACKAGE_DIR, "src", "generated");
const BRANCH = process.env.AKASH_API_BRANCH || "refs/heads/main";
const JWT_SCHEMA_URL = `https://raw.githubusercontent.com/akash-network/akash-api/${BRANCH}/specs/jwt-schema.json`;
const JWT_SIGNING_TEST_CASES_URL = `https://raw.githubusercontent.com/akash-network/akash-api/${BRANCH}/testdata/jwt/cases_es256k.json`;
const JWT_CLAIMS_TEST_CASES_URL = `https://raw.githubusercontent.com/akash-network/akash-api/${BRANCH}/testdata/jwt/cases_jwt.json.tmpl`;
const JWT_MNEMONIC_URL = `https://raw.githubusercontent.com/akash-network/akash-api/${BRANCH}/testdata/jwt/mnemonic`;

async function main() {
  console.log(`Generating JWT schema and test cases`);

  try {
    const [schema, signingTestCases, claimsTestCases, mnemonic] = await Promise.all([
      fetchJson(JWT_SCHEMA_URL),
      fetchJson(JWT_SIGNING_TEST_CASES_URL),
      fetchJson(JWT_CLAIMS_TEST_CASES_URL),
      fetchText(JWT_MNEMONIC_URL)
    ]);

    await fsp.mkdir(OUT_DIR, { recursive: true });

    await Promise.all([
      fsp.writeFile(joinPath(OUT_DIR, "jwt-schema-data.ts"), `export const jwtSchemaData = ${JSON.stringify(schema, null, 2)}`),
      fsp.writeFile(
        joinPath(OUT_DIR, "jwt-signing-test-cases.ts"),
        `// This file contains test cases for JWT signing validation\nexport const jwtSigningTestCases = ${JSON.stringify(signingTestCases, null, 2)};`
      ),
      fsp.writeFile(
        joinPath(OUT_DIR, "jwt-claims-test-cases.ts"),
        `// This file contains test cases for JWT claims validation\nexport const jwtClaimsTestCases = ${JSON.stringify(claimsTestCases, null, 2)};`
      ),
      fsp.writeFile(
        joinPath(OUT_DIR, "jwt-mnemonic.ts"),
        `// This file contains the test mnemonic for JWT signing\nexport const jwtMnemonic = "${mnemonic.trim()}";`
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

function fetchText(url: string): Promise<string> {
  return fetch(url).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return res.text();
  });
}

main().catch(console.error);
