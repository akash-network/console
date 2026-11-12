import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { countRedactions, REDACTED, redactEmailAddresses, redactSecrets, redactSecretStrings } from "./redact-secrets";

describe(redactSecrets.name, () => {
  it.each([
    { shape: "an OpenAI style key", secret: `sk-${alphanumeric(16)}` },
    { shape: "an OpenAI project key", secret: `sk-proj-${alphanumeric(24)}_${alphanumeric(8)}` },
    { shape: "a Hugging Face token", secret: `hf_${alphanumeric(20)}` },
    { shape: "a GitHub personal token", secret: `ghp_${alphanumeric(20)}` },
    { shape: "a GitHub OAuth token", secret: `gho_${alphanumeric(36)}` },
    { shape: "a GitHub app token", secret: `ghs_${alphanumeric(36)}` },
    { shape: "a fine-grained GitHub token", secret: `github_pat_${alphanumeric(22)}_${alphanumeric(10)}` },
    { shape: "a Slack token", secret: `xoxb-${digits(10)}-${alphanumeric(12)}` },
    { shape: "an AWS access key id", secret: `AKIA${upperAlphanumeric(16)}` },
    { shape: "an AWS temporary access key id", secret: `ASIA${upperAlphanumeric(16)}` },
    { shape: "a JWT", secret: `eyJ${alphanumeric(12)}.eyJ${alphanumeric(20)}.${alphanumeric(16)}-_${alphanumeric(4)}` }
  ])("replaces $shape in the middle of a sentence", ({ secret }) => {
    expect(redactSecrets(`my deploy fails with ${secret} set in the env`)).toBe(`my deploy fails with ${REDACTED} set in the env`);
  });

  it("replaces a private key block with everything between its markers", () => {
    const privateKey = ["-----BEGIN RSA PRIVATE KEY-----", alphanumeric(40), alphanumeric(40), "-----END RSA PRIVATE KEY-----"].join("\n");

    expect(redactSecrets(`here is the key:\n${privateKey}\nthanks`)).toBe(`here is the key:\n${REDACTED}\nthanks`);
  });

  it("replaces each private key block separately and keeps the text between them", () => {
    const privateKey = () => ["-----BEGIN PRIVATE KEY-----", alphanumeric(40), "-----END PRIVATE KEY-----"].join("\n");

    expect(redactSecrets(`${privateKey()} and ${privateKey()}`)).toBe(`${REDACTED} and ${REDACTED}`);
  });

  it("keeps the bearer scheme and replaces the token after it", () => {
    expect(redactSecrets(`curl -H "Authorization: Bearer ${alphanumeric(24)}.${alphanumeric(8)}/+~-==" works`)).toBe(
      `curl -H "Authorization: Bearer ${REDACTED}" works`
    );
  });

  it("matches the bearer scheme whatever its case", () => {
    expect(redactSecrets(`bearer ${alphanumeric(24)}`)).toBe(`bearer ${REDACTED}`);
  });

  it("replaces the password in a connection string and keeps the user and host", () => {
    expect(redactSecrets(`DB is postgres://admin:${alphanumeric(16)}@db.example.com:5432/app`)).toBe(
      `DB is postgres://admin:${REDACTED}@db.example.com:5432/app`
    );
  });

  it("keeps a URL that carries no credentials", () => {
    const text = "see https://console.akash.network/deployments/123 and mailto:me@example.com";

    expect(redactSecrets(text)).toBe(text);
  });

  it.each([
    { name: "DB_PASSWORD", separator: "=" },
    { name: "api_key", separator: ": " },
    { name: "API-KEY", separator: "=" },
    { name: "apikey", separator: "=" },
    { name: "STRIPE_SECRET", separator: " = " },
    { name: "access_key", separator: "=" },
    { name: "PRIVATE_KEY", separator: "=" },
    { name: "auth.token", separator: "=" },
    { name: "passwd", separator: "=" },
    { name: "GCP_CREDENTIALS", separator: "=" },
    { name: "credential", separator: ":" }
  ])("replaces the value assigned to $name and keeps the name", ({ name, separator }) => {
    expect(redactSecrets(`env ${name}${separator}${alphanumeric(12)} is set`)).toBe(`env ${name}${separator}${REDACTED} is set`);
  });

  it("keeps the quotes around a quoted secret value", () => {
    expect(redactSecrets(`HF_TOKEN="${alphanumeric(8)}" and SECRET='${alphanumeric(8)}'`)).toBe(`HF_TOKEN="${REDACTED}" and SECRET='${REDACTED}'`);
  });

  it.each([
    { case: "double quotes", text: `password="two words" here`, expected: `password="${REDACTED}" here` },
    { case: "single quotes", text: `api_key: 'my secret key' here`, expected: `api_key: '${REDACTED}' here` },
    { case: "double quotes around an apostrophe", text: `password="it's mine" here`, expected: `password="${REDACTED}" here` }
  ])("replaces a quoted secret value holding spaces in $case", ({ text, expected }) => {
    expect(redactSecrets(text)).toBe(expected);
  });

  it("keeps an empty quoted secret value", () => {
    const text = `password="" is not set`;

    expect(redactSecrets(text)).toBe(text);
  });

  it.each([
    { case: "double", text: `password="hunter2`, expected: `password="${REDACTED}` },
    { case: "single", text: `token: 'two words`, expected: `token: '${REDACTED}` }
  ])("replaces the rest of the line after a $case quote that never closes", ({ text, expected }) => {
    expect(redactSecrets(text)).toBe(expected);
  });

  it("stops an unclosed quoted secret at the end of its line", () => {
    expect(redactSecrets(`password="never closed\nthen "quoted" text`)).toBe(`password="${REDACTED}\nthen "quoted" text`);
  });

  it("scans a long line with an opening quote that never closes quickly", () => {
    const text = `password="${"a ".repeat(25_000)}`;
    const startedAt = performance.now();

    expect(redactSecrets(text)).toBe(`password="${REDACTED}`);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });

  it("keeps an assignment whose name holds no secret word", () => {
    const text = "PORT=8080 and MODEL_NAME=llama-3 and keyboard=qwerty";

    expect(redactSecrets(text)).toBe(text);
  });

  it.each([
    { case: "a short sk- word", text: "the task-list and sk-short are fine" },
    { case: "an hf_ word that is too short", text: "hf_model is a folder" },
    { case: "a gh word with an unknown letter", text: `ghx_${"a".repeat(30)}` },
    { case: "an AWS-like word with a lowercase letter", text: `AKIA${"A".repeat(15)}a` },
    { case: "an AWS-like word that is too long", text: `AKIA${"A".repeat(17)}` },
    { case: "a word that only starts like a JWT", text: "eyJhbGci is how it starts" },
    { case: "a word that ends with sk-", text: `task-${"a".repeat(20)}` }
  ])("keeps $case", ({ text }) => {
    expect(redactSecrets(text)).toBe(text);
  });

  it("replaces the value of a key name with a long prefix before the secret word", () => {
    const name = `${"A".repeat(60)}_TOKEN`;

    expect(redactSecrets(`${name}=${alphanumeric(12)}`)).toBe(`${name}=${REDACTED}`);
  });

  it.each([{ text: "token.".repeat(666) }, { text: "secret-".repeat(571) }])("scans a long run of secret words without an assignment quickly", ({ text }) => {
    const startedAt = performance.now();

    expect(redactSecrets(text)).toBe(text);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });

  it("replaces every secret when the text holds several", () => {
    const first = `hf_${alphanumeric(24)}`;
    const second = `hf_${alphanumeric(24)}`;

    expect(redactSecrets(`${first} then ${second}`)).toBe(`${REDACTED} then ${REDACTED}`);
  });

  it("keeps text without secrets unchanged", () => {
    const text = "The deployment never got bids for an H100, what should I change?";

    expect(redactSecrets(text)).toBe(text);
  });

  function alphanumeric(length: number) {
    return faker.string.alphanumeric({ length, casing: "mixed" });
  }

  function upperAlphanumeric(length: number) {
    return faker.string.alphanumeric({ length, casing: "upper" });
  }

  function digits(length: number) {
    return faker.string.numeric(length);
  }
});

describe(countRedactions.name, () => {
  it("counts every secret the redaction took out", () => {
    const original = `first ${`hf_${"a1".repeat(12)}`} then password=hunter22`;

    expect(countRedactions(original, redactSecrets(original))).toBe(2);
  });

  it("counts nothing for a text without secrets", () => {
    expect(countRedactions("why no bids?", redactSecrets("why no bids?"))).toBe(0);
  });

  it("does not count a placeholder the user typed themselves", () => {
    const original = `I already replaced it with ${REDACTED}`;

    expect(countRedactions(original, redactSecrets(original))).toBe(0);
  });
});

describe(redactSecretStrings.name, () => {
  it("replaces secrets in strings nested in objects and arrays", () => {
    const value = {
      sdl: `env:\n  - HF_TOKEN=${faker.string.alphanumeric(24)}`,
      before: { command: ["sh", "-c"], args: [`--api-key=sk-${faker.string.alphanumeric(24)}`, "--port=8080"] },
      services: [{ env: { api_key: `api_key: ${faker.string.alphanumeric(12)}` } }]
    };

    expect(redactSecretStrings(value)).toEqual({
      sdl: `env:\n  - HF_TOKEN=${REDACTED}`,
      before: { command: ["sh", "-c"], args: [`--api-key=${REDACTED}`, "--port=8080"] },
      services: [{ env: { api_key: `api_key: ${REDACTED}` } }]
    });
  });

  it("keeps keys and non-string values unchanged", () => {
    const value = { proposalId: faker.string.uuid(), count: 2, enabled: false, diagnosis: null, missing: undefined, nested: [1, true, null] };

    expect(redactSecretStrings(value)).toEqual(value);
  });

  it("does not change the value it is given", () => {
    const secret = `hf_${faker.string.alphanumeric(24)}`;
    const value = { args: [secret] };

    redactSecretStrings(value);

    expect(value).toEqual({ args: [secret] });
  });

  it("replaces secrets in a bare string", () => {
    expect(redactSecretStrings(`token=${faker.string.alphanumeric(12)}`)).toBe(`token=${REDACTED}`);
  });
});

describe(redactEmailAddresses.name, () => {
  it.each(["jane@example.com", "jane.doe+gpu@mail.example.co.uk", "ops_team-1@acme-corp.io", "JANE@EXAMPLE.COM"])("replaces %s inside a free text", address => {
    expect(redactEmailAddresses(`Reach me at ${address}, thanks`)).toBe(`Reach me at ${REDACTED}, thanks`);
  });

  it("replaces every address and keeps the text around them", () => {
    expect(redactEmailAddresses("mailto:jane@example.com or bob@example.org")).toBe(`mailto:${REDACTED} or ${REDACTED}`);
  });

  it.each([
    "nginx@sha256:4c0fdaa8b6341bfdeca5f18f7837462c80cff90527ee35ef185571e1c327beac",
    "@handle on discord",
    "user@localhost",
    "provider.europlots.com",
    "https://console.akash.network/deployments/123"
  ])("keeps %s, which is not an email address", text => {
    expect(redactEmailAddresses(text)).toBe(text);
  });

  it("stays fast on a long run of address characters without an @", () => {
    const text = "a.".repeat(50_000);
    const startedAt = performance.now();

    expect(redactEmailAddresses(text)).toBe(text);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });
});
