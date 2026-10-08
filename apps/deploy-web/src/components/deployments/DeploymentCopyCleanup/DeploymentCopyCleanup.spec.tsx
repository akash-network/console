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
const BEFORE_THE_LAST_RESTORE_DAY_ENDS = new Date("2026-11-09T23:59:59.999Z");
const AFTER_THE_LAST_RESTORE_DAY = new Date("2026-11-10T00:00:00Z");
const MISMATCH = new ApiError(
  422,
  { message: "This SDL does not describe what the deployment is running", code: "deployment_definition_mismatch" },
  "POST → 422"
);
const ALREADY_RECORDED = new ApiError(409, { message: "The console already holds a definition", code: "deployment_definition_exists" }, "POST → 409");
const STALE_SEAL = new ApiError(409, { message: "The sealing key is no longer current", code: "conflict" }, "POST → 409");
const NAME_REFUSED = new ApiError(400, { message: "The name is not valid" }, "PATCH → 400");

describe(DeploymentCopyCleanup.name, () => {
  it("forgets a copy the console's definition replaces and reports what it checked", async () => {
    const { storage, track } = setup({ copies: { "100": { manifest: PLAIN_SDL, name: "web" } }, records: { "100": recordOf() } });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
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

    it("keeps one referring to a secret it holds no value for, and asks the api nothing about it", async () => {
      const { storage, track, createDeploymentDefinition, getSDLSecretsContext } = setup({
        copies: { "100": { manifest: UNRESOLVED_REFERENCE_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) }
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, onlyInBrowser: 1, onlyInBrowserActive: 1 })));
      expect(getSDLSecretsContext).not.toHaveBeenCalled();
      expect(createDeploymentDefinition).not.toHaveBeenCalled();
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("keeps it and counts the failure when the console finds it does not match what runs", async () => {
      const { storage, track } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) },
        createOutcomes: [MISMATCH]
      });

      await waitFor(() =>
        expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, onlyInBrowser: 1, onlyInBrowserActive: 1, recordFailed: 1 }))
      );
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("keeps it when it cannot be sealed", async () => {
      const { storage, track, createDeploymentDefinition } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) },
        sealFailure: new Error("key service unreachable")
      });

      await waitFor(() =>
        expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, onlyInBrowser: 1, onlyInBrowserActive: 1, recordFailed: 1 }))
      );
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

    it("reads the record from the api again after recording, rather than from the cache", async () => {
      const { track } = setup({
        copies: { "100": { manifest: PLAIN_SDL } },
        records: { "100": recordOf({ consoleSettings: null }) },
        cachesReadsForever: true
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1, recorded: 1 })));
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

  it("leaves a closed deployment's only copy alone, and does not count it as running", async () => {
    const { storage, track, createDeploymentDefinition } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      records: { "100": recordOf({ deployment: { state: "closed", hash: "chain-hash" }, consoleSettings: null }) }
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, onlyInBrowser: 1 })));
    expect(createDeploymentDefinition).not.toHaveBeenCalled();
    expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
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

    it("keeps the copy when the api refuses the name, without reading its record again", async () => {
      const { storage, track, getDeployment } = setup({
        copies: { "100": { manifest: PLAIN_SDL, name: "web" } },
        records: { "100": recordOf({ name: null }) },
        nameRefusal: NAME_REFUSED
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, holdsName: 1 })));
      expect(getDeployment).toHaveBeenCalledTimes(1);
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("keeps the copy when another surface already sent its name this session", async () => {
      const { storage, track, patchDeployment } = setup({
        copies: { "100": { manifest: PLAIN_SDL, name: "web" } },
        records: { "100": recordOf({ name: null }) },
        isNameAlreadyBackfilled: true
      });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, holdsName: 1 })));
      expect(patchDeployment).not.toHaveBeenCalled();
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });
  });

  it("counts a copy kept for a name the console refused apart from one kept beside a record it cannot use", async () => {
    const { track } = setup({
      copies: { "100": { manifest: PLAIN_SDL, name: "web" }, "200": { manifest: PLAIN_SDL } },
      records: { "100": recordOf({ name: null }), "200": recordOf({ consoleSettings: { sdl: "services: [not, a, map", manifestVersion: "chain-hash" } }) },
      nameRefusal: NAME_REFUSED
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 2, holdsName: 1, kept: 1 })));
  });

  describe("when a copy is kept to restore variables the console protected", () => {
    it("keeps it while this browser still offers the restore", async () => {
      const { storage, track } = await setupRestorableCopy({ now: BEFORE_THE_LAST_RESTORE_DAY_ENDS });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, restoresVariables: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    });

    it("forgets it once the last day of the restore is over", async () => {
      const { storage, track } = await setupRestorableCopy({ now: AFTER_THE_LAST_RESTORE_DAY });

      await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
      expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
    });

    async function setupRestorableCopy(input: { now: Date }) {
      const browserSdl = helloWorldWithEnv("TOKEN=from-this-browser");
      const chainHash = await deploymentData.getManifestVersion(yaml.load(browserSdl));

      return setup({
        copies: { "100": { manifest: browserSdl } },
        records: {
          "100": recordOf({
            deployment: { state: "active", hash: chainHash },
            consoleSettings: { sdl: helloWorldWithEnv("TOKEN=ac-secret://s0_e0"), manifestVersion: chainHash }
          })
        },
        now: input.now
      });
    }
  });

  it("keeps a copy whose deployment the api does not know, without reporting it", async () => {
    const { storage, track, onQueryError } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: {} });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, kept: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
    expect(onQueryError).not.toHaveBeenCalled();
  });

  it("keeps a copy when the api fails to answer for its deployment", async () => {
    const { storage, track } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      records: {},
      failure: new ApiError(500, undefined, "GET /v1/deployments/100 → 500")
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, kept: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
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
    const { getDeployment, rerenderWith, track } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: {} });

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
      records: { "200": recordOf() }
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

  it("keeps a copy it cannot read without asking the api, counts it, and checks the copies after it", async () => {
    const { storage, track, getDeployment } = setup({
      copies: { "200": { manifest: PLAIN_SDL, name: "web" } },
      unreadableCopies: ["100"],
      records: { "100": recordOf(), "200": recordOf() }
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 2, forgotten: 1, unreadable: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).toBe("{not json");
    expect(storage.getItem(copyKey(ADDRESS, "200"))).toBeNull();
    expect(getDeployment.mock.calls.map(([{ dseq }]) => dseq)).toEqual(["200"]);
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
        | "copies"
        | "forgotten"
        | "onlyInBrowser"
        | "onlyInBrowserActive"
        | "restoresVariables"
        | "holdsName"
        | "kept"
        | "unreadable"
        | "recorded"
        | "recordFailed"
        | "namesSent",
        number
      >
    >
  ) {
    return {
      category: "deployments",
      copies: 0,
      forgotten: 0,
      onlyInBrowser: 0,
      onlyInBrowserActive: 0,
      restoresVariables: 0,
      holdsName: 0,
      kept: 0,
      unreadable: 0,
      recorded: 0,
      recordFailed: 0,
      namesSent: 0,
      ...counts
    };
  }

  function copyKey(address: string, dseq: string) {
    return `testnet/${address}/deployments/${dseq}.data`;
  }

  function setup(input: {
    copies: Record<string, { manifest?: string; name?: string }>;
    otherWalletCopies?: Record<string, { manifest?: string; name?: string }>;
    unreadableCopies?: string[];
    records: Record<string, DeploymentRecord>;
    failure?: Error;
    address?: string;
    isAnsweredByHand?: boolean;
    isRecordedByHand?: boolean;
    createOutcomes?: Array<ApiError | "success">;
    sealFailure?: Error;
    nameRefusal?: Error;
    isNameAlreadyBackfilled?: boolean;
    cachesReadsForever?: boolean;
    now?: Date;
  }) {
    const entries = new Map<string, string>();
    (input.unreadableCopies ?? []).forEach(dseq => entries.set(copyKey(ADDRESS, dseq), "{not json"));
    Object.entries(input.copies).forEach(([dseq, copy]) => entries.set(copyKey(ADDRESS, dseq), JSON.stringify(copy)));
    Object.entries(input.otherWalletCopies ?? {}).forEach(([dseq, copy]) => entries.set(copyKey("akash1other", dseq), JSON.stringify(copy)));
    const storage: Storage = {
      get length() {
        return entries.size;
      },
      key: index => [...entries.keys()][index] ?? null,
      getItem: key => entries.get(key) ?? null,
      setItem: (key, value) => {
        entries.set(key, value);
      },
      removeItem: key => {
        entries.delete(key);
      },
      clear: () => entries.clear()
    };
    const deploymentLocalStorage = new DeploymentStorageService(storage, mock<NetworkStore>({ selectedNetworkId: "testnet" }));

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

    const api = createProxy({ v1: { getDeployment, getSDLSecretsContext, createDeploymentDefinition, patchDeployment } }) as unknown as ReturnType<
      typeof DEPENDENCIES.useServices
    >["api"];
    const track = vi.fn();
    const deploymentNameBackfill = new DeploymentNameBackfillService();
    if (input.isNameAlreadyBackfilled) Object.keys(input.copies).forEach(dseq => void deploymentNameBackfill.enqueue(ADDRESS, dseq, async () => undefined));

    /** `satisfies` type-checks the fields against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api, deploymentLocalStorage, deploymentNameBackfill, analyticsService: mock<AnalyticsService>({ track }) } satisfies Partial<
      ReturnType<typeof DEPENDENCIES.useServices>
    >;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;
    const onQueryError = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: input.cachesReadsForever ? Infinity : 0 } },
      queryCache: new QueryCache({ onError: onQueryError })
    });
    const useQueryClient: typeof DEPENDENCIES.useQueryClient = () => queryClient;
    let address = input.address ?? ADDRESS;
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address });
    const now = () => input.now ?? new Date("2026-10-08T12:00:00Z");
    const dependencies = { useServices, useWallet, useQueryClient, sealSdlSecrets, now };

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
      getDeployment,
      getSDLSecretsContext,
      createDeploymentDefinition,
      patchDeployment,
      sealSdlSecrets,
      queryClient,
      onQueryError,
      track,
      rerenderWith,
      answer,
      finishRecording
    };
  }
});
