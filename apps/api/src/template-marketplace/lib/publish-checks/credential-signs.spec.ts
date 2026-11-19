import { describe, expect, it } from "vitest";

import { findCredentialSign, holdsKnownCredentialFormat } from "./credential-signs";

const RANDOM_TOKEN = "q7Rk2ZpX9vLm4TnB8sWd3YhC6";

const MNEMONIC = "abandon ability able about above absent absorb abstract absurd abuse access accident";

describe(findCredentialSign.name, () => {
  it.each([
    { shape: "an OpenAI style key", value: "sk-abcdefghijklmnop1234" },
    { shape: "a Hugging Face token", value: "hf_abcdefghijklmnopqrstuv" },
    { shape: "a GitHub token", value: "ghp_abcdefghijklmnopqrstuv" },
    { shape: "an AWS access key id", value: "AKIAABCDEFGHIJKLMNOP" },
    { shape: "a JWT", value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U" },
    { shape: "a private key block", value: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----" },
    { shape: "a connection string with a password", value: `postgres://admin:${"hunter2".repeat(2)}@db.internal:5432/app` },
    { shape: "a bearer header", value: "Bearer abcdefghijklmnop1234" },
    { shape: "a 12-word mnemonic", value: "abandon ability able about above absent absorb abstract absurd abuse access accident" },
    { shape: "a 24-word mnemonic", value: Array.from({ length: 24 }, () => "ladder").join(" ") },
    { shape: "a mnemonic split over lines", value: Array.from({ length: 15 }, () => "zoo").join("\n") },
    { shape: "a mnemonic after other words", value: "seed: abandon ability able about above absent absorb abstract absurd abuse access accident" },
    { shape: "a mnemonic in double quotes", value: `"${MNEMONIC}"` },
    { shape: "a mnemonic in single quotes", value: `'${MNEMONIC}'` },
    { shape: "a mnemonic in backticks", value: `\`${MNEMONIC}\`` },
    { shape: "a mnemonic in a code fence", value: `\`\`\`\n${MNEMONIC}\n\`\`\`` },
    {
      shape: "a mnemonic with each word quoted",
      value: MNEMONIC.split(" ")
        .map(word => `"${word}",`)
        .join(" ")
    },
    { shape: "a mnemonic separated by commas", value: MNEMONIC.split(" ").join(", ") },
    { shape: "a mnemonic separated by semicolons", value: MNEMONIC.split(" ").join("; ") },
    {
      shape: "a mnemonic numbered with dots",
      value: MNEMONIC.split(" ")
        .map((word, index) => `${index + 1}. ${word}`)
        .join("\n")
    },
    {
      shape: "a mnemonic numbered with brackets",
      value: MNEMONIC.split(" ")
        .map((word, index) => `${index + 1}) ${word}`)
        .join(" ")
    },
    {
      shape: "a mnemonic numbered with colons",
      value: MNEMONIC.split(" ")
        .map((word, index) => `${index + 1}: ${word}`)
        .join(" ")
    },
    {
      shape: "a mnemonic numbered with bare numbers",
      value: MNEMONIC.split(" ")
        .map((word, index) => `${index + 1} ${word}`)
        .join(" ")
    },
    {
      shape: "a mnemonic as a dashed list",
      value: MNEMONIC.split(" ")
        .map(word => `- ${word}`)
        .join("\n")
    },
    {
      shape: "a mnemonic as a starred list",
      value: MNEMONIC.split(" ")
        .map(word => `* ${word}`)
        .join("\n")
    },
    { shape: "a private key header without the rest of its block", value: "-----BEGIN EC PRIVATE KEY-----" },
    { shape: "a provider token after a placeholder word", value: "your-token hf_abcdefghijklmnopqrstuv" }
  ])("reads $shape as a known format whatever the variable is called", ({ value }) => {
    expect(findCredentialSign(value, "NOTES")).toBe("known_format");
    expect(findCredentialSign(`  ${value}  `)).toBe("known_format");
  });

  it.each([
    { name: "HF_TOKEN", value: "abc" },
    { name: "POSTGRES_PASSWORD", value: "postgres" },
    { name: "JWT_SECRET", value: "s3cr3t" },
    { name: "OPENAI_API_KEY", value: "abcd1234" },
    { name: "OPENAI_APIKEY", value: "abcd1234" },
    { name: "AWS_SECRET_ACCESS_KEY", value: "wJalrXUtnFEMI" },
    { name: "SSH_PRIVATE_KEY", value: "abc" },
    { name: "SECRET_KEY_BASE", value: "abc" },
    { name: "DB_PASSWD", value: "abc" },
    { name: "REDIS_PWD", value: "abc" },
    { name: "KEY_PASSPHRASE", value: "open sesame" },
    { name: "WALLET_MNEMONIC", value: "one two" },
    { name: "GCP_CREDENTIALS", value: "{}" },
    { name: "registry.credential", value: "abc" },
    { name: "authToken", value: "abc" },
    { name: "apiKey", value: "abc" },
    { name: "db-password", value: "abc" },
    { name: "ENCRYPTION_KEY", value: "abc" },
    { name: "SIGNING_KEY", value: "abc" },
    { name: "MASTER_KEY", value: "abc" },
    { name: "LICENSE_KEY", value: "abc" },
    { name: "AUTH_KEY", value: "abc" },
    { name: "WANDB_KEY", value: "0123456789ab" },
    { name: "PASSWORD_SALT", value: "a1b2c3d4e5f6" },
    { name: "WALLET_SEED", value: "a1b2c3d4e5f6" },
    { name: "ADMIN_PASS", value: "hunter2hunter" },
    { name: "BASIC_AUTH", value: "admin:hunter22" }
  ])("reads $name=$value as a credential by its name", ({ name, value }) => {
    expect(findCredentialSign(value, name)).toBe("credential_name");
  });

  it.each([
    { name: "MAX_TOKENS", value: "large" },
    { name: "TOKENIZERS_PARALLELISM", value: "quiet" },
    { name: "API_KEY_HEADER", value: "X-API-Key" },
    { name: "HF_TOKEN_PATH", value: "/run/secrets/hf" },
    { name: "PASSWORD_FILE", value: "/run/secrets/db" },
    { name: "SECRET_NAME", value: "my-secret" },
    { name: "TOKEN_TYPE", value: "access" },
    { name: "TOKEN_TTL", value: "short" },
    { name: "JWT_SECRET_ALGORITHM", value: "HS256" },
    { name: "SORT_KEY", value: "createdAt" },
    { name: "PRIMARY_KEY", value: "id" },
    { name: "CACHE_KEY", value: "models and weights" },
    { name: "PARTITION_KEY", value: "abcdefghijklmnop" },
    { name: "SHARD_KEY", value: "123456789012x".slice(0, 11) },
    { name: "KEY_API", value: "abc" },
    { name: "API", value: "abc" },
    { name: "KEY", value: "short1" },
    { name: "RANDOM_SEED", value: "fixed" },
    { name: "MODEL", value: "meta-llama/Llama-3.1-8B-Instruct" },
    { name: "MODEL_ID", value: "TheBloke/Mistral-7B-Instruct-v0.2-GGUF" },
    { name: "IMAGE", value: "ghcr.io/open-webui/open-webui:0.4.8" },
    { name: "DATABASE_URL", value: "postgres://db.internal:5432/app" },
    { name: "OLLAMA_HOST", value: "http://ollama:11434" },
    { name: "GIT_COMMIT", value: "9fceb02d0ae598e95dc970b74767f19372d61af8" },
    { name: "MODEL_SHA256", value: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855" },
    { name: "WALLET_ADDRESS", value: "0x52908400098527886E0F7030069857D2E4169EE7" },
    { name: "AKASH_ADDRESS", value: "akash1qqqsyqcyq5rqwzqfpg9scrgwpugpzysnu4rwyh" },
    { name: "TENANT", value: "3f2c1e0a-9b8d-4c7e-a6f5-1d2e3b4c5a69" },
    { name: "REPEATED", value: "Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1" },
    { name: "LOWER_ONLY", value: "abcdefghij0123456789klmnopqrstuv" },
    { name: "UPPER_ONLY", value: "ABCDEFGHIJ0123456789KLMNOPQRSTUV" },
    { name: "NO_DIGITS", value: "abcdefghijKLMNOPQRSTUVwxyzABCDEF" },
    { name: "SHORT_RUN", value: RANDOM_TOKEN.slice(0, 23) },
    { name: "SYSTEM_PROMPT", value: "you are a helpful assistant that answers questions about the weather in detail" },
    { name: "ELEVEN_WORDS", value: Array.from({ length: 11 }, () => "ladder").join(" ") },
    {
      name: "BROKEN_RUN_OF_WORDS",
      value: `${Array.from({ length: 11 }, () => "ladder").join(" ")} xyzzy ${Array.from({ length: 11 }, () => "ladder").join(" ")}`
    },
    { name: "LONG_WORDS", value: Array.from({ length: 12 }, () => "ladderlad").join(" ") },
    { name: "SHORT_WORDS", value: Array.from({ length: 12 }, () => "la").join(" ") },
    { name: "CAPITAL_WORDS", value: Array.from({ length: 12 }, () => "Ladder").join(" ") }
  ])("reads $name=$value as ordinary config", ({ name, value }) => {
    expect(findCredentialSign(value, name)).toBeUndefined();
  });

  it.each(["", "   ", "true", "FALSE", "yes", "no", "on", "off", "enabled", "Disabled", "none", "null", "nil", "undefined", "42", "-3.5", "0"])(
    "reads %j in a credential variable as no value",
    value => {
      expect(findCredentialSign(value, "API_TOKEN")).toBeUndefined();
    }
  );

  it.each([
    "<your-token>",
    "${HF_TOKEN}",
    "$HF_TOKEN",
    "xxx",
    "XXXXXXXX",
    "***",
    "changeme",
    "change-me",
    "CHANGE_ME",
    "replace me",
    "your-api-key-here",
    "your_token",
    "todo",
    "TBD",
    "example",
    "placeholder",
    "ac-secret://HF_TOKEN",
    "ac-secret://hf_abcdefghijklmnopqrstuv"
  ])("reads the placeholder %j in a credential variable as no value", value => {
    expect(findCredentialSign(value, "API_TOKEN")).toBeUndefined();
  });

  it.each(["xx", "**", "changeme now", "my todo", "4 2", "truely", "<open", "yourtoken"])("reads %j in a credential variable as a value", value => {
    expect(findCredentialSign(value, "API_TOKEN")).toBe("credential_name");
  });

  it.each([
    { shape: "on its own", value: RANDOM_TOKEN },
    { shape: "inside a larger value", value: `--auth=${RANDOM_TOKEN} --verbose` },
    { shape: "after a separator", value: `prefix-${RANDOM_TOKEN}` }
  ])("reads a long mixed-case random string $shape as a random string under any name", ({ value }) => {
    expect(findCredentialSign(value, "EXTRA_ARGS")).toBe("random_string");
    expect(findCredentialSign(value)).toBe("random_string");
  });

  it.each([
    { shape: "an argument", value: "--api-key=hunter2abc --verbose" },
    { shape: "inline JSON", value: '{"password": "hunter2abc", "port": 8080}' },
    { shape: "a query string", value: "https://example.com/hook?token=abc123" }
  ])("reads a credential set by name inside $shape as a credential assignment", ({ value }) => {
    expect(findCredentialSign(value, "EXTRA_ARGS")).toBe("credential_assignment");
    expect(findCredentialSign(value)).toBe("credential_assignment");
  });

  it.each([
    "--max_tokens=512 --temperature=0.7",
    "--max-new-tokens=1024",
    "--hf-token-path=/models/token",
    "--api-key=<your-key>",
    "--api-key=${API_KEY}",
    "token_limit: 4096",
    "model=meta-llama/Llama-3.1-8B-Instruct --tokenizer=fast",
    "https://example.com:8080/v1",
    "you are now using the fast model with some safe default values",
    "Bearer authentication is required",
    "Send a bearer token in the Authorization header"
  ])("reads %j as ordinary config", value => {
    expect(findCredentialSign(value, "EXTRA_ARGS")).toBeUndefined();
  });

  it("reads a value as long as an SDL of dotted words that never reach an assignment quickly", () => {
    const value = "token.".repeat(21_830);
    const startedAt = performance.now();

    expect(findCredentialSign(value, "NOTES")).toBeUndefined();
    expect(performance.now() - startedAt).toBeLessThan(500);
  });

  it("reads a credential-named value with no name given as ordinary config", () => {
    expect(findCredentialSign("postgres")).toBeUndefined();
  });

  it("needs an ambiguous name's value to be long, unbroken and mixed", () => {
    expect(findCredentialSign("abcdefghij12", "WANDB_KEY")).toBe("credential_name");
    expect(findCredentialSign("abcdefghij1", "WANDB_KEY")).toBeUndefined();
    expect(findCredentialSign("abcdefghijkl", "WANDB_KEY")).toBeUndefined();
    expect(findCredentialSign("123456789012", "WANDB_KEY")).toBeUndefined();
    expect(findCredentialSign("abcdef ghij12", "WANDB_KEY")).toBeUndefined();
  });
});

describe(holdsKnownCredentialFormat.name, () => {
  it.each([
    { shape: "a provider token among other words", text: "# export HF_TOKEN=hf_abcdefghijklmnopqrstuv before deploying" },
    { shape: "a mnemonic on a line of its own", text: "  abandon ability able about above absent absorb abstract absurd abuse access accident  " },
    { shape: "a private key block that spans lines", text: "notes\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" }
  ])("finds $shape", ({ text }) => {
    expect(holdsKnownCredentialFormat(text)).toBe(true);
  });

  it.each([
    "Set HF_TOKEN to your own token, then deploy.",
    "--max_tokens=512",
    "password: hunter2abc",
    "Authorization: Bearer abcdefghijklmnop1234",
    `postgres://app:${"hunter2".repeat(2)}@db:5432/app`,
    "you are now using the fast model with some safe default values",
    "abandon ability able about above absent absorb abstract absurd abuse access",
    "`abandon ability able about above absent absorb abstract absurd abuse access`",
    MNEMONIC.split(" ").join("."),
    MNEMONIC.split(" ").join("-"),
    MNEMONIC.split(" ").join(" . "),
    MNEMONIC.split(" ").join(" 1.5 "),
    MNEMONIC.split(" ").join(" -- "),
    MNEMONIC.split(" ")
      .map(word => `${word}.`)
      .join(" "),
    MNEMONIC.split(" ")
      .map(word => `(${word})`)
      .join(" "),
    MNEMONIC.split(" ")
      .map(word => `x"${word}`)
      .join(" "),
    MNEMONIC.split(" ")
      .map(word => `${word}"x`)
      .join(" "),
    MNEMONIC.toUpperCase(),
    "abandon ability able about above absent xyzzy absorb abstract absurd abuse access accident"
  ])("finds none in %j, which names no format a provider issues", text => {
    expect(holdsKnownCredentialFormat(text)).toBe(false);
  });
});
