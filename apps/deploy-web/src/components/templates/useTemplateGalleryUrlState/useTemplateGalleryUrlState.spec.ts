import { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useTemplateGalleryUrlState";
import { useTemplateGalleryUrlState } from "./useTemplateGalleryUrlState";

import { act, renderHook } from "@testing-library/react";

describe(useTemplateGalleryUrlState.name, () => {
  it("starts from the category and search in the link", () => {
    const { result } = setup({ url: { category: "Games", search: "craft" } });

    expect(result.current.category).toBe("Games");
    expect(result.current.search).toBe("craft");
  });

  it("starts with no category and an empty search for a bare link", () => {
    const { result } = setup({ url: {} });

    expect(result.current.category).toBeNull();
    expect(result.current.search).toBe("");
  });

  it("starts with no category and an empty search while the link is not ready yet", () => {
    const { result } = setup({ url: null });

    expect(result.current.category).toBeNull();
    expect(result.current.search).toBe("");
  });

  it("puts a picked category in the link right away, keeping the search", () => {
    const { result, router } = setup({ url: { search: "craft" } });

    act(() => result.current.selectCategory("Games"));

    expect(result.current.category).toBe("Games");
    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games&search=craft");
  });

  it("updates the search right away and puts it in the link once typing stops", async () => {
    const { result, router } = setup({ url: { category: "Games" } });

    act(() => result.current.changeSearch("mi"));
    act(() => result.current.changeSearch("mine"));

    expect(result.current.search).toBe("mine");
    expect(router.replace).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/templates?category=Games&search=mine"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("keeps a category picked moments before typing, before the link shows it", async () => {
    const { result, router } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    act(() => result.current.changeSearch("mine"));

    await vi.waitFor(() => expect(router.replace).toHaveBeenLastCalledWith("/templates?category=Games&search=mine"));
  });

  it("drops a pending search write once a category is picked, writing the search with it", async () => {
    const { result, router } = setup({ url: {} });

    act(() => result.current.changeSearch("mine"));
    act(() => result.current.selectCategory("Games"));
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games&search=mine");
  });

  it("clears the search and drops it from the link right away", () => {
    const { result, router } = setup({ url: { category: "Games", search: "craft" } });

    act(() => result.current.clearSearch());

    expect(result.current.search).toBe("");
    expect(router.replace).toHaveBeenCalledWith("/templates?category=Games");
  });

  it("does not write a search typed just before clearing it", async () => {
    const { result, router } = setup({ url: {} });

    act(() => result.current.changeSearch("mine"));
    act(() => result.current.clearSearch());
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(result.current.search).toBe("");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("follows the link when something else changes it", () => {
    const { result, rerenderWithUrl } = setup({ url: { category: "Games", search: "craft" } });

    rerenderWithUrl({});

    expect(result.current.category).toBeNull();
    expect(result.current.search).toBe("");
  });

  it("follows the link once it becomes ready", () => {
    const { result, rerenderWithUrl } = setup({ url: null });

    rerenderWithUrl({ category: "Games", search: "craft" });

    expect(result.current.category).toBe("Games");
    expect(result.current.search).toBe("craft");
  });

  it("drops a pending search write when the link changes elsewhere", async () => {
    const { result, router, rerenderWithUrl } = setup({ url: { category: "Games" } });

    act(() => result.current.changeSearch("mine"));
    rerenderWithUrl({});
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(router.replace).not.toHaveBeenCalled();
    expect(result.current.search).toBe("");
  });

  it("does not follow the link when it shows the page's own write", () => {
    const { result, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    act(() => result.current.changeSearch("mine"));
    rerenderWithUrl({ category: "Games" });

    expect(result.current.category).toBe("Games");
    expect(result.current.search).toBe("mine");
  });

  it("does not follow the link back to an older write that lands after a newer one", () => {
    const { result, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    act(() => result.current.selectCategory("Tools"));
    rerenderWithUrl({ category: "Games" });
    rerenderWithUrl({ category: "Tools" });

    expect(result.current.category).toBe("Tools");
  });

  it("follows the link again after its own writes have landed", () => {
    const { result, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    rerenderWithUrl({ category: "Games" });
    rerenderWithUrl({ category: "Tools" });

    expect(result.current.category).toBe("Tools");
  });

  it("follows a link that shares only the category with a write still pending", () => {
    const { result, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    rerenderWithUrl({ category: "Games", search: "craft" });

    expect(result.current.search).toBe("craft");
  });

  it("follows a link that shares only the search with a write still pending", () => {
    const { result, rerenderWithUrl } = setup({ url: { search: "craft" } });

    act(() => result.current.selectCategory("Games"));
    rerenderWithUrl({ category: "Tools", search: "craft" });

    expect(result.current.category).toBe("Tools");
  });

  it("follows the link back to a state it wrote earlier once that write has landed", () => {
    const { result, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    rerenderWithUrl({ category: "Games" });
    rerenderWithUrl({ category: "Tools" });
    rerenderWithUrl({ category: "Games" });

    expect(result.current.category).toBe("Games");
  });

  it("does not navigate when the pick is already in the link", () => {
    const { result, router } = setup({ url: { category: "Games", search: "craft" } });

    act(() => result.current.selectCategory("Games"));

    expect(router.replace).not.toHaveBeenCalled();
  });

  it("drops its pending writes when the link changes elsewhere, so it follows a later return to one of them", () => {
    const { result, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    rerenderWithUrl({ category: "Tools" });
    rerenderWithUrl({ category: "Games" });

    expect(result.current.category).toBe("Games");
  });

  it("forgets a pending write once the user goes back to what the link already shows", () => {
    const { result, router, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    act(() => result.current.selectCategory(null));
    rerenderWithUrl({ category: "Games" });

    expect(router.replace).toHaveBeenLastCalledWith("/templates");
    expect(result.current.category).toBe("Games");
  });

  it("keeps waiting for its own write after going back to what the link shows and picking again", () => {
    const { result, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    act(() => result.current.selectCategory(null));
    act(() => result.current.selectCategory("Tools"));
    rerenderWithUrl({ category: "Tools" });

    expect(result.current.category).toBe("Tools");
  });

  it("follows an outside link to a category it wrote before, once its own writes have landed", () => {
    const { result, rerenderWithUrl } = setup({ url: {} });

    act(() => result.current.selectCategory("Games"));
    rerenderWithUrl({ category: "Games" });
    act(() => result.current.selectCategory("Tools"));
    rerenderWithUrl({ category: "Tools" });
    rerenderWithUrl({ category: "Games" });

    expect(result.current.category).toBe("Games");
  });

  it("drops a pending search write when unmounted", async () => {
    const { result, router, unmount } = setup({ url: {} });

    act(() => result.current.changeSearch("mine"));
    unmount();
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(router.replace).not.toHaveBeenCalled();
  });

  function setup(input: { url: { category?: string; search?: string } | null }) {
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    let searchParams = toSearchParams(input.url);
    const dependencies = { useRouter: () => router, useSearchParams: () => searchParams };

    const { result, rerender, unmount } = renderHook(() => useTemplateGalleryUrlState(dependencies));

    const rerenderWithUrl = (url: { category?: string; search?: string }) => {
      searchParams = toSearchParams(url);
      rerender();
    };

    return { result, router, rerenderWithUrl, unmount };
  }

  function toSearchParams(url: { category?: string; search?: string } | null) {
    if (!url) return null;

    const params = new URLSearchParams();
    if (url.category) params.set("category", url.category);
    if (url.search) params.set("search", url.search);
    return new ReadonlyURLSearchParams(params);
  }
});
