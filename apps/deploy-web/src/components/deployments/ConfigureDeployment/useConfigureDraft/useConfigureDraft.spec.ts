import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DEPENDENCIES } from "./useConfigureDraft";
import { createConfigureDraft, useConfigureDraft } from "./useConfigureDraft";

import { renderHook } from "@testing-library/react";

const DRAFT_KEY_PREFIX = "configure-draft:";

describe(useConfigureDraft.name, () => {
  it("resolves the draft id from the URL when present", () => {
    const { result, mintDraftId } = setup({ intent: { draftId: "draft-1" } });

    expect(result.current.draftId).toBe("draft-1");
    expect(mintDraftId).not.toHaveBeenCalled();
  });

  it("mints a draft id when the URL carries none", () => {
    const { result, mintDraftId } = setup({ mintedDraftId: "fresh-1" });

    expect(result.current.draftId).toBe("fresh-1");
    expect(mintDraftId).toHaveBeenCalledTimes(1);
  });

  it("writes a freshly minted id into the URL", () => {
    const { replace } = setup({ mintedDraftId: "fresh-1" });

    expect(replace).toHaveBeenCalledWith(expect.stringContaining("draftId=fresh-1"), undefined, { shallow: true });
  });

  it("does not rewrite the URL when it already carries a draft id", () => {
    const { replace } = setup({ intent: { draftId: "draft-1" } });

    expect(replace).not.toHaveBeenCalled();
  });

  it("exposes the persisted sdl for the active draft", () => {
    const { result } = setup({ intent: { draftId: "draft-1" }, stored: { "draft-1": "version: '2.0'" } });

    expect(result.current.persistedSdl).toBe("version: '2.0'");
  });

  it("has no persisted sdl when nothing is stored for the id", () => {
    const { result } = setup({ intent: { draftId: "missing" } });

    expect(result.current.persistedSdl).toBeUndefined();
  });

  it("saves the sdl for the active draft", () => {
    const { result } = setup({ intent: { draftId: "draft-1" } });

    result.current.save("version: '2.0'");

    expect(storedSdl("draft-1")).toBe("version: '2.0'");
  });

  it("exposes the persisted name for the active draft", () => {
    const { result } = setup({ intent: { draftId: "draft-1" }, storedName: { "draft-1": "my-app" } });

    expect(result.current.persistedName).toBe("my-app");
  });

  it("has no persisted name when the stored draft omits one", () => {
    const { result } = setup({ intent: { draftId: "draft-1" }, stored: { "draft-1": "version: '2.0'" } });

    expect(result.current.persistedName).toBeUndefined();
  });

  it("saves the name alongside the sdl for the active draft", () => {
    const { result } = setup({ intent: { draftId: "draft-1" } });

    result.current.save("version: '2.0'", "my-app");

    expect(storedName("draft-1")).toBe("my-app");
  });

  it("clears the persisted draft", () => {
    const { result } = setup({ intent: { draftId: "draft-1" }, stored: { "draft-1": "version: '2.0'" } });

    result.current.clear();

    expect(window.localStorage.getItem(`${DRAFT_KEY_PREFIX}draft-1`)).toBeNull();
  });

  it("follows the URL when it switches to a different draft on the same instance", () => {
    const { result, rerender } = setup({
      intent: { draftId: "draft-a" },
      stored: { "draft-a": "sdl: a", "draft-b": "sdl: b" }
    });
    expect(result.current.persistedSdl).toBe("sdl: a");

    rerender({ sdlStrategy: "edit", bidStrategy: "select", draftId: "draft-b" });

    expect(result.current.draftId).toBe("draft-b");
    expect(result.current.persistedSdl).toBe("sdl: b");
  });

  it("is a safe no-op when storage is unavailable", () => {
    const { result } = setup({ intent: { draftId: "draft-1" }, getStorage: () => undefined });

    expect(result.current.persistedSdl).toBeUndefined();
    expect(() => result.current.save("sdl")).not.toThrow();
  });

  it("degrades to a no-op when storage access throws", () => {
    const blocked = mock<Storage>();
    const reject = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    blocked.getItem.mockImplementation(reject);
    blocked.setItem.mockImplementation(reject);
    blocked.removeItem.mockImplementation(reject);
    const { result } = setup({ intent: { draftId: "draft-1" }, getStorage: () => blocked });

    expect(result.current.persistedSdl).toBeUndefined();
    expect(() => result.current.save("sdl")).not.toThrow();
    expect(() => result.current.clear()).not.toThrow();
  });

  it("ignores an unreadable entry instead of throwing", () => {
    const { result } = setup({ intent: { draftId: "draft-1" }, rawStored: { "draft-1": "not json" } });

    expect(result.current.persistedSdl).toBeUndefined();
  });

  it("caps the number of stored drafts, evicting the least recently updated", () => {
    const { result, rerender } = setup({ intent: { draftId: "draft-0" } });
    let clock = 1;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => clock++);

    for (let index = 0; index < 25; index++) {
      rerender({ sdlStrategy: "edit", bidStrategy: "select", draftId: `draft-${index}` });
      result.current.save(`sdl-${index}`);
    }
    nowSpy.mockRestore();

    expect(countDrafts()).toBe(20);
    expect(window.localStorage.getItem(`${DRAFT_KEY_PREFIX}draft-0`)).toBeNull();
    expect(window.localStorage.getItem(`${DRAFT_KEY_PREFIX}draft-24`)).not.toBeNull();
  });

  function storedSdl(draftId: string) {
    const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${draftId}`);
    return raw ? (JSON.parse(raw) as { sdl: string }).sdl : undefined;
  }

  function storedName(draftId: string) {
    const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${draftId}`);
    return raw ? (JSON.parse(raw) as { name?: string }).name : undefined;
  }

  function countDrafts() {
    return Object.keys(window.localStorage).filter(key => key.startsWith(DRAFT_KEY_PREFIX)).length;
  }

  function setup(input: {
    intent?: Partial<DeploymentIntent>;
    stored?: Record<string, string>;
    storedName?: Record<string, string>;
    rawStored?: Record<string, string>;
    getStorage?: typeof DEPENDENCIES.getStorage;
    mintedDraftId?: string;
  }) {
    window.localStorage.clear();
    Object.entries(input.stored ?? {}).forEach(([draftId, sdl]) =>
      window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${draftId}`, JSON.stringify({ sdl, updatedAt: 1 }))
    );
    Object.entries(input.storedName ?? {}).forEach(([draftId, name]) =>
      window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${draftId}`, JSON.stringify({ sdl: "seeded", name, updatedAt: 1 }))
    );
    Object.entries(input.rawStored ?? {}).forEach(([draftId, raw]) => window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${draftId}`, raw));

    const replace = vi.fn();
    const mintDraftId = vi.fn(() => input.mintedDraftId ?? "minted-id");
    const dependencies: typeof DEPENDENCIES = {
      getStorage: input.getStorage ?? (() => window.localStorage),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace }),
      mintDraftId
    };
    const initialProps: DeploymentIntent = { sdlStrategy: "edit", bidStrategy: "select", ...input.intent };

    return {
      ...renderHook((intent: DeploymentIntent) => useConfigureDraft(intent, dependencies), { initialProps }),
      replace,
      mintDraftId
    };
  }
});

describe(createConfigureDraft.name, () => {
  it("persists the sdl under a freshly minted id and returns that id", () => {
    const { create } = setup({ mintedDraftId: "fresh-1" });

    const draftId = create("version: '2.0'");

    expect(draftId).toBe("fresh-1");
    expect(readSdl("fresh-1")).toBe("version: '2.0'");
  });

  it("returns the minted id without throwing when storage is unavailable", () => {
    const { create } = setup({ mintedDraftId: "fresh-1", getStorage: () => undefined });

    expect(create("version: '2.0'")).toBe("fresh-1");
  });

  function readSdl(draftId: string) {
    const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${draftId}`);
    return raw ? (JSON.parse(raw) as { sdl: string }).sdl : undefined;
  }

  function setup(input: { mintedDraftId?: string; getStorage?: typeof DEPENDENCIES.getStorage }) {
    window.localStorage.clear();
    const dependencies: typeof DEPENDENCIES = {
      getStorage: input.getStorage ?? (() => window.localStorage),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({}),
      mintDraftId: vi.fn(() => input.mintedDraftId ?? "minted-id")
    };
    return { create: (sdl: string) => createConfigureDraft(sdl, dependencies) };
  }
});
