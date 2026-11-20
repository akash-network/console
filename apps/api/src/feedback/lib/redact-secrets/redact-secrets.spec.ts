import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  countRedactions,
  holdsIssuedCredential,
  holdsUrlPassword,
  REDACTED,
  redactEmailAddresses,
  redactSecretFields,
  redactSecrets,
  redactSecretStrings
} from "./redact-secrets";

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
    { shape: "a Stripe secret key", secret: `sk_live_${alphanumeric(24)}` },
    { shape: "a Stripe restricted test key", secret: `rk_test_${alphanumeric(16)}` },
    { shape: "a Google API key", secret: `AIza${alphanumeric(35)}` },
    { shape: "a GitLab personal token", secret: `glpat-${alphanumeric(20)}` },
    { shape: "an npm token", secret: `npm_${alphanumeric(36)}` },
    { shape: "a SendGrid key", secret: `SG.${alphanumeric(22)}.${alphanumeric(43)}` },
    { shape: "a Replicate token", secret: `r8_${alphanumeric(37)}` },
    { shape: "a Groq key", secret: `gsk_${alphanumeric(52)}` },
    { shape: "an NVIDIA API key", secret: `nvapi-${alphanumeric(64)}` },
    { shape: "a Docker Hub token", secret: `dckr_pat_${alphanumeric(27)}` },
    { shape: "a Tailscale key", secret: `tskey-auth-${alphanumeric(24)}` },
    { shape: "a JWT", secret: `eyJ${alphanumeric(12)}.eyJ${alphanumeric(20)}.${alphanumeric(16)}-_${alphanumeric(4)}` }
  ])("replaces $shape in the middle of a sentence", ({ secret }) => {
    expect(redactSecrets(`my deploy fails with ${secret} set in the env`)).toBe(`my deploy fails with ${REDACTED} set in the env`);
  });

  it("replaces a JWT whose payload is longer than a thousand characters", () => {
    const jwt = `eyJ${alphanumeric(12)}.eyJ${alphanumeric(1500)}.${alphanumeric(43)}`;

    expect(redactSecrets(`token ${jwt} expired`)).toBe(`token ${REDACTED} expired`);
  });

  it.each(["session-", "--jwt=", "path/", "a.b.", "eyJ-", "-"])("replaces a JWT that follows %s and keeps what is before it", prefix => {
    const jwt = `eyJ${alphanumeric(12)}.eyJ${alphanumeric(20)}.${alphanumeric(16)}`;

    expect(redactSecrets(`it sent ${prefix}${jwt} twice`)).toBe(`it sent ${prefix}${REDACTED} twice`);
  });

  it("replaces a JWT whose header and payload hold hyphens", () => {
    const jwt = `eyJ${alphanumeric(6)}-${alphanumeric(6)}-e.eyJ${alphanumeric(10)}-eyJ${alphanumeric(10)}.${alphanumeric(8)}-${alphanumeric(8)}`;

    expect(redactSecrets(`it sent ${jwt} twice`)).toBe(`it sent ${REDACTED} twice`);
  });

  it.each([
    { shape: "JWT starts without a dot", text: "eyJ-".repeat(32_000) },
    { shape: "JWT headers without a dot", text: "eyJa-".repeat(26_000) },
    { shape: "JWT starts after a header and a dot", text: `eyJa.${"eyJ-".repeat(32_000)}` },
    { shape: "headers that each reach a payload without a signature", text: "eyJa.eyJb ".repeat(13_000) }
  ])("stays fast on a long run of $shape", ({ text }) => {
    const startedAt = performance.now();

    expect(redactSecrets(text)).toBe(text);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
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

  it.each([
    { case: "JSON", text: `config: {"password":"hunter22","port":8080}`, expected: `config: {"password":"${REDACTED}","port":8080}` },
    { case: "spaced JSON", text: `{ "api_key": "abc 123" }`, expected: `{ "api_key": "${REDACTED}" }` },
    { case: "single-quoted", text: `{'token': 'abc123'}`, expected: `{'token': '${REDACTED}'}` }
  ])("replaces the value of a quoted secret key in $case", ({ text, expected }) => {
    expect(redactSecrets(text)).toBe(expected);
  });

  it.each([
    { case: "an equals sign", text: `password"=token="hunter22"`, expected: `password"=token="${REDACTED}"` },
    { case: "JSON", text: `{"password":token="hunter22"}`, expected: `{"password":token="${REDACTED}"}` },
    { case: "single quotes", text: `password': token: 'hunter22'`, expected: `password': token: '${REDACTED}'` },
    { case: "spaces", text: `password" = token = "hunter22"`, expected: `password" = token = "${REDACTED}"` },
    { case: "an unclosed second value", text: `passwd'=token="abc`, expected: `passwd'=token="${REDACTED}` }
  ])("replaces the second secret after a quoted secret key with an unquoted value in $case", ({ text, expected }) => {
    expect(redactSecrets(text)).toBe(expected);
  });

  it.each([
    { case: "JSON", text: `{"password": hunter22}`, expected: `{"password": ${REDACTED}}` },
    { case: "a JSON number before another field", text: `{"token": 123456, "port": 8080}`, expected: `{"token": ${REDACTED}, "port": 8080}` },
    { case: "a JSON array", text: `["api_key": abc123]`, expected: `["api_key": ${REDACTED}]` },
    { case: "single quotes", text: `'api_key': abc123`, expected: `'api_key': ${REDACTED}` },
    { case: "an equals sign", text: `password"=hunter2 next`, expected: `password"=${REDACTED} next` }
  ])("replaces an unquoted value after a quoted secret key in $case", ({ text, expected }) => {
    expect(redactSecrets(text)).toBe(expected);
  });

  it.each([
    { case: "a second key in the first value", text: `token"= "a secret= "z9"`, expected: `token"= "${REDACTED}"${REDACTED}"` },
    { case: "a second key after words", text: `password"="one two token="z9x8c7"`, expected: `password"="${REDACTED}"${REDACTED}"` },
    { case: "single quotes", text: `password'= 'abc api_key ='hunter22'`, expected: `password'= '${REDACTED}'${REDACTED}'` },
    { case: "a suffixed key name", text: `AWS_ACCESS_KEY_ID"= "a secret= "z9"`, expected: `AWS_ACCESS_KEY_ID"= "${REDACTED}"${REDACTED}"` },
    { case: "the other quote inside the second value", text: `token"= "a secret= '"hunter22'`, expected: `token"= "${REDACTED}` }
  ])("replaces a second secret whose quote a quoted secret key's value would close on, with $case", ({ text, expected }) => {
    expect(redactSecrets(text)).toBe(expected);
  });

  it.each([
    { case: "JSON", text: String.raw`{"password":"first\"remaining-secret","port":8080}`, expected: `{"password":"${REDACTED}` },
    { case: "an escaped backslash", text: String.raw`{"token":"abc\\","port":8080}`, expected: `{"token":"${REDACTED}` },
    { case: "a second secret after it", text: String.raw`password="abc\" api_key="z9Xk2mP4qR7s"`, expected: `password="${REDACTED}` },
    { case: "a second secret opening with a space", text: String.raw`password="x\" api_key=" z9Xk2mP4qR7s"`, expected: `password="${REDACTED}` },
    { case: "a period after it", text: String.raw`password="p\"w0rd".`, expected: `password="${REDACTED}` },
    { case: "a slash after it", text: String.raw`password="p\"w0rd"/`, expected: `password="${REDACTED}` },
    { case: "a closing angle bracket after it", text: String.raw`password="p\"w0rd">`, expected: `password="${REDACTED}` },
    { case: "an exclamation mark after it", text: String.raw`password="p\"w0rd"!`, expected: `password="${REDACTED}` },
    { case: "a following line", text: String.raw`password="p\"w0rd"` + "\nport=8080", expected: `password="${REDACTED}\nport=8080` }
  ])("replaces the rest of the line after a quoted secret holding an escaped quote in $case", ({ text, expected }) => {
    expect(redactSecrets(text)).toBe(expected);
  });

  it("keeps a later escaped quote out of an earlier quoted secret", () => {
    expect(redactSecrets(String.raw`{"password":"x","note":"say \"hi\""}`)).toBe(String.raw`{"password":"${REDACTED}","note":"say \"hi\""}`);
  });

  it("closes a quoted secret value followed by punctuation at its own quote", () => {
    expect(redactSecrets(`password="hunter22". token="abc123"`)).toBe(`password="${REDACTED}". token="${REDACTED}"`);
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

  it.each([
    { case: "words", text: `password="${"a ".repeat(25_000)}` },
    { case: "escapes", text: `password="${"\\a ".repeat(16_000)}` }
  ])("scans a long line of $case with an opening quote that never closes quickly", ({ text }) => {
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

  it.each([
    { carrier: "a quoted key with an unquoted value", prefix: '"password": ' },
    { carrier: "a bearer scheme", prefix: "Bearer " },
    { carrier: "an unquoted key", prefix: "api_key=" }
  ])("replaces the whole value of $carrier that starts with a provider token", ({ prefix }) => {
    const text = `${prefix}sk_live_${alphanumeric(24)}.private-tail`;

    expect(redactSecrets(text)).toBe(`${prefix}${REDACTED}`);
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

const CONNECTION_STRING_WITH_PASSWORD = `postgres://app:${"hunter2".repeat(2)}@db:5432/app`;

describe(holdsIssuedCredential.name, () => {
  it.each([
    { shape: "a Hugging Face token", build: () => `hf_${faker.string.alphanumeric({ length: 24, casing: "mixed" })}` },
    { shape: "a GitHub token", build: () => `ghp_${faker.string.alphanumeric({ length: 36, casing: "mixed" })}` },
    { shape: "a private key block", build: () => `-----BEGIN PRIVATE KEY-----\n${faker.string.alphanumeric(64)}\n-----END PRIVATE KEY-----` }
  ])("finds $shape among other words", ({ build }) => {
    expect(holdsIssuedCredential(`export it as ${build()} before you start`)).toBe(true);
  });

  it("finds a token every time it is asked about the same text", () => {
    const text = `hf_${faker.string.alphanumeric({ length: 24, casing: "mixed" })}`;

    expect([holdsIssuedCredential(text), holdsIssuedCredential(text), holdsIssuedCredential(text)]).toEqual([true, true, true]);
  });

  it.each(["--max_tokens=512", "token: abc", "Bearer abc123", CONNECTION_STRING_WITH_PASSWORD, "Set HF_TOKEN to your own token."])(
    "does not take %s for an issued credential",
    text => {
      expect(holdsIssuedCredential(text)).toBe(false);
    }
  );
});

describe(holdsUrlPassword.name, () => {
  it("finds a password in a connection string", () => {
    expect(holdsUrlPassword(CONNECTION_STRING_WITH_PASSWORD)).toBe(true);
  });

  it("finds a password every time it is asked about the same text", () => {
    const text = "redis://default:hunter2@cache:6379";

    expect([holdsUrlPassword(text), holdsUrlPassword(text)]).toEqual([true, true]);
  });

  it.each(["https://example.com/docs", "postgres://app@db:5432/app", "user:pass"])("finds none in %s", text => {
    expect(holdsUrlPassword(text)).toBe(false);
  });
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

describe(redactSecretFields.name, () => {
  it("replaces what a secret-like key holds, as text or as a number, at any depth", () => {
    const value = {
      env: { API_TOKEN: faker.string.alphanumeric(12), "db password": faker.string.alphanumeric(8), PORT: "8080" },
      services: [{ accessKey: faker.number.int({ min: 1000, max: 9999 }), image: "nginx" }]
    };

    expect(redactSecretFields(value)).toEqual({
      env: { API_TOKEN: REDACTED, "db password": REDACTED, PORT: "8080" },
      services: [{ accessKey: REDACTED, image: "nginx" }]
    });
  });

  it("keeps what cannot carry a secret under a secret-like key, and reads on into what it contains", () => {
    const value = { hasSecrets: true, nextPageToken: null, secrets: [{ name: "DB_URL", env: `PGPASSWORD=${faker.string.alphanumeric(12)}` }] };

    expect(redactSecretFields(value)).toEqual({
      hasSecrets: true,
      nextPageToken: null,
      secrets: [{ name: "DB_URL", env: `PGPASSWORD=${REDACTED}` }]
    });
  });

  it("leaves a key alone when the secret word is not in its last word", () => {
    const value = { "token count": 12, "secret santa list": "Ada, Grace", tokenizer: "bpe" };

    expect(redactSecretFields(value)).toEqual({ "token count": 12, "secret santa list": "Ada, Grace", tokenizer: REDACTED });
  });

  it("replaces secrets in strings and keeps the other values unchanged", () => {
    const value = { sdl: `env:\n  - HF_TOKEN=${faker.string.alphanumeric(24)}`, count: 2, enabled: false, diagnosis: null, nested: [1, true, null] };

    expect(redactSecretFields(value)).toEqual({ ...value, sdl: `env:\n  - HF_TOKEN=${REDACTED}` });
    expect(redactSecretFields(`token=${faker.string.alphanumeric(12)}`)).toBe(`token=${REDACTED}`);
    expect(redactSecretFields(7)).toBe(7);
    expect(redactSecretFields(null)).toBeNull();
  });

  it("does not change the value it is given", () => {
    const password = faker.string.alphanumeric(12);
    const value = { env: { password } };

    redactSecretFields(value);

    expect(value).toEqual({ env: { password } });
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
