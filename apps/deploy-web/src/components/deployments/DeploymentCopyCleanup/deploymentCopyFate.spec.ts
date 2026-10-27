import { describe, expect, it, vi } from "vitest";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import type { DeploymentCopy, DeploymentRecord } from "./deploymentCopyFate";
import { definitionFateOf, unsentNameOf } from "./deploymentCopyFate";

const CHAIN_HASH = "chain-hash";

function sdlWithEnv(env: string[]) {
  return ["version: '2.0'", "services:", "  web:", "    image: nginx", "    env:", ...env.map(entry => `      - "${entry}"`)].join("\n");
}

const PLAIN_SDL = sdlWithEnv(["MODE=dev"]);
const BROWSER_SDL = sdlWithEnv(["MODE=from-this-browser"]);
const BLANKED_SDL = sdlWithEnv(["TOKEN="]);

describe(definitionFateOf.name, () => {
  it("forgets a copy holding no definition", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ name: "web" }, recordOf({ consoleSettings: null }))).toBe("forget");
  });

  it("forgets a closed deployment's copy, even when the console holds no definition for it", async () => {
    const { fateOf, manifestVersionOf } = setup();

    expect(await fateOf({ manifest: PLAIN_SDL }, recordOf({ deployment: { state: "closed", hash: CHAIN_HASH }, consoleSettings: null }))).toBe("forget");
    expect(manifestVersionOf).not.toHaveBeenCalled();
  });

  it("records a running deployment's copy when the console holds no definition for it", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ manifest: PLAIN_SDL }, recordOf({ consoleSettings: null }))).toBe("record");
  });

  it("forgets a copy once the console holds the definition the chain runs, without hashing either", async () => {
    const { fateOf, manifestVersionOf } = setup();

    expect(await fateOf({ manifest: BROWSER_SDL }, recordOf())).toBe("forget");
    expect(manifestVersionOf).not.toHaveBeenCalled();
  });

  it("forgets a copy when the console's definition has blank values the chain itself runs", async () => {
    const { fateOf } = setup({ versions: { [BLANKED_SDL]: CHAIN_HASH, [BROWSER_SDL]: CHAIN_HASH } });

    expect(await fateOf({ manifest: BROWSER_SDL }, recordOf({ consoleSettings: { sdl: BLANKED_SDL, manifestVersion: CHAIN_HASH } }))).toBe("forget");
  });

  describe("when the console's definition is not the one the chain runs", () => {
    it("keeps a copy that is", async () => {
      const { fateOf } = setup({ versions: { [BROWSER_SDL]: CHAIN_HASH } });

      expect(await fateOf({ manifest: BROWSER_SDL }, recordOf({ consoleSettings: { sdl: PLAIN_SDL, manifestVersion: "older-hash" } }))).toBe("keep");
    });

    it("keeps a copy that is, beside a definition whose values were blanked away", async () => {
      const { fateOf } = setup({ versions: { [BLANKED_SDL]: "other-hash", [BROWSER_SDL]: CHAIN_HASH } });

      expect(await fateOf({ manifest: BROWSER_SDL }, recordOf({ consoleSettings: { sdl: BLANKED_SDL, manifestVersion: CHAIN_HASH } }))).toBe("keep");
    });

    it("forgets a copy that is not either", async () => {
      const { fateOf } = setup({ versions: { [BROWSER_SDL]: "another-hash" } });

      expect(await fateOf({ manifest: BROWSER_SDL }, recordOf({ consoleSettings: { sdl: PLAIN_SDL, manifestVersion: "older-hash" } }))).toBe("forget");
    });

    it("forgets a copy this browser cannot hash", async () => {
      const { fateOf } = setup();

      expect(await fateOf({ manifest: BROWSER_SDL }, recordOf({ consoleSettings: { sdl: PLAIN_SDL, manifestVersion: "older-hash" } }))).toBe("forget");
    });
  });

  function setup(input: { versions?: Record<string, string> } = {}) {
    const manifestVersionOf = vi.fn(async (sdl: string) => input.versions?.[sdl] ?? null);
    const fateOf = (copy: DeploymentCopy, record: DeploymentRecord) => definitionFateOf(copy, record, manifestVersionOf);

    return { fateOf, manifestVersionOf };
  }
});

describe(unsentNameOf.name, () => {
  it("is the copy's name when the console holds none", () => {
    expect(unsentNameOf({ name: "  web  " }, recordOf({ name: null }))).toBe("web");
  });

  it("is cut to the longest name the console accepts", () => {
    expect(unsentNameOf({ name: "a".repeat(MAX_DEPLOYMENT_NAME_LENGTH + 5) }, recordOf({ name: null }))).toBe("a".repeat(MAX_DEPLOYMENT_NAME_LENGTH));
  });

  it("is nothing once the console holds a name", () => {
    expect(unsentNameOf({ name: "web" }, recordOf({ name: "renamed" }))).toBeUndefined();
  });

  it.each([undefined, "", "   "])("is nothing for a copy named %p", name => {
    expect(unsentNameOf({ name }, recordOf({ name: null }))).toBeUndefined();
  });
});

function recordOf(overrides: Partial<DeploymentRecord> = {}): DeploymentRecord {
  return {
    deployment: { state: "active", hash: CHAIN_HASH },
    name: "web",
    consoleSettings: { sdl: PLAIN_SDL, manifestVersion: CHAIN_HASH },
    ...overrides
  };
}
