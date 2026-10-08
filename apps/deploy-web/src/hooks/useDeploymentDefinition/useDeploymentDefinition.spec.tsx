import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import yaml from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import { deploymentData } from "@src/utils/deploymentData";
import { DEPENDENCIES, isUsableDeploymentDefinition, sdlToRedeploy, useDeploymentDefinition } from "./useDeploymentDefinition";

import { helloWorldManifest } from "@tests/seeders/manifest";
import { buildWallet } from "@tests/seeders/wallet";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const API_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=from-the-api"\n';
const LOCAL_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=from-this-browser"\n';
const WITHHELD_VALUES_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=ac-secret://s0_e0"\n';
const SEALED_CREDENTIALS_SDL =
  'version: "2.0"\nservices:\n  web:\n    image: nginx\n    credentials:\n      host: docker.io\n      username: someone\n      password: "ac-secret://s0_c_password"\n    env:\n      - "TOKEN=from-the-api"\n';
const BLANK_ENV_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN="\n';
const PARTLY_BLANK_ENV_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN="\n      - "REGION=us-east-1"\n';
const AFTER_THE_LAST_RESTORE_DAY = new Date("2026-11-10T00:00:00Z");
const REFERENCE_BESIDE_BLANK_ENV_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=ac-secret://s0_e0"\n      - "VAEURLS="\n';

describe(useDeploymentDefinition.name, () => {
  it("prefers the sdl the api recorded over this browser's own copy", async () => {
    const { result } = setup({ apiSdl: API_SDL, localSdl: LOCAL_SDL });

    await vi.waitFor(() => expect(result.current.source).toBe("api"));
    expect(result.current.sdl).toBe(API_SDL);
  });

  it("carries the manifest version the api recorded beside its copy, so a patch can be guarded on it", async () => {
    const { result } = setup({ apiSdl: API_SDL, chainManifestVersion: "recorded-version" });

    await vi.waitFor(() => expect(result.current.source).toBe("api"));
    expect(result.current.manifestVersion).toBe("recorded-version");
  });

  it("carries no manifest version beside this browser's copy, which the api never recorded", async () => {
    const { result } = setup({ apiSdl: API_SDL, recordedManifestVersion: "version-1", chainManifestVersion: "version-2", localSdl: LOCAL_SDL });

    await vi.waitFor(() => expect(result.current.source).toBe("local"));
    expect(result.current.manifestVersion).toBeUndefined();
  });

  it("carries no manifest version beside an absent definition", async () => {
    const { result } = setup({ apiSdl: API_SDL, recordedManifestVersion: "version-1", chainManifestVersion: "version-2" });

    await vi.waitFor(() => expect(result.current.source).toBe("absent"));
    expect(result.current.manifestVersion).toBeUndefined();
  });

  it("reports resolving until the api answers, so no caller shows the local copy first", () => {
    const { result } = setup({ apiSdl: API_SDL, localSdl: LOCAL_SDL });

    expect(result.current.source).toBe("resolving");
    expect(result.current.sdl).toBeUndefined();
  });

  it("carries the name from this browser while the api's answer is still resolving", () => {
    const { result } = setup({ apiSdl: API_SDL, localName: "my-deployment" });

    expect(result.current.source).toBe("resolving");
    expect(result.current.name).toBe("my-deployment");
  });

  it("prefers the name the api holds over the one this browser recorded", async () => {
    const { result } = setup({ apiSdl: API_SDL, apiName: "renamed-elsewhere", localSdl: LOCAL_SDL, localName: "my-deployment" });

    await vi.waitFor(() => expect(result.current.name).toBe("renamed-elsewhere"));
    expect(result.current.source).toBe("api");
  });

  it("carries the name from this browser when the api holds none", async () => {
    const { result } = setup({ apiSdl: API_SDL, localSdl: LOCAL_SDL, localName: "my-deployment" });

    await vi.waitFor(() => expect(result.current.source).toBe("api"));
    expect(result.current.name).toBe("my-deployment");
  });

  it("falls back when the api's copy describes a manifest version the chain has moved past", async () => {
    const { result } = setup({
      apiSdl: API_SDL,
      recordedManifestVersion: "version-1",
      chainManifestVersion: "version-2",
      localSdl: LOCAL_SDL
    });

    await vi.waitFor(() => expect(result.current.source).toBe("local"));
    expect(result.current.sdl).toBe(LOCAL_SDL);
  });

  describe("when the api's copy leaves an env value blank", () => {
    it.each([
      ["a caller that signs it", false],
      ["a caller that accepts references", true]
    ])("serves it to %s once it hashes to the version the chain runs, since the value was left blank on purpose", async (_case, acceptReferences) => {
      const { result } = setup({ apiSdl: PARTLY_BLANK_ENV_SDL, apiCopyVersion: "on-chain-version", localSdl: LOCAL_SDL, acceptReferences });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.sdl).toBe(PARTLY_BLANK_ENV_SDL);
    });

    it("reports resolving after the api answers while it hashes the copy", async () => {
      const { result } = setup({ apiSdl: PARTLY_BLANK_ENV_SDL, apiName: "named-by-the-api", localSdl: LOCAL_SDL, isReadingApiCopy: true });

      await vi.waitFor(() => expect(result.current.name).toBe("named-by-the-api"));
      expect(result.current.source).toBe("resolving");
      expect(result.current.sdl).toBeUndefined();
    });

    it("serves a copy whose blank value sits beside a reference without hashing it, since the api blanked values only before it sealed any", async () => {
      const { result } = setup({ apiSdl: REFERENCE_BESIDE_BLANK_ENV_SDL, localSdl: LOCAL_SDL, acceptReferences: true, isReadingApiCopy: true });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.sdl).toBe(REFERENCE_BESIDE_BLANK_ENV_SDL);
    });

    it("does not hash a copy the chain has moved past", async () => {
      const { result } = setup({
        apiSdl: PARTLY_BLANK_ENV_SDL,
        recordedManifestVersion: "an-older-version",
        localSdl: LOCAL_SDL,
        isReadingApiCopy: true
      });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
    });
  });

  it("does not wait on hashing the api's copy when it leaves no value blank", async () => {
    const { result } = setup({ apiSdl: API_SDL, isReadingApiCopy: true });

    await vi.waitFor(() => expect(result.current.source).toBe("api"));
  });

  describe("when the api holds no sdl it can stand behind", () => {
    it.each([
      ["it recorded none", null],
      ["its values were withheld as references", WITHHELD_VALUES_SDL],
      ["every env value it holds was blanked away", BLANK_ENV_SDL],
      ["one of the env values it holds was blanked away", PARTLY_BLANK_ENV_SDL]
    ])("falls back to this browser's copy when %s", async (_case, apiSdl) => {
      const { result } = setup({ apiSdl, localSdl: LOCAL_SDL });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
      expect(result.current.sdl).toBe(LOCAL_SDL);
    });

    it.each([401, 403, 404])("falls back to this browser's copy on a %s without reporting it", async status => {
      const { result, onQueryError } = setup({ apiError: new ApiError(status, {}, `GET /v1/deployments/{dseq} → ${status}`), localSdl: LOCAL_SDL });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
      expect(result.current.sdl).toBe(LOCAL_SDL);
      expect(onQueryError).not.toHaveBeenCalled();
    });

    it("reports a server error rather than silencing it, and still falls back", async () => {
      const { result, onQueryError } = setup({ apiError: new ApiError(500, {}, "GET /v1/deployments/{dseq} → 500"), localSdl: LOCAL_SDL });

      await vi.waitFor(() => expect(onQueryError).toHaveBeenCalled());
      expect(result.current.source).toBe("local");
      expect(result.current.sdl).toBe(LOCAL_SDL);
    });

    it("falls back without reporting when the browser cannot reach the api at all", async () => {
      const { result, onQueryError } = setup({ apiError: new TypeError("Failed to fetch"), localSdl: LOCAL_SDL });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
      expect(result.current.sdl).toBe(LOCAL_SDL);
      expect(onQueryError).not.toHaveBeenCalled();
    });
  });

  describe("when neither source holds an sdl", () => {
    it("reports absent", async () => {
      const { result } = setup({ apiSdl: null, localSdl: undefined });

      await vi.waitFor(() => expect(result.current.source).toBe("absent"));
      expect(result.current.sdl).toBeUndefined();
    });

    it("still hands back the withheld-value sdl so the user can see the document's shape", async () => {
      const { result } = setup({ apiSdl: WITHHELD_VALUES_SDL, localSdl: undefined });

      await vi.waitFor(() => expect(result.current.source).toBe("absent"));
      expect(result.current.sdl).toBe(WITHHELD_VALUES_SDL);
    });

    it("serves a copy whose withheld value sits beside a real one, so the update view can guard it", async () => {
      const { result } = setup({ apiSdl: PARTLY_BLANK_ENV_SDL, localSdl: undefined });

      await vi.waitFor(() => expect(result.current.source).toBe("absent"));
      expect(result.current.sdl).toBe(PARTLY_BLANK_ENV_SDL);
    });
  });

  describe("when the caller accepts references, as a redeploy does", () => {
    it("serves the api's copy even though its values are withheld as references", async () => {
      const { result } = setup({ apiSdl: WITHHELD_VALUES_SDL, localSdl: LOCAL_SDL, acceptReferences: true });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.sdl).toBe(WITHHELD_VALUES_SDL);
    });

    it("still falls back when the api's copy blanks a value away, which no redeploy can restore", async () => {
      const { result } = setup({ apiSdl: BLANK_ENV_SDL, localSdl: LOCAL_SDL, acceptReferences: true });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
    });

    it("fills the values the api withholds from this browser's copy once that copy is the one the chain runs", async () => {
      const { result } = setup({ apiSdl: WITHHELD_VALUES_SDL, localSdl: LOCAL_SDL, acceptReferences: true });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.sdl).toBe(WITHHELD_VALUES_SDL);
      expect(result.current.restoredSdl).toContain("TOKEN=from-this-browser");
    });

    it("restores nothing once the last day this browser offers the restore is over", async () => {
      const { result } = setup({ apiSdl: WITHHELD_VALUES_SDL, localSdl: LOCAL_SDL, acceptReferences: true, now: AFTER_THE_LAST_RESTORE_DAY });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.sdl).toBe(WITHHELD_VALUES_SDL);
      expect(result.current.restoredSdl).toBeUndefined();
    });

    it("does not wait on this browser's copy once the last day of the restore is over", async () => {
      const { result } = setup({
        apiSdl: WITHHELD_VALUES_SDL,
        localSdl: LOCAL_SDL,
        acceptReferences: true,
        isReadingBrowserCopy: true,
        now: AFTER_THE_LAST_RESTORE_DAY
      });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
    });

    it("restores nothing from a copy of this browser's the chain has moved past", async () => {
      const { result } = setup({ apiSdl: WITHHELD_VALUES_SDL, localSdl: LOCAL_SDL, acceptReferences: true, browserCopyVersion: "an-older-version" });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.restoredSdl).toBeUndefined();
    });

    it("reports resolving while it reads which version this browser's copy is", () => {
      const { result } = setup({ apiSdl: WITHHELD_VALUES_SDL, localSdl: LOCAL_SDL, acceptReferences: true, isReadingBrowserCopy: true });

      return vi.waitFor(() => {
        expect(result.current.source).toBe("resolving");
        expect(result.current.sdl).toBeUndefined();
      });
    });

    it("does not wait on this browser's copy when the api withholds nothing", async () => {
      const { result } = setup({ apiSdl: API_SDL, localSdl: LOCAL_SDL, acceptReferences: true, isReadingBrowserCopy: true });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.restoredSdl).toBeUndefined();
    });

    it("does not wait on this browser's copy when the api withholds only a registry credential", async () => {
      const { result } = setup({ apiSdl: SEALED_CREDENTIALS_SDL, localSdl: LOCAL_SDL, acceptReferences: true, isReadingBrowserCopy: true });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.restoredSdl).toBeUndefined();
    });

    it("does not wait on this browser's copy when the api's copy is not the one the chain runs", async () => {
      const { result } = setup({
        apiSdl: WITHHELD_VALUES_SDL,
        localSdl: LOCAL_SDL,
        acceptReferences: true,
        recordedManifestVersion: "an-older-version",
        isReadingBrowserCopy: true
      });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
    });

    describe("when this browser hashes its own copy", () => {
      it("fills the values the api sealed from a copy that hashes to the version the chain runs", async () => {
        const localSdl = helloWorldWithEnv("TOKEN=from-this-browser");
        const chainManifestVersion = await deploymentData.getManifestVersion(yaml.load(localSdl));
        const { result, onQueryError } = setup({
          apiSdl: helloWorldWithEnv("TOKEN=ac-secret://s0_e0"),
          localSdl,
          chainManifestVersion,
          acceptReferences: true,
          hashesCopies: true
        });

        await vi.waitFor(() => expect(result.current.restoredSdl).toContain("TOKEN=from-this-browser"));
        expect(result.current.source).toBe("api");
        expect(onQueryError).not.toHaveBeenCalled();
      });

      it.each([
        ["does not parse", "services: [not, a, map"],
        ["builds no manifest", LOCAL_SDL]
      ])("restores nothing from a copy that %s, and reports nothing", async (_case, localSdl) => {
        const { result, onQueryError } = setup({ apiSdl: WITHHELD_VALUES_SDL, localSdl, acceptReferences: true, hashesCopies: true });

        await vi.waitFor(() => expect(result.current.source).toBe("api"));
        expect(result.current.restoredSdl).toBeUndefined();
        expect(onQueryError).not.toHaveBeenCalled();
      });
    });
  });

  describe("when this browser hashes the api's copy", () => {
    it("serves a copy whose blank value was written that way, as its hash matches the version the chain runs", async () => {
      const apiSdl = helloWorldWithEnv("VAEURLS=");
      const chainManifestVersion = await deploymentData.getManifestVersion(yaml.load(apiSdl));
      const { result, onQueryError } = setup({ apiSdl, localSdl: LOCAL_SDL, chainManifestVersion, hashesCopies: true });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.sdl).toBe(apiSdl);
      expect(onQueryError).not.toHaveBeenCalled();
    });

    it("falls back from a copy whose value the api blanked away, as its hash matches no version the chain runs", async () => {
      const chainManifestVersion = await deploymentData.getManifestVersion(yaml.load(helloWorldWithEnv("TOKEN=a-real-token")));
      const { result } = setup({ apiSdl: helloWorldWithEnv("TOKEN="), localSdl: LOCAL_SDL, chainManifestVersion, hashesCopies: true });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
      expect(result.current.sdl).toBe(LOCAL_SDL);
    });
  });

  it("restores nothing for a caller that does not accept references", async () => {
    const { result } = setup({ apiSdl: WITHHELD_VALUES_SDL, localSdl: LOCAL_SDL, isReadingBrowserCopy: true });

    await vi.waitFor(() => expect(result.current.source).toBe("local"));
    expect(result.current.restoredSdl).toBeUndefined();
  });

  describe("whether the console holds a definition of its own", () => {
    it("says it holds one beside the copy it serves", async () => {
      const { result } = setup({ apiSdl: API_SDL });

      await vi.waitFor(() => expect(result.current.source).toBe("api"));
      expect(result.current.isRecordedByConsole).toBe(true);
    });

    it("says it holds one even when this browser's copy is served instead", async () => {
      const { result } = setup({ apiSdl: API_SDL, recordedManifestVersion: "version-1", chainManifestVersion: "version-2", localSdl: LOCAL_SDL });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
      expect(result.current.isRecordedByConsole).toBe(true);
    });

    it.each([
      ["this browser holds a copy", LOCAL_SDL],
      ["nothing holds a copy", undefined]
    ])("says it holds none when %s", async (_case, localSdl) => {
      const { result } = setup({ apiSdl: null, localSdl });

      await vi.waitFor(() => expect(result.current.source).not.toBe("resolving"));
      expect(result.current.isRecordedByConsole).toBe(false);
    });

    it("leaves it unknown while the api answers", () => {
      const { result } = setup({ apiSdl: null });

      expect(result.current.isRecordedByConsole).toBeUndefined();
    });

    it("leaves it unknown when the api could not be asked", async () => {
      const { result } = setup({ apiError: new ApiError(404, {}, "GET /v1/deployments/{dseq} → 404"), localSdl: LOCAL_SDL });

      await vi.waitFor(() => expect(result.current.source).toBe("local"));
      expect(result.current.isRecordedByConsole).toBeUndefined();
    });
  });

  it("asks the api for nothing when there is no dseq", () => {
    const { getDeployment, result } = setup({ dseq: null, localSdl: LOCAL_SDL });

    expect(getDeployment).not.toHaveBeenCalled();
    expect(result.current.source).toBe("local");
  });

  function helloWorldWithEnv(entry: string) {
    const document = yaml.load(helloWorldManifest) as { services: { web: Record<string, unknown> } };
    document.services.web.env = [entry];
    return yaml.dump(document);
  }

  function setup(input: {
    dseq?: string | null;
    apiSdl?: string | null;
    apiName?: string;
    apiError?: Error;
    chainManifestVersion?: string;
    recordedManifestVersion?: string;
    localSdl?: string;
    localName?: string;
    acceptReferences?: boolean;
    browserCopyVersion?: string;
    isReadingBrowserCopy?: boolean;
    apiCopyVersion?: string;
    isReadingApiCopy?: boolean;
    hashesCopies?: boolean;
    now?: Date;
  }) {
    const chainManifestVersion = input.chainManifestVersion ?? "on-chain-version";
    const recordedManifestVersion = input.recordedManifestVersion ?? chainManifestVersion;
    const getDeployment = vi.fn(() => {
      if (input.apiError) return Promise.reject(input.apiError);
      return Promise.resolve({
        data: {
          deployment: { hash: chainManifestVersion },
          name: input.apiName ?? null,
          consoleSettings: input.apiSdl ? { sdl: input.apiSdl, manifestVersion: recordedManifestVersion } : null
        }
      });
    });
    const api = createProxy({ v1: { getDeployment } }) as unknown as ApiService;

    const deploymentLocalStorage = mock<DeploymentStorageService>({
      get: vi.fn().mockReturnValue(input.localSdl || input.localName ? { manifest: input.localSdl, name: input.localName } : null)
    });

    const onQueryError = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
      queryCache: new QueryCache({ onError: onQueryError })
    });

    const useWallet: typeof DEPENDENCIES.useWallet = () => buildWallet({ address: "akash1test" });
    /** `satisfies` type-checks both fields against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api, deploymentLocalStorage } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    const useResolvedName: typeof DEPENDENCIES.useResolvedDeploymentName = dseq =>
      useResolvedDeploymentName(dseq, { useServices, useDeploymentNameBackfill: () => undefined });
    const readCopyVersion: typeof DEPENDENCIES.useManifestVersionOf = sdl => {
      if (sdl && sdl === input.apiSdl) return { version: input.isReadingApiCopy ? undefined : input.apiCopyVersion, isReading: !!input.isReadingApiCopy };

      return {
        version: sdl && !input.isReadingBrowserCopy ? input.browserCopyVersion ?? chainManifestVersion : undefined,
        isReading: !!sdl && !!input.isReadingBrowserCopy
      };
    };
    const useManifestVersionOf = input.hashesCopies ? DEPENDENCIES.useManifestVersionOf : readCopyVersion;
    const now = () => input.now ?? new Date("2026-10-08T12:00:00Z");

    const { result } = setupQuery(
      () =>
        useDeploymentDefinition(
          input.dseq === undefined ? "123" : input.dseq,
          { acceptReferences: input.acceptReferences },
          { useServices, useWallet, useResolvedDeploymentName: useResolvedName, useManifestVersionOf, now }
        ),
      {
        services: { api: () => api, deploymentLocalStorage: () => deploymentLocalStorage, queryClient: () => queryClient }
      }
    );

    return { result, getDeployment, deploymentLocalStorage, onQueryError };
  }
});

describe(isUsableDeploymentDefinition.name, () => {
  it.each(["api", "local"] as const)("accepts a definition resolved from the %s source", source => {
    expect(isUsableDeploymentDefinition({ sdl: API_SDL, name: undefined, source })).toBe(true);
  });

  it.each(["resolving", "absent"] as const)("rejects a %s definition even when it carries an inspection-only sdl", source => {
    expect(isUsableDeploymentDefinition({ sdl: WITHHELD_VALUES_SDL, name: undefined, source })).toBe(false);
  });

  it("rejects a usable source that carries no sdl", () => {
    expect(isUsableDeploymentDefinition({ sdl: undefined, name: undefined, source: "local" })).toBe(false);
  });
});

describe(sdlToRedeploy.name, () => {
  it("redeploys the values this browser gave back", () => {
    expect(sdlToRedeploy({ sdl: WITHHELD_VALUES_SDL, restoredSdl: LOCAL_SDL, name: undefined, source: "api" })).toBe(LOCAL_SDL);
  });

  it("redeploys the served copy when nothing was given back", () => {
    expect(sdlToRedeploy({ sdl: WITHHELD_VALUES_SDL, name: undefined, source: "api" })).toBe(WITHHELD_VALUES_SDL);
  });
});
