import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { UserTemplateListItem } from "@src/types/marketplace-template";
import type { OrganizationOutput } from "@src/types/organization";
import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, MyTemplates } from "./MyTemplates";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildProject } from "@tests/seeders/project";
import { buildUserTemplateListItem } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const SUPPORT_URL = "https://akash.network/support";
const ML_RESEARCH = buildProject({ id: "project-ml", name: "ml-research" });
const INFRA = buildProject({ id: "project-infra", name: "infra" });

const COMFY = buildUserTemplateListItem({
  id: "tpl-comfy",
  title: "ComfyUI + Flux.1 dev",
  icon: "image",
  visibility: "public",
  isListed: true,
  projectId: ML_RESEARCH.id,
  currentVersion: { version: 4, status: "live", createdAt: "2026-11-05T12:00:00.000Z" },
  updatedAt: "2026-11-05T12:00:00.000Z",
  lastEditedBy: { username: "sam.rivera" },
  usage: { deploys: 2148, lastDeployedAt: "2026-11-06T12:00:00.000Z" }
});
const RAG = buildUserTemplateListItem({
  id: "tpl-rag",
  title: "RAG stack (staging)",
  visibility: "organization",
  projectId: ML_RESEARCH.id,
  currentVersion: { version: 6, status: "live", createdAt: "2026-11-01T12:00:00.000Z" },
  usage: { deploys: 48, lastDeployedAt: null }
});
const BATCH = buildUserTemplateListItem({
  id: "tpl-batch",
  title: "Batch embeddings worker",
  visibility: "private",
  projectId: INFRA.id,
  currentVersion: { version: 1, status: "live", createdAt: "2026-11-06T12:00:00.000Z" },
  updatedAt: "2026-11-06T12:00:00.000Z",
  lastEditedBy: null,
  usage: { deploys: 0, lastDeployedAt: null }
});
const XMR = buildUserTemplateListItem({
  id: "tpl-xmr",
  title: "XMR benchmark (old)",
  visibility: "public",
  isListed: true,
  moderationStatus: "hidden",
  projectId: null,
  currentVersion: null,
  usage: { deploys: 3, lastDeployedAt: null }
});
const TEMPLATES = [COMFY, RAG, BATCH, XMR];

type TemplatesQuery = ReturnType<typeof DEPENDENCIES.useMyTemplates>;
type DeleteMutation = ReturnType<typeof DEPENDENCIES.useDeleteMarketplaceTemplateMutation>;

describe(MyTemplates.name, () => {
  it("lists the organization's templates with visibility, status, version, deploys and last update", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "My templates" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      UrlService.templates()
    );
    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual([
      "Template",
      "Visibility",
      "Status",
      "Current",
      "Deploys",
      "Last updated",
      "Actions"
    ]);

    const comfy = rowOf(COMFY);
    expect(within(comfy).getByRole("link", { name: COMFY.title })).toHaveAttribute("href", UrlService.template(COMFY.id));
    expect(within(comfy).getByText("Edited by sam.rivera")).toBeInTheDocument();
    expect(cellTexts(comfy)).toEqual(["ComfyUI + Flux.1 devEdited by sam.rivera", "Public", "In gallery", "v4", "2,148", "Nov 5, 2026", "Edit"]);

    expect(cellTexts(rowOf(RAG)).slice(1, 5)).toEqual(["Organization", "Shared with organization", "v6", "48"]);
    expect(cellTexts(rowOf(BATCH))).toEqual(["Batch embeddings worker", "Private", "Not shared", "v1", "–", "Nov 6, 2026", "Edit"]);
    expect(cellTexts(rowOf(XMR)).slice(3, 5)).toEqual(["–", "3"]);
    expect(
      screen.getByText("Private and Organization templates are only visible to members. Public templates are published under Northwind Labs.")
    ).toBeInTheDocument();
    expect(screen.queryByText("No templates match these filters.")).not.toBeInTheDocument();
  });

  it("explains a public template that is not in the gallery", () => {
    const unlisted = buildUserTemplateListItem({ title: "Open WebUI for support team", visibility: "public", isListed: false });
    setup({ templates: [unlisted] });

    expect(within(rowOf(unlisted)).getByText("Not in gallery")).toBeInTheDocument();
    expect(within(rowOf(unlisted)).getByText("Saved before checks existed.")).toBeInTheDocument();
    expect(within(rowOf(unlisted)).queryByRole("link", { name: "Contact support" })).not.toBeInTheDocument();
  });

  it("filters by project tab, search, visibility and status", async () => {
    setup({});

    expect(screen.getByRole("button", { name: "All of Northwind Labs 4" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "infra 1" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("combobox", { name: "Visibility: Any" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status: Any" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "ml-research 2" }));
    expect(listedTitles()).toEqual([COMFY.title, RAG.title]);
    expect(screen.getByRole("button", { name: "ml-research 2" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "All of Northwind Labs 4" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Search my templates" }), "  BATCH ");
    expect(listedTitles()).toEqual([BATCH.title]);

    await userEvent.clear(screen.getByRole("textbox", { name: "Search my templates" }));
    await choose("Visibility", "Organization");
    expect(listedTitles()).toEqual([RAG.title]);

    await choose("Visibility", "Any");
    await choose("Status", "Hidden by Akash");
    expect(screen.getByRole("combobox", { name: "Status: Hidden by Akash" })).toBeInTheDocument();
    expect(listedTitles()).toEqual([XMR.title]);

    await choose("Visibility", "Private");
    expect(listedTitles()).toEqual([]);
    expect(screen.getByText("No templates match these filters.")).toBeInTheDocument();

    await choose("Visibility", "Any");
    await choose("Status", "Any");
    expect(listedTitles()).toHaveLength(4);
    expect(screen.queryByText("No templates match these filters.")).not.toBeInTheDocument();
  });

  it("searches summaries too", async () => {
    const withSummary = buildUserTemplateListItem({ title: "Staging API gateway", summary: "Envoy in front of the staging services" });
    setup({ templates: [withSummary, BATCH] });

    await userEvent.type(screen.getByRole("textbox", { name: "Search my templates" }), "envoy");

    expect(listedTitles()).toEqual([withSummary.title]);
  });

  it("shows no project tabs while projects are off", () => {
    const { useProjectsQuery } = setup({ projectsEnabled: false });

    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
    expect(screen.queryByRole("button", { name: /^All of/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ml-research 2" })).not.toBeInTheDocument();
    expect(listedTitles()).toHaveLength(4);
  });

  it("names no organization while there is none", () => {
    setup({ organization: null });

    expect(screen.queryByRole("button", { name: "ml-research 2" })).not.toBeInTheDocument();
    expect(listedTitles()).toHaveLength(4);
    expect(
      screen.getByText("Private and Organization templates are only visible to members. Public templates are published under your organization.")
    ).toBeInTheDocument();
  });

  it("shows a viewer no Edit, Duplicate or Delete", async () => {
    const readOnly = buildUserTemplateListItem({ title: "Postgres with nightly dumps", canEdit: false });
    setup({ templates: [readOnly] });

    expect(within(rowOf(readOnly)).queryByRole("link", { name: /^Edit/ })).not.toBeInTheDocument();
    await openMenuOf(readOnly);

    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveAttribute("href", UrlService.template(readOnly.id));
    expect(screen.getByRole("menuitem", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Duplicate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete template" })).not.toBeInTheDocument();
  });

  it("explains a hidden template with a support link", () => {
    setup({});

    const xmr = rowOf(XMR);
    expect(within(xmr).getByText("Hidden by Akash")).toBeInTheDocument();
    expect(within(xmr).getByText("Akash hid this template.")).toBeInTheDocument();
    expect(within(xmr).getByRole("link", { name: "Contact support" })).toHaveAttribute("href", SUPPORT_URL);
    expect(within(rowOf(COMFY)).queryByRole("link", { name: "Contact support" })).not.toBeInTheDocument();
  });

  it("falls back to the support email when no support link is configured", () => {
    setup({ supportUrl: undefined });

    expect(within(rowOf(XMR)).getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "mailto:support@akash.network");
  });

  it("asks before deleting and removes the row once deleted", async () => {
    const { confirm, deleteTemplate, enqueueSnackbar } = setup({});

    await openMenuOf(BATCH);
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete template" }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Delete Batch embeddings worker?" }));
    expect(deleteTemplate).toHaveBeenCalledWith({ id: BATCH.id });
    expect(screen.queryByRole("row", { name: new RegExp(BATCH.title) })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All of Northwind Labs 3" })).toBeInTheDocument();
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Deleted Batch embeddings worker" }) }), {
      variant: "success"
    });
  });

  it("keeps the template when the delete is not confirmed", async () => {
    const { deleteTemplate } = setup({ isConfirmed: false });

    await openMenuOf(BATCH);
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete template" }));

    expect(deleteTemplate).not.toHaveBeenCalled();
    expect(rowOf(BATCH)).toBeInTheDocument();
  });

  it("keeps the row and says so when the delete is refused", async () => {
    const { enqueueSnackbar } = setup({ deleteError: new ApiError(403, { message: "You cannot change this template" }, "forbidden") });

    await openMenuOf(BATCH);
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete template" }));

    expect(rowOf(BATCH)).toBeInTheDocument();
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Couldn't delete the template", subTitle: "You can no longer delete this template." })
      }),
      { variant: "error" }
    );
  });

  it("asks to retry when the delete fails for another reason", async () => {
    const { enqueueSnackbar } = setup({ deleteError: new ApiError(503, { message: "Unavailable" }, "unavailable") });

    await openMenuOf(BATCH);
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete template" }));

    expect(rowOf(BATCH)).toBeInTheDocument();
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't delete the template", subTitle: "Try again in a moment." }) }),
      { variant: "error" }
    );
  });

  it("copies the template link", async () => {
    const { writeText, enqueueSnackbar } = setup({});

    await openMenuOf(RAG);
    await userEvent.click(screen.getByRole("menuitem", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${UrlService.template(RAG.id)}`);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Link copied" }) }), { variant: "success" });
  });

  it("says so when the link cannot be copied", async () => {
    const { enqueueSnackbar } = setup({ isCopySuccessful: false });

    await openMenuOf(RAG);
    await userEvent.click(screen.getByRole("menuitem", { name: "Copy link" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't copy the link" }) }), {
      variant: "error"
    });
  });

  it("opens template mode for New template, Edit and Duplicate", async () => {
    const { ImportSdlButton } = setup({});

    expect(screen.getByRole("link", { name: "New template" })).toHaveAttribute("href", UrlService.configureTemplate({ mode: "new" }));
    expect(within(rowOf(COMFY)).getByRole("link", { name: `Edit ${COMFY.title}` })).toHaveAttribute(
      "href",
      UrlService.configureTemplate({ mode: "edit", userTemplateId: COMFY.id, baseVersion: 4 })
    );
    expect(ImportSdlButton.mock.lastCall?.[0].configureUrl?.("draft-1")).toBe(UrlService.configureTemplate({ mode: "new", draftId: "draft-1" }));

    await openMenuOf(COMFY);
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveAttribute(
      "href",
      UrlService.configureTemplate({ mode: "new", copyFromTemplateId: COMFY.id, copyFromVersion: 4 })
    );
  });

  it("waits for the templates before drawing them", () => {
    const { Layout } = setup({ isLoading: true });

    expect(Layout.mock.lastCall?.[0]).toMatchObject({ isLoading: true });
    expect(screen.queryByText("No templates yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers a retry when the templates cannot be loaded", async () => {
    const { refetch } = setup({ isError: true });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Couldn't load your templates.")).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });

  it("invites saving a first template when there is none", () => {
    setup({ templates: [] });

    expect(screen.getByText("No templates yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  function rowOf(template: UserTemplateListItem) {
    return screen.getByRole("row", { name: new RegExp(escapeRegExp(template.title)) });
  }

  function cellTexts(row: HTMLElement) {
    return within(row)
      .getAllByRole("cell")
      .map(cell => cell.textContent);
  }

  function listedTitles() {
    return screen
      .queryAllByRole("row")
      .slice(1)
      .map(row => within(within(row).getAllByRole("cell")[0]).getByRole("link").textContent);
  }

  async function openMenuOf(template: UserTemplateListItem) {
    await userEvent.click(screen.getByRole("button", { name: `Actions for ${template.title}` }));
  }

  async function choose(filter: string, option: string) {
    await userEvent.click(screen.getByRole("combobox", { name: new RegExp(`^${filter}: `) }));
    await userEvent.click(screen.getByRole("option", { name: option }));
  }

  function stubClipboard(clipboard: Pick<Clipboard, "writeText">) {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    onTestFinished(() => {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    });
  }

  function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function setup(input: {
    templates?: UserTemplateListItem[];
    projects?: Project[];
    organization?: Pick<OrganizationOutput, "name"> | null;
    projectsEnabled?: boolean;
    isLoading?: boolean;
    isError?: boolean;
    isConfirmed?: boolean;
    deleteError?: unknown;
    isCopySuccessful?: boolean;
    supportUrl?: string;
  }) {
    const confirm = vi.fn(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const refetch = vi.fn();
    const deleteTemplate = vi.fn<DeleteMutation["mutateAsync"]>(async () => {
      if (input.deleteError) throw input.deleteError;
    });
    const writeText = input.isCopySuccessful === false ? vi.fn().mockRejectedValue(new Error("denied")) : vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const ImportSdlButton = vi.fn<typeof DEPENDENCIES.ImportSdlButton>(() => <button type="button">Import SDL</button>);
    const organization = input.organization === undefined ? { name: "Northwind Labs" } : input.organization;
    const projectsQuery = mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: structuredClone(input.projects ?? [ML_RESEARCH, INFRA]) });
    const templatesQuery = input.isLoading
      ? mock<TemplatesQuery>({ data: undefined, isLoading: true, isError: false, refetch })
      : input.isError
        ? mock<TemplatesQuery>({ data: undefined, isLoading: false, isError: true, refetch })
        : mock<TemplatesQuery>({ data: structuredClone(input.templates ?? TEMPLATES), isLoading: false, isError: false, refetch });
    const activeOrganization = mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
      activeOrganization: organization ? mock<OrganizationOutput>({ id: "org-1", type: "team", role: "admin", ...organization }) : undefined,
      projectsEnabled: input.projectsEnabled ?? true
    });
    const deleteMutation = mock<DeleteMutation>({ mutateAsync: deleteTemplate });
    const popup = mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm });
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() => projectsQuery);
    const publicConfig = mock<AppDIContainer["publicConfig"]>({
      NEXT_PUBLIC_CONTACT_SUPPORT_URL: "supportUrl" in input ? input.supportUrl : SUPPORT_URL
    });

    const dependencies = MockComponents(DEPENDENCIES, {
      Layout,
      ImportSdlButton,
      useProjectsQuery,
      useMyTemplates: () => templatesQuery,
      useActiveOrganization: () => activeOrganization,
      useDeleteMarketplaceTemplateMutation: () => deleteMutation,
      usePopup: () => popup,
      useSnackbar: () => snackbar
    });

    render(
      <TestContainerProvider services={{ publicConfig: () => publicConfig }}>
        <MyTemplates dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { Layout, ImportSdlButton, useProjectsQuery, confirm, deleteTemplate, enqueueSnackbar, refetch, writeText };
  }
});
