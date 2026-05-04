import React from "react";
import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LocalNotesContextType as LocalNotesContext } from "@src/components/LocalNoteManager";
import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import type { SdlContextProps } from "@src/context/SdlBuilderProvider";
import type { AppDIContainer } from "@src/context/ServicesProvider";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { hardcodedTemplates } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import type { Props as ManifestEditProps } from "../ManifestEdit/ManifestEdit";
import { DEPENDENCIES, NewDeploymentContainer } from "./NewDeploymentContainer";

import { render, screen } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(NewDeploymentContainer.name, () => {
  it("renders TemplateList when step is choose-template", async () => {
    setup({ step: RouteStep.chooseTemplate });

    await vi.waitFor(() => {
      expect(screen.getByTestId("template-list")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("manifest-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-lease")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stepper")).not.toBeInTheDocument();
  });

  it("renders ManifestEdit and Stepper when step is edit-deployment", async () => {
    const { ManifestEdit } = setup({ step: RouteStep.editDeployment });

    await vi.waitFor(() => {
      expect(screen.getByTestId("manifest-edit")).toBeInTheDocument();
    });
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
    expect(screen.queryByTestId("template-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-lease")).not.toBeInTheDocument();
    expect(ManifestEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTemplate: null,
        editedManifest: "",
        isGitProviderTemplate: false
      }),
      {}
    );
  });

  it("renders CreateLease and Stepper when step is create-leases", async () => {
    const { CreateLease } = setup({ step: RouteStep.createLeases, dseq: "12345" });

    await vi.waitFor(() => {
      expect(screen.getByTestId("create-lease")).toBeInTheDocument();
    });
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
    expect(screen.queryByTestId("template-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manifest-edit")).not.toBeInTheDocument();
    expect(CreateLease).toHaveBeenCalledWith(
      expect.objectContaining({
        dseq: "12345"
      }),
      {}
    );
  });

  it("sets isGitProviderTemplate to true when gitProvider is github", async () => {
    const { ManifestEdit } = setup({
      step: RouteStep.editDeployment,
      gitProvider: "github"
    });

    await vi.waitFor(() => {
      expect(ManifestEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          isGitProviderTemplate: true
        }),
        {}
      );
    });
  });

  it("sets isGitProviderTemplate to true when code param is present", async () => {
    const { ManifestEdit } = setup({
      step: RouteStep.editDeployment,
      code: "auth-code-123"
    });

    await vi.waitFor(() => {
      expect(ManifestEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          isGitProviderTemplate: true
        }),
        {}
      );
    });
  });

  it("sets isGitProviderTemplate to true when templateId is CI_CD_TEMPLATE_ID", async () => {
    const { ManifestEdit } = setup({
      step: RouteStep.editDeployment,
      templateId: CI_CD_TEMPLATE_ID
    });

    await vi.waitFor(() => {
      expect(ManifestEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          isGitProviderTemplate: true
        }),
        {}
      );
    });
  });

  it("redirects to gitlab with correct params when state is gitlab and code is present", async () => {
    const { mockRouter } = setup({
      state: "gitlab",
      code: "gitlab-auth-code"
    });

    await vi.waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        UrlService.newDeployment({
          step: RouteStep.editDeployment,
          gitProvider: "github",
          gitProviderCode: "gitlab-auth-code",
          templateId: CI_CD_TEMPLATE_ID
        })
      );
    });
  });

  it("does not redirect to gitlab when redeploy param is present", async () => {
    const { mockRouter } = setup({
      state: "gitlab",
      code: "gitlab-auth-code",
      redeploy: "123"
    });

    await vi.waitFor(() => {
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  it("redirects to edit-deployment step when templateId matches hardcodedTemplates", async () => {
    const hardcodedTemplate = hardcodedTemplates[0];
    const { mockRouter } = setup({
      step: RouteStep.chooseTemplate,
      templateId: hardcodedTemplate?.code
    });

    await vi.waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringContaining(`step=${RouteStep.editDeployment}`));
    });
  });

  it("redirects to edit-deployment step when requestedTemplate prop is provided", async () => {
    const requestedTemplate: TemplateOutput = {
      id: "template-123",
      name: "Test Template",
      deploy: "version: 2.0\nservices:\n  web:\n    image: nginx",
      config: { ssh: false },
      summary: "",
      logoUrl: "",
      readme: "",
      path: "",
      guide: "",
      githubUrl: "",
      persistentStorageEnabled: false
    };

    const { mockRouter } = setup({
      step: RouteStep.chooseTemplate,
      requestedTemplate
    });

    await vi.waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringContaining(`step=${RouteStep.editDeployment}`));
    });
  });

  it("redirects to edit-deployment step when deploySdl atom is available", async () => {
    const deploySdl: TemplateCreation = {
      code: "custom-sdl",
      name: "Custom Template",
      title: "Custom Template",
      category: "General",
      description: "Custom SDL template",
      content: "custom sdl content"
    };

    const { mockRouter } = setup({
      step: RouteStep.chooseTemplate,
      deploySdl
    });

    await vi.waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringContaining(`step=${RouteStep.editDeployment}`));
    });
  });

  it("redirects to edit-deployment step when redeploy param is present", async () => {
    const redeployData = {
      name: "Redeployed App",
      manifest: "redeploy manifest content"
    };

    const { mockRouter } = setup({
      step: RouteStep.chooseTemplate,
      redeploy: "123",
      redeployData
    });

    await vi.waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringContaining(`step=${RouteStep.editDeployment}`));
    });
  });

  it("toggles ssh component when template has ssh config", async () => {
    const { sdlBuilder } = setup({
      step: RouteStep.chooseTemplate,
      requestedTemplate: {
        id: "ssh-template",
        name: "SSH Template",
        deploy: "ssh deploy content",
        config: { ssh: true },
        summary: "",
        logoUrl: "",
        readme: "",
        path: "",
        guide: "",
        githubUrl: "",
        persistentStorageEnabled: false
      }
    });

    await vi.waitFor(() => {
      expect(sdlBuilder.toggleCmp).toHaveBeenCalledWith("ssh");
    });
  });

  it("sets isGitProviderTemplate and redirects when CI/CD image is in yaml", async () => {
    const deploySdl: TemplateCreation = {
      code: "ci-cd",
      name: "CI/CD Template",
      title: "CI/CD Template",
      category: "CI/CD",
      description: "CI/CD template",
      content: "ci-cd-image"
    };

    const { mockRouter } = setup({
      step: RouteStep.chooseTemplate,
      deploySdl,
      hasCiCdImageInSDL: true
    });

    await vi.waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringContaining("gitProvider"));
    });
  });

  it("shows loading state when templates are loading", () => {
    const { Layout } = setup({
      step: RouteStep.chooseTemplate,
      isLoadingTemplates: true
    });

    expect(Layout).toHaveBeenCalledWith(
      expect.objectContaining({
        isLoading: true
      }),
      {}
    );
  });

  it("renders with default step 0 when no step param is provided", async () => {
    setup({});

    await vi.waitFor(() => {
      expect(screen.getByTestId("template-list")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("stepper")).not.toBeInTheDocument();
  });

  it("loads new template content when user re-selects a different template", async () => {
    const templateA = makeTemplate({ id: "template-A", deploy: "version: 2.0\n# template A content" });
    const templateB = makeTemplate({ id: "template-B", deploy: "version: 2.0\n# template B content" });

    const { ManifestEdit, rerender } = setup({
      step: RouteStep.editDeployment,
      templateId: templateA.id,
      requestedTemplate: templateA
    });

    await vi.waitFor(() => {
      expect(ManifestEdit).toHaveBeenCalledWith(expect.objectContaining({ editedManifest: templateA.deploy }), {});
    });

    ManifestEdit.mockClear();
    rerender({ templateId: templateB.id, requestedTemplate: templateB });

    await vi.waitFor(() => {
      expect(ManifestEdit).toHaveBeenCalledWith(expect.objectContaining({ editedManifest: templateB.deploy }), {});
    });
  });

  it("preserves user-edited manifest when re-rendered with the same templateId", async () => {
    const templateA = makeTemplate({ id: "template-A", deploy: "version: 2.0\n# template A content" });

    const { ManifestEdit, rerender } = setup({
      step: RouteStep.editDeployment,
      templateId: templateA.id,
      requestedTemplate: templateA
    });

    await vi.waitFor(() => {
      expect(ManifestEdit).toHaveBeenCalledWith(expect.objectContaining({ editedManifest: templateA.deploy }), {});
    });

    const userEditedManifest = "version: 2.0\n# user-edited content";
    const lastProps = ManifestEdit.mock.calls.at(-1)?.[0];
    expect(lastProps).toBeDefined();
    lastProps!.setEditedManifest(userEditedManifest);

    await vi.waitFor(() => {
      expect(ManifestEdit).toHaveBeenLastCalledWith(expect.objectContaining({ editedManifest: userEditedManifest }), {});
    });

    ManifestEdit.mockClear();
    rerender({ templateId: templateA.id, requestedTemplate: templateA });

    await vi.waitFor(() => {
      expect(ManifestEdit).toHaveBeenCalled();
    });
    expect(ManifestEdit).toHaveBeenLastCalledWith(expect.objectContaining({ editedManifest: userEditedManifest }), {});
  });

  function setup(
    input: {
      step?: RouteStep;
      dseq?: string;
      templateId?: string;
      gitProvider?: string;
      code?: string;
      state?: string;
      redeploy?: string;
      redeployData?: { name: string; manifest: string };
      requestedTemplate?: TemplateOutput;
      deploySdl?: TemplateCreation | null;
      isLoadingTemplates?: boolean;
      hasCiCdImageInSDL?: boolean;
    } = {}
  ) {
    const buildSearchParams = (next: typeof input) => {
      const params = new Map<string, string>();
      if (next.step) params.set("step", next.step);
      if (next.dseq) params.set("dseq", next.dseq);
      if (next.templateId) params.set("templateId", next.templateId);
      if (next.gitProvider) params.set("gitProvider", next.gitProvider);
      if (next.code) params.set("code", next.code);
      if (next.state) params.set("state", next.state);
      if (next.redeploy) params.set("redeploy", next.redeploy);
      return {
        get: (key: string) => params.get(key) ?? null,
        entries: () => params.entries()
      } as unknown as ReadonlyURLSearchParams;
    };

    let mockSearchParams = buildSearchParams(input);
    let currentRequestedTemplate = input.requestedTemplate;
    let currentTemplateId = input.templateId;

    const mockRouter = {
      replace: vi.fn(),
      push: vi.fn()
    };

    const Layout = vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>);
    const TemplateList = vi.fn(() => <div data-testid="template-list">TemplateList</div>);
    const ManifestEdit = vi.fn<(props: ManifestEditProps) => React.ReactElement>(() => <div data-testid="manifest-edit">ManifestEdit</div>);
    const CreateLease = vi.fn(() => <div data-testid="create-lease">CreateLease</div>);
    const CustomizedSteppers = vi.fn(() => <div data-testid="stepper">Stepper</div>);

    // Create stable references for hook return values to prevent infinite re-renders
    const sdlBuilder = mock<SdlContextProps>();
    const localNotes = mock<LocalNotesContext>({
      getDeploymentData: vi.fn().mockReturnValue(input.redeployData ?? null)
    });
    const templatesValue = {
      isLoading: input.isLoadingTemplates ?? false,
      templates: [] as never[],
      categories: [] as never[]
    };

    const sdlAnalyzer = mock<AppDIContainer["sdlAnalyzer"]>({
      hasCiCdImage: vi.fn(() => input.hasCiCdImageInSDL ?? false)
    });

    const dependencies = {
      ...DEPENDENCIES,
      Editor: Object.assign(vi.fn(ComponentMock), { preload: vi.fn() }),
      Layout,
      TemplateList,
      ManifestEdit,
      CreateLease,
      CustomizedSteppers,
      useRouter: () => mockRouter,
      useSearchParams: () => mockSearchParams,
      useSdlBuilder: () => sdlBuilder,
      useLocalNotes: () => localNotes,
      useTemplates: () => templatesValue
    } as unknown as typeof DEPENDENCIES;
    const store = createStore();

    if (input.deploySdl !== undefined) {
      store.set(sdlStore.deploySdl, input.deploySdl);
    }

    const renderTree = () => (
      <TestContainerProvider
        services={{
          sdlAnalyzer: () => sdlAnalyzer
        }}
      >
        <JotaiStoreProvider store={store}>
          <NewDeploymentContainer template={currentRequestedTemplate} templateId={currentTemplateId} dependencies={dependencies} />
        </JotaiStoreProvider>
      </TestContainerProvider>
    );

    const view = render(renderTree());

    const rerender = (next: Partial<typeof input>) => {
      const merged = { ...input, ...next };
      mockSearchParams = buildSearchParams(merged);
      currentRequestedTemplate = merged.requestedTemplate;
      currentTemplateId = merged.templateId;
      view.rerender(renderTree());
    };

    return {
      mockRouter,
      localNotes,
      sdlBuilder,
      Layout,
      CreateLease,
      ManifestEdit,
      TemplateList,
      rerender
    };
  }

  function makeTemplate(overrides: Partial<TemplateOutput> & { id: string; deploy: string }): TemplateOutput {
    return {
      name: `Template ${overrides.id}`,
      config: { ssh: false },
      summary: "",
      logoUrl: "",
      readme: "",
      path: "",
      guide: "",
      githubUrl: "",
      persistentStorageEnabled: false,
      ...overrides
    };
  }
});
