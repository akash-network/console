import { useEffect } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MarketplaceTemplate, TemplateVersionSummary } from "@src/types/marketplace-template";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, TemplatePage } from "./TemplatePage";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildMarketplaceTemplate, buildTemplateVersion, buildTemplateVersionSummary } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";

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
  publisher: { name: "Northwind Labs", slug: "northwind-labs", type: "team" },
  currentVersion: CURRENT_VERSION,
  usage: { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null }
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
    expect(NextSeo).toHaveBeenCalledWith({ title: "Open WebUI + vLLM", description: undefined }, expect.anything());
  });

  it("describes the page with the template's summary", () => {
    const { NextSeo } = setup({});

    expect(NextSeo).toHaveBeenCalledWith({ title: "Open WebUI + vLLM", description: "Private ChatGPT-style chat on your own GPU." }, expect.anything());
  });

  it("shows deploys, the still-up share and the last deploy", () => {
    setup({
      template: {
        ...TEMPLATE,
        usage: { deploys: 1284, stillUpAfter24h: 0.936, lastDeployedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }
      }
    });

    expect(screen.getByText("1,284 deploys · 94% still up after 24 h · Last deployed 2 hours ago")).toBeInTheDocument();
  });

  it("drops the usage parts that have no data", () => {
    setup({ template: { ...TEMPLATE, usage: { deploys: 1, stillUpAfter24h: null, lastDeployedAt: null } } });

    expect(screen.getByText("1 deploy")).toBeInTheDocument();
    expect(screen.queryByText(/still up after 24 h/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last deployed/)).not.toBeInTheDocument();
  });

  it("shows no usage line before the first deploy", () => {
    setup({});

    expect(screen.queryByText(/deploys?\b/)).not.toBeInTheDocument();
  });

  it("shows editors Edit configuration and Settings, and viewers neither", () => {
    const { unmount } = setup({ template: { ...TEMPLATE, canEdit: true } });

    expect(screen.getByRole("link", { name: "Edit configuration" })).toHaveAttribute(
      "href",
      UrlService.configureTemplate({ mode: "edit", userTemplateId: TEMPLATE_ID })
    );
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

  it("offers no favorite without a session", () => {
    setup({ isSignedIn: false });

    expect(screen.queryByRole("button", { name: "Favorite" })).not.toBeInTheDocument();
  });

  it("copies the template link", async () => {
    const { writeText, enqueueSnackbar } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`${getBaseUrl()}${UrlService.template(TEMPLATE_ID)}`);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  it("reports a link it could not copy", async () => {
    const { enqueueSnackbar } = setup({ isCopyFailing: true });

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
  });

  it("links back to the templates gallery", () => {
    setup({});

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Templates" })).toHaveAttribute("href", UrlService.templates());
  });

  function stubClipboard(clipboard: Pick<Clipboard, "writeText">) {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    onTestFinished(() => {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    });
  }

  function setup(input: {
    template?: MarketplaceTemplate;
    versions?: TemplateVersionSummary[];
    tab?: string;
    error?: ApiError;
    isLoading?: boolean;
    isPreviousVersionLoading?: boolean;
    isPreviousVersionFailing?: boolean;
    isSignedIn?: boolean;
    isFavoriteFailing?: boolean;
    isFavoriteChangeHeld?: boolean;
    isCopyFailing?: boolean;
    TemplateReadmeTab?: typeof DEPENDENCIES.TemplateReadmeTab;
  }) {
    const refetch = vi.fn();
    const enqueueSnackbar = vi.fn();
    const writeText = input.isCopyFailing ? vi.fn().mockRejectedValue(new Error("denied")) : vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const favoriteChangeRelease = Promise.withResolvers<void>();
    if (!input.isFavoriteChangeHeld) favoriteChangeRelease.resolve();
    const changeFavorite = async () => {
      await favoriteChangeRelease.promise;
      if (input.isFavoriteFailing) throw new Error("refused");
      return mock<Awaited<ReturnType<FavoriteMutation["mutateAsync"]>>>();
    };
    const addFavorite = vi.fn<FavoriteMutation["mutateAsync"]>(changeFavorite);
    const removeFavorite = vi.fn<FavoriteMutation["mutateAsync"]>(changeFavorite);

    let templateQuery: TemplateQuery = input.isLoading
      ? mock<TemplateQuery>({ data: undefined, isLoading: true, isError: false, error: null, refetch })
      : input.error
        ? mock<TemplateQuery>({ data: undefined, isLoading: false, isError: true, error: input.error, refetch })
        : mock<TemplateQuery>({ data: structuredClone(input.template ?? TEMPLATE), isLoading: false, isError: false, error: null, refetch });
    let versionsQuery = mock<VersionsQuery>({ data: structuredClone(input.versions ?? VERSIONS) });
    const idleVersionQuery = mock<VersionQuery>({ data: undefined, isLoading: false });
    const previousVersionQuery = input.isPreviousVersionLoading
      ? mock<VersionQuery>({ data: undefined, isLoading: true })
      : input.isPreviousVersionFailing
        ? mock<VersionQuery>({ data: undefined, isLoading: false })
        : mock<VersionQuery>({ data: structuredClone(PREVIOUS_VERSION), isLoading: false });
    const addFavoriteMutation = mock<FavoriteMutation>({ mutateAsync: addFavorite });
    const removeFavoriteMutation = mock<FavoriteMutation>({ mutateAsync: removeFavorite });
    const customUser = mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ user: input.isSignedIn === false ? undefined : { username: "sam.rivera" } });
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({
      pathname: "/template/[id]",
      query: input.tab ? { id: TEMPLATE_ID, tab: input.tab } : { id: TEMPLATE_ID }
    });

    const useMarketplaceTemplate = vi.fn<typeof DEPENDENCIES.useMarketplaceTemplate>(() => templateQuery);
    const useTemplateVersions = vi.fn<typeof DEPENDENCIES.useTemplateVersions>(() => versionsQuery);
    const useTemplateVersion = vi.fn<typeof DEPENDENCIES.useTemplateVersion>((_id, version) => (version === 2 ? previousVersionQuery : idleVersionQuery));
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const NotFoundPage = vi.fn<typeof DEPENDENCIES.NotFoundPage>(() => <p>Page not found.</p>);
    const TemplateReadmeTab = vi.fn<typeof DEPENDENCIES.TemplateReadmeTab>(input.TemplateReadmeTab ?? (() => null));
    const TemplateConfigurationTab = vi.fn<typeof DEPENDENCIES.TemplateConfigurationTab>(() => null);
    const TemplateIcon = vi.fn<typeof DEPENDENCIES.TemplateIcon>(() => null);
    const NextSeo = vi.fn<typeof DEPENDENCIES.NextSeo>(() => <></>);

    const dependencies = MockComponents(DEPENDENCIES, {
      Layout,
      NotFoundPage,
      TemplateReadmeTab,
      TemplateConfigurationTab,
      TemplateIcon,
      NextSeo,
      useMarketplaceTemplate,
      useTemplateVersions,
      useTemplateVersion,
      useAddFavoriteTemplate: () => addFavoriteMutation,
      useRemoveFavoriteTemplate: () => removeFavoriteMutation,
      useCustomUser: () => customUser,
      useSnackbar: () => snackbar,
      useRouter: () => router
    });

    const { unmount, rerender } = render(<TemplatePage id={TEMPLATE_ID} dependencies={dependencies} />);

    const receiveFromServer = (next: { template: MarketplaceTemplate; versions?: TemplateVersionSummary[] }) => {
      templateQuery = mock<TemplateQuery>({ data: structuredClone(next.template), isLoading: false, isError: false, error: null, refetch });
      versionsQuery = mock<VersionsQuery>({ data: structuredClone(next.versions ?? VERSIONS) });
      rerender(<TemplatePage id={TEMPLATE_ID} dependencies={dependencies} />);
    };

    return {
      unmount,
      receiveFromServer,
      releaseFavoriteChange: () => act(async () => favoriteChangeRelease.resolve()),
      router,
      refetch,
      enqueueSnackbar,
      writeText,
      addFavorite,
      removeFavorite,
      useMarketplaceTemplate,
      useTemplateVersions,
      useTemplateVersion,
      Layout,
      NotFoundPage,
      TemplateReadmeTab,
      TemplateConfigurationTab,
      TemplateIcon,
      NextSeo
    };
  }
});
