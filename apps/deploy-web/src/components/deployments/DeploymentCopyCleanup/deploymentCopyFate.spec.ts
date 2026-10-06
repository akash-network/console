import { describe, expect, it, vi } from "vitest";

import type { DeploymentRecord } from "./deploymentCopyFate";
import { deploymentCopyFateOf } from "./deploymentCopyFate";

const CHAIN_HASH = "chain-hash";

function sdlWithEnv(env: string[]) {
  return ["version: '2.0'", "services:", "  web:", "    image: nginx", "    env:", ...env.map(entry => `      - "${entry}"`)].join("\n");
}

const PLAIN_SDL = sdlWithEnv(["MODE=dev"]);
const BLANKED_SDL = sdlWithEnv(["TOKEN="]);
const PROTECTED_SDL = sdlWithEnv(["MODE=ac-secret://s0_e0"]);

describe(deploymentCopyFateOf.name, () => {
  it("keeps a copy whose deployment the console could not be asked about", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ manifest: PLAIN_SDL, name: "web" }, null)).toBe("keep");
  });

  it("forgets a copy holding only a name the console already has", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ name: "web" }, recordOf({ name: "web", consoleSettings: null }))).toBe("forget");
  });

  it("keeps a copy holding only a name the console has not recorded", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ name: "web" }, recordOf({ name: null, consoleSettings: null }))).toBe("holds-name");
  });

  it("forgets a copy whose name is blank, since there is nothing to send", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ name: "  " }, recordOf({ name: null, consoleSettings: null }))).toBe("forget");
  });

  it("keeps a copy that is the only definition of its deployment", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ manifest: PLAIN_SDL, name: "web" }, recordOf({ consoleSettings: null }))).toBe("only-in-browser");
  });

  it("forgets a copy once the console holds the definition the chain runs", async () => {
    const { fateOf, manifestVersionOf } = setup();

    expect(await fateOf({ manifest: PLAIN_SDL, name: "web" }, recordOf())).toBe("forget");
    expect(manifestVersionOf).not.toHaveBeenCalled();
  });

  it("keeps a copy when the console's definition is not the one the chain runs", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ manifest: PLAIN_SDL }, recordOf({ consoleSettings: { sdl: PLAIN_SDL, manifestVersion: "older-hash" } }))).toBe("keep");
  });

  it("keeps a copy when the console's definition lost values that hashing it cannot account for", async () => {
    const { fateOf } = setup({ versions: { [BLANKED_SDL]: "other-hash" } });

    expect(await fateOf({ manifest: PLAIN_SDL }, recordOf({ consoleSettings: { sdl: BLANKED_SDL, manifestVersion: CHAIN_HASH } }))).toBe("keep");
  });

  it("forgets a copy when the console's definition has blank values the chain itself runs", async () => {
    const { fateOf } = setup({ versions: { [BLANKED_SDL]: CHAIN_HASH } });

    expect(await fateOf({ manifest: PLAIN_SDL }, recordOf({ consoleSettings: { sdl: BLANKED_SDL, manifestVersion: CHAIN_HASH } }))).toBe("forget");
  });

  it("keeps a copy the update tab restores protected variables from", async () => {
    const { fateOf } = setup({ versions: { [PLAIN_SDL]: CHAIN_HASH } });

    expect(await fateOf({ manifest: PLAIN_SDL }, recordOf({ consoleSettings: { sdl: PROTECTED_SDL, manifestVersion: CHAIN_HASH } }))).toBe(
      "restores-variables"
    );
  });

  it("forgets a copy that no longer matches the chain, since nothing can be restored from it", async () => {
    const { fateOf } = setup({ versions: { [PLAIN_SDL]: "older-hash" } });

    expect(await fateOf({ manifest: PLAIN_SDL }, recordOf({ consoleSettings: { sdl: PROTECTED_SDL, manifestVersion: CHAIN_HASH } }))).toBe("forget");
  });

  it("keeps a copy holding a name the console has not recorded, even beside a recorded definition", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ manifest: PLAIN_SDL, name: "web" }, recordOf({ name: null }))).toBe("holds-name");
  });

  it("forgets a copy carrying no name even when the console has none either", async () => {
    const { fateOf } = setup();

    expect(await fateOf({ manifest: PLAIN_SDL }, recordOf({ name: null }))).toBe("forget");
  });

  function recordOf(overrides: Partial<DeploymentRecord> = {}): DeploymentRecord {
    return {
      deployment: { state: "active", hash: CHAIN_HASH },
      name: "web",
      consoleSettings: { sdl: PLAIN_SDL, manifestVersion: CHAIN_HASH },
      ...overrides
    };
  }

  function setup(input: { versions?: Record<string, string> } = {}) {
    const manifestVersionOf = vi.fn(async (sdl: string) => input.versions?.[sdl] ?? null);
    const fateOf = (copy: Parameters<typeof deploymentCopyFateOf>[0], record: DeploymentRecord | null) => deploymentCopyFateOf(copy, record, manifestVersionOf);

    return { fateOf, manifestVersionOf };
  }
});
