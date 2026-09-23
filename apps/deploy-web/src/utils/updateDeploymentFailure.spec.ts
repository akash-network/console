import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { addCreditsContentOf, creditsRefusalOf, isClientRefusal, sdlRefusalOf } from "./updateDeploymentFailure";

const BAD_SDL = new ApiError(400, { message: "SDL is not valid YAML: line 3, column 5" }, "PATCH /v1/deployments/{dseq} → 400");
const UNKNOWN_PORT = new ApiError(400, { message: 'service "web" exposes no port "8080"' }, "PATCH /v1/deployments/{dseq} → 400");
const TRIAL_GATED = new ApiError(400, { message: "Invalid SDL: GPU deployments are not available on free trial" }, "PATCH /v1/deployments/{dseq} → 400");
const OUT_OF_CREDITS = new ApiError(402, { message: "Insufficient balance: top up to keep deploying" }, "PATCH /v1/deployments/{dseq} → 402");
const SERVER_FAILURE = new ApiError(500, { message: "Invalid SDL: the console could not read it" }, "PATCH /v1/deployments/{dseq} → 500");

describe("sdlRefusalOf", () => {
  it("returns the message of a 400 refusing the document itself", () => {
    expect(sdlRefusalOf(BAD_SDL)).toBe("SDL is not valid YAML: line 3, column 5");
  });

  it("returns nothing for a 400 that refuses something other than the document", () => {
    expect(sdlRefusalOf(UNKNOWN_PORT)).toBeNull();
  });

  it("returns nothing for a trial gate, which only adding credits resolves", () => {
    expect(sdlRefusalOf(TRIAL_GATED)).toBeNull();
  });

  it("returns nothing for a server failure worded like a refusal", () => {
    expect(sdlRefusalOf(SERVER_FAILURE)).toBeNull();
  });
});

describe("creditsRefusalOf", () => {
  it("returns the message of a 402", () => {
    expect(creditsRefusalOf(OUT_OF_CREDITS)).toBe("Insufficient balance: top up to keep deploying");
  });

  it("returns a trial gate without the refusal prefix", () => {
    expect(creditsRefusalOf(TRIAL_GATED)).toBe("GPU deployments are not available on free trial");
  });

  it("returns nothing for any other refusal", () => {
    expect(creditsRefusalOf(BAD_SDL)).toBeNull();
  });
});

describe("addCreditsContentOf", () => {
  it("splits a titled refusal at its first colon", () => {
    expect(addCreditsContentOf("Insufficient balance: top up to keep deploying")).toEqual({
      title: "Insufficient balance",
      message: "top up to keep deploying"
    });
  });

  it("titles an untitled refusal as a request for credits", () => {
    expect(addCreditsContentOf("Not enough funds")).toEqual({ title: "Add credits to continue", message: "Not enough funds" });
  });

  it("carries no message for an empty refusal", () => {
    expect(addCreditsContentOf("")).toEqual({ title: "Add credits to continue", message: undefined });
  });
});

describe("isClientRefusal", () => {
  it.each([
    { named: "a 400", cause: BAD_SDL, expected: true },
    { named: "a 402", cause: OUT_OF_CREDITS, expected: true },
    { named: "a 500", cause: SERVER_FAILURE, expected: false },
    { named: "an error that is not the api's", cause: new Error("offline"), expected: false }
  ])("reads $named as $expected", ({ cause, expected }) => {
    expect(isClientRefusal(cause)).toBe(expected);
  });
});
