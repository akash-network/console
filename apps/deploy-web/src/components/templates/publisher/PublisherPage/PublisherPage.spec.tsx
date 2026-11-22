import React from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GallerySort } from "@src/components/templates/communityGallery/galleryView";
import { PublisherLinkList } from "@src/components/templates/publisher/PublisherLinkList/PublisherLinkList";
import type { CurrentTemplatePublisher, TemplatePublisherPage } from "@src/types/marketplace-template";
import type { DEPENDENCIES } from "./PublisherPage";
import { PUBLIC_PAGE_BEHIND_NOTICE, PublisherPage } from "./PublisherPage";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCommunityTemplateCard } from "@tests/seeders/communityTemplate";

type PublisherQuery = ReturnType<typeof DEPENDENCIES.useTemplatePublisher>;
type OwnProfileQuery = ReturnType<typeof DEPENDENCIES.useCurrentTemplatePublisher>;
type UrlState = ReturnType<typeof DEPENDENCIES.useTemplateGalleryUrlState>;

const HOSTILE_MARKUP = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

const PUBLISHER: TemplatePublisherPage = {
  name: "Lambda Garage",
  handle: "lambda-garage",
  type: "team",
  bio: "We build GPU inference stacks for small teams.",
  links: [
    { url: "https://lambdagarage.dev/", label: null },
    { url: "https://github.com/lambda-garage", label: "GitHub" }
  ],
  verified: false,
  memberSince: "2025-03-14T12:00:00.000Z",
  counts: { templates: 3, deploys: 18400 },
  templates: [
    buildCommunityTemplateCard({
      title: "Llama.cpp CPU server",
      publishedAt: "2026-03-01T00:00:00.000Z",
      usage: { deploys: 20, stillUpAfter24h: null, forks: 0 }
    }),
    buildCommunityTemplateCard({
      title: "Open WebUI + vLLM",
      publishedAt: "2026-01-01T00:00:00.000Z",
      usage: { deploys: 900, stillUpAfter24h: null, forks: 0 }
    }),
    buildCommunityTemplateCard({ title: "Embeddings API", publishedAt: "2026-06-01T00:00:00.000Z", usage: { deploys: 5, stillUpAfter24h: null, forks: 0 } })
  ]
};

const OWN_PROFILE: CurrentTemplatePublisher = {
  name: PUBLISHER.name,
  handle: PUBLISHER.handle,
  type: PUBLISHER.type,
  bio: PUBLISHER.bio,
  links: PUBLISHER.links,
  verified: PUBLISHER.verified,
  memberSince: PUBLISHER.memberSince,
  canEdit: true
};

describe(PublisherPage.name, () => {
  it("shows who the publisher is: name, initials, type, bio, links, age and counts", () => {
    const { NextSeo } = setup({});

    expect(screen.getByRole("heading", { level: 1, name: "Lambda Garage" })).toBeInTheDocument();
    expect(screen.getByText("LG")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Community publisher")).toBeInTheDocument();
    expect(screen.getByText("We build GPU inference stacks for small teams.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /lambdagarage\.dev/ })).toHaveAttribute("href", "https://lambdagarage.dev/");
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveTextContent("· github.com");
    expect(screen.getByText("Member since Mar 2025")).toBeInTheDocument();
    expect(screen.getByText("Templates", { selector: "dt" }).nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Total deploys").nextElementSibling).toHaveTextContent("18.4K");
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute("href", "/templates");
    expect(NextSeo).toHaveBeenCalledWith({ title: "Lambda Garage · Templates" }, expect.anything());
  });

  it("names a personal publisher as one", () => {
    setup({ publisher: { type: "personal" } });

    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
  });

  it("marks a publisher only when staff verified it", () => {
    const { unmount } = setup({ publisher: { verified: true } });
    expect(screen.getByRole("img", { name: "Verified by Akash" })).toBeInTheDocument();
    unmount();

    setup({ publisher: { verified: false } });
    expect(screen.queryByRole("img", { name: "Verified by Akash" })).not.toBeInTheDocument();
  });

  it("leaves the bio and the links out when the publisher wrote none", () => {
    setup({ publisher: { bio: null, links: [] } });

    expect(screen.queryByRole("list", { name: "Links" })).not.toBeInTheDocument();
    expect(screen.getByText("Member since Mar 2025")).toBeInTheDocument();
    expect(screen.getByRole("banner").querySelectorAll("p")).toHaveLength(1);
  });

  it("renders markup in the name, the bio and the links as text", () => {
    const { container } = setup({
      publisher: {
        name: HOSTILE_MARKUP,
        bio: HOSTILE_MARKUP,
        links: [
          { url: "https://lambdagarage.dev/", label: HOSTILE_MARKUP },
          { url: "javascript:alert(1)", label: null }
        ]
      }
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(HOSTILE_MARKUP);
    expect(screen.getAllByText(HOSTILE_MARKUP)).toHaveLength(3);
    expect(screen.getByText("javascript:alert(1)").closest("a")).toBeNull();
    expect(container.querySelector("img, script")).toBeNull();
  });

  it("lists the publisher's templates most popular first, without linking each card back to this page", () => {
    const { GalleryEntryList } = setup({});

    expect(shownTitles()).toEqual(["Open WebUI + vLLM", "Llama.cpp CPU server", "Embeddings API"]);
    expect(GalleryEntryList).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "3 templates · Popular",
        search: "",
        showsCommunityNote: true,
        linksPublishers: false,
        emptyHint: "This publisher lists no templates right now."
      }),
      expect.anything()
    );
  });

  it("lists the newest first when the link asks for it", () => {
    const { GalleryEntryList } = setup({ sort: "newest" });

    expect(shownTitles()).toEqual(["Embeddings API", "Llama.cpp CPU server", "Open WebUI + vLLM"]);
    expect(GalleryEntryList).toHaveBeenLastCalledWith(expect.objectContaining({ title: "3 templates · Newest" }), expect.anything());
    expect(screen.getByRole("button", { name: "Newest" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sorts by the trending score when the link asks for it", () => {
    setup({
      sort: "trending",
      publisher: {
        templates: [
          buildCommunityTemplateCard({ title: "Steady", scores: { popular: 9, trending: 1, isTrending: false } }),
          buildCommunityTemplateCard({ title: "Rising", scores: { popular: 2, trending: 7, isTrending: true } })
        ]
      }
    });

    expect(shownTitles()).toEqual(["Rising", "Steady"]);
  });

  it("hands a new sort to the link", async () => {
    const { user, urlState } = setup({});

    await user.click(screen.getByRole("button", { name: "Newest" }));

    expect(urlState.selectSort).toHaveBeenCalledExactlyOnceWith("newest");
  });

  it("keeps the search and the sort in this publisher's own link", () => {
    const { useTemplateGalleryUrlState } = setup({});
    const toUrl = useTemplateGalleryUrlState.mock.calls[0][1] as NonNullable<Parameters<typeof DEPENDENCIES.useTemplateGalleryUrlState>[1]>;

    expect(useTemplateGalleryUrlState.mock.calls[0][0]).toBeUndefined();
    expect(toUrl({ category: "AI - GPU", search: "webui", source: "official", sort: "newest" })).toBe(
      "/template-publishers/lambda-garage?search=webui&sort=newest"
    );
    expect(toUrl({ category: null, search: "", source: "all", sort: "popular" })).toBe("/template-publishers/lambda-garage");
  });

  it("keeps the same link writer between renders", () => {
    const { useTemplateGalleryUrlState, rerender } = setup({});

    rerender();

    const writers = useTemplateGalleryUrlState.mock.calls.map(call => call[1]);
    expect(writers.length).toBeGreaterThan(1);
    expect(new Set(writers).size).toBe(1);
  });

  it("shows only the templates matching the search and says so when none does", () => {
    const { GalleryEntryList, unmount } = setup({ search: "webui" });
    expect(shownTitles()).toEqual(["Open WebUI + vLLM"]);
    expect(GalleryEntryList).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "3 templates · Popular", search: "webui", emptyHint: "Try a different search." }),
      expect.anything()
    );
    unmount();

    setup({ search: "zzz" });
    expect(shownTitles()).toEqual([]);
  });

  it("hands typing and clearing the search to the link", async () => {
    const { user, urlState } = setup({ search: "web" });

    await user.type(screen.getByRole("textbox", { name: "Search this publisher's templates" }), "u");
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(urlState.changeSearch).toHaveBeenCalledExactlyOnceWith("webu");
    expect(urlState.clearSearch).toHaveBeenCalledOnce();
  });

  it("offers nothing to clear while the search is empty", () => {
    setup({});

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("starts the list over when the sort or the search changes", () => {
    const mounts = vi.fn();
    const GalleryEntryList = vi.fn<typeof DEPENDENCIES.GalleryEntryList>(() => {
      useMountCounter(mounts);
      return null;
    });
    const { rerender } = setup({ GalleryEntryList });

    rerender();
    expect(mounts).toHaveBeenCalledTimes(1);
    rerender({ sort: "newest" });
    expect(mounts).toHaveBeenCalledTimes(2);
    rerender({ sort: "newest", search: "web" });
    expect(mounts).toHaveBeenCalledTimes(3);
  });

  it("does not sort again when the page renders with the same templates and sort", () => {
    const { GalleryEntryList, rerender } = setup({});
    const firstEntries = GalleryEntryList.mock.lastCall?.[0].entries;

    rerender();

    expect(GalleryEntryList.mock.lastCall?.[0].entries).toBe(firstEntries);
  });

  it("follows a sort, a search and a list of templates that change while the page is open", () => {
    const { rerender } = setup({});
    expect(shownTitles()).toEqual(["Open WebUI + vLLM", "Llama.cpp CPU server", "Embeddings API"]);

    rerender({ sort: "newest" });
    expect(shownTitles()).toEqual(["Embeddings API", "Llama.cpp CPU server", "Open WebUI + vLLM"]);

    rerender({ sort: "newest", search: "llama" });
    expect(shownTitles()).toEqual(["Llama.cpp CPU server"]);

    rerender({ sort: "newest", templates: [buildCommunityTemplateCard({ title: "Brand new" })] });
    expect(shownTitles()).toEqual(["Brand new"]);
  });

  it("brings the community note back when a community template joins the Official ones", () => {
    const { GalleryEntryList, rerender } = setup({ publisher: { templates: [buildCommunityTemplateCard({ isOfficial: true })] } });
    expect(GalleryEntryList).toHaveBeenLastCalledWith(expect.objectContaining({ showsCommunityNote: false }), expect.anything());

    rerender({ templates: [buildCommunityTemplateCard({ isOfficial: true }), buildCommunityTemplateCard({ isOfficial: false })] });

    expect(GalleryEntryList).toHaveBeenLastCalledWith(expect.objectContaining({ showsCommunityNote: true, title: "2 templates · Popular" }), expect.anything());
  });

  it("writes the link of the publisher the page moved to", () => {
    const { useTemplateGalleryUrlState, rerender } = setup({});

    rerender({ handle: "northwind-labs" });

    const toUrl = useTemplateGalleryUrlState.mock.lastCall?.[1] as NonNullable<Parameters<typeof DEPENDENCIES.useTemplateGalleryUrlState>[1]>;
    expect(toUrl({ category: null, search: "", source: "all", sort: "newest" })).toBe("/template-publishers/northwind-labs?sort=newest");
  });

  it("treats a search of spaces as no search when wording the empty list", () => {
    const { GalleryEntryList } = setup({ search: "   ", publisher: { templates: [] } });

    expect(GalleryEntryList).toHaveBeenLastCalledWith(
      expect.objectContaining({ emptyHint: "This publisher lists no templates right now." }),
      expect.anything()
    );
  });

  it("drops the community note when every template is Official", () => {
    const { GalleryEntryList } = setup({ publisher: { templates: [buildCommunityTemplateCard({ isOfficial: true })] } });

    expect(GalleryEntryList).toHaveBeenLastCalledWith(expect.objectContaining({ title: "1 template · Popular", showsCommunityNote: false }), expect.anything());
  });

  it("shows a publisher that lists nothing with zero counts and an empty list", () => {
    const { GalleryEntryList } = setup({ publisher: { templates: [], counts: { templates: 0, deploys: 0 } } });

    expect(screen.getByText("Templates", { selector: "dt" }).nextElementSibling).toHaveTextContent("0");
    expect(GalleryEntryList).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "0 templates · Popular", entries: [], showsCommunityNote: false }),
      expect.anything()
    );
  });

  it.each([404, 400])("says the publisher was not found for a %i, without an error", status => {
    const { NextSeo, GalleryEntryList } = setup({ error: new ApiError(status, { message: "Publisher not found" }, String(status)) });

    expect(screen.getByRole("heading", { level: 1, name: "Publisher not found" })).toBeInTheDocument();
    expect(screen.getByText("There is no publisher page at this address.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse templates" })).toHaveAttribute("href", "/templates");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(NextSeo).toHaveBeenCalledWith({ title: "Publisher not found", noindex: true }, expect.anything());
    expect(GalleryEntryList).not.toHaveBeenCalled();
  });

  it("says the publisher was not found when a reload answers 404 after it loaded", () => {
    const { GalleryEntryList } = setup({ error: new ApiError(404, { message: "Publisher not found" }, "404"), hasLoadedBefore: true });

    expect(screen.getByRole("heading", { level: 1, name: "Publisher not found" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Lambda Garage" })).not.toBeInTheDocument();
    expect(GalleryEntryList).not.toHaveBeenCalled();
  });

  it("keeps a loaded publisher on screen when a reload fails for another reason", () => {
    setup({ error: new ApiError(500, null, "500"), hasLoadedBefore: true });

    expect(screen.getByRole("heading", { level: 1, name: "Lambda Garage" })).toBeInTheDocument();
    expect(screen.queryByText("Publisher not found")).not.toBeInTheDocument();
  });

  it("shows a spinner while the publisher loads", () => {
    const { Layout } = setup({ isLoading: true });

    expect(screen.getByRole("status", { name: "Loading publisher" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(Layout).toHaveBeenLastCalledWith(expect.objectContaining({ isLoading: true }), expect.anything());
  });

  it.each([new ApiError(500, null, "500"), new TypeError("Failed to fetch")])("offers a retry when loading failed with %s", async error => {
    const { user, refetch } = setup({ error });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this publisher.");
    expect(screen.queryByText("Publisher not found")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  describe("when the viewer is signed out", () => {
    it("does not ask for the viewer's own publisher profile and offers no editing", () => {
      const { useCurrentTemplatePublisher } = setup({ isSignedIn: false, ownProfile: OWN_PROFILE });

      expect(useCurrentTemplatePublisher).toHaveBeenCalledWith({ enabled: false });
      expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
      expect(screen.queryByText(PUBLIC_PAGE_BEHIND_NOTICE)).not.toBeInTheDocument();
    });
  });

  describe("when the viewer is signed in", () => {
    it("asks for the viewer's own publisher profile", () => {
      const { useCurrentTemplatePublisher } = setup({ isSignedIn: true });

      expect(useCurrentTemplatePublisher).toHaveBeenCalledWith({ enabled: true });
    });

    it("offers no editing on another organization's page", () => {
      setup({ ownProfile: { ...OWN_PROFILE, handle: "northwind-labs", bio: "Ours" } });

      expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
      expect(screen.getByText("We build GPU inference stacks for small teams.")).toBeInTheDocument();
      expect(screen.queryByText("Ours")).not.toBeInTheDocument();
      expect(screen.queryByText(PUBLIC_PAGE_BEHIND_NOTICE)).not.toBeInTheDocument();
    });

    it("offers no editing to a member who may not change the profile", () => {
      setup({ ownProfile: { ...OWN_PROFILE, canEdit: false } });

      expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
    });

    it("offers no editing when the organization is not a publisher", () => {
      setup({ ownProfile: undefined });

      expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
    });

    it("opens the profile form on the saved profile and closes it again", async () => {
      const { user, EditPublisherProfileDialog } = setup({ ownProfile: OWN_PROFILE });
      expect(EditPublisherProfileDialog).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Edit profile" }));
      expect(EditPublisherProfileDialog).toHaveBeenLastCalledWith(expect.objectContaining({ profile: OWN_PROFILE }), expect.anything());

      await user.click(screen.getByRole("button", { name: "Close form" }));
      expect(screen.queryByRole("button", { name: "Close form" })).not.toBeInTheDocument();
    });

    it("keeps the open form, on the profile it was opened with, when the session ends under it", async () => {
      const { user, EditPublisherProfileDialog, rerender } = setup({ ownProfile: OWN_PROFILE });
      await user.click(screen.getByRole("button", { name: "Edit profile" }));

      rerender({ isSignedIn: false });

      expect(screen.getByRole("button", { name: "Close form" })).toBeInTheDocument();
      expect(EditPublisherProfileDialog).toHaveBeenLastCalledWith(expect.objectContaining({ profile: OWN_PROFILE }), expect.anything());
      expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
    });

    it("shows no notice while the public page shows the saved profile", () => {
      setup({ ownProfile: OWN_PROFILE });

      expect(screen.queryByText(PUBLIC_PAGE_BEHIND_NOTICE)).not.toBeInTheDocument();
    });

    it.each([
      ["bio", { bio: "A brand new bio." }],
      ["number of links", { links: [PUBLISHER.links[0]] }],
      ["address of a link", { links: [{ url: "https://lambdagarage.io/", label: null }, PUBLISHER.links[1]] }],
      ["label of a link", { links: [PUBLISHER.links[0], { url: "https://github.com/lambda-garage", label: "Code" }] }]
    ])("shows the saved profile and says the public page is behind when the %s differs", (_, change) => {
      setup({ ownProfile: { ...OWN_PROFILE, ...change } });

      expect(screen.getByRole("status")).toHaveTextContent(PUBLIC_PAGE_BEHIND_NOTICE);
    });

    it("shows a member the saved bio and links rather than the ones the public page still serves", () => {
      setup({ ownProfile: { ...OWN_PROFILE, canEdit: false, bio: "A brand new bio.", links: [{ url: "https://lambdagarage.io/", label: null }] } });

      expect(screen.getByText("A brand new bio.")).toBeInTheDocument();
      expect(screen.queryByText("We build GPU inference stacks for small teams.")).not.toBeInTheDocument();
      expect(within(screen.getByRole("list", { name: "Links" })).getAllByRole("link")).toHaveLength(1);
      expect(screen.getByRole("link", { name: /lambdagarage\.io/ })).toBeInTheDocument();
    });
  });

  function shownTitles() {
    return screen.queryAllByTestId("card").map(card => card.textContent);
  }

  function useMountCounter(onMount: () => void) {
    React.useEffect(() => onMount(), []);
  }

  function setup(input: {
    publisher?: Partial<TemplatePublisherPage>;
    error?: Error;
    hasLoadedBefore?: boolean;
    isLoading?: boolean;
    isSignedIn?: boolean;
    ownProfile?: CurrentTemplatePublisher;
    sort?: GallerySort;
    search?: string;
    GalleryEntryList?: typeof DEPENDENCIES.GalleryEntryList;
  }) {
    const refetch = vi.fn();
    const publisher = (input.error && !input.hasLoadedBefore) || input.isLoading ? undefined : { ...PUBLISHER, ...input.publisher };
    const publisherQuery = Object.assign(mock<PublisherQuery>(), {
      data: publisher,
      error: input.error ?? null,
      isError: !!input.error,
      isLoading: !!input.isLoading,
      refetch
    });
    const ownProfileQuery = Object.assign(mock<OwnProfileQuery>(), { data: input.ownProfile });
    const customUser = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>(), {
      user: input.isSignedIn === false ? undefined : { userId: "user-1" }
    });
    const urlState = Object.assign(mock<UrlState>(), { sort: input.sort ?? "popular", search: input.search ?? "" });
    const useTemplateGalleryUrlState = vi.fn<typeof DEPENDENCIES.useTemplateGalleryUrlState>(() => urlState);
    const useCurrentTemplatePublisher = vi.fn<typeof DEPENDENCIES.useCurrentTemplatePublisher>(() => ownProfileQuery);
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const NextSeo = vi.fn<typeof DEPENDENCIES.NextSeo>(() => <></>);
    const GalleryEntryList =
      input.GalleryEntryList ??
      vi.fn<typeof DEPENDENCIES.GalleryEntryList>(({ entries }) => (
        <>
          {entries.map(entry => (
            <div key={entry.key} data-testid="card">
              {entry.title}
            </div>
          ))}
        </>
      ));
    const EditPublisherProfileDialog = vi.fn<typeof DEPENDENCIES.EditPublisherProfileDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        Close form
      </button>
    ));
    const dependencies: typeof DEPENDENCIES = {
      Layout,
      NextSeo,
      GalleryEntryList,
      PublisherLinkList,
      EditPublisherProfileDialog,
      useTemplatePublisher: () => publisherQuery,
      useCurrentTemplatePublisher,
      useTemplateGalleryUrlState,
      useCustomUser: () => customUser
    };

    const view = render(<PublisherPage handle="lambda-garage" dependencies={dependencies} />);

    return {
      ...view,
      user: userEvent.setup(),
      rerender: (next: { sort?: GallerySort; search?: string; templates?: TemplatePublisherPage["templates"]; handle?: string; isSignedIn?: boolean } = {}) => {
        if (next.isSignedIn === false) customUser.user = undefined;
        urlState.sort = next.sort ?? input.sort ?? "popular";
        urlState.search = next.search ?? input.search ?? "";
        if (next.templates && publisherQuery.data) publisherQuery.data = { ...publisherQuery.data, templates: next.templates };
        view.rerender(<PublisherPage handle={next.handle ?? "lambda-garage"} dependencies={dependencies} />);
      },
      refetch,
      urlState,
      useTemplateGalleryUrlState,
      useCurrentTemplatePublisher,
      Layout,
      NextSeo,
      GalleryEntryList: GalleryEntryList as ReturnType<typeof vi.fn<typeof DEPENDENCIES.GalleryEntryList>>,
      EditPublisherProfileDialog
    };
  }
});
