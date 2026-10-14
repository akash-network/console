import type { PropsWithChildren } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, NewDeploymentPage } from "./NewDeploymentPage";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("NewDeploymentPage", () => {
  it("targets the project the page was opened for", () => {
    const { useDeployTarget } = setup({ requestedProjectId: "project-1" });

    expect(useDeployTarget).toHaveBeenCalledWith({ requestedProjectId: "project-1" });
  });

  it("leads back to the project a deployment is started in", () => {
    setup({ targetProject: mock<Project>({ id: "project-1", name: "storefront" }) });

    expect(screen.getByRole("link", { name: "Back to storefront" })).toHaveAttribute("href", UrlService.project("project-1"));
  });

  it("leads back to the deployments without a project to return to", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Back to deployments" })).toHaveAttribute("href", UrlService.deploymentList());
  });

  it("remembers a changed project and keeps it in the address", async () => {
    const { chooseProject, replace } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "choose project-2" }));

    expect(chooseProject).toHaveBeenCalledWith("project-2");
    expect(replace).toHaveBeenCalledWith(UrlService.newDeployment({ projectId: "project-2" }));
  });

  it("renders the picker inside the retired-builder redirect", () => {
    const { LegacyBuilderRedirect } = setup({});

    expect(LegacyBuilderRedirect).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "What do you want to deploy?" })).toBeInTheDocument();
  });

  it("gives the page its own title and canonical url", () => {
    const { CustomNextSeo } = setup({});

    expect(CustomNextSeo).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New Deployment", url: expect.stringMatching(/\/new-deployment$/) }),
      expect.anything()
    );
  });

  it("links back to the deployments list", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Back to deployments" })).toHaveAttribute("href", UrlService.deploymentList());
  });

  it("offers an SDL import and the agent setup to everyone", () => {
    const { ImportSdlButton, AgentModePanel } = setup({});

    expect(ImportSdlButton).toHaveBeenCalled();
    expect(AgentModePanel).toHaveBeenCalled();
  });

  it("describes each way to start from scratch next to a preview of it", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Bring your own container" })).toHaveAccessibleDescription(
      "Run any Docker image from any registry. Configure ports, variables, and resources."
    );
    expect(screen.getByRole("button", { name: "Spin up a Linux machine" })).toHaveAccessibleDescription(
      "A clean Linux server with SSH access. Choose Ubuntu, CentOS Stream, Debian, or SuSE Leap."
    );
    expect(screen.getByText("deploy.yaml")).toBeInTheDocument();
    expect(screen.getByText("ssh")).toBeInTheDocument();
  });

  it("starts a blank configure screen for your own container", async () => {
    const { push, analyticsService } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Bring your own container" }));

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({}));
    expect(analyticsService.track).toHaveBeenCalledWith("run_custom_container_btn_clk", "Amplitude");
  });

  it("starts configure on a linux machine with ssh", async () => {
    const { push, analyticsService } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Spin up a Linux machine" }));

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ vm: true }));
    expect(analyticsService.track).toHaveBeenCalledWith("launch_container_vm_btn_clk", "Amplitude");
  });

  it("shows six popular templates, promoted first, badging the popular ones", () => {
    const templates = [
      template("plain-1"),
      template("plain-2"),
      template("popular", ["popular"]),
      template("recommended", ["recommended"]),
      template("plain-3"),
      template("plain-4"),
      template("plain-5")
    ];
    const { TemplateCard } = setup({ templates });

    const shown = TemplateCard.mock.calls.map(([props]) => [props.template.id, props.isPopular]);
    expect(shown).toEqual([
      ["recommended", false],
      ["popular", true],
      ["plain-1", false],
      ["plain-2", false],
      ["plain-3", false],
      ["plain-4", false]
    ]);
  });

  it("keeps the hello world template and the full gallery one click away", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Try hello world" })).toHaveAttribute("href", UrlService.configureDeployment({ templateId: "hello-world" }));
    expect(screen.getByRole("link", { name: "View all templates" })).toHaveAttribute("href", UrlService.templates());
  });

  it("holds the template grid's place while the templates load", () => {
    const { Skeleton, Layout } = setup({ isLoadingTemplates: true, templates: [] });

    expect(Skeleton).toHaveBeenCalledTimes(6);
    expect(Layout).toHaveBeenCalledWith(expect.objectContaining({ isLoading: true }), expect.anything());
  });

  it("drops the placeholders once templates are shown", () => {
    const { Skeleton } = setup({ isLoadingTemplates: true, templates: [template("comfy")] });

    expect(Skeleton).not.toHaveBeenCalled();
  });

  it("shows no placeholders when the templates could not be loaded", () => {
    const { Skeleton, Layout } = setup({ isLoadingTemplates: false, templates: [] });

    expect(Skeleton).not.toHaveBeenCalled();
    expect(Layout).toHaveBeenCalledWith(expect.objectContaining({ isLoading: false }), expect.anything());
  });

  function template(id: string, tags?: string[]): TemplateOutputSummaryWithCategory {
    return { id, name: id, summary: "", deploy: "", logoUrl: null, category: "General", tags };
  }

  function setup(input: {
    templates?: TemplateOutputSummaryWithCategory[];
    isLoadingTemplates?: boolean;
    requestedProjectId?: string;
    targetProject?: Project;
  }) {
    const push = vi.fn();
    const replace = vi.fn();
    const chooseProject = vi.fn();
    const searchParams = mock<ReadonlyURLSearchParams>();
    searchParams.get.mockImplementation(key => (key === "projectId" ? input.requestedProjectId ?? null : null));
    const useDeployTarget = vi.fn<typeof DEPENDENCIES.useDeployTarget>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeployTarget>>({ project: input.targetProject, chooseProject })
    );
    const DeployTargetChip = vi.fn<typeof DEPENDENCIES.DeployTargetChip>(({ onChoose }) => (
      <button type="button" onClick={() => onChoose("project-2")}>
        choose project-2
      </button>
    ));
    const analyticsService = mock<AnalyticsService>();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push, replace });
    const templatesResult = { isLoading: input.isLoadingTemplates ?? false, categories: [], templates: input.templates ?? [] };
    const Layout = vi.fn(({ children }: PropsWithChildren) => <div>{children}</div>);
    const LegacyBuilderRedirect = vi.fn(({ children }: PropsWithChildren) => <>{children}</>);
    const AgentModePanel = vi.fn(() => null);
    const ImportSdlButton = vi.fn(() => null);
    const TemplateCard = vi.fn<typeof DEPENDENCIES.TemplateCard>(() => null);
    const Skeleton = vi.fn<typeof DEPENDENCIES.Skeleton>(() => <div />);
    const dependencies = MockComponents(DEPENDENCIES, {
      useRouter: () => router,
      useTemplates: () => templatesResult,
      useSearchParams: () => searchParams,
      useDeployTarget,
      DeployTargetChip,
      Layout: Layout as never,
      LegacyBuilderRedirect,
      AgentModePanel,
      ImportSdlButton,
      StartFromScratchCard: DEPENDENCIES.StartFromScratchCard,
      TemplateCard,
      Skeleton
    });

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <NewDeploymentPage dependencies={dependencies} />
      </TestContainerProvider>
    );

    return {
      push,
      replace,
      chooseProject,
      useDeployTarget,
      analyticsService,
      Layout,
      LegacyBuilderRedirect,
      AgentModePanel,
      ImportSdlButton,
      TemplateCard,
      Skeleton,
      CustomNextSeo: dependencies.CustomNextSeo
    };
  }
});
