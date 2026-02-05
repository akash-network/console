import React from "react";
import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { mock } from "jest-mock-extended";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import type { ReadonlyURLSearchParams } from "next/navigation";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import type { ContextType as LocalNotesContext } from "@src/context/LocalNoteProvider/LocalNoteContext";
import type { SdlContextProps } from "@src/context/SdlBuilderProvider";
import type { AppDIContainer } from "@src/context/ServicesProvider";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { hardcodedTemplates } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, NewDeploymentContainer } from "./NewDeploymentContainer";

import { render, screen, waitFor } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(NewDeploymentContainer.name, () => {
  it("renders TemplateList when step is choose-template", async () => {
    setup({ step: RouteStep.chooseTemplate });

    await waitFor(() => {
      expect(screen.getByTestId("template-list")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("manifest-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-lease")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stepper")).not.toBeInTheDocument();
  });

  it("renders ManifestEdit and Stepper when step is edit-deployment", async () => {
    const { ManifestEdit } = setup({ step: RouteStep.editDeployment });

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  it("redirects to edit-deployment step when templateId matches hardcodedTemplates", async () => {
    const hardcodedTemplate = hardcodedTemplates[0];
    const { mockRouter } = setup({
      step: RouteStep.chooseTemplate,
      templateId: hardcodedTemplate?.code
    });

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
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

    await waitFor(() => {
      expect(screen.getByTestId("template-list")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("stepper")).not.toBeInTheDocument();
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
    const searchParams = new Map<string, string>();
    if (input.step) searchParams.set("step", input.step);
    if (input.dseq) searchParams.set("dseq", input.dseq);
    if (input.templateId) searchParams.set("templateId", input.templateId);
    if (input.gitProvider) searchParams.set("gitProvider", input.gitProvider);
    if (input.code) searchParams.set("code", input.code);
    if (input.state) searchParams.set("state", input.state);
    if (input.redeploy) searchParams.set("redeploy", input.redeploy);

    const mockSearchParams = {
      get: (key: string) => searchParams.get(key) ?? null,
      entries: () => searchParams.entries()
    } as unknown as ReadonlyURLSearchParams;

    const mockRouter = {
      replace: jest.fn(),
      push: jest.fn()
    };

    const Layout = jest.fn(({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>);
    const TemplateList = jest.fn(() => <div data-testid="template-list">TemplateList</div>);
    const ManifestEdit = jest.fn(() => <div data-testid="manifest-edit">ManifestEdit</div>);
    const CreateLease = jest.fn(() => <div data-testid="create-lease">CreateLease</div>);
    const CustomizedSteppers = jest.fn(() => <div data-testid="stepper">Stepper</div>);

    // Create stable references for hook return values to prevent infinite re-renders
    const sdlBuilder = mock<SdlContextProps>();
    const localNotes = mock<LocalNotesContext>({
      getDeploymentData: jest.fn().mockReturnValue(input.redeployData ?? null)
    });
    const templatesValue = {
      isLoading: input.isLoadingTemplates ?? false,
      templates: [] as never[],
      categories: [] as never[]
    };

    const sdlAnalyzer = mock<AppDIContainer["sdlAnalyzer"]>({
      hasCiCdImage: jest.fn(() => input.hasCiCdImageInSDL ?? false)
    });

    const dependencies = {
      ...DEPENDENCIES,
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

    render(
      <TestContainerProvider
        services={{
          sdlAnalyzer: () => sdlAnalyzer
        }}
      >
        <JotaiStoreProvider store={store}>
          <NewDeploymentContainer template={input.requestedTemplate} templateId={input.templateId} dependencies={dependencies} />
        </JotaiStoreProvider>
      </TestContainerProvider>
    );

    return {
      mockRouter,
      localNotes,
      sdlBuilder,
      Layout,
      CreateLease,
      ManifestEdit,
      TemplateList
    };
  }
});
