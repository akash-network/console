import { describe, expect, it } from "vitest";

import type { EnvironmentVariableType } from "@src/types/sdlBuilder/sdlBuilder";
import { holdsVariablesProtectedByDefault, restoredEnvOf } from "./protectedVariables";

describe(restoredEnvOf.name, () => {
  it("turns a kept secret into a plain variable carrying the value this browser gave back", () => {
    const restored = restoredEnvOf([[kept("port", "PORT", "s0_e0"), plain("mode", "MODE", "dev")]], [[plain("other-id", "PORT", "3000")]]);

    expect(restored).toEqual({
      count: 1,
      changes: [
        {
          serviceIndex: 0,
          env: [
            { id: "port", key: "PORT", value: "3000", isSecret: false },
            { id: "mode", key: "MODE", value: "dev" }
          ]
        }
      ]
    });
  });

  it("restores each service from its own values", () => {
    const restored = restoredEnvOf(
      [[kept("web", "TOKEN", "s0_e0")], [kept("api", "TOKEN", "s1_e0")]],
      [[plain("w", "TOKEN", "web-token")], [plain("a", "TOKEN", "api-token")]]
    );

    expect(restored.changes.map(change => change.env?.[0].value)).toEqual(["web-token", "api-token"]);
  });

  it("names only the services that change", () => {
    const restored = restoredEnvOf(
      [[plain("mode", "MODE", "dev")], [kept("api", "TOKEN", "s1_e0")]],
      [[plain("m", "MODE", "dev")], [plain("a", "TOKEN", "api-token")]]
    );

    expect(restored.changes.map(change => change.serviceIndex)).toEqual([1]);
  });

  it("leaves a kept secret alone when this browser gave back no value under its name", () => {
    expect(restoredEnvOf([[kept("token", "TOKEN", "s0_e0")]], [[plain("other", "OTHER", "x")]])).toEqual({ count: 0, changes: [] });
  });

  it("leaves a secret added in the form alone, since its value was typed here", () => {
    const added = { id: "new", key: "TOKEN", value: "typed-here", isSecret: true };

    expect(restoredEnvOf([[added]], [[plain("t", "TOKEN", "from-this-browser")]])).toEqual({ count: 0, changes: [] });
  });

  it("leaves a reserved variable alone, since the form never shows it", () => {
    expect(restoredEnvOf([[kept("SSH_PUBKEY", "SSH_PUBKEY", "s0_e0")]], [[plain("SSH_PUBKEY", "SSH_PUBKEY", "ssh-ed25519 AAAA")]])).toEqual({
      count: 0,
      changes: []
    });
  });

  it("leaves a service this browser's copy lacks alone", () => {
    expect(restoredEnvOf([[kept("token", "TOKEN", "s0_e0")]], [])).toEqual({ count: 0, changes: [] });
  });

  it("gives back nothing a secret still stands on in this browser's copy", () => {
    expect(restoredEnvOf([[kept("token", "TOKEN", "s0_e0")]], [[kept("t", "TOKEN", "s0_e0")]])).toEqual({ count: 0, changes: [] });
  });

  it("leaves a secret the user named alone, even where this browser gave back a value under its key", () => {
    expect(restoredEnvOf([[kept("token", "TOKEN", "API_TOKEN")]], [[plain("t", "TOKEN", "from-this-browser")]])).toEqual({ count: 0, changes: [] });
  });

  it("gives back only the rows the api sealed on its own in a service that changes", () => {
    const restored = restoredEnvOf(
      [[kept("port", "PORT", "s0_e0"), kept("token", "TOKEN", "API_TOKEN"), plain("mode", "MODE", "dev"), kept("region", "REGION", "s0_e3")]],
      [[plain("p", "PORT", "3000"), plain("t", "TOKEN", "from-this-browser"), plain("m", "MODE", "prod")]]
    );

    expect(restored).toEqual({
      count: 1,
      changes: [
        {
          serviceIndex: 0,
          env: [
            { id: "port", key: "PORT", value: "3000", isSecret: false },
            kept("token", "TOKEN", "API_TOKEN"),
            plain("mode", "MODE", "dev"),
            kept("region", "REGION", "s0_e3")
          ]
        }
      ]
    });
  });
});

describe(holdsVariablesProtectedByDefault.name, () => {
  it.each(["s0_e2", "s1_e0_2"])("is true for a kept secret named %s, as the api names a value it sealed on its own", name => {
    expect(holdsVariablesProtectedByDefault([[kept("id", "TOKEN", name)]])).toBe(true);
  });

  it("is false for a secret the user named", () => {
    expect(holdsVariablesProtectedByDefault([[kept("id", "API_TOKEN", "API_TOKEN")]])).toBe(false);
  });

  it("is false for a plain variable", () => {
    expect(holdsVariablesProtectedByDefault([[plain("id", "PORT", "3000")]])).toBe(false);
  });

  it("is false for a reserved variable, which the form never shows", () => {
    expect(holdsVariablesProtectedByDefault([[kept("SSH_PUBKEY", "SSH_PUBKEY", "s0_e0")]])).toBe(false);
  });
});

function kept(id: string, key: string, name: string): EnvironmentVariableType {
  return { id, key, value: `ac-secret://${name}`, isSecret: true };
}

function plain(id: string, key: string, value: string): EnvironmentVariableType {
  return { id, key, value };
}
