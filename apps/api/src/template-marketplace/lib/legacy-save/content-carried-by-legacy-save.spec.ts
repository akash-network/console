import { describe, expect, it } from "vitest";

import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { contentCarriedByLegacySave } from "./content-carried-by-legacy-save";

describe(contentCarriedByLegacySave.name, () => {
  it.each<[string, Parameters<typeof contentCarriedByLegacySave>[1]]>([
    ["no content at all", {}],
    ["no readme and no asked values", { readme: null, askedValues: [] }]
  ])("carries nothing and checks nothing for a version with %s", (_case, current) => {
    expect(contentCarriedByLegacySave(buildSdl(["API_KEY=hunter2"]), current)).toEqual({});
  });

  it("carries the readme and asked values of a version that has them", () => {
    const askedValues = [secretAskedValue("API_KEY")];

    expect(contentCarriedByLegacySave(buildSdl(["API_KEY"]), { readme: "# Readme", askedValues })).toEqual({ readme: "# Readme", askedValues });
  });

  it("carries a readme alone with no asked values", () => {
    expect(contentCarriedByLegacySave(buildSdl(), { readme: "# Readme" })).toEqual({ readme: "# Readme", askedValues: [] });
  });

  it("takes a submitted description as the readme it carries, and an empty one as none", () => {
    expect(contentCarriedByLegacySave(buildSdl(), { readme: "# Old" }, "# New")).toEqual({ readme: "# New", askedValues: [] });
    expect(contentCarriedByLegacySave(buildSdl(), { readme: "# Old" }, "")).toEqual({ readme: null, askedValues: [] });
  });

  it("carries nothing for a version with no content even when a description is submitted", () => {
    expect(contentCarriedByLegacySave(buildSdl(), { readme: null, askedValues: [] }, "# New")).toEqual({});
  });

  it("carries asked values alone with no readme", () => {
    const askedValues = [secretAskedValue("API_KEY")];

    expect(contentCarriedByLegacySave(buildSdl(["API_KEY"]), { askedValues })).toEqual({ readme: null, askedValues });
  });

  it("refuses a new SDL that puts a plaintext value in a secret it carries", () => {
    const issue = 'Variable "API_KEY" is a secret, so web.env.API_KEY must not carry a value';

    expect(() => contentCarriedByLegacySave(buildSdl(["API_KEY=hunter2"]), { askedValues: [secretAskedValue("API_KEY")] })).toThrow(
      expect.objectContaining({ status: 400, errorCode: "template_invalid", data: { issues: [issue] } })
    );
  });

  it.each([
    ["an env entry written as a mapping", "API_KEY: hunter2"],
    ["an env entry that is not text", "12345"]
  ])("refuses a new SDL that hides a secret it carries behind %s", (_case, entry) => {
    expect(() => contentCarriedByLegacySave(buildSdl([entry]), { askedValues: [secretAskedValue("API_KEY")] })).toThrow(
      expect.objectContaining({ status: 400, data: { issues: ['Service "web" fills in a secret, so its env must list NAME=value entries'] } })
    );
  });

  it("refuses a new SDL that drops the service an asked value fills in or carries a registry password", () => {
    const askedValue = { ...secretAskedValue("API_KEY"), bindings: [{ service: "api", env: "API_KEY" }] };

    expect(() => contentCarriedByLegacySave(buildSdl([], ["host: docker.io", "username: me", "password: hunter2"]), { askedValues: [askedValue] })).toThrow(
      expect.objectContaining({
        data: {
          issues: [
            'Variable "API_KEY" fills in service "api", which the SDL does not define',
            'Service "web" carries a registry password; save it as a secret instead'
          ]
        }
      })
    );
  });

  function secretAskedValue(key: string): AskedValue {
    return { key, label: key, type: "secret", required: true, bindings: [{ service: "web", env: key }] };
  }

  function buildSdl(env: string[] = [], credentials: string[] = []) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      "    image: nginx:1.25",
      ...(env.length ? ["    env:", ...env.map(entry => `      - ${entry}`)] : []),
      ...(credentials.length ? ["    credentials:", ...credentials.map(entry => `      ${entry}`)] : [])
    ].join("\n");
  }
});
