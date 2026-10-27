import { describe, expect, it } from "vitest";

import type { EnvironmentVariableType } from "@src/types/sdlBuilder/sdlBuilder";
import { holdsVariablesProtectedByDefault } from "./protectedVariables";

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
