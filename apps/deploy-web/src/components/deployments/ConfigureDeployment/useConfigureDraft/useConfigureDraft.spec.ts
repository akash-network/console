import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { ConfigureDraftContent } from "./useConfigureDraft";
import { createConfigureDraft, DEPENDENCIES, LEGACY_DRAFT_KEY_PREFIX, SAVE_DELAY_MS, useConfigureDraft } from "./useConfigureDraft";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const ACCOUNT_DRAFT: ConfigureDraftContent = {
  sdl: "account: sdl",
  name: "web",
  runtimeLimitHours: 24,
  inheritSecretsFrom: "1234",
  startingSdl: "starting: sdl",
  placementRegions: { dcloud: ["us-east", "eu-west"] }
};

describe(useConfigureDraft.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("draft id", () => {
    it("resolves the draft id from the URL", async () => {
      const { result, replace } = setup({ intent: { draftId: "from-url" }, accountDrafts: { "from-url": ACCOUNT_DRAFT } });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.draftId).toBe("from-url");
      expect(replace).not.toHaveBeenCalled();
    });

    it("mints a draft id when the URL carries none and writes it into the URL", async () => {
      const { result, replace, getConfigureDraft } = setup({ mintedDraftId: "minted" });

      expect(result.current.draftId).toBe("minted");
      expect(result.current.isLoading).toBe(false);
      await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("draftId=minted"), undefined, { shallow: true }));
      expect(getConfigureDraft).not.toHaveBeenCalled();
    });

    it("stays loaded once the minted id lands in the URL, since the account has nothing under it", async () => {
      const { result, replace, getConfigureDraft, followReplacedUrl } = setup({ mintedDraftId: "minted" });
      await waitFor(() => expect(replace).toHaveBeenCalled());

      act(() => followReplacedUrl());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.draftId).toBe("minted");
      expect(getConfigureDraft).not.toHaveBeenCalled();
    });

    it("continues under a new id when the account cannot answer for the URL's draft, so that draft is never overwritten", async () => {
      const { result, replace, updateConfigureDraft, followReplacedUrl } = setup({
        intent: { draftId: "unreadable" },
        mintedDraftId: "fresh",
        failure: new ApiError(500, undefined, "GET /v1/configure-drafts/unreadable → 500")
      });

      await waitFor(() => expect(result.current.draftId).toBe("fresh"));
      expect(result.current.persistedSdl).toBeUndefined();
      await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("draftId=fresh"), undefined, { shallow: true }));
      act(() => followReplacedUrl());
      expect(result.current.isLoading).toBe(false);

      act(() => result.current.save("typed: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));

      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledWith({ draftId: "fresh", data: expect.objectContaining({ sdl: "typed: sdl" }) }));
    });
  });

  describe("reading", () => {
    it("reports loading while the account's draft is read, then exposes everything it holds", async () => {
      const { result } = setup({ intent: { draftId: "resumed" }, accountDrafts: { resumed: ACCOUNT_DRAFT } });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.persistedSdl).toBeUndefined();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({
        persistedSdl: "account: sdl",
        persistedName: "web",
        persistedRuntimeLimitHours: 24,
        persistedInheritSecretsFrom: "1234",
        persistedStartingSdl: "starting: sdl",
        persistedPlacementRegions: { dcloud: ["us-east", "eu-west"] }
      });
    });

    it("has nothing persisted for a draft the account does not have", async () => {
      const { result } = setup({ intent: { draftId: "unknown" } });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.draftId).toBe("unknown");
      expect(result.current.persistedSdl).toBeUndefined();
    });

    it("picks up a draft this browser kept from before drafts moved to the account", async () => {
      const { result } = setup({
        intent: { draftId: "legacy" },
        legacyDrafts: { legacy: JSON.stringify({ ...ACCOUNT_DRAFT, sdl: "browser: sdl", updatedAt: 1 }) }
      });

      await waitFor(() => expect(result.current.persistedSdl).toBe("browser: sdl"));
      expect(result.current).toMatchObject({
        persistedName: "web",
        persistedRuntimeLimitHours: 24,
        persistedInheritSecretsFrom: "1234",
        persistedStartingSdl: "starting: sdl",
        persistedPlacementRegions: { dcloud: ["us-east", "eu-west"] }
      });
    });

    it("prefers the account's copy over one this browser still keeps", async () => {
      const { result } = setup({
        intent: { draftId: "both" },
        accountDrafts: { both: ACCOUNT_DRAFT },
        legacyDrafts: { both: JSON.stringify({ sdl: "browser: sdl" }) }
      });

      await waitFor(() => expect(result.current.persistedSdl).toBe("account: sdl"));
    });

    it.each([
      ["an unreadable entry", "{not json"],
      ["an entry without an sdl", JSON.stringify({ name: "web" })],
      ["a null entry", "null"]
    ])("ignores %s this browser kept", async (_case, raw) => {
      const { result } = setup({ intent: { draftId: "broken" }, legacyDrafts: { broken: raw } });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.persistedSdl).toBeUndefined();
    });

    it("leaves out fields this browser kept in a shape a draft never has", async () => {
      const { result } = setup({
        intent: { draftId: "odd" },
        legacyDrafts: {
          odd: JSON.stringify({
            sdl: "browser: sdl",
            name: 7,
            runtimeLimitHours: "24",
            inheritSecretsFrom: 1,
            startingSdl: [],
            placementRegions: { a: ["x"], b: "y" }
          })
        }
      });

      await waitFor(() => expect(result.current.persistedSdl).toBe("browser: sdl"));
      expect(result.current).toMatchObject({
        persistedName: undefined,
        persistedRuntimeLimitHours: undefined,
        persistedInheritSecretsFrom: undefined,
        persistedStartingSdl: undefined,
        persistedPlacementRegions: undefined
      });
    });

    it("works without browser storage", async () => {
      const { result } = setup({ intent: { draftId: "nostorage" }, getStorage: () => undefined });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.persistedSdl).toBeUndefined();
    });

    it("exposes a draft handed over from outside the screen at once, without asking the account", () => {
      const draftId = createConfigureDraft("uploaded: sdl", { name: "upload", inheritSecretsFrom: "99" }, mintingDependencies("handed-over"));
      const { result, getConfigureDraft } = setup({ intent: { draftId } });

      expect(result.current.isLoading).toBe(false);
      expect(result.current).toMatchObject({
        persistedSdl: "uploaded: sdl",
        persistedStartingSdl: "uploaded: sdl",
        persistedName: "upload",
        persistedInheritSecretsFrom: "99"
      });
      expect(getConfigureDraft).not.toHaveBeenCalled();
    });
  });

  describe("saving", () => {
    it("sends the draft once typing settles, carrying the inheritance forward", async () => {
      const { result, updateConfigureDraft } = await setupResumed();

      act(() => result.current.save("typed: sdl", "named", 12, "starting: sdl", { dcloud: ["us-east"] }));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS - 1));
      expect(updateConfigureDraft).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));

      await waitFor(() =>
        expect(updateConfigureDraft).toHaveBeenCalledWith({
          draftId: "resumed",
          data: {
            sdl: "typed: sdl",
            name: "named",
            runtimeLimitHours: 12,
            startingSdl: "starting: sdl",
            placementRegions: { dcloud: ["us-east"] },
            inheritSecretsFrom: "1234"
          }
        })
      );
    });

    it("sends only the latest of saves made in quick succession", async () => {
      const { result, updateConfigureDraft } = await setupResumed();

      act(() => result.current.save("first: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS / 2));
      act(() => result.current.save("second: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));

      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledTimes(1));
      expect(updateConfigureDraft).toHaveBeenCalledWith({ draftId: "resumed", data: expect.objectContaining({ sdl: "second: sdl" }) });
    });

    it("sends nothing for a save identical to the last one sent", async () => {
      const { result, updateConfigureDraft } = await setupResumed();

      act(() => result.current.save("same: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));
      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledTimes(1));
      act(() => result.current.save("same: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));

      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));
      expect(updateConfigureDraft).toHaveBeenCalledTimes(1);
    });

    it("sends a save again after the account refused it", async () => {
      const { result, updateConfigureDraft } = await setupResumed({ saveFailure: new ApiError(500, undefined, "PUT → 500") });

      act(() => result.current.save("same: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));
      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledTimes(1));
      await new Promise(resolve => setTimeout(resolve, 0));
      act(() => result.current.save("same: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));

      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledTimes(2));
    });

    it("forgets this browser's copy once the account has the draft, and reads the account's afterwards", async () => {
      const { result, queryClient, getConfigureDraft, api, legacyEntry } = setup({
        intent: { draftId: "legacy" },
        legacyDrafts: { legacy: JSON.stringify({ sdl: "browser: sdl" }) }
      });
      await waitFor(() => expect(result.current.persistedSdl).toBe("browser: sdl"));

      act(() => result.current.save("browser: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));

      await waitFor(() => expect(legacyEntry("legacy")).toBeNull());
      expect(queryClient.getQueryData(api.v1.getConfigureDraft.getKey({ draftId: "legacy" }))).toMatchObject({ data: { sdl: "browser: sdl" } });
      expect(getConfigureDraft).toHaveBeenCalledTimes(1);
    });

    it("hands a draft from outside the screen to the account once its first save lands", async () => {
      const draftId = createConfigureDraft("uploaded: sdl", {}, mintingDependencies("saved-upload"));
      const first = setup({ intent: { draftId } });

      act(() => first.result.current.save("typed: sdl"));
      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));
      await waitFor(() => expect(first.updateConfigureDraft).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(first.queryClient.getQueryData(first.api.v1.getConfigureDraft.getKey({ draftId }))).toBeDefined());
      const next = setup({ intent: { draftId } });

      expect(next.result.current.isLoading).toBe(true);
      await waitFor(() => expect(next.getConfigureDraft).toHaveBeenCalledWith({ draftId }));
    });

    it("sends a save still waiting when the screen goes away", async () => {
      const { result, unmount, updateConfigureDraft } = await setupResumed();

      act(() => result.current.save("leaving: sdl"));
      unmount();

      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledWith({ draftId: "resumed", data: expect.objectContaining({ sdl: "leaving: sdl" }) }));
    });

    it("sends nothing when the screen goes away with nothing waiting", async () => {
      const { unmount, updateConfigureDraft } = await setupResumed();

      unmount();

      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));
      expect(updateConfigureDraft).not.toHaveBeenCalled();
    });
  });

  describe("dropInheritance", () => {
    it("sends the latest draft at once without the inheritance, and leaves it out of later saves", async () => {
      const { result, updateConfigureDraft } = await setupResumed();

      act(() => result.current.save("typed: sdl"));
      act(() => result.current.dropInheritance());
      await waitFor(() =>
        expect(updateConfigureDraft).toHaveBeenCalledWith({
          draftId: "resumed",
          data: expect.objectContaining({ sdl: "typed: sdl", inheritSecretsFrom: undefined })
        })
      );
      act(() => result.current.save("later: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));

      await waitFor(() =>
        expect(updateConfigureDraft).toHaveBeenLastCalledWith({
          draftId: "resumed",
          data: expect.objectContaining({ sdl: "later: sdl", inheritSecretsFrom: undefined })
        })
      );
    });

    it("keeps a save that was still waiting from bringing the inheritance back", async () => {
      const { result, updateConfigureDraft } = await setupResumed();

      act(() => result.current.save("typed: sdl"));
      act(() => result.current.dropInheritance());
      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));

      expect(updateConfigureDraft).toHaveBeenCalledTimes(1);
      expect(updateConfigureDraft).toHaveBeenCalledWith({ draftId: "resumed", data: expect.objectContaining({ inheritSecretsFrom: undefined }) });
    });

    it("leaves the inheritance out of a save made before the account confirmed it was dropped", async () => {
      const { result, updateConfigureDraft, answerSave } = await setupResumed({ isSaveAnsweredByHand: true });

      act(() => result.current.dropInheritance());
      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledTimes(1));
      act(() => result.current.save("later: sdl"));
      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));
      act(() => answerSave(0));

      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledTimes(2));
      expect(updateConfigureDraft).toHaveBeenLastCalledWith({
        draftId: "resumed",
        data: expect.objectContaining({ sdl: "later: sdl", inheritSecretsFrom: undefined })
      });
    });

    it("sends the stored draft without the inheritance when nothing was saved yet", async () => {
      const { result, updateConfigureDraft } = await setupResumed();

      act(() => result.current.dropInheritance());

      await waitFor(() =>
        expect(updateConfigureDraft).toHaveBeenCalledWith({
          draftId: "resumed",
          data: expect.objectContaining({ sdl: "account: sdl", inheritSecretsFrom: undefined })
        })
      );
    });

    it("sends nothing for a session with no draft yet", async () => {
      const { result, updateConfigureDraft } = setup({ mintedDraftId: "minted" });

      act(() => result.current.dropInheritance());

      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));
      expect(updateConfigureDraft).not.toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("discards the draft at the account, along with this browser's copy and any save still waiting", async () => {
      const { result, updateConfigureDraft, deleteConfigureDraft, legacyEntry } = setup({
        intent: { draftId: "legacy" },
        legacyDrafts: { legacy: JSON.stringify({ sdl: "browser: sdl" }) }
      });
      await waitFor(() => expect(result.current.persistedSdl).toBe("browser: sdl"));

      act(() => result.current.save("typed: sdl"));
      act(() => result.current.clear());
      act(() => result.current.save("after: sdl"));
      act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));

      await waitFor(() => expect(deleteConfigureDraft).toHaveBeenCalledWith({ draftId: "legacy" }));
      expect(legacyEntry("legacy")).toBeNull();
      expect(updateConfigureDraft).not.toHaveBeenCalled();
    });

    it("discards the draft only once a save already sent has landed, so that save cannot bring it back", async () => {
      const { result, updateConfigureDraft, deleteConfigureDraft, answerSave } = await setupResumed({ isSaveAnsweredByHand: true });

      act(() => result.current.save("typed: sdl"));
      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));
      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledTimes(1));
      act(() => result.current.clear());
      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));
      expect(deleteConfigureDraft).not.toHaveBeenCalled();

      act(() => answerSave(0));

      await waitFor(() => expect(deleteConfigureDraft).toHaveBeenCalledWith({ draftId: "resumed" }));
    });

    it("lets go of a draft handed over from outside the screen", async () => {
      const draftId = createConfigureDraft("uploaded: sdl", {}, mintingDependencies("discarded-upload"));
      const first = setup({ intent: { draftId } });

      act(() => first.result.current.clear());
      const next = setup({ intent: { draftId } });

      await waitFor(() => expect(next.result.current.isLoading).toBe(false));
      expect(next.result.current.persistedSdl).toBeUndefined();
    });

    it("leaves no copy of the discarded draft for the next screen to open", async () => {
      const { result, deleteConfigureDraft, cachedAccountDraft } = await setupResumed();

      act(() => result.current.clear());

      await waitFor(() => expect(deleteConfigureDraft).toHaveBeenCalled());
      await waitFor(() => expect(cachedAccountDraft("resumed")).toBeNull());
    });

    it("leaves no copy of the discarded draft behind when a save lands during the discard", async () => {
      const { result, updateConfigureDraft, deleteConfigureDraft, answerSave, cachedAccountDraft } = await setupResumed({ isSaveAnsweredByHand: true });
      act(() => result.current.save("typed: sdl"));
      await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS));
      await waitFor(() => expect(updateConfigureDraft).toHaveBeenCalledTimes(1));
      act(() => result.current.clear());

      act(() => answerSave(0));

      await waitFor(() => expect(deleteConfigureDraft).toHaveBeenCalled());
      await waitFor(() => expect(cachedAccountDraft("resumed")).toBeNull());
    });
  });

  describe(createConfigureDraft.name, () => {
    it("returns a freshly minted id", () => {
      expect(createConfigureDraft("uploaded: sdl", {}, mintingDependencies("minted-for-upload"))).toBe("minted-for-upload");
    });
  });

  async function setupResumed(input: { saveFailure?: Error; isSaveAnsweredByHand?: boolean } = {}) {
    const view = setup({ intent: { draftId: "resumed" }, accountDrafts: { resumed: ACCOUNT_DRAFT }, ...input });
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    return view;
  }

  function mintingDependencies(draftId: string): typeof DEPENDENCIES {
    return { ...DEPENDENCIES, mintDraftId: () => draftId };
  }

  function setup(input: {
    intent?: Partial<DeploymentIntent>;
    accountDrafts?: Record<string, ConfigureDraftContent>;
    legacyDrafts?: Record<string, string>;
    failure?: Error;
    saveFailure?: Error;
    isSaveAnsweredByHand?: boolean;
    mintedDraftId?: string;
    getStorage?: typeof DEPENDENCIES.getStorage;
  }) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.localStorage.clear();
    Object.entries(input.legacyDrafts ?? {}).forEach(([draftId, raw]) => window.localStorage.setItem(`${LEGACY_DRAFT_KEY_PREFIX}${draftId}`, raw));

    const getConfigureDraft = vi.fn(({ draftId }: { draftId: string }) => {
      if (input.failure) return Promise.reject(input.failure);
      const draft = input.accountDrafts?.[draftId];
      return draft
        ? Promise.resolve({ data: { ...draft, draftId, updatedAt: "2026-10-06T12:00:00.000Z" } })
        : Promise.reject(new ApiError(404, undefined, "→ 404"));
    });
    const pendingSaves: (() => void)[] = [];
    const updateConfigureDraft = vi.fn(({ draftId, data }: { draftId: string; data: ConfigureDraftContent }) => {
      if (input.saveFailure) return Promise.reject(input.saveFailure);
      const answer = { data: { ...data, draftId, updatedAt: "2026-10-06T12:00:01.000Z" } };
      return input.isSaveAnsweredByHand ? new Promise<typeof answer>(resolve => pendingSaves.push(() => resolve(answer))) : Promise.resolve(answer);
    });
    const deleteConfigureDraft = vi.fn(() => Promise.resolve(undefined));
    const api = createProxy({ v1: { getConfigureDraft, updateConfigureDraft, deleteConfigureDraft } }) as unknown as ApiService;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const replace = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      getStorage: input.getStorage ?? (() => window.localStorage),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace }),
      useServices: () => ({ api }) as unknown as ReturnType<typeof DEPENDENCIES.useServices>,
      useQueryClient: () => queryClient,
      mintDraftId: () => input.mintedDraftId ?? "minted-id"
    };
    let intent: DeploymentIntent = { sdlStrategy: "edit", bidStrategy: "select", vm: false, ...input.intent };

    const view = setupQuery(() => useConfigureDraft(intent, dependencies), { services: { api: () => api, queryClient: () => queryClient } });
    const legacyEntry = (draftId: string) => window.localStorage.getItem(`${LEGACY_DRAFT_KEY_PREFIX}${draftId}`);
    const cachedAccountDraft = (draftId: string) => queryClient.getQueryData(api.v1.getConfigureDraft.getKey({ draftId }));

    const answerSave = (index: number) => pendingSaves[index]();
    const followReplacedUrl = () => {
      const [url] = replace.mock.lastCall as [string];
      intent = { ...intent, draftId: new URL(url, "http://localhost").searchParams.get("draftId") ?? undefined };
      view.rerender();
    };

    return {
      ...view,
      api,
      queryClient,
      replace,
      getConfigureDraft,
      updateConfigureDraft,
      deleteConfigureDraft,
      legacyEntry,
      cachedAccountDraft,
      answerSave,
      followReplacedUrl
    };
  }
});
