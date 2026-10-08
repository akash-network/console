import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";

import type { RecordableDefinition } from "./recordableDefinition";
import type { SdlSecretsSealContext } from "./sealSdlSecrets";
import { isDefinitionAlreadyRecorded, isDefinitionMismatch, sendSealedDefinition } from "./sendSealedDefinition";

const DEFINITION: RecordableDefinition = { sdl: 'version: "2.0"\nservices: {}\n', secrets: { DATABASE_PASSWORD: "hunter2hunter2" } };
const CONTEXT: SdlSecretsSealContext = { kid: "sdl-secrets.v1", sub: "user-1", jwk: { kty: "RSA", n: "n", e: "AQAB" } };
const STALE_SEAL = new ApiError(409, { message: "The sealing key is no longer current", code: "conflict" }, "POST → 409");
const ALREADY_RECORDED = new ApiError(409, { message: "The console already holds a definition", code: "deployment_definition_exists" }, "POST → 409");
const MISMATCH = new ApiError(
  422,
  { message: "This SDL does not describe what the deployment is running", code: "deployment_definition_mismatch" },
  "POST → 422"
);
const PROVIDER_BEHIND = new ApiError(409, { message: "The provider has not picked it up yet", code: "provider_manifest_version_stale" }, "PUT → 409");
const SERVER_FAILURE = new ApiError(500, { message: "Deployment could not be read, please retry" }, "POST → 500");

describe(sendSealedDefinition.name, () => {
  it("sends the definition's values sealed to the sdl it travels with", async () => {
    const { send, seal, contextOf } = setup();

    await sendSealedDefinition(DEFINITION, { contextOf, seal }, send);

    expect(seal).toHaveBeenCalledWith({ context: CONTEXT, sdl: DEFINITION.sdl, secrets: DEFINITION.secrets });
    expect(send).toHaveBeenCalledWith("sealed-1");
  });

  it("reseals with a fresh context once when the api refuses a seal made against a retired key", async () => {
    const { send, seal, contextOf } = setup({ outcomes: [STALE_SEAL, "success"] });

    await sendSealedDefinition(DEFINITION, { contextOf, seal }, send);

    expect(contextOf).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(2, "sealed-2");
  });

  it("gives up after one reseal when the api refuses the second seal too", async () => {
    const { send, seal, contextOf } = setup({ outcomes: [STALE_SEAL, STALE_SEAL, "success"] });

    await expect(sendSealedDefinition(DEFINITION, { contextOf, seal }, send)).rejects.toBe(STALE_SEAL);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["the console already holds a definition", ALREADY_RECORDED],
    ["the sdl does not match what runs", MISMATCH],
    ["the provider has yet to apply an update", PROVIDER_BEHIND],
    ["the server fails", SERVER_FAILURE]
  ])("does not reseal when %s", async (_case, failure) => {
    const { send, seal, contextOf } = setup({ outcomes: [failure, "success"] });

    await expect(sendSealedDefinition(DEFINITION, { contextOf, seal }, send)).rejects.toBe(failure);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when it cannot seal", async () => {
    const { send, contextOf } = setup();
    const failure = new Error("key service unreachable");

    await expect(sendSealedDefinition(DEFINITION, { contextOf, seal: vi.fn().mockRejectedValue(failure) }, send)).rejects.toBe(failure);
    expect(send).not.toHaveBeenCalled();
  });

  function setup(input: { outcomes?: Array<Error | "success"> } = {}) {
    const outcomes = [...(input.outcomes ?? ["success"])];
    const send = vi.fn(async (_sealedSecrets: string) => {
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
    });
    let seals = 0;
    const seal = vi.fn(async () => `sealed-${++seals}`);
    const contextOf = vi.fn(async () => CONTEXT);

    return { send, seal, contextOf };
  }
});

describe(isDefinitionAlreadyRecorded.name, () => {
  it("recognises the api answering that it already holds a definition", () => {
    expect(isDefinitionAlreadyRecorded(ALREADY_RECORDED)).toBe(true);
  });

  it.each([
    ["a mismatch", MISMATCH],
    ["a stale seal", STALE_SEAL],
    ["a failure that is no api error", new Error("deployment_definition_exists")]
  ])("does not mistake %s for it", (_case, failure) => {
    expect(isDefinitionAlreadyRecorded(failure)).toBe(false);
  });
});

describe(isDefinitionMismatch.name, () => {
  it("recognises the api answering that the sdl does not match what runs", () => {
    expect(isDefinitionMismatch(MISMATCH)).toBe(true);
  });

  it("does not mistake the console already holding a definition for it", () => {
    expect(isDefinitionMismatch(ALREADY_RECORDED)).toBe(false);
  });
});
