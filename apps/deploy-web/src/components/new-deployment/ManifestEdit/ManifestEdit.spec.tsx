import type { ForwardRefExoticComponent } from "react";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it, type Mock, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider";
import sdlStore from "@src/store/sdlStore";
import { DEPENDENCIES, ManifestEdit } from "./ManifestEdit";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentMock, createRefComponentMock } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Dependencies = typeof DEPENDENCIES;

describe(ManifestEdit.name, () => {
  it("renders deployment name input and Create Deployment button", () => {
    setup();

    expect(screen.getByLabelText(/Name your deployment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Deployment/i })).toBeInTheDocument();
  });

  it("disables Create Deployment button when editedManifest is empty", () => {
    setup({ editedManifest: null });

    expect(screen.getByRole("button", { name: /Create Deployment/i })).toBeDisabled();
  });

  it("disables Create Deployment button when blockchain is down", () => {
    setup({ editedManifest: "some-manifest", isBlockchainDown: true });

    expect(screen.getByRole("button", { name: /Create Deployment/i })).toBeDisabled();
  });

  it("sets deployment name from selected template", async () => {
    setup({ selectedTemplate: { title: "My Template", code: "my-template", category: "General", description: "A template", name: "Template Name" } });

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/Name your deployment/i)).toHaveValue("Template Name");
    });
  });

  it("shows parsing error when create deployment is clicked with invalid SDL", async () => {
    setup({ editedManifest: "some-manifest" });

    await userEvent.click(screen.getByRole("button", { name: /Create Deployment/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/Error while parsing SDL/i)).toBeInTheDocument();
    });
  });

  it("shows Builder and YAML buttons when yml-editor component is available", () => {
    setup({ hasComponents: ["yml-editor"] });

    expect(screen.getByRole("button", { name: /Builder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /YAML/i })).toBeInTheDocument();
  });

  it("hides Builder and YAML buttons when yml-editor component is not available", () => {
    setup({ hasComponents: [] });

    expect(screen.queryByRole("button", { name: /Builder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /YAML/i })).not.toBeInTheDocument();
  });

  it("hides mode toggle buttons for git provider templates", () => {
    setup({ isGitProviderTemplate: true, hasComponents: ["yml-editor"] });

    expect(screen.queryByRole("button", { name: /Builder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /YAML/i })).not.toBeInTheDocument();
  });

  it("shows upload button when yml-uploader is available and no templateId", () => {
    setup({ hasComponents: ["yml-uploader"], templateId: null });

    expect(screen.getByText(/Upload your SDL/i)).toBeInTheDocument();
  });

  it("hides upload button when templateId is set", () => {
    setup({ hasComponents: ["yml-uploader"], templateId: "some-template" });

    expect(screen.queryByText(/Upload your SDL/i)).not.toBeInTheDocument();
  });

  it("renders SDLEditor when in yaml mode and yml-editor is available", () => {
    const SDLEditor = vi.fn(ComponentMock);
    const SdlBuilder = createRefComponentMock();
    setup({ hasComponents: ["yml-editor"], editedManifest: "some-yaml", SDLEditor, SdlBuilder, selectedSdlEditMode: "yaml" });

    expect(SdlBuilder.renderFn).not.toHaveBeenCalled();
    expect(SDLEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "some-yaml"
      }),
      expect.anything()
    );
  });

  it("renders SdlBuilder when in builder mode", () => {
    const SdlBuilder = createRefComponentMock();
    const SDLEditor = vi.fn(ComponentMock);
    setup({ SdlBuilder, SDLEditor, selectedSdlEditMode: "builder" });

    expect(SdlBuilder.renderFn).toHaveBeenCalled();
    expect(SDLEditor).not.toHaveBeenCalled();
  });

  it("shows PrerequisiteList when create deployment is clicked for non-managed wallet", async () => {
    const PrerequisiteList = vi.fn(ComponentMock);
    const SDLEditor = vi.fn(ComponentMock);

    setup({
      editedManifest: "some-manifest",
      isManaged: false,
      PrerequisiteList,
      SDLEditor,
      hasComponents: ["yml-editor"],
      selectedSdlEditMode: "yaml"
    });

    act(() => {
      triggerSdlValidation(SDLEditor, true);
    });

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: /Create Deployment/i })).not.toBeDisabled();
    });

    await userEvent.click(screen.getByRole("button", { name: /Create Deployment/i }));

    await vi.waitFor(() => {
      expect(PrerequisiteList).toHaveBeenCalledWith(
        expect.objectContaining({
          onClose: expect.any(Function),
          onContinue: expect.any(Function)
        }),
        expect.anything()
      );
    });
  });

  it("shows DeploymentDepositModal when create deployment is clicked for managed wallet", async () => {
    const DeploymentDepositModal = vi.fn(ComponentMock);
    const SDLEditor = vi.fn(ComponentMock);

    setup({
      editedManifest: "some-manifest",
      isManaged: true,
      DeploymentDepositModal,
      SDLEditor,
      hasComponents: ["yml-editor"],
      selectedSdlEditMode: "yaml"
    });

    act(() => {
      triggerSdlValidation(SDLEditor, true);
    });

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: /Create Deployment/i })).not.toBeDisabled();
    });

    await userEvent.click(screen.getByRole("button", { name: /Create Deployment/i }));

    await vi.waitFor(() => {
      expect(DeploymentDepositModal).toHaveBeenCalledWith(
        expect.objectContaining({
          handleCancel: expect.any(Function),
          onDeploymentDeposit: expect.any(Function),
          denom: "uakt",
          title: "Confirm deployment creation?"
        }),
        expect.anything()
      );
    });
  });

  it("tracks create_deployment_btn_clk event when Create Deployment is clicked", async () => {
    const analyticsService = mock<AppDIContainer["analyticsService"]>();
    setup({ editedManifest: "some-manifest", analyticsService });

    await userEvent.click(screen.getByRole("button", { name: /Create Deployment/i }));

    expect(analyticsService.track).toHaveBeenCalledWith("create_deployment_btn_clk", "Amplitude");
  });

  it("updates deployment name input when user types", async () => {
    setup();

    const input = screen.getByLabelText(/Name your deployment/i);
    await userEvent.clear(input);
    await userEvent.type(input, "My Deployment");

    expect(input).toHaveValue("My Deployment");
  });

  function triggerSdlValidation(SDLEditor: Mock, isValid: boolean) {
    const lastCall = SDLEditor.mock.calls[SDLEditor.mock.calls.length - 1];
    if (lastCall) {
      const props = lastCall[0];
      props.onValidate({ isValid });
    }
  }

  function setup(input?: {
    editedManifest?: string | null;
    selectedTemplate?: { title: string; code: string; category: string; description: string; name?: string };
    isGitProviderTemplate?: boolean;
    isBlockchainDown?: boolean;
    isManaged?: boolean;
    hasComponents?: string[];
    templateId?: string | null;
    SDLEditor?: Mock;
    SdlBuilder?: Mock | ForwardRefExoticComponent<any>;
    PrerequisiteList?: Mock;
    DeploymentDepositModal?: Mock;
    analyticsService?: AppDIContainer["analyticsService"];
    selectedSdlEditMode?: "yaml" | "builder";
  }) {
    const hasComponents = new Set(input?.hasComponents ?? []);
    const analyticsService = input?.analyticsService ?? mock<AppDIContainer["analyticsService"]>();
    const store = createStore();

    if (input?.selectedSdlEditMode) {
      store.set(sdlStore.selectedSdlEditMode, input.selectedSdlEditMode);
    }

    const dependencies = {
      ...DEPENDENCIES,
      Alert: ComponentMock,
      CustomTooltip: ComponentMock,
      FileButton: ComponentMock,
      SDLEditor: input?.SDLEditor ?? ComponentMock,
      SdlBuilder: input?.SdlBuilder ?? createRefComponentMock(),
      ShareDeployButton: ComponentMock,
      DeploymentDepositModal: input?.DeploymentDepositModal ?? ComponentMock,
      DeploymentMinimumEscrowAlertText: ComponentMock,
      TrialDeploymentBadge: ComponentMock,
      CustomNextSeo: ComponentMock,
      LinkTo: ComponentMock,
      PrerequisiteList: input?.PrerequisiteList ?? ComponentMock,
      ViewPanel: ComponentMock,
      useSettings: () => ({
        settings: {
          apiEndpoint: "https://api.example.com",
          rpcEndpoint: "https://rpc.example.com",
          isCustomNode: false,
          nodes: [],
          selectedNode: null,
          customNode: null,
          isBlockchainDown: input?.isBlockchainDown ?? false
        },
        setSettings: vi.fn(),
        isLoadingSettings: false,
        isSettingsInit: true,
        refreshNodeStatuses: vi.fn(),
        isRefreshingNodeStatus: false
      }),
      useWallet: (() => ({
        address: "akash123",
        walletName: "test",
        isWalletConnected: true,
        isWalletLoaded: true,
        isManaged: input?.isManaged ?? false,
        isTrialing: false,
        signAndBroadcastTx: vi.fn().mockResolvedValue({})
      })) as unknown as Dependencies["useWallet"],
      useCertificate: () =>
        mock({
          updateSelectedCertificate: vi.fn(),
          genNewCertificateIfLocalIsInvalid: vi.fn().mockResolvedValue(null)
        }),
      useSdlBuilder: (() => ({
        hasComponent: (name: string) => hasComponents.has(name),
        toggleCmp: vi.fn()
      })) as unknown as Dependencies["useSdlBuilder"],
      useImportSimpleSdl: () => [],
      useManagedWalletDenom: () => "uakt",
      useDepositParams: (() => ({ data: 5000000 })) as unknown as Dependencies["useDepositParams"],
      useMuiTheme: () => ({
        breakpoints: {
          down: () => "(max-width: 900px)"
        }
      }),
      useMediaQuery: () => false,
      useSnackbar: () => ({
        enqueueSnackbar: vi.fn(),
        closeSnackbar: vi.fn()
      }),
      useRouter: () => mock(),
      useSearchParams: (() => ({
        get: (key: string) => (key === "templateId" ? input?.templateId ?? null : null)
      })) as unknown as Dependencies["useSearchParams"]
    } as unknown as Dependencies;

    return render(
      <TestContainerProvider
        services={{
          analyticsService: () => analyticsService,
          chainApiHttpClient: () => mock<AppDIContainer["chainApiHttpClient"]>(),
          deploymentLocalStorage: () => mock<AppDIContainer["deploymentLocalStorage"]>()
        }}
      >
        <JotaiStoreProvider store={store}>
          <ManifestEdit
            editedManifest={input?.editedManifest !== undefined ? input.editedManifest : "some-manifest"}
            setEditedManifest={vi.fn()}
            onTemplateSelected={vi.fn()}
            selectedTemplate={(input?.selectedTemplate as any) ?? null}
            isGitProviderTemplate={input?.isGitProviderTemplate}
            dependencies={dependencies}
          />
        </JotaiStoreProvider>
      </TestContainerProvider>
    );
  }
});
