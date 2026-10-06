import type { NetworkStore } from "@akashnetwork/network-store";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import type { DEPENDENCIES } from "./DeploymentCopyCleanup";
import { DeploymentCopyCleanup } from "./DeploymentCopyCleanup";
import type { DeploymentRecord } from "./deploymentCopyFate";

import { render, waitFor } from "@testing-library/react";

const ADDRESS = "akash1owner";
const PLAIN_SDL = ["version: '2.0'", "services:", "  web:", "    image: nginx", "    env:", '      - "MODE=dev"'].join("\n");

describe(DeploymentCopyCleanup.name, () => {
  it("forgets a copy the console's definition replaces and reports what it checked", async () => {
    const { storage, track } = setup({ copies: { "100": { manifest: PLAIN_SDL, name: "web" } }, records: { "100": recordOf() } });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, forgotten: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).toBeNull();
  });

  it("keeps a copy that is the only definition of a running deployment, and counts it", async () => {
    const { storage, track } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: { "100": recordOf({ consoleSettings: null }) } });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, onlyInBrowser: 1, onlyInBrowserActive: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
  });

  it("does not count a closed deployment's only copy as running", async () => {
    const { track } = setup({
      copies: { "100": { manifest: PLAIN_SDL } },
      records: { "100": recordOf({ deployment: { state: "closed", hash: "chain-hash" }, consoleSettings: null }) }
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, onlyInBrowser: 1 })));
  });

  it("counts a copy kept for a name the console lacks apart from one kept beside a record it cannot use", async () => {
    const { track } = setup({
      copies: { "100": { manifest: PLAIN_SDL, name: "web" }, "200": { manifest: PLAIN_SDL } },
      records: { "100": recordOf({ name: null }), "200": recordOf({ consoleSettings: { sdl: "services: [not, a, map", manifestVersion: "chain-hash" } }) }
    });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 2, holdsName: 1, kept: 1 })));
  });

  it("keeps a copy whose deployment the api does not know", async () => {
    const { storage, track } = setup({ copies: { "100": { manifest: PLAIN_SDL } }, records: {} });

    await waitFor(() => expect(track).toHaveBeenCalledWith("deployment_copies_checked", reportOf({ copies: 1, kept: 1 })));
    expect(storage.getItem(copyKey(ADDRESS, "100"))).not.toBeNull();
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
    const { getDeployment, rerenderWith, track } = setup({
      copies: { "100": { manifest: PLAIN_SDL, name: "web" } },
      records: { "100": recordOf({ name: null }) }
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
      copies: { "100": { manifest: PLAIN_SDL, name: "web" } },
      otherWalletCopies: { "200": { manifest: PLAIN_SDL } },
      records: { "100": recordOf({ name: null }), "200": recordOf() }
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

  function reportOf(
    counts: Partial<
      Record<"copies" | "forgotten" | "onlyInBrowser" | "onlyInBrowserActive" | "restoresVariables" | "holdsName" | "kept" | "unreadable", number>
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

    const pendingAnswers = new Map<string, () => void>();
    const answerFor = (dseq: string) => {
      if (input.failure) return Promise.reject(input.failure);
      const record = input.records[dseq];
      return record ? Promise.resolve({ data: record }) : Promise.reject(new ApiError(404, undefined, `GET /v1/deployments/${dseq} → 404`));
    };
    const getDeployment = vi.fn(({ dseq }: { dseq: string }) =>
      input.isAnsweredByHand ? new Promise(resolve => pendingAnswers.set(dseq, () => resolve(answerFor(dseq)))) : answerFor(dseq)
    );
    const api = createProxy({ v1: { getDeployment } }) as unknown as ReturnType<typeof DEPENDENCIES.useServices>["api"];
    const track = vi.fn();

    /** `satisfies` type-checks the fields against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api, deploymentLocalStorage, analyticsService: mock<AnalyticsService>({ track }) } satisfies Partial<
      ReturnType<typeof DEPENDENCIES.useServices>
    >;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const useQueryClient: typeof DEPENDENCIES.useQueryClient = () => queryClient;
    let address = input.address ?? ADDRESS;
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address });

    const { rerender } = render(<DeploymentCopyCleanup dependencies={{ useServices, useWallet, useQueryClient }} />);
    const rerenderWith = (nextAddress: string) => {
      address = nextAddress;
      rerender(<DeploymentCopyCleanup dependencies={{ useServices, useWallet, useQueryClient }} />);
    };
    const answer = (dseq: string) => pendingAnswers.get(dseq)?.();

    return { storage: { getItem: (key: string) => entries.get(key) ?? null }, getDeployment, track, rerenderWith, answer };
  }
});
