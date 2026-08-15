import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AKASH_SDK_MODULES, IGNORED_TYPE_URLS, isIgnoredTypeUrl, registeredProtoTypes } from "@src/proto/type-catalog";

const requireFromSpec = createRequire(import.meta.url);

describe("akash proto type coverage", () => {
  it("keeps the catalog's module map in lockstep with the installed chain SDK", () => {
    const discovered = discoverSdkAkashModuleNames();

    expect(
      discovered,
      "the installed @akashnetwork/chain-sdk ships a different set of Akash proto modules than the catalog imports - update AKASH_SDK_MODULES in src/proto/type-catalog.ts and register or ignore the new types"
    ).toEqual(Object.keys(AKASH_SDK_MODULES).sort());
  });

  it("registers or ignores every Akash type the installed chain SDK ships", () => {
    const registeredTypeUrls = new Set(registeredProtoTypes.map(([typeUrl]) => typeUrl));

    const unhandled = collectSdkAkashTypeUrls().filter(typeUrl => !registeredTypeUrls.has(typeUrl) && !isIgnoredTypeUrl(typeUrl));

    expect(unhandled, "register these types in src/proto/type-catalog.ts or add them to its ignore list with a documented reason").toEqual([]);
  });

  it("keeps registered types out of the ignore list", () => {
    const shadowed = registeredProtoTypes.map(([typeUrl]) => typeUrl).filter(typeUrl => isIgnoredTypeUrl(typeUrl));

    expect(shadowed, "ignored types are never decoded, so registering them is dead weight - drop one side").toEqual([]);
  });

  it("has no stale Akash entries in the exact ignore list", () => {
    const sdkTypeUrls = new Set(collectSdkAkashTypeUrls());

    const stale = [...IGNORED_TYPE_URLS].filter(typeUrl => typeUrl.startsWith("/akash.") && !sdkTypeUrls.has(typeUrl));

    expect(stale, "these ignored Akash types no longer exist in the installed chain SDK - remove them from IGNORED_TYPE_URLS").toEqual([]);
  });

  /**
   * The universe of Akash types comes from the SDK's dist folder, not from the catalog's imports,
   * so a module missing from AKASH_SDK_MODULES still surfaces its types here instead of shrinking
   * the check into a vacuous pass. Off-chain `index.provider.akash.*` modules are excluded by the
   * basename filter: they carry `akash.`-prefixed $types but are the provider gRPC API, never tx messages.
   */
  function discoverSdkAkashModuleNames(): string[] {
    const protosDir = path.dirname(requireFromSpec.resolve("@akashnetwork/chain-sdk/private-types/akash.v1"));

    return fs
      .readdirSync(protosDir)
      .filter(file => file.startsWith("index.akash.") && !file.endsWith(".map"))
      .map(file => file.replace(/^index\./, "").replace(/\.(cjs|js)$/, ""))
      .sort();
  }

  function collectSdkAkashTypeUrls(): string[] {
    return discoverSdkAkashModuleNames().flatMap(name => {
      const module = requireFromSpec(`@akashnetwork/chain-sdk/private-types/${name}`) as object;

      return Object.values(module).flatMap(value =>
        value !== null && typeof value === "object" && "$type" in value && typeof value.$type === "string" ? ["/" + value.$type] : []
      );
    });
  }
});
