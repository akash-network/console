import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useConfigureDraft";
import { useConfigureDraft } from "./useConfigureDraft";

import { renderHook } from "@testing-library/react";

const DRAFT_KEY_PREFIX = "configure-draft:";

describe(useConfigureDraft.name, () => {
  it("reads back a saved draft", () => {
    const { result } = setup({ draftId: "draft-1" });

    result.current.save("version: '2.0'");

    expect(result.current.read()).toBe("version: '2.0'");
  });

  it("returns undefined when nothing has been saved for the id", () => {
    const { result } = setup({ draftId: "missing" });

    expect(result.current.read()).toBeUndefined();
  });

  it("clears a saved draft", () => {
    const { result } = setup({ draftId: "draft-1" });
    result.current.save("sdl");

    result.current.clear();

    expect(result.current.read()).toBeUndefined();
  });

  it("does not persist anything when there is no draft id", () => {
    const { result } = setup({ draftId: undefined });

    result.current.save("sdl");

    expect(result.current.read()).toBeUndefined();
    expect(countDrafts()).toBe(0);
  });

  it("is a safe no-op when storage is unavailable", () => {
    const { result } = setup({ draftId: "draft-1", getStorage: () => undefined });

    expect(() => result.current.save("sdl")).not.toThrow();
    expect(result.current.read()).toBeUndefined();
  });

  it("ignores an unreadable entry instead of throwing", () => {
    const { result } = setup({ draftId: "draft-1" });
    window.localStorage.setItem(`${DRAFT_KEY_PREFIX}draft-1`, "not json");

    expect(result.current.read()).toBeUndefined();
  });

  it("caps the number of stored drafts, evicting the least recently updated", () => {
    const { result, rerender } = setup({ draftId: "draft-0" });
    let clock = 1;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => clock++);

    for (let index = 0; index < 25; index++) {
      rerender(`draft-${index}`);
      result.current.save(`sdl-${index}`);
    }
    nowSpy.mockRestore();

    expect(countDrafts()).toBe(20);
    expect(window.localStorage.getItem(`${DRAFT_KEY_PREFIX}draft-0`)).toBeNull();
    expect(window.localStorage.getItem(`${DRAFT_KEY_PREFIX}draft-24`)).not.toBeNull();
  });

  function countDrafts() {
    return Object.keys(window.localStorage).filter(key => key.startsWith(DRAFT_KEY_PREFIX)).length;
  }

  function setup(input: { draftId: string | undefined; getStorage?: typeof DEPENDENCIES.getStorage }) {
    window.localStorage.clear();
    const dependencies = input.getStorage ? { getStorage: input.getStorage } : undefined;
    return renderHook((draftId: string | undefined) => useConfigureDraft(draftId, dependencies), { initialProps: input.draftId });
  }
});
