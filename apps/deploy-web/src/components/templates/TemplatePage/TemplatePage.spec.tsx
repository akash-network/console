import { useEffect } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { MarketplaceTemplate, TemplateVersionSummary } from "@src/types/marketplace-template";
import type { OrganizationOutput } from "@src/types/organization";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, TemplatePage } from "./TemplatePage";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildMarketplaceTemplate, buildTemplateVersion, buildTemplateVersionSummary } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type TemplateQuery = ReturnType<typeof DEPENDENCIES.useMarketplaceTemplate>;
type VersionsQuery = ReturnType<typeof DEPENDENCIES.useTemplateVersions>;
type VersionQuery = ReturnType<typeof DEPENDENCIES.useTemplateVersion>;
type FavoriteMutation = ReturnType<typeof DEPENDENCIES.useAddFavoriteTemplate>;

const TEMPLATE_ID = "tpl-webui";
const CURRENT_VERSION = buildTemplateVersion({ templateId: TEMPLATE_ID, version: 3, readme: "# Open WebUI" });
const PREVIOUS_VERSION = buildTemplateVersion({ templateId: TEMPLATE_ID, version: 2, readme: "# Open WebUI (v2)" });
const VERSIONS = [3, 2, 1].map(version => buildTemplateVersionSummary({ templateId: TEMPLATE_ID, version }));
const TEMPLATE = buildMarketplaceTemplate({
  id: TEMPLATE_ID,
  title: "Open WebUI + vLLM",
  summary: "Private ChatGPT-style chat on your own GPU.",
  icon: "message-square",
  visibility: "organization",
  publisher: {
    name: "Northwind Labs",
    slug: "northwind-labs",
    type: "team",
    handle: null,
    verified: false,
    memberSince: null,
    counts: { templates: 0, deploys: 0 }
  },
  currentVersion: CURRENT_VERSION,
  usage: { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null, forks: 0, favorites: 0 }
});

describe(TemplatePage.name, () => {
  it("shows the template's icon, title, visibility, current version and summary", () => {
    const { TemplateIcon } = setup({});

    expect(screen.getByRole("heading", { level: 1, name: "Open WebUI + vLLM" })).toBeInTheDocument();
    expect(TemplateIcon).toHaveBeenCalledWith(expect.objectContaining({ icon: "message-square" }), expect.anything());
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("v3 current")).toBeInTheDocument();
    expect(screen.getByText("Private ChatGPT-style chat on your own GPU.")).toBeInTheDocument();
  });

  it("leaves out a summary the template does not have", () => {
    const { NextSeo } = setup({ template: { ...TEMPLATE, summary: null } });

    expect(screen.queryByText("Private ChatGPT-style chat on your own GPU.")).not.toBeInTheDocument();
    expect(NextSeo).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Open WebUI + vLLM · Template", description: "A template you can deploy on Akash Network from Akash Console." }),
      expect.anything()
    );
  });

  it("describes the page with the template's summary", () => {
    const { NextSeo } = setup({});

    expect(NextSeo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Open WebUI + vLLM · Template",
        description: "Private ChatGPT-style chat on your own GPU.",
        openGraph: expect.objectContaining({ title: "Open WebUI + vLLM" })
      }),
      expect.anything()
    );
  });

  describe("the page view event", () => {
    it("names the template and its current version once the template has loaded", () => {
      const { useTrackTemplateEvent } = setup({ template: { ...TEMPLATE, visibility: "public" } });

      expect(useTrackTemplateEvent).toHaveBeenLastCalledWith("template_page_viewed", { source: "community", templateId: TEMPLATE_ID, templateVersion: 3 });
    });

    it("names a private template as private and one without a version with none", () => {
      const { useTrackTemplateEvent } = setup({ template: { ...TEMPLATE, visibility: "private", currentVersion: null } });

      expect(useTrackTemplateEvent).toHaveBeenLastCalledWith("template_page_viewed", { source: "private", templateId: TEMPLATE_ID, templateVersion: null });
    });

    it("names nothing while the template loads", () => {
      const { useTrackTemplateEvent } = setup({ isLoading: true });

      expect(useTrackTemplateEvent).toHaveBeenLastCalledWith("template_page_viewed", undefined);
    });

    it("names nothing for a template that cannot be read", () => {
      const { useTrackTemplateEvent } = setup({ error: new ApiError(404, { message: "Not found" }, "404") });

      expect(useTrackTemplateEvent).toHaveBeenLastCalledWith("template_page_viewed", undefined);
    });
  });

  describe("head tags", () => {
    const LISTED_TEMPLATE = { ...TEMPLATE, visibility: "public" as const, isListed: true, publishedAt: "2026-10-01T00:00:00.000Z" };

    it("lets a listed template be indexed at its own address, with its preview image", () => {
      const { NextSeo } = setup({ template: LISTED_TEMPLATE, isSignedIn: false });

      expect(NextSeo).toHaveBeenCalledWith(
        expect.objectContaining({
          noindex: false,
          canonical: "https://console.akash.network/template/tpl-webui",
          openGraph: expect.objectContaining({
            url: "https://console.akash.network/template/tpl-webui",
            images: [expect.objectContaining({ url: "https://console.akash.network/api/og/template/tpl-webui" })]
          })
        }),
        expect.anything()
      );
    });

    it("names the same address whatever tab is open", () => {
      const { NextSeo } = setup({ template: LISTED_TEMPLATE, tab: "configuration" });

      expect(NextSeo).toHaveBeenCalledWith(expect.objectContaining({ canonical: "https://console.akash.network/template/tpl-webui" }), expect.anything());
    });

    it("keeps a public template the gallery does not list out of search engines", () => {
      const { NextSeo } = setup({ template: { ...LISTED_TEMPLATE, isListed: false }, isSignedIn: false });

      expect(NextSeo).toHaveBeenCalledWith(expect.objectContaining({ noindex: true }), expect.anything());
    });

    it("keeps the owner's view, with its Settings tab, out of search engines", () => {
      const { NextSeo } = setup({ template: { ...LISTED_TEMPLATE, canEdit: true }, tab: "settings" });

      expect(NextSeo).toHaveBeenCalledWith(expect.objectContaining({ noindex: true }), expect.anything());
    });
  });

  it("shows deploys, the still-up share and the last deploy", () => {
    setup({
      template: {
        ...TEMPLATE,
        usage: { deploys: 1284, stillUpAfter24h: 0.936, lastDeployedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), forks: 0, favorites: 0 }
      }
    });

    expect(screen.getByText("1,284 deploys · 94% still up after 24 h · Last deployed 2 hours ago")).toBeInTheDocument();
  });

  it("drops the usage parts that have no data", () => {
    setup({ template: { ...TEMPLATE, usage: { deploys: 1, stillUpAfter24h: null, lastDeployedAt: null, forks: 0, favorites: 0 } } });

    expect(screen.getByText("1 deploy")).toBeInTheDocument();
    expect(screen.queryByText(/still up after 24 h/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last deployed/)).not.toBeInTheDocument();
  });

  it("shows no usage line before the first deploy", () => {
    setup({});

    expect(screen.queryByText(/deploys?\b/)).not.toBeInTheDocument();
  });

  it("adds forks and favorites to the usage line, in the singular for one", () => {
    const { unmount } = setup({
      template: { ...TEMPLATE, usage: { deploys: 1284, lastDeployedAt: null, stillUpAfter24h: 0.94, forks: 1037, favorites: 214 } }
    });
    expect(screen.getByText("1,284 deploys · 94% still up after 24 h · 1,037 forks · 214 favorites")).toBeInTheDocument();
    unmount();

    setup({ template: { ...TEMPLATE, usage: { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null, forks: 1, favorites: 1 } } });
    expect(screen.getByText("1 fork · 1 favorite")).toBeInTheDocument();
  });

  describe("trust signals", () => {
    const PUBLISHER = {
      name: "Lambda Garage",
      slug: "lambda-garage",
      type: "team" as const,
      handle: "lambda-garage",
      verified: true,
      memberSince: "2025-07-11T12:00:00.000Z",
      counts: { templates: 7, deploys: 18400 }
    };
    const COMMUNITY_TEMPLATE = { ...TEMPLATE, visibility: "public" as const, isListed: true, publishedAt: "2026-10-30T12:00:00.000Z", publisher: PUBLISHER };

    it("warns that a public community template is not reviewed by Akash and names its publisher", () => {
      const { TemplateReviewNotice } = setup({ template: COMMUNITY_TEMPLATE });

      expect(TemplateReviewNotice).toHaveBeenLastCalledWith({ isOfficial: false, publisherName: "Lambda Garage" }, expect.anything());
      expect(screen.getByText("Community")).toBeInTheDocument();
      expect(screen.queryByText("Official")).not.toBeInTheDocument();
    });

    it("says an Official template is Official instead", () => {
      const { TemplateReviewNotice } = setup({ template: { ...COMMUNITY_TEMPLATE, isOfficial: true } });

      expect(TemplateReviewNotice).toHaveBeenLastCalledWith({ isOfficial: true, publisherName: "Lambda Garage" }, expect.anything());
      expect(screen.getByText("Official")).toBeInTheDocument();
      expect(screen.queryByText("Community")).not.toBeInTheDocument();
    });

    it("passes no publisher name when the template has no publisher", () => {
      const { TemplateReviewNotice, TemplatePublisherCard } = setup({ template: { ...COMMUNITY_TEMPLATE, publisher: null } });

      expect(TemplateReviewNotice).toHaveBeenLastCalledWith({ isOfficial: false, publisherName: undefined }, expect.anything());
      expect(TemplatePublisherCard).not.toHaveBeenCalled();
    });

    it("shows the publisher card with the publish date and the current version", () => {
      const { TemplatePublisherCard } = setup({ template: COMMUNITY_TEMPLATE });

      const props = TemplatePublisherCard.mock.lastCall?.[0];
      expect(props).toMatchObject({ publishedAt: "2026-10-30T12:00:00.000Z", currentVersion: CURRENT_VERSION.version });
      expect(props?.publisher.name).toBe("Lambda Garage");
      expect(props?.publisher.verified).toBe(true);
      expect(props?.publisher.counts.deploys).toBe(18400);
    });

    it("shows the publisher card without a version for a template that has none", () => {
      const { TemplatePublisherCard } = setup({ template: { ...COMMUNITY_TEMPLATE, currentVersion: null } });

      expect(TemplatePublisherCard).toHaveBeenLastCalledWith(expect.objectContaining({ currentVersion: undefined }), expect.anything());
    });

    it.each(["private", "organization"] as const)("shows neither the notice, the badge nor the publisher card on a %s template", visibility => {
      const { TemplateReviewNotice, TemplatePublisherCard } = setup({ template: { ...COMMUNITY_TEMPLATE, visibility, isOfficial: true } });

      expect(TemplateReviewNotice).not.toHaveBeenCalled();
      expect(TemplatePublisherCard).not.toHaveBeenCalled();
      expect(screen.queryByText("Community")).not.toBeInTheDocument();
      expect(screen.queryByText("Official")).not.toBeInTheDocument();
    });

    it("says what a fork was forked from and links to it", () => {
      setup({ template: { ...TEMPLATE, copiedFromId: "tpl-source", copiedFrom: { id: "tpl-source", title: "Open WebUI + vLLM original" } } });

      expect(screen.getByText(/Forked from/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Open WebUI + vLLM original" })).toHaveAttribute("href", "/template/tpl-source");
    });

    it("says nothing about a source the viewer can no longer read", () => {
      setup({ template: { ...TEMPLATE, copiedFromId: null, copiedFrom: null } });

      expect(screen.queryByText(/Forked from/)).not.toBeInTheDocument();
    });

    it("renders markup in the title of the forked template as text", () => {
      const hostile = "<img src=x onerror=alert(1)>";
      setup({ template: { ...TEMPLATE, copiedFromId: "tpl-source", copiedFrom: { id: "tpl-source", title: hostile } } });

      expect(screen.getByRole("link", { name: hostile })).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("fork", () => {
    const PUBLIC_TEMPLATE = { ...TEMPLATE, visibility: "public" as const };

    it("opens Configure in template mode with the current version of a public template", () => {
      setup({ template: PUBLIC_TEMPLATE });

      expect(screen.getByRole("link", { name: "Fork" })).toHaveAttribute(
        "href",
        UrlService.configureTemplate({ mode: "new", copyFromTemplateId: TEMPLATE_ID, copyFromVersion: CURRENT_VERSION.version })
      );
    });

    it("forks the version an editor is looking at", async () => {
      setup({ template: { ...PUBLIC_TEMPLATE, canEdit: true }, tab: "versions" });

      await userEvent.click(screen.getByRole("button", { name: "View v2" }));

      expect(screen.getByRole("link", { name: "Fork" })).toHaveAttribute(
        "href",
        UrlService.configureTemplate({ mode: "new", copyFromTemplateId: TEMPLATE_ID, copyFromVersion: 2 })
      );
    });

    it("sends a signed-out visitor to sign in and back into the fork", () => {
      setup({ template: PUBLIC_TEMPLATE, isSignedIn: false });

      const forkUrl = UrlService.configureTemplate({ mode: "new", copyFromTemplateId: TEMPLATE_ID, copyFromVersion: CURRENT_VERSION.version });
      expect(screen.getByRole("link", { name: "Fork" })).toHaveAttribute("href", UrlService.newLogin({ returnTo: forkUrl }));
      expect(UrlService.newLogin({ returnTo: forkUrl })).toContain(encodeURIComponent(forkUrl));
    });

    it.each(["private", "organization"] as const)("offers no fork on a %s template", visibility => {
      setup({ template: { ...TEMPLATE, visibility } });

      expect(screen.queryByRole("link", { name: "Fork" })).not.toBeInTheDocument();
    });

    it("offers no fork on a public template without a saved version", () => {
      setup({ template: { ...PUBLIC_TEMPLATE, currentVersion: null } });

      expect(screen.queryByRole("link", { name: "Fork" })).not.toBeInTheDocument();
    });
  });

  it("shows editors Edit configuration and Settings, and viewers neither", () => {
    const { unmount } = setup({ template: { ...TEMPLATE, canEdit: true } });

    expect(screen.getByRole("link", { name: "Edit configuration" })).toHaveAttribute(
      "href",
      UrlService.configureTemplate({ mode: "edit", userTemplateId: TEMPLATE_ID, baseVersion: TEMPLATE.currentVersion?.version })
    );
    expect(screen.getByRole("link", { name: "Edit configuration" }).getAttribute("href")).toMatch(/[?&]baseVersion=\d+/);
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Version" })).toBeInTheDocument();
    expect(screen.getByText("Edit configuration and Settings show only to members of Northwind Labs")).toBeInTheDocument();

    unmount();
    setup({ template: { ...TEMPLATE, canEdit: false } });

    expect(screen.queryByRole("link", { name: "Edit configuration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Version" })).not.toBeInTheDocument();
    expect(screen.queryByText(/show only to members of/)).not.toBeInTheDocument();
  });

  it("names the editor's organization generically when the template has no publisher", () => {
    setup({ template: { ...TEMPLATE, canEdit: true, publisher: null } });

    expect(screen.getByText("Edit configuration and Settings show only to members of your organization")).toBeInTheDocument();
  });

  it("deploys the current version by default", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute(
      "href",
      UrlService.configureDeployment({ userTemplateId: TEMPLATE_ID, templateVersion: 3 })
    );
  });

  it("deploys the selected version", async () => {
    const { useTemplateVersion, TemplateReadmeTab } = setup({ template: { ...TEMPLATE, canEdit: true } });

    await userEvent.click(screen.getByRole("combobox", { name: "Version" }));
    expect(screen.getByRole("option", { name: "v3 Current" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "v2" }));

    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute(
      "href",
      UrlService.configureDeployment({ userTemplateId: TEMPLATE_ID, templateVersion: 2 })
    );
    expect(useTemplateVersion).toHaveBeenLastCalledWith(TEMPLATE_ID, 2);
    expect(TemplateReadmeTab).toHaveBeenLastCalledWith(
      { templateId: TEMPLATE_ID, version: expect.objectContaining({ version: 2, readme: PREVIOUS_VERSION.readme }), canEdit: false },
      expect.anything()
    );
  });

  it("starts the README afresh for another version, so an open draft never saves onto it", async () => {
    const mountReadme = vi.fn();
    const TemplateReadmeTab = vi.fn<typeof DEPENDENCIES.TemplateReadmeTab>(({ version }) => {
      useEffect(() => mountReadme(version.version), []);
      return null;
    });
    setup({ template: { ...TEMPLATE, canEdit: true }, TemplateReadmeTab });

    await userEvent.click(screen.getByRole("combobox", { name: "Version" }));
    await userEvent.click(screen.getByRole("option", { name: "v2" }));

    expect(mountReadme.mock.calls).toEqual([[3], [2]]);
  });

  it("keeps an open README draft when a refetch brings a newer current version", async () => {
    const mountReadme = vi.fn();
    const TemplateReadmeTab = vi.fn<typeof DEPENDENCIES.TemplateReadmeTab>(({ version }) => {
      useEffect(() => mountReadme(version.version), []);
      return null;
    });
    const { receiveFromServer } = setup({ template: { ...TEMPLATE, canEdit: true }, TemplateReadmeTab });

    const nextVersion = buildTemplateVersion({ templateId: TEMPLATE_ID, version: 4, readme: "# Open WebUI (v4)" });
    receiveFromServer({ template: { ...TEMPLATE, canEdit: true, currentVersion: nextVersion } });

    expect(mountReadme.mock.calls).toEqual([[3]]);
    expect(TemplateReadmeTab).toHaveBeenLastCalledWith(
      { templateId: TEMPLATE_ID, version: expect.objectContaining({ version: 4 }), canEdit: true },
      expect.anything()
    );
  });

  it("keeps the README mounted on another tab, so an open draft survives the switch", async () => {
    const unmountReadme = vi.fn();
    const TemplateReadmeTab = vi.fn<typeof DEPENDENCIES.TemplateReadmeTab>(() => {
      useEffect(() => unmountReadme, []);
      return <p>README editor</p>;
    });
    const { router, receiveFromServer } = setup({ template: { ...TEMPLATE, canEdit: true }, TemplateReadmeTab });

    router.query = { id: TEMPLATE_ID, tab: "versions" };
    receiveFromServer({ template: { ...TEMPLATE, canEdit: true } });

    expect(screen.getByRole("tab", { name: /Versions/ })).toHaveAttribute("aria-selected", "true");
    expect(unmountReadme).not.toHaveBeenCalled();
    expect(screen.getByRole("tabpanel", { name: "README", hidden: true })).toHaveAttribute("data-state", "inactive");
  });

  it("follows a new current version once the current one is picked again", async () => {
    const { receiveFromServer, TemplateReadmeTab } = setup({ template: { ...TEMPLATE, canEdit: true } });
    await userEvent.click(screen.getByRole("combobox", { name: "Version" }));
    await userEvent.click(screen.getByRole("option", { name: "v2" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Version" }));
    await userEvent.click(screen.getByRole("option", { name: "v3 Current" }));

    const nextVersion = buildTemplateVersion({ templateId: TEMPLATE_ID, version: 4, readme: "# Open WebUI (v4)" });
    receiveFromServer({
      template: { ...TEMPLATE, canEdit: true, currentVersion: nextVersion },
      versions: [buildTemplateVersionSummary({ templateId: TEMPLATE_ID, version: 4 }), ...VERSIONS]
    });

    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute(
      "href",
      UrlService.configureDeployment({ userTemplateId: TEMPLATE_ID, templateVersion: 4 })
    );
    expect(TemplateReadmeTab).toHaveBeenLastCalledWith(
      { templateId: TEMPLATE_ID, version: expect.objectContaining({ version: 4 }), canEdit: true },
      expect.anything()
    );
  });

  it("waits for a selected version to load before showing it", async () => {
    const { TemplateReadmeTab } = setup({ template: { ...TEMPLATE, canEdit: true }, isPreviousVersionLoading: true });
    TemplateReadmeTab.mockClear();

    await userEvent.click(screen.getByRole("combobox", { name: "Version" }));
    await userEvent.click(screen.getByRole("option", { name: "v2" }));

    expect(TemplateReadmeTab).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Loading v2" })).toBeInTheDocument();
  });

  it("explains a selected version that could not be loaded", async () => {
    setup({ template: { ...TEMPLATE, canEdit: true }, isPreviousVersionFailing: true });

    await userEvent.click(screen.getByRole("combobox", { name: "Version" }));
    await userEvent.click(screen.getByRole("option", { name: "v2" }));

    expect(screen.getByText("Couldn't load v2.")).toBeInTheDocument();
  });

  it("asks for no other version while the current one is shown", () => {
    const { useTemplateVersion } = setup({});

    expect(useTemplateVersion).toHaveBeenCalledWith(TEMPLATE_ID, undefined);
    expect(useTemplateVersion).not.toHaveBeenCalledWith(TEMPLATE_ID, 3);
  });

  it("lets editors edit the README of the current version", () => {
    const { TemplateReadmeTab } = setup({ template: { ...TEMPLATE, canEdit: true } });

    expect(TemplateReadmeTab).toHaveBeenCalledWith(
      { templateId: TEMPLATE_ID, version: expect.objectContaining({ version: 3, readme: CURRENT_VERSION.readme }), canEdit: true },
      expect.anything()
    );
  });

  it("counts the versions on the Versions tab", () => {
    const { useTemplateVersions } = setup({});

    expect(screen.getByRole("tab", { name: "Versions 3" })).toBeInTheDocument();
    expect(useTemplateVersions).toHaveBeenCalledWith(TEMPLATE_ID, { enabled: true });
  });

  it("lists the versions on the Versions tab for the page's selection", () => {
    const { TemplateVersionsTab } = setup({ tab: "versions", template: { ...TEMPLATE, canEdit: true } });

    expect(TemplateVersionsTab).toHaveBeenCalledWith(
      {
        templateId: TEMPLATE_ID,
        versions: expect.arrayContaining([expect.objectContaining({ version: 3 }), expect.objectContaining({ version: 2 })]),
        currentVersion: 3,
        shownVersion: 3,
        canEdit: true,
        onView: expect.any(Function)
      },
      expect.anything()
    );
  });

  it("selects a version when View is clicked on the Versions tab", async () => {
    const { useTemplateVersion, TemplateVersionsTab } = setup({ tab: "versions", template: { ...TEMPLATE, canEdit: true } });

    await userEvent.click(screen.getByRole("button", { name: "View v2" }));

    expect(useTemplateVersion).toHaveBeenLastCalledWith(TEMPLATE_ID, 2);
    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute(
      "href",
      UrlService.configureDeployment({ userTemplateId: TEMPLATE_ID, templateVersion: 2 })
    );
    expect(TemplateVersionsTab).toHaveBeenLastCalledWith(expect.objectContaining({ shownVersion: 2 }), expect.anything());
  });

  it("follows a new current version after View picks the current one again", async () => {
    const { receiveFromServer } = setup({ tab: "versions", template: { ...TEMPLATE, canEdit: true } });
    await userEvent.click(screen.getByRole("button", { name: "View v2" }));
    await userEvent.click(screen.getByRole("button", { name: "View v3" }));

    receiveFromServer({
      template: { ...TEMPLATE, canEdit: true, currentVersion: buildTemplateVersion({ templateId: TEMPLATE_ID, version: 4 }) },
      versions: [buildTemplateVersionSummary({ templateId: TEMPLATE_ID, version: 4 }), ...VERSIONS]
    });

    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute(
      "href",
      UrlService.configureDeployment({ userTemplateId: TEMPLATE_ID, templateVersion: 4 })
    );
  });

  it("waits for the versions to load on the Versions tab", () => {
    const { TemplateVersionsTab } = setup({ tab: "versions", isLoadingVersions: true });

    expect(screen.getByRole("status", { name: "Loading versions" })).toBeInTheDocument();
    expect(TemplateVersionsTab).not.toHaveBeenCalled();
  });

  it("explains versions that could not be loaded", () => {
    setup({ tab: "versions", isFailingVersions: true });

    expect(screen.getByText("Couldn't load the versions.")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading versions" })).not.toBeInTheDocument();
  });

  it("keeps the selected tab in the URL", async () => {
    const { router } = setup({});

    await userEvent.click(screen.getByRole("tab", { name: "Configuration" }));

    expect(router.replace).toHaveBeenCalledWith({ pathname: "/template/[id]", query: { id: TEMPLATE_ID, tab: "configuration" } }, undefined, {
      shallow: true,
      scroll: false
    });
  });

  it("opens the tab the URL names", () => {
    const { TemplateConfigurationTab } = setup({ tab: "configuration" });

    expect(screen.getByRole("tab", { name: "Configuration" })).toHaveAttribute("aria-selected", "true");
    expect(TemplateConfigurationTab).toHaveBeenCalledWith({ version: expect.objectContaining({ version: 3, sdl: CURRENT_VERSION.sdl }) }, expect.anything());
  });

  it("opens the README when the URL names a tab the caller does not get", () => {
    setup({ tab: "settings" });

    expect(screen.getByRole("tab", { name: "README" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens Settings from the URL for an editor", () => {
    setup({ template: { ...TEMPLATE, canEdit: true }, tab: "settings" });

    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an editor the template's settings on the Settings tab", () => {
    const { TemplateSettingsTab } = setup({ template: { ...TEMPLATE, canEdit: true }, tab: "settings" });

    expect(TemplateSettingsTab).toHaveBeenCalledWith({ template: expect.objectContaining({ id: TEMPLATE_ID, title: "Open WebUI + vLLM" }) }, expect.anything());
  });

  it("keeps the settings out of other tabs and out of a viewer's page", () => {
    const { TemplateSettingsTab, unmount } = setup({ template: { ...TEMPLATE, canEdit: true } });
    expect(TemplateSettingsTab).not.toHaveBeenCalled();

    unmount();
    const viewer = setup({ template: { ...TEMPLATE, canEdit: false }, tab: "settings" });

    expect(viewer.TemplateSettingsTab).not.toHaveBeenCalled();
  });

  it("explains a template saved without a version", () => {
    const { TemplateReadmeTab } = setup({ template: { ...TEMPLATE, currentVersion: null } });

    expect(screen.getByText("This template has no saved version yet.")).toBeInTheDocument();
    expect(TemplateReadmeTab).not.toHaveBeenCalled();
    expect(screen.queryByText(/current$/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute("href", UrlService.configureDeployment({ userTemplateId: TEMPLATE_ID }));
  });

  it("shows the shared not-found state for a template it cannot read", () => {
    const { NotFoundPage, Layout } = setup({ error: new ApiError(404, { message: "Not found" }, "not found") });

    expect(NotFoundPage).toHaveBeenCalled();
    expect(Layout).not.toHaveBeenCalled();
  });

  describe("when the template was removed", () => {
    it.each(["readme", "configuration", "versions", "settings"])("says so with its title on the %s tab instead of an error", tab => {
      const { RemovedTemplateNotice, NotFoundPage, NextSeo, useTemplateVersions } = setup({ tab, error: removedError("Open WebUI + vLLM") });

      expect(RemovedTemplateNotice).toHaveBeenCalledWith({ title: "Open WebUI + vLLM", isSignedIn: true }, expect.anything());
      expect(NextSeo).toHaveBeenCalledWith(expect.objectContaining({ title: "Template removed", noindex: true }), expect.anything());
      expect(NotFoundPage).not.toHaveBeenCalled();
      expect(screen.queryByText("Couldn't load this template.")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Deploy" })).not.toBeInTheDocument();
      expect(useTemplateVersions).toHaveBeenLastCalledWith(TEMPLATE_ID, { enabled: false });
    });

    it("tells the notice when the visitor is signed out", () => {
      const { RemovedTemplateNotice } = setup({ error: removedError("Open WebUI + vLLM"), isSignedIn: false });

      expect(RemovedTemplateNotice).toHaveBeenCalledWith({ title: "Open WebUI + vLLM", isSignedIn: false }, expect.anything());
    });

    it("keeps a 410 that is not a removal on the retry state", () => {
      const { RemovedTemplateNotice } = setup({ error: new ApiError(410, { code: "gone" }, "410") });

      expect(RemovedTemplateNotice).not.toHaveBeenCalled();
      expect(screen.getByText("Couldn't load this template.")).toBeInTheDocument();
    });
  });

  describe("reporting", () => {
    const PUBLIC_TEMPLATE: MarketplaceTemplate = { ...TEMPLATE, visibility: "public", isListed: true, canEdit: false, author: { username: "priya" } };

    it("offers Report on a public template to someone outside the publishing organization", async () => {
      const { ReportTemplateDialog } = setup({ template: PUBLIC_TEMPLATE });

      expect(ReportTemplateDialog).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Report this template" }));

      expect(ReportTemplateDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({ template: expect.objectContaining({ id: TEMPLATE_ID }) }),
        expect.anything()
      );
    });

    it("closes the report dialog when it asks to", async () => {
      setup({ template: PUBLIC_TEMPLATE });
      await userEvent.click(screen.getByRole("button", { name: "Report this template" }));

      await userEvent.click(screen.getByRole("button", { name: "Close the report dialog" }));

      expect(screen.queryByRole("button", { name: "Close the report dialog" })).not.toBeInTheDocument();
    });

    it.each([
      ["an editor", { ...PUBLIC_TEMPLATE, canEdit: true }, undefined],
      ["a template that is not public", { ...PUBLIC_TEMPLATE, visibility: "organization" as const }, undefined],
      ["a hidden template", { ...PUBLIC_TEMPLATE, moderationStatus: "hidden" as const }, undefined],
      ["a member of the publishing team who cannot edit", PUBLIC_TEMPLATE, [{ type: "team" as const, slug: "northwind-labs" }]]
    ])("offers no Report to %s", (_, template, organizations) => {
      setup({ template, organizations });

      expect(screen.queryByRole("button", { name: "Report this template" })).not.toBeInTheDocument();
    });

    it("offers no Report to the owner of the personal account that published it", () => {
      setup({
        template: {
          ...PUBLIC_TEMPLATE,
          publisher: {
            name: "sam.rivera",
            slug: null,
            type: "personal",
            handle: "sam-rivera",
            verified: false,
            memberSince: null,
            counts: { templates: 0, deploys: 0 }
          },
          author: { username: "sam.rivera" }
        }
      });

      expect(screen.queryByRole("button", { name: "Report this template" })).not.toBeInTheDocument();
    });

    it("sends a signed-out visitor to sign in and back to the template", async () => {
      const { router, ReportTemplateDialog } = setup({ template: PUBLIC_TEMPLATE, isSignedIn: false });

      await userEvent.click(screen.getByRole("button", { name: "Report this template" }));

      expect(router.push).toHaveBeenCalledWith(UrlService.newLogin({ returnTo: UrlService.template(TEMPLATE_ID) }));
      expect(ReportTemplateDialog).not.toHaveBeenCalled();
    });

    it("sends a reporter whose session ended to sign in and back to the template", async () => {
      const { router } = setup({ template: PUBLIC_TEMPLATE });
      await userEvent.click(screen.getByRole("button", { name: "Report this template" }));

      await userEvent.click(screen.getByRole("button", { name: "Report while signed out" }));

      expect(router.push).toHaveBeenCalledWith(UrlService.newLogin({ returnTo: UrlService.template(TEMPLATE_ID) }));
    });

    it("reloads the template when the report finds it was removed", async () => {
      const { refetch } = setup({ template: PUBLIC_TEMPLATE });
      await userEvent.click(screen.getByRole("button", { name: "Report this template" }));

      await userEvent.click(screen.getByRole("button", { name: "Report a removed template" }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  it("offers a retry when the template fails to load", async () => {
    const { refetch, NotFoundPage } = setup({ error: new ApiError(503, { message: "Unavailable" }, "unavailable") });

    expect(screen.getByText("Couldn't load this template.")).toBeInTheDocument();
    expect(NotFoundPage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the layout's loading state while the template loads", () => {
    const { Layout } = setup({ isLoading: true });

    expect(Layout).toHaveBeenCalledWith(expect.objectContaining({ isLoading: true }), expect.anything());
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("adds a favorite for a signed-in user", async () => {
    const { addFavorite, removeFavorite } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Favorite" }));

    expect(addFavorite).toHaveBeenCalled();
    expect(removeFavorite).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "true");
  });

  it("removes a favorite", async () => {
    const { addFavorite, removeFavorite } = setup({ template: { ...TEMPLATE, isFavorite: true } });
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Favorite" }));

    expect(removeFavorite).toHaveBeenCalled();
    expect(addFavorite).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the favorite as it was when the change fails", async () => {
    const { enqueueSnackbar } = setup({ isFavoriteFailing: true });

    await userEvent.click(screen.getByRole("button", { name: "Favorite" }));

    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "false");
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
  });

  it("sends one favorite change for a double click", async () => {
    const { addFavorite, releaseFavoriteChange } = setup({ isFavoriteChangeHeld: true });

    await userEvent.dblClick(screen.getByRole("button", { name: "Favorite" }));
    await releaseFavoriteChange();

    expect(addFavorite).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "true");
  });

  it("takes the next favorite change once the previous one settles", async () => {
    const { addFavorite, removeFavorite } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Favorite" }));
    await userEvent.click(screen.getByRole("button", { name: "Favorite" }));

    expect(addFavorite).toHaveBeenCalledTimes(1);
    expect(removeFavorite).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "false");
  });

  it("follows the favorite the server reports after a change", async () => {
    const { receiveFromServer } = setup({});
    await userEvent.click(screen.getByRole("button", { name: "Favorite" }));

    receiveFromServer({ template: { ...TEMPLATE, isFavorite: true } });
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "true");

    receiveFromServer({ template: { ...TEMPLATE, isFavorite: false } });
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "false");
  });

  it("sends a visitor who favorites to sign in and back to the template, without asking the API", async () => {
    const { router, addFavorite, removeFavorite } = setup({ isSignedIn: false });
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: "Favorite" }));

    expect(router.push).toHaveBeenCalledWith(UrlService.newLogin({ returnTo: UrlService.template(TEMPLATE_ID) }));
    expect(addFavorite).not.toHaveBeenCalled();
    expect(removeFavorite).not.toHaveBeenCalled();
  });

  it("sends a visitor who deploys to sign in and on to Configure with the template", () => {
    setup({ isSignedIn: false });

    const deployUrl = UrlService.configureDeployment({ userTemplateId: TEMPLATE_ID, templateVersion: CURRENT_VERSION.version });
    expect(screen.getByRole("link", { name: "Deploy" })).toHaveAttribute("href", UrlService.newLogin({ returnTo: deployUrl }));
    expect(UrlService.newLogin({ returnTo: deployUrl })).toContain(encodeURIComponent(deployUrl));
  });

  describe("when the server already learned the template was removed", () => {
    it("shows the removed page with the title and asks the API for nothing", () => {
      const { RemovedTemplateNotice, NextSeo, useMarketplaceTemplate, useTemplateVersions } = setup({
        removedOnServer: { title: "Open WebUI + vLLM" },
        isSignedIn: false
      });

      expect(RemovedTemplateNotice).toHaveBeenCalledWith({ title: "Open WebUI + vLLM", isSignedIn: false }, expect.anything());
      expect(NextSeo).toHaveBeenCalledWith(expect.objectContaining({ title: "Template removed", noindex: true }), expect.anything());
      expect(useMarketplaceTemplate).toHaveBeenCalledWith(undefined);
      expect(useTemplateVersions).toHaveBeenCalledWith(TEMPLATE_ID, { enabled: false });
    });

    it("shows the removed page without a title when the API no longer gives one", () => {
      const { RemovedTemplateNotice } = setup({ removedOnServer: { title: null }, isSignedIn: false });

      expect(RemovedTemplateNotice).toHaveBeenCalledWith({ title: undefined, isSignedIn: false }, expect.anything());
    });
  });

  describe("sharing", () => {
    it("keeps the share dialog closed until it is asked for", () => {
      const { ShareTemplateDialog } = setup({});

      expect(ShareTemplateDialog).not.toHaveBeenCalled();
    });

    it("opens the share dialog for an editor, under the template's organization", async () => {
      const { ShareTemplateDialog } = setup({ template: { ...TEMPLATE, canEdit: true } });

      await userEvent.click(screen.getByRole("button", { name: "Share" }));

      expect(screen.getByRole("button", { name: "Share" })).toHaveTextContent("Share");
      expect(ShareTemplateDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({
          template: expect.objectContaining({ id: TEMPLATE_ID, title: "Open WebUI + vLLM", canEdit: true }),
          organization: { name: "Northwind Labs", type: "team" }
        }),
        expect.anything()
      );
    });

    it("gives a viewer a share button without the label, and a dialog that knows no organization for a template filed in none", async () => {
      const { ShareTemplateDialog } = setup({ template: { ...TEMPLATE, canEdit: false, publisher: null } });

      const share = screen.getByRole("button", { name: "Share" });
      expect(share).toHaveTextContent("");
      await userEvent.click(share);

      expect(ShareTemplateDialog).toHaveBeenLastCalledWith(expect.objectContaining({ organization: null }), expect.anything());
    });

    it("closes the share dialog", async () => {
      setup({});

      await userEvent.click(screen.getByRole("button", { name: "Share" }));
      await userEvent.click(screen.getByRole("button", { name: "Close the share dialog" }));

      expect(screen.queryByRole("button", { name: "Close the share dialog" })).not.toBeInTheDocument();
    });
  });

  describe("arriving from the Deploy on Akash badge", () => {
    it("records the arrival with the template, its version and the source", () => {
      const { analyticsService } = setup({ arrivalSource: "badge" });

      expect(analyticsService.track).toHaveBeenCalledWith(
        "template_badge_arrival",
        { category: "deployments", templateId: TEMPLATE_ID, templateVersion: 3, source: "badge" },
        "Amplitude"
      );
    });

    it("records an arrival at a template that has no version yet", () => {
      const { analyticsService } = setup({ arrivalSource: "badge", template: { ...TEMPLATE, currentVersion: null } });

      expect(analyticsService.track).toHaveBeenCalledWith("template_badge_arrival", expect.objectContaining({ templateVersion: null }), "Amplitude");
    });

    it("records it once, however often the page renders again", () => {
      const { analyticsService, receiveFromServer } = setup({ arrivalSource: "badge" });

      receiveFromServer({ template: { ...TEMPLATE, title: "Renamed" } });

      expect(analyticsService.track).toHaveBeenCalledTimes(1);
    });

    it("waits for the template before recording", () => {
      const { analyticsService, receiveFromServer } = setup({ arrivalSource: "badge", isLoading: true });

      expect(analyticsService.track).not.toHaveBeenCalled();
      receiveFromServer({ template: TEMPLATE });

      expect(analyticsService.track).toHaveBeenCalledTimes(1);
    });

    it.each([undefined, "newsletter"])("records nothing for a visit whose source is %j", arrivalSource => {
      const { analyticsService } = setup({ arrivalSource });

      expect(analyticsService.track).not.toHaveBeenCalled();
    });
  });

  it("links back to the templates gallery", () => {
    setup({});

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Templates" })).toHaveAttribute("href", UrlService.templates());
  });

  function removedError(title: string) {
    return new ApiError(410, { code: "template_removed", message: "This template was removed", data: { title } }, "410");
  }

  function setup(input: {
    template?: MarketplaceTemplate;
    versions?: TemplateVersionSummary[];
    tab?: string;
    error?: ApiError;
    isLoading?: boolean;
    isPreviousVersionLoading?: boolean;
    isPreviousVersionFailing?: boolean;
    isLoadingVersions?: boolean;
    isFailingVersions?: boolean;
    isSignedIn?: boolean;
    organizations?: { type: "personal" | "team"; slug: string }[];
    isFavoriteFailing?: boolean;
    isFavoriteChangeHeld?: boolean;
    arrivalSource?: string;
    removedOnServer?: { title: string | null };
    TemplateReadmeTab?: typeof DEPENDENCIES.TemplateReadmeTab;
  }) {
    const refetch = vi.fn();
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const favoriteChangeRelease = Promise.withResolvers<void>();
    if (!input.isFavoriteChangeHeld) favoriteChangeRelease.resolve();
    const changeFavorite = async () => {
      await favoriteChangeRelease.promise;
      if (input.isFavoriteFailing) throw new Error("refused");
      return mock<Awaited<ReturnType<FavoriteMutation["mutateAsync"]>>>();
    };
    const addFavorite = vi.fn<FavoriteMutation["mutateAsync"]>(changeFavorite);
    const removeFavorite = vi.fn<FavoriteMutation["mutateAsync"]>(changeFavorite);

    let templateQuery: TemplateQuery =
      input.isLoading || input.removedOnServer
        ? mock<TemplateQuery>({ data: undefined, isLoading: true, isError: false, error: null, refetch })
        : input.error
          ? mock<TemplateQuery>({ data: undefined, isLoading: false, isError: true, error: input.error, refetch })
          : mock<TemplateQuery>({ data: structuredClone(input.template ?? TEMPLATE), isLoading: false, isError: false, error: null, refetch });
    let versionsQuery = input.isLoadingVersions
      ? mock<VersionsQuery>({ data: undefined, isError: false })
      : input.isFailingVersions
        ? mock<VersionsQuery>({ data: undefined, isError: true })
        : mock<VersionsQuery>({ data: structuredClone(input.versions ?? VERSIONS), isError: false });
    const idleVersionQuery = mock<VersionQuery>({ data: undefined, isLoading: false });
    const previousVersionQuery = input.isPreviousVersionLoading
      ? mock<VersionQuery>({ data: undefined, isLoading: true })
      : input.isPreviousVersionFailing
        ? mock<VersionQuery>({ data: undefined, isLoading: false })
        : mock<VersionQuery>({ data: structuredClone(PREVIOUS_VERSION), isLoading: false });
    const addFavoriteMutation = mock<FavoriteMutation>({ mutateAsync: addFavorite });
    const removeFavoriteMutation = mock<FavoriteMutation>({ mutateAsync: removeFavorite });
    const customUser = mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ user: input.isSignedIn === false ? undefined : { username: "sam.rivera" } });
    const activeOrganization = mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
      organizations: (input.organizations ?? [{ type: "personal", slug: "sam-rivera" }]).map(organization => mock<OrganizationOutput>(organization))
    });
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({
      pathname: "/template/[id]",
      query: { id: TEMPLATE_ID, ...(input.tab ? { tab: input.tab } : {}), utm_source: input.arrivalSource }
    });

    const useMarketplaceTemplate = vi.fn<typeof DEPENDENCIES.useMarketplaceTemplate>(() => templateQuery);
    const useTemplateVersions = vi.fn<typeof DEPENDENCIES.useTemplateVersions>(() => versionsQuery);
    const useTemplateVersion = vi.fn<typeof DEPENDENCIES.useTemplateVersion>((_id, version) => (version === 2 ? previousVersionQuery : idleVersionQuery));
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const NotFoundPage = vi.fn<typeof DEPENDENCIES.NotFoundPage>(() => <p>Page not found.</p>);
    const TemplateReadmeTab = vi.fn<typeof DEPENDENCIES.TemplateReadmeTab>(input.TemplateReadmeTab ?? (() => null));
    const TemplateConfigurationTab = vi.fn<typeof DEPENDENCIES.TemplateConfigurationTab>(() => null);
    const TemplateVersionsTab = vi.fn<typeof DEPENDENCIES.TemplateVersionsTab>(({ versions, onView }) => (
      <>
        {versions.map(({ version }) => (
          <button key={version} onClick={() => onView(version)}>
            View v{version}
          </button>
        ))}
      </>
    ));
    const TemplateSettingsTab = vi.fn<typeof DEPENDENCIES.TemplateSettingsTab>(() => null);
    const TemplateIcon = vi.fn<typeof DEPENDENCIES.TemplateIcon>(() => null);
    const NextSeo = vi.fn<typeof DEPENDENCIES.NextSeo>(() => <></>);
    const ShareTemplateDialog = vi.fn<typeof DEPENDENCIES.ShareTemplateDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        Close the share dialog
      </button>
    ));

    const ReportTemplateDialog = vi.fn<typeof DEPENDENCIES.ReportTemplateDialog>(({ onClose, onSignedOut, onTemplateRemoved }) => (
      <>
        <button type="button" onClick={onClose}>
          Close the report dialog
        </button>
        <button type="button" onClick={onSignedOut}>
          Report while signed out
        </button>
        <button type="button" onClick={onTemplateRemoved}>
          Report a removed template
        </button>
      </>
    ));
    const RemovedTemplateNotice = vi.fn<typeof DEPENDENCIES.RemovedTemplateNotice>(() => null);
    const TemplateReviewNotice = vi.fn<typeof DEPENDENCIES.TemplateReviewNotice>(() => null);
    const TemplatePublisherCard = vi.fn<typeof DEPENDENCIES.TemplatePublisherCard>(() => null);

    const useTrackTemplateEvent = vi.fn<typeof DEPENDENCIES.useTrackTemplateEvent>();
    const dependencies = MockComponents(DEPENDENCIES, {
      Layout,
      NotFoundPage,
      TemplateReadmeTab,
      TemplateConfigurationTab,
      TemplateVersionsTab,
      TemplateSettingsTab,
      TemplateIcon,
      NextSeo,
      ShareTemplateDialog,
      ReportTemplateDialog,
      RemovedTemplateNotice,
      TemplateReviewNotice,
      TemplatePublisherCard,
      useActiveOrganization: () => activeOrganization,
      useMarketplaceTemplate,
      useTemplateVersions,
      useTemplateVersion,
      useAddFavoriteTemplate: () => addFavoriteMutation,
      useRemoveFavoriteTemplate: () => removeFavoriteMutation,
      useCustomUser: () => customUser,
      useSnackbar: () => snackbar,
      useRouter: () => router,
      useTrackTemplateEvent
    });

    const renderPage = () => (
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <TemplatePage id={TEMPLATE_ID} removedTemplate={input.removedOnServer} dependencies={dependencies} />
      </TestContainerProvider>
    );
    const { unmount, rerender } = render(renderPage());

    const receiveFromServer = (next: { template: MarketplaceTemplate; versions?: TemplateVersionSummary[] }) => {
      templateQuery = mock<TemplateQuery>({ data: structuredClone(next.template), isLoading: false, isError: false, error: null, refetch });
      versionsQuery = mock<VersionsQuery>({ data: structuredClone(next.versions ?? VERSIONS), isError: false });
      rerender(renderPage());
    };

    return {
      unmount,
      receiveFromServer,
      releaseFavoriteChange: () => act(async () => favoriteChangeRelease.resolve()),
      router,
      refetch,
      enqueueSnackbar,
      analyticsService,
      ShareTemplateDialog,
      ReportTemplateDialog,
      RemovedTemplateNotice,
      TemplateReviewNotice,
      TemplatePublisherCard,
      addFavorite,
      removeFavorite,
      useMarketplaceTemplate,
      useTemplateVersions,
      useTemplateVersion,
      Layout,
      NotFoundPage,
      TemplateReadmeTab,
      TemplateConfigurationTab,
      TemplateVersionsTab,
      TemplateSettingsTab,
      TemplateIcon,
      NextSeo,
      useTrackTemplateEvent
    };
  }
});
