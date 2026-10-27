import type { NetworkStore } from "@akashnetwork/network-store";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import yaml from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DeploymentNameBackfillService } from "@src/services/deployment-name-backfill/deployment-name-backfill.service";
import { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import { deploymentData } from "@src/utils/deploymentData";
import type { SdlSecretsSealContext } from "@src/utils/sdl/sealSdlSecrets";
import type { DEPENDENCIES } from "./DeploymentCopyCleanup";
import { DeploymentCopyCleanup } from "./DeploymentCopyCleanup";
import type { DeploymentRecord } from "./deploymentCopyFate";

import { render, waitFor } from "@testing-library/react";
import { helloWorldManifest } from "@tests/seeders/manifest";

const ADDRESS = "akash1owner";
const NETWORK = "testnet";
const PLAIN_SDL = ["version: '2.0'", "services:", "  web:", "    image: nginx", "    env:", '      - "MODE=dev"'].join("\n");
const UNRESOLVED_REFERENCE_SDL = PLAIN_SDL.replace("MODE=dev", "API_TOKEN=ac-secret://API_TOKEN");
const PRIVATE_REGISTRY_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: registry.example.com/web",
  "    credentials:",
  "      host: registry.example.com",
  "      username: someone",
  "      password: hunter2hunter2",
  "    env:",
  '      - "MODE=dev"'
].join("\n");
const SEALING_CONTEXT: SdlSecretsSealContext = { kid: "sdl-secrets.v1", sub: "user-1", jwk: { kty: "RSA", n: "n", e: "AQAB" } };
const MISMATCH = new ApiError(
  422,
  { message: "This SDL does not describe what the deployment is running", code: "deployment_definition_mismatch" },
  "POST → 422"
);
const ALREADY_RECORDED = new ApiError(409, { message: "The console already holds a definition", code: "deployment_definition_exists" }, "POST → 409");
const STALE_SEAL = new ApiError(409, { message: "The sealing key is no longer current", code: "conflict" }, "POST → 409");
const RECORDING_UNAVAILABLE = new ApiError(503, { message: "The version this deployment runs could not be read, please retry" }, "POST → 503");
const NAME_REFUSED = new ApiError(400, { message: "The name is not valid" }, "PATCH → 400");

describe(DeploymentCopyCleanup.name, () => {
  it("forgets a copy the console's definition replaces and reports what it checked", async () => {
    const { storage, track } = setup({ copies: { "100": { manifest: PLAIN_SDL, name: "web" } }, records: { "100": recordOf() } });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
  });

  it("forgets a closed deployment's only copy without recording it", async () => {
    const { storage, track, createDeploymentDefinition } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      records: { "100": recordOf({ deployment: { state: "closed", hash: "chain-hash" }, consoleSettings: null }) }
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
    expect(createDeploymentDefinition).not.toHaveBeenCalled();
    expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
  });

  describe("when a copy is the only definition of a running deployment", () => {
    it("records it with the console, then forgets it", async () => {
      const { storage, track, createDeploymentDefinition, sealSdlSecrets } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) }
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, recorded: 1 })));
      expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEALING_CONTEXT, sdl: PLAIN_SDL, secrets: {} });
      expect(createDeploymentDefinition).toHaveBeenCalledWith({ dseq: "100", data: { sdl: PLAIN_SDL, sealedSecrets: "sealed-1" } });
      expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    });

    it("seals its registry credentials and leaves its variables readable", async () => {
      const { createDeploymentDefinition, sealSdlSecrets, track } = setup({
        copies: { "100": { manifest: PRIVATE_REGISTRY_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) }
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, recorded: 1 })));
      const recordedSdl = createDeploymentDefinition.mock.calls[0][0].data.sdl;
      expect(recordedSdl).toContain("MODE=dev");
      expect(recordedSdl).not.toContain("hunter2hunter2");
      expect(sealSdlSecrets).toHaveBeenCalledWith(
        expect.objectContaining({ sdl: recordedSdl, secrets: { REGISTRY_USERNAME: "someone", REGISTRY_PASSWORD: "hunter2hunter2" } })
      );
    });

    it("keeps one referring to a secret it holds no value for, for the user to save, and asks the api nothing about it", async () => {
      const { storage, track, createDeploymentDefinition, getSDLSecretsContext } = setup({
        copies: { "100": { manifest: UNRESOLVED_REFERENCE_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) }
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, keptRunning: 1 })));
      expect(getSDLSecretsContext).not.toHaveBeenCalled();
      expect(createDeploymentDefinition).not.toHaveBeenCalled();
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("forgets it when the console finds it does not match what runs", async () => {
      const { storage, track } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) },
        createOutcomes: [MISMATCH]
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, recordRefused: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    });

    it("keeps it for the next visit when the console cannot record it now", async () => {
      const { storage, track } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) },
        createOutcomes: [RECORDING_UNAVAILABLE]
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, recordFailed: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("keeps it for the next visit when it cannot be sealed", async () => {
      const { storage, track, createDeploymentDefinition } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) },
        sealFailure: new Error("key service unreachable")
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, recordFailed: 1 })));
      expect(createDeploymentDefinition).not.toHaveBeenCalled();
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("counts it as recorded when the console recorded a definition meanwhile, and forgets it", async () => {
      const { storage, track } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) },
        createOutcomes: [ALREADY_RECORDED]
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, recorded: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    });

    it("reseals once when the api refuses a seal made against a retired key", async () => {
      const { createDeploymentDefinition, track } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) },
        createOutcomes: [STALE_SEAL, "success"]
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, recorded: 1 })));
      expect(createDeploymentDefinition).toHaveBeenCalledTimes(2);
    });

    it("sends the name it holds once the definition is recorded, then forgets it", async () => {
      const { storage, track, patchDeployment } = setup({
        copies: { "100": { manifest: PLAIN_SDL, name: "web" } },
        records: { "100": recordOf({ consoleSettings: null, name: null }) }
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, recorded: 1, namesSent: 1 })));
      expect(patchDeployment).toHaveBeenCalledWith({ dseq: "100", data: { name: "web" } });
      expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    });

    it("has the deployment read again once its definition is recorded", async () => {
      const { track, invalidateQueries, api } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: { "100": recordOf({ consoleSettings: null }) } });

      await waitFor(() => expect(track).toHaveBeenCalled());
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getDeployment.getKey() });
    });

    it("asks the mutation cache not to report a refusal it expects, while leaving a server fault reported", async () => {
      const { queryClient, track } = setup({
        copies: { "100": { manifest: PLAIN_SDL, name: "web" } },
        records: { "100": recordOf({ consoleSettings: null, name: null }) }
      });

      await waitFor(() => expect(track).toHaveBeenCalled());
      const metas = queryClient
        .getMutationCache()
        .getAll()
        .map(mutation => mutation.options.meta);
      expect(metas).toEqual([SKIP_REPORTING_BELOW_SERVER_ERROR, SKIP_REPORTING_BELOW_SERVER_ERROR, SKIP_REPORTING_BELOW_SERVER_ERROR]);
    });
  });

  describe("when the console's definition is not the one a running deployment runs", () => {
    it("keeps a copy that is, until the deployment closes", async () => {
      const { storage, track } = await setupCopyTheChainRuns({ state: "active" });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, keptRunning: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("forgets that copy once the deployment is closed", async () => {
      const { storage, track } = await setupCopyTheChainRuns({ state: "closed" });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    });

    it("still sends the name a kept copy holds", async () => {
      const { track, patchDeployment } = await setupCopyTheChainRuns({ state: "active", name: "storefront" });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, keptRunning: 1, namesSent: 1 })));
      expect(patchDeployment).toHaveBeenCalledWith({ dseq: "100", data: { name: "storefront" } });
    });

    it("forgets a copy the chain does not run either", async () => {
      const { storage, track } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: { sdl: PLAIN_SDL, manifestVersion: "older-hash" } }) }
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    });

    async function setupCopyTheChainRuns(input: { state: string; name?: string }) {
      const browserSdl = helloWorldWithEnv("TOKEN=from-this-browser");
      const chainHash = await deploymentData.getManifestVersion(yaml.load(browserSdl));

      return setup({
        copies: { "100": { manifest: browserSdl, name: input.name } },
        records: {
          "100": recordOf({
            deployment: { state: input.state, hash: chainHash },
            name: input.name ? null : "web",
            consoleSettings: { sdl: helloWorldWithEnv("TOKEN=from-an-older-update"), manifestVersion: "older-hash" }
          })
        }
      });
    }
  });

  describe("when a copy holds a name the console lacks", () => {
    it("sends the name, then forgets the copy", async () => {
      const { storage, track, patchDeployment } = setup({
        copies: { "100": { manifest: PLAIN_SDL, name: "  web  " } },
        records: { "100": recordOf({ name: null }) }
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, namesSent: 1 })));
      expect(patchDeployment).toHaveBeenCalledExactlyOnceWith({ dseq: "100", data: { name: "web" } });
      expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    });

    it("has every surface read the names again once one is sent, even when other copies changed nothing", async () => {
      const { track, invalidateQueries, api } = setup({
        copies: { "100": { name: "web" }, "200": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ name: null }), "200": recordOf() }
      });

      await waitFor(() => expect(track).toHaveBeenCalled());
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getDeployment.getKey() });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.listDeploymentNames.getKey() });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.listDeployments.getKey() });
    });

    it("keeps the copy for the next visit when the api refuses the name", async () => {
      const { storage, track } = setup({
        copies: { "100": { manifest: PLAIN_SDL, name: "web" } },
        records: { "100": recordOf({ name: null }) },
        nameRefusal: NAME_REFUSED
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, nameFailed: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("keeps the copy when the rename dialog already took the name over this session", async () => {
      const { storage, track, patchDeployment } = setup({
        copies: { "100": { manifest: PLAIN_SDL, name: "web" } },
        records: { "100": recordOf({ name: null }) },
        isNameAlreadyBackfilled: true
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, nameFailed: 1 })));
      expect(patchDeployment).not.toHaveBeenCalled();
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });
  });

  it("has nothing read again when the check changed nothing the console holds", async () => {
    const { track, invalidateQueries } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: { "100": recordOf() } });

    await waitFor(() => expect(track).toHaveBeenCalled());
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("forgets a copy whose deployment the api does not know, without reporting it", async () => {
    const { storage, track, onQueryError } = setup({ copies: { "100": { manifest: PLAIN_SDL, name: "web" } }, records: {} });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    expect(onQueryError).not.toHaveBeenCalled();
  });

  it.each([
    ["fails to answer", new ApiError(500, undefined, "GET /v1/deployments/100 → 500")],
    ["refuses to answer", new ApiError(401, undefined, "GET /v1/deployments/100 → 401")],
    ["cannot be reached", new TypeError("Failed to fetch")]
  ])("keeps a copy for the next visit when the api %s for its deployment", async (_case, failure) => {
    const { storage, track } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: {}, failure });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, unchecked: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
  });

  it("asks the query cache not to report a refusal it expects, while leaving a server fault reported", async () => {
    const { queryClient, track, api } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: { "100": recordOf() } });

    await waitFor(() => expect(track).toHaveBeenCalled());
    expect(queryClient.getQueryCache().find({ queryKey: api.v1.getDeployment.getKey({ dseq: "100" }) })?.meta).toBe(SKIP_REPORTING_BELOW_SERVER_ERROR);
  });

  it("asks the api rather than trusting an answer it cached earlier", async () => {
    const { track, createDeploymentDefinition } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      records: { "100": recordOf({ consoleSettings: null }) },
      cached: { "100": recordOf() }
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, recorded: 1 })));
    expect(createDeploymentDefinition).toHaveBeenCalled();
  });

  it("forgets a copy it cannot read without asking the api, counts it, and checks the copies after it", async () => {
    const { storage, track, getDeployment } = setup({
      copies: { "200": { manifest: PLAIN_SDL, name: "web" } },
      unreadableCopies: ["100"],
      records: { "100": recordOf(), "200": recordOf() }
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 2, forgotten: 2, unreadable: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    expect(storage.getItem(copyKey(ADDRESS, "200"))).toBeNull();
    expect(getDeployment.mock.calls.map(([{ dseq }]) => dseq)).toEqual(["200"]);
  });

  it("checks a copy another tab removed meanwhile as an empty one", async () => {
    const { track, getDeployment } = setup({ copies: {}, vanishedCopies: ["100"], records: { "100": recordOf() } });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
    expect(getDeployment).toHaveBeenCalledWith({ dseq: "100" });
  });

  it("keeps a copy whose check fails unexpectedly, and checks the copies after it", async () => {
    const { storage, track } = setup({
      copies: { "100": { manifest: PLAIN_SDL }, "200": { manifest: PLAIN_SDL } },
      records: { "100": recordOf(), "200": recordOf() },
      failingRemovals: ["100"]
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 2, forgotten: 1, unchecked: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    expect(storage.getItem(copyKey(ADDRESS, "200"))).toBeNull();
  });

  it("leaves another wallet's copies alone", async () => {
    const { storage, track } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      otherWalletCopies: { "200": { manifest: PLAIN_SDL } },
      records: { "100": recordOf(), "200": recordOf() }
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
    expect(storage.getItem(copyKey("akash1other", "200"))).not.toBeNull();
  });

  it("forgets every copy kept under another network, before any wallet is known", async () => {
    const { storage } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, otherNetworkCopies: { "200": { manifest: PLAIN_SDL } }, records: {}, address: "" });

    await waitFor(() => expect(storage.getItem(copyKey(ADDRESS, "200", "mainnet"))).toBeNull());
    expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
  });

  it("asks the api nothing and reports nothing when this browser holds no copy", async () => {
    const { getDeployment, track } = setup({ copies: {}, records: {} });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getDeployment).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("waits for the wallet before checking its copies", async () => {
    const { getDeployment, rerenderWith, track } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: { "100": recordOf() }, address: "" });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getDeployment).not.toHaveBeenCalled();

    rerenderWith(ADDRESS);

    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
  });

  it("checks a wallet's copies once per page load", async () => {
    const { getDeployment, rerenderWith, track } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      records: {},
      failure: new TypeError("Failed to fetch")
    });

    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    rerenderWith(ADDRESS);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getDeployment).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("checks the next wallet's copies when the wallet changes", async () => {
    const { getDeployment, rerenderWith, track } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      otherWalletCopies: { "200": { manifest: PLAIN_SDL } },
      records: { "100": recordOf(), "200": recordOf() }
    });

    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    rerenderWith("akash1other");

    await waitFor(() => expect(track).toHaveBeenCalledTimes(2));
    expect(getDeployment).toHaveBeenLastCalledWith({ dseq: "200" });
  });

  it("does not check a wallet again when it comes back within the same page load", async () => {
    const { getDeployment, rerenderWith, track } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      otherWalletCopies: { "200": { manifest: PLAIN_SDL } },
      records: { "200": recordOf() },
      failure: new TypeError("Failed to fetch")
    });

    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    rerenderWith("akash1other");
    await waitFor(() => expect(track).toHaveBeenCalledTimes(2));
    rerenderWith(ADDRESS);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getDeployment).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledTimes(2);
  });

  it("asks the api about one copy at a time", async () => {
    const { getDeployment, answer } = setup({
      copies: { "100": { manifest: PLAIN_SDL }, "200": { manifest: PLAIN_SDL } },
      records: { "100": recordOf(), "200": recordOf() },
      isAnsweredByHand: true
    });

    await waitFor(() => expect(getDeployment).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getDeployment).toHaveBeenCalledTimes(1);

    answer("100");

    await waitFor(() => expect(getDeployment).toHaveBeenCalledTimes(2));
  });

  it("records one copy at a time", async () => {
    const { createDeploymentDefinition, finishRecording } = setup({
      copies: { "100": { manifest: PLAIN_SDL }, "200": { manifest: PLAIN_SDL } },
      records: { "100": recordOf({ consoleSettings: null }), "200": recordOf({ consoleSettings: null }) },
      isRecordedByHand: true
    });

    await waitFor(() => expect(createDeploymentDefinition).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(createDeploymentDefinition).toHaveBeenCalledTimes(1);

    finishRecording("100");

    await waitFor(() => expect(createDeploymentDefinition).toHaveBeenCalledTimes(2));
  });

  function recordOf(overrides: Partial<DeploymentRecord> = {}): DeploymentRecord {
    return {
      deployment: { state: "active", hash: "chain-hash" },
      name: "web",
      consoleSettings: { sdl: PLAIN_SDL, manifestVersion: "chain-hash" },
      ...overrides
    };
  }

  function helloWorldWithEnv(entry: string) {
    const document = yaml.load(helloWorldManifest) as { services: { web: Record<string, unknown> } };
    document.services.web.env = [entry];
    return yaml.dump(document);
  }

  function reportOf(
    counts: Partial<
      Record<
        "copies" | "forgotten" | "unreadable" | "keptRunning" | "recordFailed" | "nameFailed" | "unchecked" | "recorded" | "recordRefused" | "namesSent",
        number
      >
    >
  ) {
    return {
      category: "deployments",
      copies: 0,
      forgotten: 0,
      unreadable: 0,
      keptRunning: 0,
      recordFailed: 0,
      nameFailed: 0,
      unchecked: 0,
      recorded: 0,
      recordRefused: 0,
      namesSent: 0,
      ...counts
    };
  }

  function copyKey(address: string, dseq: string, network = NETWORK) {
    return `${network}/${address}/deployments/${dseq}.data`;
  }

  function setup(input: {
    copies: Record<string, { manifest?: string; name?: string }>;
    otherWalletCopies?: Record<string, { manifest?: string; name?: string }>;
    otherNetworkCopies?: Record<string, { manifest?: string; name?: string }>;
    unreadableCopies?: string[];
    vanishedCopies?: string[];
    failingRemovals?: string[];
    records: Record<string, DeploymentRecord>;
    cached?: Record<string, DeploymentRecord>;
    failure?: Error;
    address?: string;
    isAnsweredByHand?: boolean;
    isRecordedByHand?: boolean;
    createOutcomes?: Array<ApiError | "success">;
    sealFailure?: Error;
    nameRefusal?: Error;
    isNameAlreadyBackfilled?: boolean;
  }) {
    const entries = new Map<string, string>();
    (input.unreadableCopies ?? []).forEach(dseq => entries.set(copyKey(ADDRESS, dseq), "{not json"));
    Object.entries(input.copies).forEach(([dseq, copy]) => entries.set(copyKey(ADDRESS, dseq), JSON.stringify(copy)));
    Object.entries(input.otherWalletCopies ?? {}).forEach(([dseq, copy]) => entries.set(copyKey("akash1other", dseq), JSON.stringify(copy)));
    Object.entries(input.otherNetworkCopies ?? {}).forEach(([dseq, copy]) => entries.set(copyKey(ADDRESS, dseq, "mainnet"), JSON.stringify(copy)));
    const vanishedKeys = (input.vanishedCopies ?? []).map(dseq => copyKey(ADDRESS, dseq));
    const failingRemovalKeys = new Set((input.failingRemovals ?? []).map(dseq => copyKey(ADDRESS, dseq)));
    const listedKeys = () => [...entries.keys(), ...vanishedKeys];
    const storage: Storage = {
      get length() {
        return listedKeys().length;
      },
      key: index => listedKeys()[index] ?? null,
      getItem: key => entries.get(key) ?? null,
      setItem: (key, value) => {
        entries.set(key, value);
      },
      removeItem: key => {
        if (failingRemovalKeys.has(key)) throw new DOMException("The operation is insecure.", "SecurityError");
        entries.delete(key);
      },
      clear: () => entries.clear()
    };
    const deploymentLocalStorage = new DeploymentStorageService(storage, mock<NetworkStore>({ selectedNetworkId: NETWORK }));

    const records = new Map(Object.entries(input.records));
    const recordTheDefinition = (dseq: string, sdl: string) => {
      const record = records.get(dseq) as DeploymentRecord;
      records.set(dseq, { ...record, consoleSettings: { sdl, manifestVersion: record.deployment.hash } });
    };

    const pendingAnswers = new Map<string, () => void>();
    const answerFor = (dseq: string) => {
      if (input.failure) return Promise.reject(input.failure);
      const record = records.get(dseq);
      return record ? Promise.resolve({ data: record }) : Promise.reject(new ApiError(404, undefined, `GET /v1/deployments/${dseq} → 404`));
    };
    const getDeployment = vi.fn(({ dseq }: { dseq: string }) =>
      input.isAnsweredByHand ? new Promise(resolve => pendingAnswers.set(dseq, () => resolve(answerFor(dseq)))) : answerFor(dseq)
    );

    const getSDLSecretsContext = vi.fn(async () => ({ data: SEALING_CONTEXT }));
    let seals = 0;
    const sealSdlSecrets = vi.fn(async () => {
      if (input.sealFailure) throw input.sealFailure;
      return `sealed-${++seals}`;
    });

    const createOutcomes = [...(input.createOutcomes ?? [])];
    const pendingRecordings = new Map<string, () => void>();
    const recordingOf = ({ dseq, data }: { dseq: string; data: { sdl: string; sealedSecrets: string } }) => {
      const outcome = createOutcomes.shift() ?? "success";
      if (outcome === "success" || outcome === ALREADY_RECORDED) recordTheDefinition(dseq, data.sdl);
      return outcome === "success" ? Promise.resolve({ data: {} }) : Promise.reject(outcome);
    };
    const createDeploymentDefinition = vi.fn((variables: { dseq: string; data: { sdl: string; sealedSecrets: string } }) =>
      input.isRecordedByHand ? new Promise(resolve => pendingRecordings.set(variables.dseq, () => resolve(recordingOf(variables)))) : recordingOf(variables)
    );

    const patchDeployment = vi.fn(async ({ dseq, data }: { dseq: string; data: { name: string } }) => {
      if (input.nameRefusal) throw input.nameRefusal;
      records.set(dseq, { ...(records.get(dseq) as DeploymentRecord), name: data.name });
      return { data: {} };
    });

    const api = createProxy({
      v1: { getDeployment, getSDLSecretsContext, createDeploymentDefinition, patchDeployment, listDeploymentNames: vi.fn(), listDeployments: vi.fn() }
    }) as unknown as ReturnType<typeof DEPENDENCIES.useServices>["api"];
    const track = vi.fn();
    const deploymentNameBackfill = new DeploymentNameBackfillService();
    if (input.isNameAlreadyBackfilled) Object.keys(input.copies).forEach(dseq => void deploymentNameBackfill.preempt(ADDRESS, dseq));

    /** `satisfies` type-checks the fields against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api, deploymentLocalStorage, deploymentNameBackfill, analyticsService: mock<AnalyticsService>({ track }) } satisfies Partial<
      ReturnType<typeof DEPENDENCIES.useServices>
    >;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;
    const onQueryError = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      queryCache: new QueryCache({ onError: onQueryError })
    });
    Object.entries(input.cached ?? {}).forEach(([dseq, record]) =>
      queryClient.setQueryData<{ data: DeploymentRecord }>(api.v1.getDeployment.getKey({ dseq }), { data: record })
    );
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const useQueryClient: typeof DEPENDENCIES.useQueryClient = () => queryClient;
    let address = input.address ?? ADDRESS;
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address });
    const dependencies = { useServices, useWallet, useQueryClient, sealSdlSecrets };

    const cleanup = () => (
      <QueryClientProvider client={queryClient}>
        <DeploymentCopyCleanup dependencies={dependencies} />
      </QueryClientProvider>
    );
    const { rerender } = render(cleanup());
    const rerenderWith = (nextAddress: string) => {
      address = nextAddress;
      rerender(cleanup());
    };
    const answer = (dseq: string) => pendingAnswers.get(dseq)?.();
    const finishRecording = (dseq: string) => pendingRecordings.get(dseq)?.();

    return {
      storage: { getItem: (key: string) => entries.get(key) ?? null },
      api,
      getDeployment,
      getSDLSecretsContext,
      createDeploymentDefinition,
      patchDeployment,
      sealSdlSecrets,
      queryClient,
      invalidateQueries,
      onQueryError,
      track,
      rerenderWith,
      answer,
      finishRecording
    };
  }
});
