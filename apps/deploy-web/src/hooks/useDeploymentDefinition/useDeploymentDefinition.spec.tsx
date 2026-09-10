import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import type { DEPENDENCIES } from "./useDeploymentDefinition";
import { useDeploymentDefinition } from "./useDeploymentDefinition";

import { buildWallet } from "@tests/seeders/wallet";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const API_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=from-the-api"\n';
const LOCAL_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=from-this-browser"\n';
const WITHHELD_VALUES_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=ac-secret://s0_e0"\n';
const BLANK_ENV_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN="\n';
const PARTLY_BLANK_ENV_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN="\n      - "REGION=us-east-1"\n';

describe(useDeploymentDefinition.name, () => {
  it("prefers the sdl the api recorded over this browser's own copy", async () => {
    const { result } = setup({ apiSdl: API_SDL, localSdl: LOCAL_SDL });

    await vi.waitFor(() => expect(result.current.source).toBe("api"));
    expect(result.current.sdl).toBe(API_SDL);
  });

  it("reports resolving until the api answers, so no caller shows the local copy first", () => {
    const { result } = setup({ apiSdl: API_SDL, localSdl: LOCAL_SDL });

    expect(result.current.source).toBe("resolving");
    expect(result.current.sdl).toBeUndefined();
  });

  it("carries the deployment name from this browser even when the sdl comes from the api", async () => {
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

  describe("when the api holds no sdl it can stand behind", () => {
    it.each([
      ["it recorded none", null],
      ["its values were withheld as references", WITHHELD_VALUES_SDL],
      ["every env value it holds is blank", BLANK_ENV_SDL],
      ["one of the env values it holds is blank", PARTLY_BLANK_ENV_SDL]
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

  it("asks the api for nothing when there is no dseq", () => {
    const { getDeployment, result } = setup({ dseq: null, localSdl: LOCAL_SDL });

    expect(getDeployment).not.toHaveBeenCalled();
    expect(result.current.source).toBe("local");
  });

  function setup(input: {
    dseq?: string | null;
    apiSdl?: string | null;
    apiError?: Error;
    chainManifestVersion?: string;
    recordedManifestVersion?: string;
    localSdl?: string;
    localName?: string;
  }) {
    const chainManifestVersion = input.chainManifestVersion ?? "on-chain-version";
    const recordedManifestVersion = input.recordedManifestVersion ?? chainManifestVersion;
    const getDeployment = vi.fn(() => {
      if (input.apiError) return Promise.reject(input.apiError);
      return Promise.resolve({
        data: {
          deployment: { hash: chainManifestVersion },
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

    const { result } = setupQuery(() => useDeploymentDefinition(input.dseq === undefined ? "123" : input.dseq, { useServices, useWallet }), {
      services: { api: () => api, deploymentLocalStorage: () => deploymentLocalStorage, queryClient: () => queryClient }
    });

    return { result, getDeployment, deploymentLocalStorage, onQueryError };
  }
});
