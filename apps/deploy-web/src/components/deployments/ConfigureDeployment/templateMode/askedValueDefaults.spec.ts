import { describe, expect, it } from "vitest";

import { guessAskedValue, labelFromKey, looksLikeSecret } from "./askedValueDefaults";

describe("labelFromKey", () => {
  it.each([
    ["HF_TOKEN", "HF token"],
    ["OPENAI_API_KEY", "Openai API key"],
    ["maxModelLen", "Max model len"],
    ["db-host.name", "DB host name"],
    ["__LOG__LEVEL__", "Log level"],
    ["MODEL", "Model"],
    ["api_url", "API URL"],
    ["S3_BUCKET", "S3 bucket"],
    ["OAUTH_ID", "OAUTH ID"],
    ["Server_Name", "Server name"],
    ["_", ""]
  ])("turns %s into %s", (key, label) => {
    expect(labelFromKey(key)).toBe(label);
  });

  it.each([
    "API",
    "URL",
    "URI",
    "ID",
    "HF",
    "GPU",
    "CPU",
    "DB",
    "UI",
    "JWT",
    "SSH",
    "AWS",
    "S3",
    "HTTP",
    "HTTPS",
    "TLS",
    "SMTP",
    "IP",
    "DNS",
    "LLM",
    "AI",
    "CORS",
    "OAUTH"
  ])("keeps %s upper case in any position", acronym => {
    expect(labelFromKey(`first_${acronym.toLowerCase()}`)).toBe(`First ${acronym}`);
    expect(labelFromKey(`${acronym.toLowerCase()}_last`)).toBe(`${acronym} last`);
  });

  it("cuts the label to 80 characters", () => {
    const label = labelFromKey("A".repeat(100));

    expect(label).toBe(`A${"a".repeat(79)}`);
    expect(label).toHaveLength(80);
  });

  it("does not end the label in a space when the cut lands on one", () => {
    const key = `${"a".repeat(79)}_bcd`;

    expect(labelFromKey(key)).toBe(`A${"a".repeat(78)}`);
  });

  it("keeps a label of exactly 80 characters whole", () => {
    expect(labelFromKey("A".repeat(80))).toHaveLength(80);
  });
});

describe("guessAskedValue", () => {
  it("asks a secret row as a required secret", () => {
    expect(guessAskedValue({ value: "ac-secret://HF_TOKEN", isSecret: true })).toEqual({ type: "secret", required: true });
  });

  it("asks a secret row as a secret even when its value reads as a number", () => {
    expect(guessAskedValue({ value: "42", isSecret: true })).toEqual({ type: "secret", required: true });
  });

  it.each([
    ["true", "true"],
    ["false", "false"],
    ["TRUE", "true"],
    ["False", "false"]
  ])("reads %s as a boolean defaulting to %s", (value, expected) => {
    expect(guessAskedValue({ value, isSecret: false })).toEqual({ type: "boolean", default: expected, required: false });
  });

  it.each(["truee", "xtrue", "yes", " true"])("does not read %s as a boolean", value => {
    expect(guessAskedValue({ value, isSecret: false }).type).toBe("text");
  });

  it.each([
    ["8192", true],
    ["0", true],
    ["-5", true],
    ["0.5", false],
    ["-1.25", false],
    ["10.0", false]
  ])("reads %s as a number, whole is %s", (value, integer) => {
    expect(guessAskedValue({ value, isSecret: false })).toEqual({ type: "number", default: value, integer, required: false });
  });

  it.each(["007", "1.", ".5", "1e3", "--1", "1,5", "12a", "a12", "+1", "1.5.2"])("does not read %s as a number", value => {
    expect(guessAskedValue({ value, isSecret: false })).toEqual({ type: "text", default: value, required: false });
  });

  it("requires an empty value as text with no default", () => {
    expect(guessAskedValue({ value: "", isSecret: false })).toStrictEqual({ type: "text", required: true });
  });

  it("defaults any other value as optional text", () => {
    expect(guessAskedValue({ value: "info", isSecret: false })).toEqual({ type: "text", default: "info", required: false });
  });
});

describe("looksLikeSecret", () => {
  const RANDOM_TOKEN = "aB3dE5fG7hJ9kL1mN2pQ4rS6";

  it.each([
    ["sk-", "sk-abcdefghijklmnop"],
    ["sk_live_", "sk_live_abcdefghijk"],
    ["sk_test_", "sk_test_abcdefghijk"],
    ["ghp_", "ghp_abcdefghijklmno"],
    ["gho_", "gho_abcdefghijklmno"],
    ["github_pat_", "github_pat_abcdefgh"],
    ["hf_", "hf_abcdefghijklmn"],
    ["xoxb-", "xoxb-abcdefghijkl"],
    ["xoxp-", "xoxp-abcdefghijkl"],
    ["glpat-", "glpat-abcdefghijk"],
    ["AKIA", "AKIAABCDEFGHIJKL"],
    ["AIza", "AIzaabcdefghijkl"]
  ])("flags a %s value under any key", (_prefix, value) => {
    expect(looksLikeSecret("SOMETHING", value)).toBe(true);
  });

  it("flags a prefixed value of exactly 16 characters", () => {
    expect(looksLikeSecret("X", "sk-123456789012")).toBe(false);
    expect(looksLikeSecret("X", "sk-1234567890123")).toBe(true);
  });

  it("ignores a prefix that is not at the start", () => {
    expect(looksLikeSecret("X", "xsk-1234567890123")).toBe(false);
  });

  it("trims the value before measuring it", () => {
    expect(looksLikeSecret("X", "  sk-1234567890123  ")).toBe(true);
    expect(looksLikeSecret("X", "  sk-123456789012  ")).toBe(false);
  });

  it.each([
    "SECRET_KEY",
    "app_token",
    "DB_PASSWORD",
    "DB_PASSWD",
    "OPENAI_API_KEY",
    "OPENAIAPIKEY",
    "SIGNING_PRIVATE_KEY",
    "SIGNINGPRIVATEKEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_ACCESSKEY",
    "GCP_CREDENTIALS"
  ])("flags a value of 8 characters under the key %s", key => {
    expect(looksLikeSecret(key, "abcd1234")).toBe(true);
  });

  it("does not flag a short value under a secret-sounding key", () => {
    expect(looksLikeSecret("HF_TOKEN", "abcd123")).toBe(false);
  });

  it("does not flag a value under a key that does not sound secret", () => {
    expect(looksLikeSecret("MODEL_NAME", "abcd1234")).toBe(false);
  });

  it("flags a long random mixed-case value with digits", () => {
    expect(looksLikeSecret("X", RANDOM_TOKEN)).toBe(true);
  });

  it("does not flag a random value of 23 characters", () => {
    expect(looksLikeSecret("X", RANDOM_TOKEN.slice(0, 23))).toBe(false);
  });

  it.each([
    ["upper case", RANDOM_TOKEN.toLowerCase()],
    ["lower case", RANDOM_TOKEN.toUpperCase()],
    ["a digit", "aBcDeFgHjKlMnPqRsTuVwXyZ"]
  ])("does not flag a long value without %s", (_missing, value) => {
    expect(looksLikeSecret("X", value)).toBe(false);
  });

  it("does not flag a long value of low entropy", () => {
    expect(looksLikeSecret("X", "Aa1".repeat(10))).toBe(false);
  });

  it("flags a value at an entropy just above 3.5 bits per character", () => {
    expect(looksLikeSecret("X", "aA1bB2cC3dD4".repeat(2))).toBe(true);
  });

  it("does not flag a value at an entropy just below 3.5 bits per character", () => {
    expect(looksLikeSecret("X", "aA1bB2cC3dDaA1bB2cC3dDaA")).toBe(false);
  });

  it.each(["info", "8192", "http://litellm:4000/v1", "", "   ", "true"])("does not flag %j", value => {
    expect(looksLikeSecret("MODEL", value)).toBe(false);
  });

  it.each(["meta-llama/Llama-3.1-8B-Instruct", "Qwen/Qwen2.5-7B-Instruct", "ghcr.io/akash-network/Console:v2.1.0", "https://api.Example.com/v1/Models2"])(
    "does not flag the model, image or url %s",
    value => {
      expect(looksLikeSecret("MODEL", value)).toBe(false);
    }
  );

  it.each([
    ["an AWS-style secret with slashes", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"],
    ["a JWT-shaped value", "eyJhbGciOi1JIUzI1NiI.eyJzdWIiOiIxMjM0NTY3ODkw.SflKxwRJSMeKKF2QT4fwpMeJf36"],
    ["a url with credentials", "postgres://user:Pass1@db.Example.com:5432/app"],
    ["a url with credentials and no password digits", "redis://default:hunter@cache:6379"]
  ])("flags %s", (_description, value) => {
    expect(looksLikeSecret("X", value)).toBe(true);
  });

  it.each(["https://user@host.com/path", "postgres://db:5432/app"])("does not flag the url %s as carrying credentials", value => {
    expect(looksLikeSecret("DATABASE_URL", value)).toBe(false);
  });

  it("does not flag a value with whitespace inside", () => {
    expect(looksLikeSecret("API_KEY", "abcd 1234")).toBe(false);
    expect(looksLikeSecret("X", `${RANDOM_TOKEN.slice(0, 12)} ${RANDOM_TOKEN.slice(12)}`)).toBe(false);
    expect(looksLikeSecret("X", "sk-1234567 890123456")).toBe(false);
  });

  it("never flags a secret reference", () => {
    expect(looksLikeSecret("HF_TOKEN", "ac-secret://HF_TOKEN")).toBe(false);
    expect(looksLikeSecret("API_KEY", "ac-secret://s0_e1_with_a_long_random_name_1234")).toBe(false);
  });
});
