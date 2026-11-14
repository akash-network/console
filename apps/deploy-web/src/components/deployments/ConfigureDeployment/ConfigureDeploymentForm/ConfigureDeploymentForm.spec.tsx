import type { ComponentProps, ReactNode } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { PlacementType, SdlBuilderFormValuesType } from "@src/types";
import type { TemplateAskedValue, TemplateSource } from "@src/types/marketplace-template";
import type { OrganizationRole } from "@src/types/organization";
import { defaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { HELLO_WORLD_IMAGE } from "@src/utils/templates";
import { ConfigurationPane } from "../ConfigurationPane/ConfigurationPane";
import { DEPENDENCIES as LOGS_CARD_DEPENDENCIES, LogsCard } from "../ConfigurationPane/LogsCard/LogsCard";
import { ConfigureEditor, DEPENDENCIES as CONFIGURE_EDITOR_DEPENDENCIES } from "../ConfigureEditor/ConfigureEditor";
import { PlacementFields } from "../ConfigureEditor/PlacementFields/PlacementFields";
import { DEPENDENCIES as SERVICE_CARD_DEPENDENCIES, ServiceCard } from "../ConfigureEditor/ServiceCard/ServiceCard";
import { ServiceStack } from "../ConfigureEditor/ServiceStack/ServiceStack";
import { DEPENDENCIES as DEPLOYMENT_PANE_DEPENDENCIES, DeploymentPane } from "../DeploymentPane/DeploymentPane";
import { DEPENDENCIES as PLACEMENT_CARD_DEPENDENCIES, PlacementCard } from "../DeploymentPane/PlacementCard/PlacementCard";
import { importDeploymentState } from "../importDeploymentState/importDeploymentState";
import { useInheritedSecrets } from "../InheritedSecretsProvider/InheritedSecretsProvider";
import { NeedsFundsAlert } from "../NeedsFundsAlert/NeedsFundsAlert";
import { usePlacementManagerContext } from "../PlacementManagerProvider/PlacementManagerProvider";
import type { FundingImpactState } from "../ReviewAndDeployModal/useFundingImpact";
import { SdlImportChangesBanner } from "../SdlImportChangesBanner/SdlImportChangesBanner";
import type { DeploymentFlow, FlowError } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./ConfigureDeploymentForm";
import { ConfigureDeploymentForm } from "./ConfigureDeploymentForm";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildMarketplaceTemplate, buildTemplateVersion } from "@tests/seeders/userTemplate";

const VALID_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.0",
  "    expose:",
  "      - port: 80",
  "        as: 80",
  "        to:",
  "          - global: true",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1"
].join("\n");

const SINGLE_REGION_SDL = VALID_SDL.replace("    dcloud:\n      pricing:", "    dcloud:\n      attributes:\n        location-region: us-west\n      pricing:");

/** The valid SDL with a private registry on its service, the password typed in the clear as an upload would carry it. */
const CREDENTIALS_SDL = VALID_SDL.replace(
  "    image: nginx:1.0",
  ["    image: nginx:1.0", "    credentials:", "      host: ghcr.io", "      username: alice", "      password: hunter22"].join("\n")
);

/** The valid SDL with a variable an upload carries in the clear, which the user may go on to mark secret. */
const PLAIN_VARIABLE_SDL = VALID_SDL.replace("    image: nginx:1.0", ["    image: nginx:1.0", "    env:", "      - API_KEY=hunter2"].join("\n"));

/** The valid SDL as the api records it once a registry password has been sealed away, so it reaches Configure carrying a reference. */
const INHERITED_REFERENCE_SDL = VALID_SDL.replace(
  "    image: nginx:1.0",
  ["    image: nginx:1.0", "    credentials:", "      host: ghcr.io", "      username: alice", "      password: ac-secret://c_password"].join("\n")
);

const TEMPLATE_SDL = VALID_SDL.replace(
  "    image: nginx:1.0",
  ["    image: nginx:1.0", "    env:", "      - ADMIN_EMAIL=", "      - HF_TOKEN=ac-secret://HF_TOKEN"].join("\n")
);

const FILLED_TEMPLATE_SDL = TEMPLATE_SDL.replace("ADMIN_EMAIL=", "ADMIN_EMAIL=admin@northwind.dev");

const TEMPLATE_ASKED_VALUES: TemplateAskedValue[] = [
  { key: "ADMIN_EMAIL", label: "Admin email", type: "text", required: true, bindings: [{ service: "web", env: "ADMIN_EMAIL" }] },
  { key: "HF_TOKEN", label: "Hugging Face token", type: "secret", required: true, bindings: [{ service: "web", env: "HF_TOKEN" }] }
];

const TWO_SERVICE_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.0",
  "    expose:",
  "      - port: 80",
  "        as: 80",
  "        to:",
  "          - global: true",
  "  api:",
  "    image: node:18",
  "    expose:",
  "      - port: 3000",
  "        as: 3000",
  "        to:",
  "          - global: true",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "    api:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uact",
  "          amount: 1000",
  "        api:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1",
  "  api:",
  "    dcloud:",
  "      profile: api",
  "      count: 1"
].join("\n");

/** The valid SDL with its service also deployed to a second placement, which the form has no way to hold. */
const TWO_PLACEMENT_SDL = VALID_SDL.replace(
  "  placement:\n",
  "  placement:\n    west:\n      pricing:\n        web:\n          denom: uact\n          amount: 1000\n"
).concat("\n    west:\n      profile: web\n      count: 1");

/** A VM deployment saved before any SSH key was entered: the VM image is present but no SSH_PUBKEY env exists. */
const VM_SDL_WITHOUT_KEY = [
  "version: '2.0'",
  "services:",
  "  vm:",
  "    image: ghcr.io/akash-network/ubuntu-2404-ssh:2",
  "    expose:",
  "      - port: 22",
  "        as: 22",
  "        proto: tcp",
  "        to:",
  "          - global: true",
  "profiles:",
  "  compute:",
  "    vm:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        vm:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  vm:",
  "    dcloud:",
  "      profile: vm",
  "      count: 1"
].join("\n");

describe(ConfigureDeploymentForm.name, () => {
  it("seeds the panes with the carried-in template SDL", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: sealedSdlOf(VALID_SDL) }), expect.anything());
  });

  it("publishes its form for the assistant with the flow phase and the live sdl", () => {
    const { usePublishConfigureForm, flow } = setup({ initialSdl: VALID_SDL });

    expect(usePublishConfigureForm).toHaveBeenCalledWith({
      form: expect.objectContaining({ getValues: expect.any(Function) }),
      phase: flow.phase,
      sdl: sealedSdlOf(VALID_SDL)
    });
  });

  it("threads both the live sdl and the debounced preview sdl into the panes", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(
      expect.objectContaining({ sdl: sealedSdlOf(VALID_SDL), previewSdl: sealedSdlOf(VALID_SDL) }),
      expect.anything()
    );
  });

  it("falls back to a default deployment when the carried-in SDL has no services", () => {
    const { ConfigureDeploymentPanes, enqueueSnackbar } = setup({ initialSdl: 'version: "2.0"' });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(
      expect.objectContaining({ sdl: expect.stringContaining('version: "2.0"'), selectedServiceId: expect.any(String) }),
      expect.anything()
    );
  });

  it("generates the SDL of the default deployment when no SDL was provided", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: undefined });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: expect.stringContaining('version: "2.0"') }), expect.anything());
  });

  it("seeds a fresh deployment on the small hardware preset (1 vCPU / 2Gi / 10Gi)", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: undefined });

    const sdl = ConfigureDeploymentPanes.mock.calls[0][0].sdl as string;
    expect(sdl).toContain("2Gi");
    expect(sdl).toContain("10Gi");
  });

  it("selects the first service from the imported template", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ selectedServiceId: expect.any(String) }), expect.anything());
  });

  it("hydrates the deployment pane with the imported template's services", () => {
    setup({ initialSdl: TWO_SERVICE_SDL, Panes: ServiceListProbePanes });

    expect(screen.getByTestId("service-titles").textContent).toBe("web,api");
  });

  it("surfaces an error and falls back to a default when the SDL cannot be imported", () => {
    const { ConfigureDeploymentPanes, enqueueSnackbar } = setup({ initialSdl: "services: [unclosed" });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(
      expect.objectContaining({ sdl: expect.stringContaining('version: "2.0"'), selectedServiceId: expect.any(String) }),
      expect.anything()
    );
  });

  it("starts with a default service selected when no SDL was provided", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: undefined });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ selectedServiceId: expect.any(String) }), expect.anything());
  });

  it("regenerates the SDL preview when the form changes", async () => {
    setup({ initialSdl: undefined, Panes: SdlProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("nginx:latest"));
  });

  it("drops the removed service from the preview after it is added then removed", async () => {
    setup({ initialSdl: undefined, Panes: AddRemoveProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "add service" }));
    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("service-2"));

    await userEvent.click(screen.getByRole("button", { name: "remove service" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).not.toContain("service-2"));
    expect(screen.getByTestId("ghost-free").textContent).toBe("true");
  });

  it("drops the removed placement and its service from the preview after it is added then removed", async () => {
    setup({ initialSdl: undefined, Panes: AddRemoveProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "add placement" }));
    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("placement-1"));

    await userEvent.click(screen.getByRole("button", { name: "remove placement" }));

    await waitFor(() => {
      const sdl = screen.getByTestId("sdl").textContent ?? "";
      expect(sdl).not.toContain("placement-1");
      expect(sdl).not.toContain("service-2");
    });
    expect(screen.getByTestId("ghost-free").textContent).toBe("true");
  });

  it("removes a non-selected service without a ghost and keeps the current selection", async () => {
    setup({ initialSdl: undefined, Panes: AddRemoveProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "add service" }));
    await userEvent.click(screen.getByRole("button", { name: "add service" }));
    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("service-3"));
    const selectedService3 = screen.getByTestId("selected").textContent;

    await userEvent.click(screen.getByRole("button", { name: "remove first service" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).not.toContain("service-1"));
    expect(screen.getByTestId("ghost-free").textContent).toBe("true");
    expect(screen.getByTestId("selected").textContent).toBe(selectedService3);
  });

  it("turns log forwarding off after another service was added without leaving a ghost service", async () => {
    setup({ initialSdl: undefined, Panes: LogForwardingProbePanes });

    await userEvent.click(screen.getByRole("switch", { name: "Enable log forwarding" }));
    await userEvent.click(screen.getByRole("button", { name: /Save/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add service" }));
    await userEvent.click(screen.getByRole("button", { name: "Select service-1" }));
    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("service-1-log-collector"));

    await userEvent.click(screen.getByRole("switch", { name: "Enable log forwarding" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).not.toContain("log-collector"));
    expect(screen.getByTestId("sdl").textContent).toContain("service-2");
    expect(screen.getByTestId("ghost-free").textContent).toBe("true");
    expect(screen.getAllByRole("button", { name: /^Select service-/ })).toHaveLength(2);
  });

  it("reselects the first remaining service when the selected one is removed", async () => {
    setup({ initialSdl: undefined, Panes: SelectionProbePanes });
    const initialSelectedId = screen.getByTestId("selected").textContent;

    await userEvent.click(screen.getByRole("button", { name: "replace services" }));

    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).not.toBe(initialSelectedId);
      expect(screen.getByTestId("selected").textContent).toBe(screen.getByTestId("first-service-id").textContent);
    });
  });

  it("persists the regenerated sdl to the draft after an edit settles", async () => {
    const { save } = setup({ initialSdl: undefined, Panes: SdlProbePanes, draftId: "draft-1" });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.stringContaining("nginx:latest"), expect.any(String), undefined, undefined, {}));
  });

  it("regenerates a carried-in SDL with its registry credentials as references, so the draft never holds the password", async () => {
    const { save } = setup({ initialSdl: CREDENTIALS_SDL });

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(expect.stringContaining("ac-secret://REGISTRY_PASSWORD"), expect.any(String), undefined, expect.any(String), {})
    );
    expect(save.mock.calls.flat().filter(arg => String(arg).includes("hunter22"))).toEqual([]);
  });

  it("keeps the sdl a restored draft started from in its later saves", async () => {
    const { save } = setup({ initialSdl: TWO_SERVICE_SDL, persistedSdl: TWO_SERVICE_SDL, persistedStartingSdl: VALID_SDL });

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined, sealedSdlOf(VALID_SDL), {}));
  });

  it("seals a variable marked secret in the starting sdl the draft holds, not only in the working one", async () => {
    const { save } = setup({
      initialSdl: PLAIN_VARIABLE_SDL,
      persistedSdl: PLAIN_VARIABLE_SDL,
      persistedStartingSdl: PLAIN_VARIABLE_SDL,
      Panes: SecretProbePanes
    });

    await userEvent.click(screen.getByRole("button", { name: "mark variable secret" }));

    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(
        expect.stringContaining("API_KEY=ac-secret://API_KEY"),
        expect.any(String),
        undefined,
        expect.stringContaining("API_KEY=ac-secret://API_KEY"),
        {}
      )
    );
    expect(JSON.stringify(save.mock.lastCall)).not.toContain("hunter2");
  });

  it("keeps the starting sdl sealed once a variable marked secret is renamed", async () => {
    const { save } = setup({
      initialSdl: PLAIN_VARIABLE_SDL,
      persistedSdl: PLAIN_VARIABLE_SDL,
      persistedStartingSdl: PLAIN_VARIABLE_SDL,
      Panes: SecretProbePanes
    });

    await userEvent.click(screen.getByRole("button", { name: "mark variable secret" }));
    await userEvent.click(screen.getByRole("button", { name: "rename variable" }));

    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(expect.stringContaining("OPENAI_KEY=ac-secret://OPENAI_KEY"), expect.any(String), undefined, expect.any(String), {})
    );
    expect(JSON.stringify(save.mock.lastCall)).not.toContain("hunter2");
  });

  it("leaves a starting sdl that no longer imports out of a sealed draft", async () => {
    const { save } = setup({ initialSdl: VALID_SDL, persistedSdl: VALID_SDL, persistedStartingSdl: "not: [valid" });

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined, undefined, {}));
  });

  it("forgets the redeploy source and explains when the console cannot reuse its secrets", () => {
    const message = "The secrets recorded for the deployment being inherited from can no longer be decrypted";
    const { dropInheritance, enqueueSnackbar } = setup({
      initialSdl: VALID_SDL,
      persistedInheritSecretsFrom: "123",
      flowError: { kind: "inherited-unreadable", message }
    });

    expect(dropInheritance).toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    const toast = enqueueSnackbar.mock.calls[0][0] as { props: { title: string; subTitle: string } };
    expect(toast.props).toMatchObject({ title: "The previous deployment's secrets can't be reused", subTitle: message });
  });

  it("offers a redeploy's inherited secret names to the panes", () => {
    setup({ initialSdl: INHERITED_REFERENCE_SDL, persistedInheritSecretsFrom: "123", Panes: InheritedSecretsProbePanes });

    expect(screen.getByTestId("inherited-source").textContent).toBe("123");
    expect(screen.getByTestId("inherited-names").textContent).toBe("c_password");
  });

  it("clears the configure draft once the deployment is deployed", () => {
    const { clear } = setup({ initialSdl: undefined, deploySucceeded: true });

    expect(clear).toHaveBeenCalled();
  });

  it("keeps the configure draft while the deployment has not been deployed", () => {
    const { clear } = setup({ initialSdl: undefined, deploySucceeded: false });

    expect(clear).not.toHaveBeenCalled();
  });

  describe("while deploying", () => {
    it("leaves telling the user about a deployment created in the background to the flow provider", () => {
      const { enqueueSnackbar } = setup({ initialSdl: undefined, phase: "deploying", isDeployedInBackground: true, deploySucceeded: true });

      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("keeps the review up with its deploy pending, and no progress screen, while the deploy is handed to the api", () => {
      const { ReviewAndDeployModal, DeployProgressOverlay } = setup({ initialSdl: undefined, phase: "deploying", showsDeployProgress: false });

      expect(ReviewAndDeployModal).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, isDeploying: true }), expect.anything());
      expect(DeployProgressOverlay).not.toHaveBeenCalled();
    });

    it("closes the review and shows the progress screen once the deploy shows its progress", () => {
      const { ReviewAndDeployModal, DeployProgressOverlay } = setup({ initialSdl: undefined, phase: "deploying", showsDeployProgress: true });

      expect(ReviewAndDeployModal).toHaveBeenLastCalledWith(expect.objectContaining({ open: false, isDeploying: false }), expect.anything());
      expect(DeployProgressOverlay).toHaveBeenCalledWith(expect.objectContaining({ activePhase: "preparing" }), expect.anything());
    });

    it.each([true, false])("shows neither the progress screen nor a pending review once the deploy is over (progress shown: %s)", showsDeployProgress => {
      const { ReviewAndDeployModal, DeployProgressOverlay } = setup({ initialSdl: undefined, phase: "quoting", showsDeployProgress });

      expect(ReviewAndDeployModal).toHaveBeenLastCalledWith(expect.objectContaining({ open: false, isDeploying: false }), expect.anything());
      expect(DeployProgressOverlay).not.toHaveBeenCalled();
    });

    it.each([true, false])("brings the review back with the deploy taking long, over any progress screen (progress shown: %s)", showsDeployProgress => {
      const { ReviewAndDeployModal, DeployProgressOverlay } = setup({
        initialSdl: undefined,
        phase: "deploying",
        showsDeployProgress,
        isDeployTakingLong: true
      });

      expect(ReviewAndDeployModal).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, isDeploying: true, isDeployTakingLong: true }),
        expect.anything()
      );
      expect(DeployProgressOverlay).not.toHaveBeenCalled();
    });

    it("sends the deploy again from the form values when the user retries a deploy taking long", async () => {
      const { flow, analyticsService, ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL, phase: "deploying", isDeployTakingLong: true });

      await userEvent.click(screen.getByRole("button", { name: "retry" }));

      expect(flow.actions.deploy).toHaveBeenCalledWith(lastPanesProps(ConfigureDeploymentPanes).sdl, { secrets: {}, unresolvedSecrets: [] });
      expect(analyticsService.track).not.toHaveBeenCalledWith("review_deploy_confirmed", expect.anything());
    });

    it("goes back to the bids of the same deployment when the user leaves a deploy taking long", async () => {
      const { flow } = setup({ initialSdl: VALID_SDL, phase: "deploying", isDeployTakingLong: true });

      await userEvent.click(screen.getByRole("button", { name: "back to bids" }));

      expect(flow.actions.refreshQuotes).toHaveBeenCalled();
      expect(flow.actions.discard).not.toHaveBeenCalled();
    });
  });

  it("seeds the deployment name from initialName", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: undefined, initialName: "my-app" });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ deploymentName: "my-app" }), expect.anything());
  });

  it("persists the deployment name into the draft alongside the sdl", async () => {
    const { save } = setup({ initialSdl: undefined, initialName: "my-app", Panes: SdlProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.stringContaining("nginx:latest"), "my-app", undefined, undefined, {}));
  });

  it("seeds the runtime limit from the persisted draft and forwards it to the review modal", () => {
    const { ReviewAndDeployModal } = setup({ initialSdl: undefined, persistedRuntimeLimitHours: 6 });

    expect(ReviewAndDeployModal).toHaveBeenCalledWith(expect.objectContaining({ runtimeLimitHours: 6 }), expect.anything());
  });

  it("persists the runtime limit into the draft alongside the sdl", async () => {
    const { save } = setup({ initialSdl: undefined, persistedRuntimeLimitHours: 6, Panes: SdlProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.stringContaining("nginx:latest"), expect.any(String), 6, undefined, {}));
  });

  it("persists several picked regions into the draft beside the sdl, which can't carry them", async () => {
    const { save } = setup({ initialSdl: undefined, Panes: RegionsProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "pick two regions" }));

    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), undefined, undefined, { dcloud: ["eu-west", "na-us-west"] })
    );
  });

  it("persists a changed pick of several regions even though the sdl stays the same", async () => {
    const { save } = setup({ initialSdl: undefined, Panes: RegionsProbePanes });
    await userEvent.click(screen.getByRole("button", { name: "pick two regions" }));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), undefined, undefined, { dcloud: ["eu-west", "na-us-west"] })
    );

    await userEvent.click(screen.getByRole("button", { name: "pick three regions" }));

    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), undefined, undefined, { dcloud: ["eu-west", "na-us-west", "eu-central"] })
    );
  });

  it("restores several picked regions the draft saved beside its sdl", () => {
    setup({ initialSdl: VALID_SDL, persistedPlacementRegions: { dcloud: ["eu-west", "na-us-west"] }, Panes: RegionsProbePanes });

    expect(screen.getByTestId("regions").textContent).toBe("eu-west,na-us-west");
  });

  it("keeps the sdl's region for a placement the draft saved no picks for", () => {
    setup({ initialSdl: SINGLE_REGION_SDL, persistedPlacementRegions: { other: ["eu-west", "na-us-west"] }, Panes: RegionsProbePanes });

    expect(screen.getByTestId("regions").textContent).toBe("us-west");
  });

  it("toasts when the flow reports an error, such as the no-providers timeout", () => {
    const { enqueueSnackbar } = setup({ initialSdl: undefined, flowError: { message: "No providers are available" } });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
  });

  it("titles the toast as a close failure when the flow error is a close error", () => {
    const { enqueueSnackbar } = setup({ initialSdl: undefined, flowError: { message: "still closing", kind: "close" } });

    const toast = enqueueSnackbar.mock.calls[0][0] as { props: { title: string } };
    expect(toast.props.title).toBe("Couldn't close the deployment");
  });

  it("keeps the bids error title for a non-close flow error", () => {
    const { enqueueSnackbar } = setup({ initialSdl: undefined, flowError: { message: "No providers", kind: "no-providers" } });

    const toast = enqueueSnackbar.mock.calls[0][0] as { props: { title: string } };
    expect(toast.props.title).toBe("Couldn't get bids from providers");
  });

  it("toasts a flow error that arrives once the form is already shown", () => {
    const { flow, rerenderWith, enqueueSnackbar } = setup({ initialSdl: undefined });
    expect(enqueueSnackbar).not.toHaveBeenCalled();

    flow.error = { message: "boom", kind: "create" };
    rerenderWith({});

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("toasts a flow error only once however often the form renders again", () => {
    const { rerenderWith, enqueueSnackbar } = setup({ initialSdl: undefined, flowError: { message: "boom", kind: "create" } });

    rerenderWith({});
    rerenderWith({});

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("drops the older layout back to editing and says why once no provider bid in time", () => {
    const { enqueueSnackbar, flow } = setup({ initialSdl: undefined, phase: "quoting", noBidsReceived: true });

    expect(flow.actions.cancelAndEdit).toHaveBeenCalledTimes(1);
    const toast = enqueueSnackbar.mock.calls[0][0] as { props: { title: string; subTitle: string } };
    expect(toast.props).toMatchObject({
      title: "Couldn't get bids from providers",
      subTitle: "No providers are available for this deployment right now. Try adjusting your deployment and requesting new bids."
    });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
  });

  it("keeps the two panel workspace on the bid page once no provider bid in time, since its marketplace explains it", () => {
    const { enqueueSnackbar, flow } = setup({ initialSdl: undefined, twoPanel: true, phase: "quoting", noBidsReceived: true });

    expect(flow.actions.cancelAndEdit).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("leaves the older layout alone while bids may still come", () => {
    const { enqueueSnackbar, flow } = setup({ initialSdl: undefined, phase: "quoting" });

    expect(flow.actions.cancelAndEdit).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("keeps a create refused for funds on the page with how far the balance falls short, rather than in a passing toast", () => {
    const { enqueueSnackbar, analyticsService } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 } }
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Add credits to deploy");
    expect(screen.getByRole("alert")).toHaveTextContent("Starting this deployment takes $0.50 and your balance has $0.12, so you're $0.38 short.");
    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledWith("configure_needs_funds_shown", {
      category: "deployments",
      variant: "not_enough_balance",
      requiredAmountUsd: 0.5,
      availableAmountUsd: 0.12
    });
  });

  it("explains the refusal with the api's reason when it reports no amounts, so a trial gpu refusal reads correctly too", () => {
    const message = "GPU interconnect not available on free trial: Add funds to unlock GPU interconnect";
    const { analyticsService } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message, kind: "needs-funds" },
      isTrialing: true,
      deployBalanceUsd: 20,
      minimumDepositUsd: 0.5
    });

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(analyticsService.track).toHaveBeenCalledWith("configure_needs_funds_shown", { category: "deployments", variant: "not_enough_balance" });
  });

  it("tells a trial whose free credit is used up to add credits, rather than how far it falls short", () => {
    const { analyticsService } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0 } },
      isTrialing: true,
      minimumDepositUsd: 0.5
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Your free trial credit is used up");
    expect(analyticsService.track).toHaveBeenCalledWith("configure_needs_funds_shown", {
      category: "deployments",
      variant: "trial_credit_used_up",
      requiredAmountUsd: 0.5,
      availableAmountUsd: 0
    });
  });

  it("tells a trial a few cents short that no configuration fits its remaining credit", () => {
    const { analyticsService } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.43 } },
      isTrialing: true,
      minimumDepositUsd: 0.5
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You have $0.43 of free trial credit left, and every deployment needs at least $0.50 up front, so changing the configuration won't help."
    );
    expect(analyticsService.track).toHaveBeenCalledWith("configure_needs_funds_shown", expect.objectContaining({ variant: "trial_credit_below_minimum" }));
  });

  it("reads the trial's remaining credit from the wallet when the refusal reports no amounts", () => {
    const { analyticsService } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds" },
      isTrialing: true,
      deployBalanceUsd: 0,
      minimumDepositUsd: 0.5
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Your free trial credit is used up");
    expect(analyticsService.track).toHaveBeenCalledWith("configure_needs_funds_shown", { category: "deployments", variant: "trial_credit_used_up" });
  });

  it("prefers the amounts the refusal reports over the wallet balance", () => {
    setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.43 } },
      isTrialing: true,
      deployBalanceUsd: 0,
      minimumDepositUsd: 0.5
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Your free trial credit is below the deployment minimum");
  });

  it("rewords the refusal once the deployment minimum loads, without counting it as shown twice", async () => {
    const { analyticsService, rerenderWith } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.43 } },
      isTrialing: true
    });

    rerenderWith({ minimumDepositUsd: 0.5 });
    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Your free trial credit is below the deployment minimum");
    expect(analyticsService.track.mock.calls.filter(([event]) => event === "configure_needs_funds_shown")).toEqual([
      ["configure_needs_funds_shown", { category: "deployments", variant: "not_enough_balance", requiredAmountUsd: 0.5, availableAmountUsd: 0.43 }]
    ]);
    expect(analyticsService.track).toHaveBeenCalledWith(
      "configure_needs_funds_add_credits_clicked",
      expect.objectContaining({ variant: "trial_credit_below_minimum" })
    );
  });

  it("keeps the refusal on the page in the two panel layout too", () => {
    setup({ initialSdl: undefined, twoPanel: true, phase: "error", flowError: { message: "Not enough balance", kind: "needs-funds" } });

    expect(screen.getByRole("button", { name: "Add credits" })).toBeInTheDocument();
  });

  it("shows no refusal while the create has not been refused for funds", () => {
    setup({ initialSdl: undefined, phase: "error", flowError: { message: "Invalid SDL", kind: "create" } });

    expect(screen.queryByRole("button", { name: "Add credits" })).not.toBeInTheDocument();
  });

  it("opens Add credits from the refusal, set to carry on with this deployment", async () => {
    const { openAddCredits, analyticsService } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 } }
    });

    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));

    expect(openAddCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        initialTab: "purchase",
        context: "configure_quotes_needs_funds",
        nextStepLabel: "Continue to deploy",
        suggestFirstDeployment: false
      })
    );
    expect(analyticsService.track).toHaveBeenCalledWith("configure_needs_funds_add_credits_clicked", {
      category: "billing",
      context: "configure_quotes_needs_funds",
      variant: "not_enough_balance",
      requiredAmountUsd: 0.5,
      availableAmountUsd: 0.12
    });
  });

  it("offers no retry while the balance still can't cover the refused deploy", () => {
    setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 } },
      deployBalanceUsd: 0.12
    });

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("sends the refused request again when the user tries again once the balance covers it", async () => {
    const { flow, analyticsService } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0 } },
      isTrialing: true,
      deployBalanceUsd: 20
    });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(flow.actions.requestQuotesAgain).toHaveBeenCalledTimes(1);
    expect(analyticsService.track).toHaveBeenCalledWith("configure_needs_funds_retry_clicked", { category: "deployments", variant: "trial_credit_used_up" });
  });

  it("takes the refusal down once the user edits the deployment", async () => {
    setup({ initialSdl: undefined, phase: "error", flowError: { message: "Not enough balance", kind: "needs-funds" }, Panes: SdlProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    expect(screen.queryByRole("button", { name: "Add credits" })).not.toBeInTheDocument();
  });

  it("takes the refusal down once the user renames the deployment", () => {
    const { naming, rerenderWith } = setup({
      initialSdl: undefined,
      initialName: "my-app",
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds" }
    });
    naming.typedName = "my-other-app";
    rerenderWith({});

    expect(screen.queryByRole("button", { name: "Add credits" })).not.toBeInTheDocument();
  });

  it("takes the refusal down once the request is sent again", () => {
    const { flow, rerenderWith } = setup({ initialSdl: undefined, phase: "error", flowError: { message: "Not enough balance", kind: "needs-funds" } });
    flow.phase = "creating";
    flow.error = undefined;
    rerenderWith({});

    expect(screen.queryByRole("button", { name: "Add credits" })).not.toBeInTheDocument();
  });

  it("shows the refusal again when the request is refused again", () => {
    const { flow, rerenderWith, analyticsService } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds" }
    });
    flow.error = { message: "Still not enough balance", kind: "needs-funds" };
    rerenderWith({});

    expect(screen.getByRole("alert")).toHaveTextContent("Still not enough balance");
    expect(analyticsService.track.mock.calls.filter(([event]) => event === "configure_needs_funds_shown")).toHaveLength(2);
  });

  it("asks the user to wait rather than add funds when a top up is already on its way", () => {
    const message = "Not enough balance to cover the deployment deposit. A top up from your saved payment method is on the way, so try again in a moment.";
    const { enqueueSnackbar } = setup({ initialSdl: undefined, flowError: { message, kind: "top-up-pending" } });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "warning" }));
    const toast = enqueueSnackbar.mock.calls[0][0] as { props: { title: string; subTitle: unknown } };
    expect(toast.props.title).toBe("Your balance is being topped up");
    expect(toast.props.subTitle).toBe("A top up from your saved payment method is on the way. Try again in a moment.");
  });

  it("explains a create refused by the project's budget and dismisses the toast once the project is opened", () => {
    const { enqueueSnackbar, closeSnackbar } = setup({
      initialSdl: undefined,
      flowError: { message: "over budget", kind: "budget-exceeded", projectId: "storefront" }
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "warning", autoHideDuration: 10000 });
    const toast = enqueueSnackbar.mock.calls[0][0] as { props: { title: string; subTitle: { props: { projectId?: string; onNavigate: () => void } } } };
    expect(toast.props.title).toBe("Project budget reached");
    expect(toast.props.subTitle.props.projectId).toBe("storefront");

    toast.props.subTitle.props.onNavigate();
    expect(closeSnackbar).toHaveBeenCalled();
  });

  it.each([
    ["owner", true],
    ["member", false]
  ] as const)(
    "hands the budget refusal toast the caller's %s role and projects flag, since the toast cannot read the organization itself",
    (organizationRole, projectsEnabled) => {
      const { enqueueSnackbar } = setup({
        initialSdl: undefined,
        organizationRole,
        projectsEnabled,
        flowError: { message: "over budget", kind: "budget-exceeded", projectId: "storefront" }
      });

      const toast = enqueueSnackbar.mock.calls[0][0] as { props: { subTitle: { props: Record<string, unknown> } } };
      expect(toast.props.subTitle.props).toMatchObject({ projectId: "storefront", organizationRole, projectsEnabled });
    }
  );

  it("sends the refused request again once credits land, so the user goes on to quotes without another click", async () => {
    const { flow, analyticsService, openAddCredits } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds" }
    });
    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));

    act(() => creditsAddedCallbackOf(openAddCredits)());

    expect(flow.actions.requestQuotesAgain).toHaveBeenCalledTimes(1);
    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_resumed_deploy", { category: "billing", context: "configure_quotes_needs_funds" });
  });

  it("leaves a request the user already sent again alone when credits land", async () => {
    const { flow, analyticsService, rerenderWith, openAddCredits } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds" }
    });
    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));
    flow.phase = "creating";
    rerenderWith({});

    act(() => creditsAddedCallbackOf(openAddCredits)());

    expect(flow.actions.requestQuotesAgain).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_resumed_deploy", expect.anything());
  });

  it("leaves the refused request alone when credits land after the user edited the form, so a stale spec is never sent", async () => {
    const { flow, openAddCredits } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds" },
      Panes: SdlProbePanes
    });
    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));

    await userEvent.click(screen.getByRole("button", { name: "change image" }));
    act(() => creditsAddedCallbackOf(openAddCredits)());

    expect(flow.actions.requestQuotesAgain).not.toHaveBeenCalled();
  });

  it("leaves the refused request alone when credits land after the user retyped a secret, which the SDL only references", async () => {
    const { flow, rerenderWith, openAddCredits } = setup({ initialSdl: undefined, Panes: SecretRetypingProbePanes });
    await userEvent.click(screen.getByRole("button", { name: "type a secret" }));
    flow.phase = "error";
    flow.error = { message: "Not enough balance", kind: "needs-funds" };
    rerenderWith({});
    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));

    await userEvent.click(screen.getByRole("button", { name: "retype the secret" }));
    act(() => creditsAddedCallbackOf(openAddCredits)());

    expect(flow.actions.requestQuotesAgain).not.toHaveBeenCalled();
  });

  it("leaves a different failure alone when credits land", async () => {
    const { flow, rerenderWith, openAddCredits } = setup({
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds" }
    });
    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));
    flow.error = { message: "Invalid SDL", kind: "create" };
    rerenderWith({});

    act(() => creditsAddedCallbackOf(openAddCredits)());

    expect(flow.actions.requestQuotesAgain).not.toHaveBeenCalled();
  });

  describe("when a trial is refused for credit below the deployment minimum", () => {
    const TRIAL_BELOW_MINIMUM = {
      initialSdl: undefined,
      phase: "error",
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.43 } },
      isTrialing: true,
      deployBalanceUsd: 0.43,
      minimumDepositUsd: 0.5,
      Workspace: TemplateProbeWorkspace,
      Header: TemplateProbeHeader
    } satisfies Parameters<typeof setup>[0];

    it.each([
      { layout: "two panel", twoPanel: true },
      { layout: "three pane", twoPanel: false }
    ])("holds the next request back and opens Add credits instead ($layout layout)", async ({ twoPanel }) => {
      const { openAddCredits, analyticsService, flow, requestQuotes } = setup({ ...TRIAL_BELOW_MINIMUM, twoPanel });

      expect(screen.getByTestId("blocked-reason")).toHaveTextContent("Add credits to deploy");

      await userEvent.click(screen.getByRole("button", { name: "request bids" }));

      expect(openAddCredits).toHaveBeenCalledTimes(1);
      expect(openAddCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          initialTab: "purchase",
          context: "configure_quotes_needs_funds",
          nextStepLabel: "Continue to deploy",
          suggestFirstDeployment: false
        })
      );
      expect(analyticsService.track).toHaveBeenCalledWith("configure_choose_provider_blocked", {
        category: "deployments",
        reasons: ["trial_credit_below_minimum"]
      });
      expect(analyticsService.track).not.toHaveBeenCalledWith("configure_needs_funds_add_credits_clicked", expect.anything());
      expect(requestQuotes).not.toHaveBeenCalled();
      expect(flow.actions.requestQuotesAgain).not.toHaveBeenCalled();
    });

    it("holds the next request back for a trial whose credit is used up", async () => {
      const { analyticsService } = setup({
        ...TRIAL_BELOW_MINIMUM,
        flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0 } },
        deployBalanceUsd: 0
      });

      await userEvent.click(screen.getByRole("button", { name: "request bids" }));

      expect(screen.getByTestId("blocked-reason")).toHaveTextContent("Add credits to deploy");
      expect(analyticsService.track).toHaveBeenCalledWith("configure_choose_provider_blocked", { category: "deployments", reasons: ["trial_credit_used_up"] });
    });

    it("sends the held request once credits land, so the user goes on to quotes without another click", async () => {
      const { flow, openAddCredits } = setup(TRIAL_BELOW_MINIMUM);
      await userEvent.click(screen.getByRole("button", { name: "request bids" }));

      act(() => creditsAddedCallbackOf(openAddCredits)());

      expect(flow.actions.requestQuotesAgain).toHaveBeenCalledTimes(1);
    });

    it("keeps the credit left and the minimum on the page after the user edits the deployment", async () => {
      setup({ ...TRIAL_BELOW_MINIMUM, Panes: SdlProbePanes });

      await userEvent.click(screen.getByRole("button", { name: "change image" }));

      expect(screen.getByRole("alert")).toHaveTextContent("You have $0.43 of free trial credit left, and every deployment needs at least $0.50 up front");
      expect(screen.getByTestId("blocked-reason")).toHaveTextContent("Add credits to deploy");
    });

    it("keeps the credit left and the minimum on the page after the user renames the deployment", () => {
      const { naming, rerenderWith } = setup({ ...TRIAL_BELOW_MINIMUM, initialName: "my-app" });
      naming.typedName = "my-other-app";
      rerenderWith({});

      expect(screen.getByRole("alert")).toHaveTextContent("Your free trial credit is below the deployment minimum");
      expect(screen.getByTestId("blocked-reason")).toHaveTextContent("Add credits to deploy");
    });

    it("lets the next request through once the balance covers the refused deploy, without a reload", () => {
      const { rerenderWith } = setup(TRIAL_BELOW_MINIMUM);

      rerenderWith({ deployBalanceUsd: 20.43 });

      expect(screen.getByTestId("blocked-reason")).toBeEmptyDOMElement();
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("takes the refusal down once the balance covers a deployment the user edited while held", async () => {
      const { rerenderWith } = setup({ ...TRIAL_BELOW_MINIMUM, Panes: SdlProbePanes });
      await userEvent.click(screen.getByRole("button", { name: "change image" }));

      rerenderWith({ deployBalanceUsd: 20.43 });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByTestId("blocked-reason")).toBeEmptyDOMElement();
    });

    it("lets the next request through once the trial ends, when the refusal reported no amounts", () => {
      const { rerenderWith } = setup({ ...TRIAL_BELOW_MINIMUM, flowError: { message: "Not enough balance", kind: "needs-funds" } });
      expect(screen.getByTestId("blocked-reason")).toHaveTextContent("Add credits to deploy");

      rerenderWith({ isTrialing: false });

      expect(screen.getByTestId("blocked-reason")).toBeEmptyDOMElement();
    });

    it("lets the next request through once the request is sent again", () => {
      const { flow, rerenderWith } = setup(TRIAL_BELOW_MINIMUM);
      flow.phase = "creating";
      flow.error = undefined;
      rerenderWith({});

      expect(screen.getByTestId("blocked-reason")).toBeEmptyDOMElement();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("asks for the empty required variables first", async () => {
      const { openAddCredits, analyticsService } = setup({
        ...TRIAL_BELOW_MINIMUM,
        initialSdl: TEMPLATE_SDL,
        templateSource: templateSourceOf(),
        Panes: TemplateProbePanes
      });

      await userEvent.click(screen.getByRole("button", { name: "request bids" }));

      expect(screen.getByTestId("blocked-reason")).toHaveTextContent("2 required fields are empty");
      expect(screen.getByText("Enter a value for Admin email to continue.")).toBeInTheDocument();
      expect(openAddCredits).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalledWith("configure_choose_provider_blocked", expect.anything());
    });
  });

  it.each([
    {
      account: "a paid account short of the deposit",
      isTrialing: false,
      deployBalanceUsd: 0.12,
      flowError: { message: "Not enough balance", kind: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 } }
    },
    {
      account: "a trial refused for something other than its credit",
      isTrialing: true,
      deployBalanceUsd: 20,
      flowError: { message: "GPU interconnect not available on free trial: Add funds to unlock GPU interconnect", kind: "needs-funds" }
    },
    {
      account: "a trial below the minimum whose request failed for another reason",
      isTrialing: true,
      deployBalanceUsd: 0.12,
      flowError: { message: "Invalid SDL", kind: "create" }
    }
  ] as const)("leaves the next request open to $account", ({ isTrialing, deployBalanceUsd, flowError }) => {
    setup({
      initialSdl: undefined,
      phase: "error",
      flowError,
      isTrialing,
      deployBalanceUsd,
      minimumDepositUsd: 0.5,
      Header: TemplateProbeHeader
    });

    expect(screen.getByTestId("blocked-reason")).toBeEmptyDOMElement();
  });

  it("closes the review modal when it is dismissed via Back", async () => {
    setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));
    await userEvent.click(screen.getByRole("button", { name: "back to marketplace" }));

    expect(screen.queryByRole("button", { name: "back to marketplace" })).not.toBeInTheDocument();
  });

  it("records a newly picked provider for its placement", async () => {
    const { flow } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes });
    const placementId = screen.getByTestId("focused-placement").textContent;

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));

    expect(flow.actions.selectProvider).toHaveBeenCalledWith(placementId, "bid-1");
  });

  it("reopens a dismissed review without picking again when the selected provider is picked again", async () => {
    const { flow } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes });
    flow.selections = { [screen.getByTestId("focused-placement").textContent ?? ""]: "bid-1" };

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));
    await userEvent.click(screen.getByRole("button", { name: "back to marketplace" }));
    await userEvent.click(screen.getByRole("button", { name: "select provider" }));

    expect(screen.getByRole("button", { name: "back to marketplace" })).toBeInTheDocument();
    expect(flow.actions.selectProvider).not.toHaveBeenCalled();
  });

  describe("when the onboarding autopilot hands its recommended bids over", () => {
    const RECOMMENDED_BID_ID = "akash1provider/999/1/1";
    const OTHER_PLACEMENT_BID_ID = "akash1other/999/2/1";

    it("starts with the bid recommended for each placement selected", () => {
      const { flow } = setup({
        initialSdl: VALID_SDL,
        phase: "quoting",
        recommendedBidIds: [OTHER_PLACEMENT_BID_ID, RECOMMENDED_BID_ID],
        Panes: ProviderSelectProbePanes
      });

      expect(flow.actions.selectProvider).toHaveBeenCalledTimes(1);
      expect(flow.actions.selectProvider).toHaveBeenCalledWith(screen.getByTestId("focused-placement").textContent, RECOMMENDED_BID_ID);
    });

    it("leaves a placement no recommended bid is for without a selection", () => {
      const { flow } = setup({ initialSdl: VALID_SDL, phase: "quoting", recommendedBidIds: [OTHER_PLACEMENT_BID_ID] });

      expect(flow.actions.selectProvider).not.toHaveBeenCalled();
    });

    it("selects the recommendation once, leaving every later pick to the user", () => {
      const { flow, rerenderWith } = setup({ initialSdl: VALID_SDL, phase: "quoting", recommendedBidIds: [RECOMMENDED_BID_ID] });

      flow.recommendedBidIds = ["akash1another/999/1/1"];
      rerenderWith({});

      expect(flow.actions.selectProvider).toHaveBeenCalledTimes(1);
      expect(flow.actions.selectProvider).toHaveBeenCalledWith(expect.any(String), RECOMMENDED_BID_ID);
    });

    it("selects a recommendation handed over after the form opened", () => {
      const { flow, rerenderWith } = setup({ initialSdl: VALID_SDL, phase: "quoting" });

      flow.recommendedBidIds = [RECOMMENDED_BID_ID];
      rerenderWith({});

      expect(flow.actions.selectProvider).toHaveBeenCalledWith(expect.any(String), RECOMMENDED_BID_ID);
    });
  });

  it("tracks the review modal opening from the header deploy action", () => {
    const { ConfigureDeploymentHeader, analyticsService } = setup({ initialSdl: VALID_SDL });
    const onDeploy = (ConfigureDeploymentHeader as ReturnType<typeof vi.fn>).mock.calls[0][0].onDeploy as () => void;

    act(() => onDeploy());

    expect(analyticsService.track).toHaveBeenCalledWith("review_deploy_opened", expect.objectContaining({ category: "deployments" }));
  });

  it("reports the completed selection count when the modal auto-opens after the last provider is picked", async () => {
    const { analyticsService } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));

    expect(analyticsService.track).toHaveBeenCalledWith("review_deploy_opened", expect.objectContaining({ placementCount: 1, selectionCount: 1 }));
  });

  it("tracks the review confirmation and starts the deploy when Confirm and deploy is clicked", async () => {
    const { flow, analyticsService } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));
    await userEvent.click(screen.getByRole("button", { name: "confirm and deploy" }));

    expect(analyticsService.track).toHaveBeenCalledWith("review_deploy_confirmed", expect.objectContaining({ category: "deployments" }));
    expect(flow.actions.deploy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ secrets: {} }));
  });

  it("hands the typed secret values to the deploy", async () => {
    const { flow, ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));
    await userEvent.click(screen.getByRole("button", { name: "confirm and deploy" }));

    const previewed = lastPanesProps(ConfigureDeploymentPanes).sdl;
    expect(flow.actions.deploy).toHaveBeenCalledWith(previewed, { secrets: {}, unresolvedSecrets: [] });
  });

  it("hands a secret typed in the form to the deploy and leaves only its reference in the sdl", async () => {
    const { flow } = setup({ initialSdl: VALID_SDL, Panes: SecretTypingProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "type a secret" }));
    await userEvent.click(screen.getByRole("button", { name: "select provider" }));
    await userEvent.click(screen.getByRole("button", { name: "confirm and deploy" }));

    expect(flow.actions.deploy).toHaveBeenCalledWith(expect.stringContaining("API_KEY=ac-secret://API_KEY"), {
      secrets: { API_KEY: "hunter2" },
      unresolvedSecrets: []
    });
  });

  it("tracks a dismissal when the review modal is closed via Back", async () => {
    const { analyticsService } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));
    await userEvent.click(screen.getByRole("button", { name: "back to marketplace" }));

    expect(analyticsService.track).toHaveBeenCalledWith("review_deploy_dismissed", expect.objectContaining({ category: "deployments" }));
  });

  it("records a dismissal with the trial, whether the deployment fits the credit, and how long the review was open", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-12T10:00:00.000Z"));
      const { analyticsService } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes, isTrialing: true, reviewFundingState: "trial" });

      await userEvent.click(screen.getByRole("button", { name: "select provider" }));
      vi.setSystemTime(new Date("2026-11-12T10:00:06.600Z"));
      await userEvent.click(screen.getByRole("button", { name: "back to marketplace" }));

      expect(analyticsService.track).toHaveBeenCalledWith(
        "review_deploy_dismissed",
        expect.objectContaining({ isTrialing: true, fundingState: "trial", fitsAvailableCredit: true, secondsOpen: 7 })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("records a dismissal of a review whose deployment the available credit cannot cover", async () => {
    const { analyticsService } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes, reviewFundingState: "not-enough-available" });

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));
    await userEvent.click(screen.getByRole("button", { name: "back to marketplace" }));

    expect(analyticsService.track).toHaveBeenCalledWith(
      "review_deploy_dismissed",
      expect.objectContaining({ isTrialing: false, fundingState: "not-enough-available", fitsAvailableCredit: false })
    );
  });

  it("records an unknown fit when the review is dismissed before its funding impact is known", async () => {
    const { analyticsService } = setup({ initialSdl: VALID_SDL, Panes: ProviderSelectProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "select provider" }));
    await userEvent.click(screen.getByRole("button", { name: "back to marketplace" }));

    expect(analyticsService.track).toHaveBeenCalledWith("review_deploy_dismissed", expect.objectContaining({ fundingState: null, fitsAvailableCredit: null }));
  });

  it("seeds an ssh-ready vm service on a vm entry with no carried-in SDL", () => {
    setup({ initialSdl: undefined, vm: true, Panes: VmStateProbePanes });

    expect(screen.getByTestId("image").textContent).toBe("ghcr.io/akash-network/ubuntu-2404-ssh:2");
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("has-ssh-key").textContent).toBe("true");
    expect(JSON.parse(screen.getByTestId("expose").textContent ?? "[]")).toEqual([{ port: 22, as: 22, proto: "tcp", global: true }]);
  });

  it("previews the vm seed's real image and ssh port in the generated SDL", () => {
    setup({ initialSdl: undefined, vm: true, Panes: VmStateProbePanes });

    const sdl = screen.getByTestId("sdl").textContent ?? "";
    expect(sdl).toContain("ghcr.io/akash-network/ubuntu-2404-ssh:2");
    expect(sdl).toContain("port: 22");
  });

  it("keeps the vm seed's ssh key empty so the schema demands one before quotes", () => {
    setup({ initialSdl: undefined, vm: true, Panes: VmStateProbePanes });

    expect(screen.getByTestId("ssh-pub-key").textContent).toBe("");
  });

  it("seeds the example image on its own port behind port 80 on an example image entry with no carried-in SDL", () => {
    setup({ initialSdl: undefined, exampleImage: true, Panes: VmStateProbePanes });

    expect(screen.getByTestId("image").textContent).toBe(HELLO_WORLD_IMAGE);
    expect(JSON.parse(screen.getByTestId("expose").textContent ?? "[]")).toEqual([{ port: 3000, as: 80, proto: "http", global: true }]);
    expect(screen.getByTestId("has-ssh-key").textContent).toBe("false");
  });

  it("keeps the example image seed on the small hardware preset", () => {
    setup({ initialSdl: undefined, exampleImage: true, Panes: VmStateProbePanes });

    const sdl = screen.getByTestId("sdl").textContent ?? "";
    expect(sdl).toContain(HELLO_WORLD_IMAGE);
    expect(sdl).toContain("2Gi");
    expect(sdl).toContain("10Gi");
  });

  it("leaves the image blank on an entry without the example image", () => {
    setup({ initialSdl: undefined, Panes: VmStateProbePanes });

    expect(screen.getByTestId("image").textContent).toBe("");
  });

  it("restores the expose-ssh flag for a carried-in deployment holding a vm service", () => {
    setup({ initialSdl: VM_SDL_WITHOUT_KEY, Panes: VmStateProbePanes });

    expect(screen.getByTestId("image").textContent).toBe("ghcr.io/akash-network/ubuntu-2404-ssh:2");
    expect(screen.getByTestId("has-ssh-key").textContent).toBe("true");
  });

  it("does not turn on the expose-ssh flag for a carried-in deployment without vm services", () => {
    setup({ initialSdl: VALID_SDL, Panes: VmStateProbePanes });

    expect(screen.getByTestId("has-ssh-key").textContent).toBe("false");
  });

  it("tracks the configure page view on mount", () => {
    const { analyticsService } = setup({ initialSdl: undefined });

    expect(analyticsService.track).toHaveBeenCalledWith("configure_page_viewed", { category: "deployments", layout: "three_pane" });
  });

  describe("with a template version", () => {
    it.each([
      { layout: "two panel", twoPanel: true },
      { layout: "three pane", twoPanel: false }
    ])("blocks requesting bids until required variables are filled, with inline errors ($layout layout)", async ({ twoPanel }) => {
      setup({
        initialSdl: TEMPLATE_SDL,
        templateSource: templateSourceOf(),
        twoPanel,
        Workspace: TemplateProbeWorkspace,
        Panes: TemplateProbePanes,
        Header: TemplateProbeHeader
      });

      expect(screen.getByTestId("blocked-reason")).toHaveTextContent("2 required fields are empty");
      expect(screen.getByRole("textbox", { name: "Admin email" })).not.toBeInvalid();

      await userEvent.click(screen.getByRole("button", { name: "request bids" }));

      expect(screen.getByRole("textbox", { name: "Admin email" })).toBeInvalid();
      expect(screen.getByText("Enter a value for Admin email to continue.")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Admin email" })).toHaveFocus();

      await userEvent.type(screen.getByLabelText("Hugging Face token"), "hf_secret");
      await userEvent.type(screen.getByRole("textbox", { name: "Admin email" }), "admin@northwind.dev");

      expect(screen.getByTestId("blocked-reason")).toBeEmptyDOMElement();
      expect(screen.queryByText("Enter a value for Admin email to continue.")).not.toBeInTheDocument();
    });

    it("seals a secret variable like any deployment secret", async () => {
      const { flow } = setup({ initialSdl: TEMPLATE_SDL, templateSource: templateSourceOf(), Panes: TemplateProbePanes });

      await userEvent.type(screen.getByLabelText("Hugging Face token"), "hf_secret");
      await userEvent.type(screen.getByRole("textbox", { name: "Admin email" }), "admin@northwind.dev");
      await userEvent.click(screen.getByRole("button", { name: "select provider" }));
      await userEvent.click(screen.getByRole("button", { name: "confirm and deploy" }));

      const [sdl, options] = (flow.actions.deploy as Mock).mock.calls[0];
      expect(sdl).toContain("HF_TOKEN=ac-secret://HF_TOKEN");
      expect(sdl).toContain("ADMIN_EMAIL=admin@northwind.dev");
      expect(sdl).not.toContain("hf_secret");
      expect(options).toEqual({ secrets: { HF_TOKEN: "hf_secret" }, unresolvedSecrets: [] });
    });

    it("blocks deploying once a required variable is cleared after bids were requested, with inline errors", async () => {
      const { ReviewAndDeployModal, flow } = setup({
        initialSdl: FILLED_TEMPLATE_SDL,
        templateSource: templateSourceOf(),
        Panes: TemplateProbePanes,
        Header: TemplateProbeHeader,
        phase: "quoting",
        dseq: "42"
      });
      expect(screen.getByTestId("blocked-reason")).toBeEmptyDOMElement();

      await userEvent.clear(screen.getByRole("textbox", { name: "Admin email" }));
      await userEvent.click(screen.getByRole("button", { name: "open review" }));
      await userEvent.click(screen.getByRole("button", { name: "select provider" }));

      expect(screen.getByTestId("blocked-reason")).toHaveTextContent("1 required field is empty");
      expect(ReviewAndDeployModal).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());
      expect(screen.getByText("Enter a value for Admin email to continue.")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Admin email" })).toHaveFocus();
      expect(flow.actions.deploy).not.toHaveBeenCalled();
    });

    it.each(["confirm and deploy", "retry"])("blocks a deploy sent from the review with %s once a required variable is cleared", async action => {
      const { flow } = setup({ initialSdl: FILLED_TEMPLATE_SDL, templateSource: templateSourceOf(), Panes: TemplateProbePanes, phase: "quoting", dseq: "42" });
      await userEvent.click(screen.getByRole("button", { name: "select provider" }));

      await userEvent.clear(screen.getByRole("textbox", { name: "Admin email" }));
      await userEvent.click(screen.getByRole("button", { name: action }));

      expect(flow.actions.deploy).not.toHaveBeenCalled();
      expect(screen.getByText("Enter a value for Admin email to continue.")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Admin email" })).toHaveFocus();
    });

    it("deploys a resumed deployment whose secret its create already sealed", async () => {
      const { flow } = setup({ initialSdl: FILLED_TEMPLATE_SDL, templateSource: templateSourceOf(), Panes: TemplateProbePanes, phase: "quoting", dseq: "42" });

      await userEvent.click(screen.getByRole("button", { name: "select provider" }));
      await userEvent.click(screen.getByRole("button", { name: "confirm and deploy" }));

      const [sdl, options] = (flow.actions.deploy as Mock).mock.calls[0];
      expect(sdl).toContain("HF_TOKEN=ac-secret://HF_TOKEN");
      expect(options).toEqual({
        secrets: {},
        unresolvedSecrets: [{ serviceTitle: "web", label: "HF_TOKEN", name: "HF_TOKEN", isKeptReference: true }]
      });
      expect(screen.getByLabelText("Hugging Face token")).toHaveAttribute("placeholder", "Sealed with this deployment");
    });

    it("asks for a secret the template only references before the deployment exists", () => {
      const { ConfigureDeploymentHeader } = setup({ initialSdl: FILLED_TEMPLATE_SDL, templateSource: templateSourceOf() });

      expect(ConfigureDeploymentHeader).toHaveBeenLastCalledWith(expect.objectContaining({ blockedReason: "1 required field is empty" }), expect.anything());
    });

    it("deploys an untouched yes/no without a default as No", async () => {
      const signUps: TemplateAskedValue = {
        key: "ENABLE_SIGNUP",
        label: "Allow sign-ups",
        type: "boolean",
        required: true,
        bindings: [{ service: "web", env: "ENABLE_SIGNUP" }]
      };
      const { flow, ConfigureDeploymentPanes } = setup({
        initialSdl: FILLED_TEMPLATE_SDL.replace("      - ADMIN_EMAIL=", "      - ENABLE_SIGNUP=\n      - ADMIN_EMAIL="),
        templateSource: templateSourceOf([...TEMPLATE_ASKED_VALUES, signUps]),
        Panes: TemplateProbePanes,
        phase: "quoting",
        dseq: "42"
      });

      await userEvent.click(screen.getByRole("button", { name: "select provider" }));
      await userEvent.click(screen.getByRole("button", { name: "confirm and deploy" }));

      expect(lastPanesProps(ConfigureDeploymentPanes).sdl).toContain("ENABLE_SIGNUP=false");
      expect((flow.actions.deploy as Mock).mock.calls[0][0]).toContain("ENABLE_SIGNUP=false");
    });

    it("starts over with an untouched yes/no as No when the configuration is reset", async () => {
      const signUps: TemplateAskedValue = {
        key: "ENABLE_SIGNUP",
        label: "Allow sign-ups",
        type: "boolean",
        required: true,
        bindings: [{ service: "web", env: "ENABLE_SIGNUP" }]
      };
      setup({
        initialSdl: FILLED_TEMPLATE_SDL.replace("      - ADMIN_EMAIL=", "      - ENABLE_SIGNUP=\n      - ADMIN_EMAIL="),
        templateSource: templateSourceOf([...TEMPLATE_ASKED_VALUES, signUps]),
        twoPanel: true,
        Workspace: ResetProbeWorkspace
      });

      await userEvent.click(screen.getByRole("button", { name: "reset" }));

      expect(screen.getByTestId("sdl")).toHaveTextContent("ENABLE_SIGNUP=false");
    });

    it("leaves an sdl without an unset yes/no as it was", () => {
      const { ConfigureDeploymentPanes } = setup({ initialSdl: FILLED_TEMPLATE_SDL, templateSource: templateSourceOf() });

      expect(lastPanesProps(ConfigureDeploymentPanes).sdl).toBe(sealedSdlOf(FILLED_TEMPLATE_SDL));
    });

    it("shows the filled values in the live sdl", async () => {
      const { ConfigureDeploymentPanes } = setup({ initialSdl: TEMPLATE_SDL, templateSource: templateSourceOf(), Panes: TemplateProbePanes });

      await userEvent.type(screen.getByRole("textbox", { name: "Admin email" }), "admin@northwind.dev");

      expect(lastPanesProps(ConfigureDeploymentPanes).sdl).toContain("ADMIN_EMAIL=admin@northwind.dev");
    });

    it.each(["creating", "deploying"] as const)("locks the variables while the deployment is %s", phase => {
      setup({ initialSdl: TEMPLATE_SDL, templateSource: templateSourceOf(), Panes: TemplateProbePanes, phase });

      expect(screen.getByRole("textbox", { name: "Admin email" })).toBeDisabled();
    });

    it("keeps the variables editable while bids come in", () => {
      setup({ initialSdl: TEMPLATE_SDL, templateSource: templateSourceOf(), Panes: TemplateProbePanes, phase: "quoting" });

      expect(screen.getByRole("textbox", { name: "Admin email" })).toBeEnabled();
    });

    it("blocks nothing once a template asks for nothing", () => {
      const { ConfigureDeploymentHeader } = setup({ initialSdl: VALID_SDL, templateSource: templateSourceOf([]) });

      expect(ConfigureDeploymentHeader).toHaveBeenLastCalledWith(expect.objectContaining({ blockedReason: undefined }), expect.anything());
    });

    it("adds no variables and blocks nothing without a template", () => {
      const threePane = setup({ initialSdl: TEMPLATE_SDL });

      expect(threePane.ConfigureDeploymentHeader).toHaveBeenLastCalledWith(expect.objectContaining({ blockedReason: undefined }), expect.anything());
      expect(threePane.ConfigureDeploymentPanes).toHaveBeenLastCalledWith(expect.objectContaining({ configurationHeader: undefined }), expect.anything());
      threePane.unmount();

      const twoPanel = setup({ initialSdl: TEMPLATE_SDL, twoPanel: true });

      expect(twoPanel.ConfigureWorkspace).toHaveBeenLastCalledWith(
        expect.objectContaining({ editorHeader: undefined, blockedReason: undefined }),
        expect.anything()
      );
    });
  });

  describe("with the two panel layout", () => {
    it("renders the two panel workspace instead of the three panes", () => {
      const { ConfigureWorkspace, ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL, twoPanel: true });

      expect(ConfigureWorkspace).toHaveBeenCalled();
      expect(ConfigureDeploymentPanes).not.toHaveBeenCalled();
    });

    it("tracks the page view as the two panel layout", () => {
      const { analyticsService } = setup({ initialSdl: undefined, twoPanel: true });

      expect(analyticsService.track).toHaveBeenCalledWith("configure_page_viewed", { category: "deployments", layout: "two_panel" });
    });

    it("hands the workspace the intent, the live sdl, the active placement and both deployment names", () => {
      const { ConfigureWorkspace } = setup({ initialSdl: VALID_SDL, initialName: "my-app", apiDerivedName: "web", twoPanel: true, draftId: "draft-1" });

      expect(ConfigureWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: undefined, draftId: "draft-1", vm: false },
          sdl: sealedSdlOf(VALID_SDL),
          previewSdl: sealedSdlOf(VALID_SDL),
          selectedServiceId: expect.any(String),
          selectedPlacement: expect.objectContaining({ name: "dcloud" }),
          deploymentName: "web",
          typedDeploymentName: "my-app"
        }),
        expect.anything()
      );
    });

    it("keeps the layout it mounted with when the flag flips mid-session", () => {
      const { ConfigureWorkspace, rerenderWith } = setup({ initialSdl: undefined });

      rerenderWith({ twoPanel: true });

      expect(ConfigureWorkspace).not.toHaveBeenCalled();
    });

    it("turns off log forwarding whose collector sits before a mounted sibling without leaving a ghost service", async () => {
      setup({ initialSdl: undefined, twoPanel: true, Workspace: EditorProbeWorkspace });

      await userEvent.click(within(serviceCard("service-1")).getByRole("switch", { name: "Enable log forwarding" }));
      await userEvent.click(screen.getByRole("button", { name: /Save/ }));
      await userEvent.click(screen.getByRole("button", { name: "Add service" }));
      await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("service-2"));
      expect(within(serviceCard("service-2")).getByRole("switch", { name: "Enable log forwarding" })).toBeInTheDocument();

      await userEvent.click(within(serviceCard("service-1")).getByRole("switch", { name: "Enable log forwarding" }));

      await waitFor(() => expect(screen.getByTestId("sdl").textContent).not.toContain("log-collector"));
      expect(screen.getByTestId("sdl").textContent).toContain("service-2");
      expect(screen.getByTestId("ghost-free").textContent).toBe("true");
    });

    it("removes a service while a sibling card is mounted without leaving a ghost service", async () => {
      setup({ initialSdl: undefined, twoPanel: true, Workspace: EditorProbeWorkspace });
      await userEvent.click(screen.getByRole("button", { name: "Add service" }));
      await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("service-2"));

      await userEvent.click(screen.getByRole("button", { name: "Remove service-1" }));

      await waitFor(() => expect(screen.getByTestId("sdl").textContent).not.toMatch(/service-1\b/));
      expect(screen.getByTestId("ghost-free").textContent).toBe("true");
      expect(serviceCard("service-2")).toBeInTheDocument();
    });

    it("removes a placement without leaving a ghost placement or service", async () => {
      setup({ initialSdl: undefined, twoPanel: true, Workspace: EditorProbeWorkspace });
      await userEvent.click(screen.getByRole("button", { name: "Add placement" }));
      await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("placement-1"));

      await userEvent.click(screen.getByRole("button", { name: "Remove placement-1" }));

      await waitFor(() => {
        const sdl = screen.getByTestId("sdl").textContent ?? "";
        expect(sdl).not.toContain("placement-1");
        expect(sdl).not.toContain("service-2");
      });
      expect(screen.getByTestId("ghost-free").textContent).toBe("true");
    });

    it("discards the pending deployment and its draft when the user leaves", async () => {
      const { flow, clear, analyticsService } = setup({ initialSdl: undefined, twoPanel: true, phase: "quoting", Workspace: DiscardProbeWorkspace });

      await userEvent.click(screen.getByRole("button", { name: "discard" }));

      expect(flow.actions.discard).toHaveBeenCalled();
      expect(clear).toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith("configure_leave_discarded", { category: "deployments", dseq: null });
    });

    it("stops a pending draft save from writing the discarded draft back", async () => {
      const { save } = setup({ initialSdl: undefined, twoPanel: true, Workspace: DiscardProbeWorkspace });

      await userEvent.click(screen.getByRole("button", { name: "change image" }));
      await userEvent.click(screen.getByRole("button", { name: "discard" }));
      await act(() => new Promise(resolve => setTimeout(resolve, 400)));

      expect(save.mock.calls.map(([sdl]) => sdl).filter(sdl => sdl.includes("nginx:latest"))).toEqual([]);
    });

    it("restores the sdl the session started from when the configuration is reset", async () => {
      const { analyticsService } = setup({ initialSdl: TWO_SERVICE_SDL, twoPanel: true, Workspace: ResetProbeWorkspace });
      await userEvent.click(screen.getByRole("button", { name: "rename first service" }));
      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("renamed,api"));

      await userEvent.click(screen.getByRole("button", { name: "reset" }));

      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("web,api"));
      expect(screen.getByTestId("sdl").textContent).not.toContain("renamed");
      expect(analyticsService.track).toHaveBeenCalledWith("configure_reset_confirmed", { category: "deployments" });
    });

    it("starts over from a default deployment when the session started from none", async () => {
      setup({ initialSdl: undefined, twoPanel: true, Workspace: ResetProbeWorkspace });
      await userEvent.click(screen.getByRole("button", { name: "rename first service" }));
      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("renamed"));

      await userEvent.click(screen.getByRole("button", { name: "reset" }));

      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("service-1"));
    });

    it("starts over from the example image when an example image session is reset", async () => {
      setup({ initialSdl: undefined, exampleImage: true, twoPanel: true, Workspace: ResetProbeWorkspace });
      await userEvent.click(screen.getByRole("button", { name: "rename first service" }));
      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("renamed"));

      await userEvent.click(screen.getByRole("button", { name: "reset" }));

      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("service-1"));
      expect(screen.getByTestId("sdl").textContent).toContain(HELLO_WORLD_IMAGE);
    });

    it("restores the sdl a restored draft started from rather than the draft's own edits", async () => {
      setup({ initialSdl: TWO_SERVICE_SDL, persistedSdl: TWO_SERVICE_SDL, persistedStartingSdl: VALID_SDL, twoPanel: true, Workspace: ResetProbeWorkspace });
      expect(screen.getByTestId("service-titles").textContent).toBe("web,api");

      await userEvent.click(screen.getByRole("button", { name: "reset" }));

      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("web"));
    });

    it("starts over from a default deployment when a restored draft recorded no starting sdl", async () => {
      setup({ initialSdl: TWO_SERVICE_SDL, persistedSdl: TWO_SERVICE_SDL, persistedStartingSdl: undefined, twoPanel: true, Workspace: ResetProbeWorkspace });

      await userEvent.click(screen.getByRole("button", { name: "reset" }));

      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("service-1"));
    });

    it("starts over from a default deployment when the starting sdl no longer imports", async () => {
      setup({ initialSdl: VALID_SDL, persistedSdl: VALID_SDL, persistedStartingSdl: "not: [valid", twoPanel: true, Workspace: ResetProbeWorkspace });

      await userEvent.click(screen.getByRole("button", { name: "reset" }));

      await waitFor(() => expect(screen.getByTestId("service-titles").textContent).toBe("service-1"));
    });

    it("drops the regions a restored draft picked when it resets to the sdl it started from", async () => {
      setup({
        initialSdl: VALID_SDL,
        persistedSdl: VALID_SDL,
        persistedStartingSdl: VALID_SDL,
        persistedPlacementRegions: { dcloud: ["eu-west", "na-us-west"] },
        twoPanel: true,
        Workspace: ResetProbeWorkspace
      });
      expect(screen.getByTestId("placement-regions").textContent).toBe("eu-west,na-us-west");

      await userEvent.click(screen.getByRole("button", { name: "reset" }));

      await waitFor(() => expect(screen.getByTestId("placement-regions").textContent).toBe(""));
    });
  });

  it("threads the live sdl, deployment name, and editability into the import/export control", () => {
    const { SdlImportExport } = setup({ initialSdl: VALID_SDL, initialName: "my-app" });

    expect(SdlImportExport).toHaveBeenCalledWith(
      expect.objectContaining({ sdl: sealedSdlOf(VALID_SDL), deploymentName: "my-app", canImport: true }),
      expect.anything()
    );
  });

  it("disables import while the flow is quoting", () => {
    const { SdlImportExport } = setup({ initialSdl: VALID_SDL, phase: "quoting" });

    expect(SdlImportExport).toHaveBeenCalledWith(expect.objectContaining({ canImport: false }), expect.anything());
  });

  it("replaces the whole configuration when an sdl is imported", async () => {
    const { SdlImportExport } = setup({ initialSdl: undefined, Panes: ImportProbePanes });
    const state = importDeploymentState(TWO_SERVICE_SDL);

    await act(async () => {
      (SdlImportExport as ReturnType<typeof vi.fn>).mock.calls[0][0].onImport(state);
    });

    await waitFor(() => {
      expect(screen.getByTestId("service-titles").textContent).toBe("web,api");
      expect(screen.getByTestId("sdl").textContent).toContain("node:18");
      expect(screen.getByTestId("selected").textContent).toBe(state.selectedServiceId);
    });
  });

  it("warns about what deploying from the form changes in a carried-in SDL", () => {
    setup({ initialSdl: TWO_PLACEMENT_SDL });

    const banner = screen.getByRole("region", { name: "Parts of the imported SDL won't deploy as written" });
    expect(within(banner).getByText('Placement "west" and the services it runs (web) are left out.')).toBeInTheDocument();
  });

  it("shows no import warning for an SDL the form deploys as written", () => {
    setup({ initialSdl: VALID_SDL });

    expect(screen.queryByRole("region", { name: "Parts of the imported SDL won't deploy as written" })).not.toBeInTheDocument();
  });

  it("shows no import warning when starting from the default deployment", () => {
    setup({ initialSdl: undefined });

    expect(screen.queryByRole("region", { name: "Parts of the imported SDL won't deploy as written" })).not.toBeInTheDocument();
  });

  it("hides the import warning once it is dismissed", async () => {
    setup({ initialSdl: TWO_PLACEMENT_SDL });

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("region", { name: "Parts of the imported SDL won't deploy as written" })).not.toBeInTheDocument();
  });

  it("warns about what deploying from the form changes in an SDL imported later", async () => {
    const { SdlImportExport } = setup({ initialSdl: undefined });

    await act(async () => {
      (SdlImportExport as ReturnType<typeof vi.fn>).mock.calls[0][0].onImport(importDeploymentState(TWO_PLACEMENT_SDL));
    });

    expect(screen.getByRole("region", { name: "Parts of the imported SDL won't deploy as written" })).toBeInTheDocument();
  });

  it("persists the imported sdl to the draft under the existing deployment name", async () => {
    const { SdlImportExport, save } = setup({ initialSdl: undefined, initialName: "my-app", Panes: ImportProbePanes });
    const state = importDeploymentState(TWO_SERVICE_SDL);

    await act(async () => {
      (SdlImportExport as ReturnType<typeof vi.fn>).mock.calls[0][0].onImport(state);
    });

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.stringContaining("node:18"), "my-app", undefined, undefined, {}));
  });

  it("persists only the name this session typed, never one the api derived for it", async () => {
    const { save } = setup({ initialSdl: undefined, apiDerivedName: "web+postgres", Panes: SdlProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(String), "", undefined, undefined, {}));
  });

  it("shows the name the api derived while asking for quotes under none, so the api can derive it again", () => {
    const { ConfigureDeploymentPanes, ConfigureDeploymentHeader } = setup({ initialSdl: undefined, apiDerivedName: "web+postgres" });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ deploymentName: "web+postgres" }), expect.anything());
    expect(ConfigureDeploymentHeader).toHaveBeenCalledWith(expect.objectContaining({ deploymentName: "" }), expect.anything());
  });

  it("threads a failed background close and its retry into the panes", () => {
    const pendingClose = { dseq: "777", failed: true };
    const { ConfigureDeploymentPanes, flow } = setup({ initialSdl: undefined, pendingClose });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ pendingClose, onRetryClose: flow.actions.retryClose }), expect.anything());
  });

  function lastPanesProps(Panes: ReturnType<typeof vi.fn>) {
    return Panes.mock.calls[Panes.mock.calls.length - 1][0] as ProbePanesProps;
  }

  function setup(input: {
    initialSdl: string | undefined;
    initialName?: string;
    apiDerivedName?: string;
    Panes?: typeof SdlProbePanes;
    draftId?: string;
    persistedRuntimeLimitHours?: number;
    persistedPlacementRegions?: Record<string, string[]>;
    deploySucceeded?: boolean;
    isDeployedInBackground?: boolean;
    showsDeployProgress?: boolean;
    isDeployTakingLong?: boolean;
    flowError?: FlowError;
    noBidsReceived?: boolean;
    vm?: boolean;
    exampleImage?: boolean;
    phase?: DeploymentFlow["phase"];
    pendingClose?: DeploymentFlow["pendingClose"];
    recommendedBidIds?: string[];
    twoPanel?: boolean;
    Workspace?: (props: WorkspaceProbeProps) => ReactNode;
    persistedInheritSecretsFrom?: string;
    persistedSdl?: string;
    persistedStartingSdl?: string;
    organizationRole?: OrganizationRole;
    projectsEnabled?: boolean;
    isTrialing?: boolean;
    deployBalanceUsd?: number;
    minimumDepositUsd?: number;
    reviewFundingState?: FundingImpactState;
    templateSource?: TemplateSource;
    Header?: (props: HeaderProbeProps) => ReactNode;
    dseq?: string;
  }) {
    const ConfigureDeploymentPanes = vi.fn(
      input.Panes ?? (({ configurationActions }: ProbePanesProps) => <div data-testid="panes-mock">{configurationActions}</div>)
    );
    const ConfigureDeploymentHeader = vi.fn(input.Header ?? (() => <div data-testid="header-mock" />));
    const ConfigureWorkspace = vi.fn(input.Workspace ?? (() => <div data-testid="workspace-mock" />));
    const SdlImportExport = vi.fn(() => null);
    const enqueueSnackbar = vi.fn();
    const closeSnackbar = vi.fn();
    const Snackbar = vi.fn(() => null);
    const openAddCredits = vi.fn<ReturnType<typeof DEPENDENCIES.useAddCredits>>();
    const naming = { typedName: input.initialName ?? "" };
    const save = vi.fn<(sdl: string, name?: string, runtimeLimitHours?: number, startingSdl?: string, placementRegions?: Record<string, string[]>) => void>();
    const clear = vi.fn<() => void>();
    const dropInheritance = vi.fn<() => void>();
    const requestQuotes = vi.fn();
    const setDeploymentName = vi.fn();
    const DeployProgressOverlay = vi.fn(() => null);
    const ReviewAndDeployModal = vi.fn(
      (props: {
        open: boolean;
        onBack: (fundingState: FundingImpactState | null) => void;
        onConfirm: () => void;
        onRetryDeploy: () => void;
        onBackToBids: () => void;
      }) =>
        props.open ? (
          <div>
            <button type="button" onClick={() => props.onBack(input.reviewFundingState ?? null)}>
              back to marketplace
            </button>
            <button type="button" onClick={props.onConfirm}>
              confirm and deploy
            </button>
            <button type="button" onClick={props.onRetryDeploy}>
              retry
            </button>
            <button type="button" onClick={props.onBackToBids}>
              back to bids
            </button>
          </div>
        ) : null
    );
    const useConfigureDraft = vi.fn(() =>
      Object.assign(
        mock<ReturnType<typeof DEPENDENCIES.useConfigureDraft>>({
          draftId: input.draftId ?? "draft-1",
          persistedSdl: input.persistedSdl,
          persistedStartingSdl: input.persistedStartingSdl,
          persistedRuntimeLimitHours: input.persistedRuntimeLimitHours,
          persistedInheritSecretsFrom: input.persistedInheritSecretsFrom,
          save,
          dropInheritance,
          clear
        }),
        { persistedPlacementRegions: input.persistedPlacementRegions }
      )
    );
    const useDeploymentName = ((args: { initialName?: string }) => ({
      name: input.apiDerivedName ?? args.initialName ?? "",
      typedName: naming.typedName,
      setName: setDeploymentName
    })) as never;
    // The base flow is created upstream by the DeploymentFlowProvider now, so it arrives as a prop rather than a hook.
    const flow = Object.assign(
      mock<DeploymentFlow>({
        phase: input.phase ?? "configuring",
        dseq: input.dseq ?? null,
        bidStrategy: "select",
        selections: {},
        deploySucceeded: input.deploySucceeded ?? false,
        isDeployedInBackground: input.isDeployedInBackground ?? false,
        showsDeployProgress: input.showsDeployProgress ?? false,
        isDeployTakingLong: input.isDeployTakingLong ?? false,
        noBidsReceived: input.noBidsReceived ?? false,
        pendingClose: input.pendingClose ?? null,
        recommendedBidIds: input.recommendedBidIds ?? [],
        actions: mock<DeploymentFlow["actions"]>({ requestQuotes })
      }),
      { error: input.flowError }
    );
    const analyticsService = mock<AnalyticsService>();
    const usePublishConfigureForm = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      NeedsFundsAlert,
      ProjectBudgetRefusal: vi.fn(() => <></>),
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      ConfigureDeploymentBackButton: vi.fn(() => <div data-testid="back-button-mock" />),
      ConfigureDeploymentHeader,
      ConfigureDeployTargetChip: vi.fn(() => <div data-testid="deploy-target-chip-mock" />),
      ConfigureDeploymentPanes: ConfigureDeploymentPanes as never,
      ConfigureWorkspace: ConfigureWorkspace as never,
      useConfigureDraft: useConfigureDraft as never,
      useDeploymentName,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar, closeSnackbar }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          projectsEnabled: input.projectsEnabled ?? false,
          activeOrganization: input.organizationRole
            ? { id: "org-1", name: "Acme Corp", slug: "acme-corp", type: "team", role: input.organizationRole, isActive: true, createdAt: "" }
            : undefined
        }),
      Snackbar: Snackbar as never,
      ReviewAndDeployModal: ReviewAndDeployModal as never,
      DeployProgressOverlay,
      SdlImportExport: SdlImportExport as never,
      SdlImportChangesBanner,
      usePlacementsWithBids: () => new Set<string>(),
      usePublishConfigureForm,
      useFlag: () => false,
      useAddCredits: () => openAddCredits,
      useWallet: walletWith(input.isTrialing ?? false),
      useWalletBalance: walletBalanceWith(input.deployBalanceUsd),
      useDeploymentFundingConfigQuery: fundingConfigQueryWith(input.minimumDepositUsd)
    };

    const formWithFlags = (flags: { twoPanel: boolean; minimumDepositUsd?: number; isTrialing: boolean; deployBalanceUsd?: number }) => (
      <ConfigureDeploymentForm
        initialSdl={input.initialSdl}
        initialName={input.initialName}
        intent={{
          sdlStrategy: "edit",
          bidStrategy: "select",
          dseq: undefined,
          draftId: input.draftId,
          vm: input.vm ?? false,
          exampleImage: input.exampleImage
        }}
        flow={flow}
        templateSource={input.templateSource}
        dependencies={{
          ...dependencies,
          useFlag: flag => flag === "ui_configure_two_panel" && flags.twoPanel,
          useDeploymentFundingConfigQuery: fundingConfigQueryWith(flags.minimumDepositUsd),
          useWallet: walletWith(flags.isTrialing),
          useWalletBalance: walletBalanceWith(flags.deployBalanceUsd)
        }}
      />
    );
    const initialFlags = {
      twoPanel: input.twoPanel ?? false,
      minimumDepositUsd: input.minimumDepositUsd,
      isTrialing: input.isTrialing ?? false,
      deployBalanceUsd: input.deployBalanceUsd
    };
    const { rerender, unmount } = render(formWithFlags(initialFlags));

    return {
      unmount,
      rerenderWith: (flags: Partial<typeof initialFlags>) => rerender(formWithFlags({ ...initialFlags, ...flags })),
      ConfigureDeploymentPanes,
      ConfigureWorkspace,
      ConfigureDeploymentHeader,
      ConfigureDeployTargetChip: vi.fn(() => <div data-testid="deploy-target-chip-mock" />),
      ReviewAndDeployModal,
      DeployProgressOverlay,
      SdlImportExport,
      flow,
      enqueueSnackbar,
      closeSnackbar,
      save,
      clear,
      dropInheritance,
      requestQuotes,
      analyticsService,
      usePublishConfigureForm,
      openAddCredits,
      naming
    };
  }
});

function sealedSdlOf(sdl: string) {
  return generateSdl(importDeploymentState(sdl).values, { sealSecrets: true });
}

function creditsAddedCallbackOf(openAddCredits: Mock) {
  return (openAddCredits.mock.calls[0][0] as { onCreditsAdded: () => void }).onCreditsAdded;
}

interface WorkspaceProbeProps {
  sdl: string;
  selectedServiceId: string;
  selectedPlacement: PlacementType;
  onSelectService: (serviceId: string) => void;
  onReset: () => void;
  onDiscard: () => void;
}

function serviceCard(title: string) {
  return screen.getByRole("region", { name: `${title} service` });
}

/**
 * Workspace stand-in that mounts the real editor, where every stacked card registers its fields and carries a real
 * logs card, so each structural change runs against the same services array and mounted cards as in the app.
 */
function EditorProbeWorkspace({ sdl, selectedServiceId, selectedPlacement, onSelectService }: WorkspaceProbeProps) {
  const services = (useWatch<SdlBuilderFormValuesType>({ name: "services" }) as SdlBuilderFormValuesType["services"]) ?? [];
  return (
    <TooltipProvider>
      <div data-testid="sdl">{sdl}</div>
      <div data-testid="ghost-free">{String(services.every(service => !!service?.id && !!service?.placementId))}</div>
      <ConfigureEditor
        selectedServiceId={selectedServiceId}
        activePlacementId={selectedPlacement.id}
        onSelectService={onSelectService}
        deploymentName=""
        onDeploymentNameChange={vi.fn()}
        toolbar={null}
        dependencies={{ ...CONFIGURE_EDITOR_DEPENDENCIES, PlacementFields: PlacementFieldsWithoutRegion, ServiceStack: ServiceStackWithRegisteringCards }}
      />
    </TooltipProvider>
  );
}

function PlacementFieldsWithoutRegion(props: ComponentProps<typeof PlacementFields>) {
  return <PlacementFields {...props} dependencies={{ RegionSelect: () => null }} />;
}

function ServiceStackWithRegisteringCards(props: ComponentProps<typeof ServiceStack>) {
  return <ServiceStack {...props} dependencies={{ ServiceCard: ServiceCardWithRegisteringSections }} />;
}

function ServiceCardWithRegisteringSections(props: ComponentProps<typeof ServiceCard>) {
  return (
    <ServiceCard
      {...props}
      dependencies={{
        ...SERVICE_CARD_DEPENDENCIES,
        ImageSection: FieldRegisteringSection as never,
        HardwareSection: FieldRegisteringSection as never,
        AdditionalSection: LogsOnlySection as never
      }}
    />
  );
}

/** Workspace stand-in that edits the form and discards the deployment the way the leave dialog does. */
function DiscardProbeWorkspace({ onDiscard }: WorkspaceProbeProps) {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  return (
    <div>
      <button type="button" onClick={() => setValue("services.0.image", "nginx:latest")}>
        change image
      </button>
      <button type="button" onClick={onDiscard}>
        discard
      </button>
    </div>
  );
}

/** Workspace stand-in that shows the services and the live sdl and offers the reset the real toolbar confirms. */
function ResetProbeWorkspace({ sdl, selectedPlacement, onReset }: WorkspaceProbeProps) {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch<SdlBuilderFormValuesType>({ name: "services" });
  const titles = Array.isArray(services) ? (services as SdlBuilderFormValuesType["services"]).map(service => service.title) : [];
  return (
    <div>
      <div data-testid="service-titles">{titles.join(",")}</div>
      <div data-testid="placement-regions">{selectedPlacement.regions?.join(",")}</div>
      <div data-testid="sdl">{sdl}</div>
      <button type="button" onClick={() => setValue("services.0.title", "renamed")}>
        rename first service
      </button>
      <button type="button" onClick={onReset}>
        reset
      </button>
    </div>
  );
}

interface ProbePanesProps {
  sdl: string;
  selectedPlacementRegions?: readonly string[];
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  selectedPlacementId: string;
  onSelectProvider: (placementId: string, bidId: string) => void;
  configurationActions?: ReactNode;
}

/**
 * Panes stand-in that selects a provider for the focused placement, mirroring the marketplace click that
 * auto-opens the review modal once every placement is chosen. Exposes the focused placement id so the
 * deselect-on-back behavior can be asserted against the exact placement the modal was opened for.
 */
function ProviderSelectProbePanes({ selectedPlacementId, onSelectProvider }: ProbePanesProps) {
  return (
    <div>
      <div data-testid="focused-placement">{selectedPlacementId}</div>
      <button type="button" onClick={() => onSelectProvider(selectedPlacementId, "bid-1")}>
        select provider
      </button>
    </div>
  );
}

/**
 * Stand-in for a real configuration card: registers fields on its service index via `useController`, exactly
 * like ImageCard/ReplicasCard/etc. This registration is what resurrected a removed service before the fix, so a
 * regression test must mount something that registers.
 */
function fundingConfigQueryWith(minimumDepositUsd: number | undefined): typeof DEPENDENCIES.useDeploymentFundingConfigQuery {
  return () =>
    Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentFundingConfigQuery>>(), {
      data: minimumDepositUsd === undefined ? undefined : { targetRunwayHours: 48, balanceHeadroomUsd: 5, defaultDepositUsd: minimumDepositUsd }
    });
}

function walletWith(isTrialing: boolean): typeof DEPENDENCIES.useWallet {
  return () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWallet>>(), { isTrialing });
}

function walletBalanceWith(deployBalanceUsd: number | undefined): typeof DEPENDENCIES.useWalletBalance {
  return () =>
    Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>(), {
      balance: deployBalanceUsd === undefined ? null : mock<WalletBalance>({ totalDeploymentGrantsUSD: deployBalanceUsd })
    });
}

function FieldRegisteringSection({ serviceIndex }: { serviceIndex: number }) {
  useController<SdlBuilderFormValuesType>({ name: `services.${serviceIndex}.image` as never });
  useController<SdlBuilderFormValuesType>({ name: `services.${serviceIndex}.title` as never });
  return null;
}

/** Panes stand-in that types a secret into the first service before offering the provider pick. */
function SecretRetypingProbePanes() {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  return (
    <div>
      <button type="button" onClick={() => setValue("services.0.env", [{ id: "api-key", key: "API_KEY", value: "hunter2", isSecret: true }])}>
        type a secret
      </button>
      <button type="button" onClick={() => setValue("services.0.env.0.value", "hunter3")}>
        retype the secret
      </button>
    </div>
  );
}

function SecretTypingProbePanes(props: ProbePanesProps) {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  return (
    <div>
      <button type="button" onClick={() => setValue("services.0.env", [{ id: "api-key", key: "API_KEY", value: "hunter2", isSecret: true }])}>
        type a secret
      </button>
      <ProviderSelectProbePanes {...props} />
    </div>
  );
}

/** Panes stand-in that mutates the shared form to drive the SDL preview subscription. */
function SdlProbePanes({ sdl }: ProbePanesProps) {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  return (
    <div>
      <div data-testid="sdl">{sdl}</div>
      <button type="button" onClick={() => setValue("services.0.image", "nginx:latest")}>
        change image
      </button>
    </div>
  );
}

/** Panes stand-in that flips the first variable to a secret the way its toggle does, then renames it. */
function SecretProbePanes() {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  return (
    <div>
      <button type="button" onClick={() => setValue("services.0.env.0.isSecret", true)}>
        mark variable secret
      </button>
      <button type="button" onClick={() => setValue("services.0.env.0.key", "OPENAI_KEY")}>
        rename variable
      </button>
    </div>
  );
}

function RegionsProbePanes({ selectedPlacementRegions }: ProbePanesProps) {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  return (
    <div>
      <div data-testid="regions">{selectedPlacementRegions?.join(",")}</div>
      <button type="button" onClick={() => setValue("placements.0.regions", ["eu-west", "na-us-west"])}>
        pick two regions
      </button>
      <button type="button" onClick={() => setValue("placements.0.regions", ["eu-west", "na-us-west", "eu-central"])}>
        pick three regions
      </button>
    </div>
  );
}

/** Panes stand-in that reports the first service's VM-relevant state and the deployment-wide SSH flag. */
function VmStateProbePanes({ sdl }: ProbePanesProps) {
  const { getValues } = useFormContext<SdlBuilderFormValuesType>();
  const service = getValues("services")[0];
  return (
    <div>
      <div data-testid="sdl">{sdl}</div>
      <div data-testid="image">{service.image}</div>
      <div data-testid="count">{String(service.count)}</div>
      <div data-testid="has-ssh-key">{String(!!getValues("hasSSHKey"))}</div>
      <div data-testid="ssh-pub-key">{service.sshPubKey ?? ""}</div>
      <div data-testid="expose">
        {JSON.stringify(service.expose.map(entry => ({ port: entry.port, as: entry.as, proto: entry.proto, global: entry.global })))}
      </div>
    </div>
  );
}

/** Panes stand-in that reports the imported services so hydration can be asserted. */
function ServiceListProbePanes() {
  const services = useWatch<SdlBuilderFormValuesType>({ name: "services" });
  const titles = Array.isArray(services) ? (services as SdlBuilderFormValuesType["services"]).map(service => service.title) : [];
  return <div data-testid="service-titles">{titles.join(",")}</div>;
}

/**
 * Panes stand-in that adds then removes a service/placement via the real manager, mirroring the UI flow —
 * including selecting the newly added item and mounting the real ConfigurationPane, so its cards register
 * fields on the selected service. That registration is what made a removed service linger in the SDL, so it
 * must be present for the removal tests to guard the regression. `ghost-free` reports that every service in
 * the form still carries an id and placementId (a resurrected partial entry would be missing them).
 */
function AddRemoveProbePanes({ sdl, selectedServiceId, onSelectService }: ProbePanesProps) {
  const manager = usePlacementManagerContext();
  const { getValues } = useFormContext<SdlBuilderFormValuesType>();
  const services = (useWatch<SdlBuilderFormValuesType>({ name: "services" }) as SdlBuilderFormValuesType["services"]) ?? [];
  return (
    <div>
      <div data-testid="sdl">{sdl}</div>
      <div data-testid="selected">{selectedServiceId}</div>
      <div data-testid="ghost-free">{String(services.every(service => !!service?.id && !!service?.placementId))}</div>
      <button type="button" onClick={() => onSelectService(manager.addService(getValues("placements")[0].id))}>
        add service
      </button>
      <button type="button" onClick={() => manager.removeService(getValues("services")[1].id)}>
        remove service
      </button>
      <button type="button" onClick={() => manager.removeService(getValues("services")[0].id)}>
        remove first service
      </button>
      <button type="button" onClick={() => onSelectService(manager.addPlacement())}>
        add placement
      </button>
      <button type="button" onClick={() => manager.removePlacement(getValues("placements")[1].id)}>
        remove placement
      </button>
      <ConfigurationPane
        selectedServiceId={selectedServiceId}
        dependencies={{
          ImageSection: FieldRegisteringSection as never,
          HardwareSection: FieldRegisteringSection as never,
          AdditionalSection: FieldRegisteringSection as never
        }}
      />
    </div>
  );
}

/**
 * Panes stand-in that mounts the real deployment pane and the real logs card, so a collector toggled from the
 * logs card and a service added from the deployment pane go through the same services array as in the app.
 */
function LogForwardingProbePanes({ sdl, selectedServiceId, onSelectService }: ProbePanesProps) {
  const services = (useWatch<SdlBuilderFormValuesType>({ name: "services" }) as SdlBuilderFormValuesType["services"]) ?? [];
  return (
    <TooltipProvider>
      <div data-testid="sdl">{sdl}</div>
      <div data-testid="ghost-free">{String(services.every(service => !!service?.id && !!service?.placementId))}</div>
      <DeploymentPane
        selectedServiceId={selectedServiceId}
        onSelectService={onSelectService}
        phase="configuring"
        selections={{}}
        selectedPlacementId=""
        sdl={sdl}
        dseq={null}
        deploymentName=""
        onDeploymentNameChange={vi.fn()}
        dependencies={{
          ...DEPLOYMENT_PANE_DEPENDENCIES,
          PlacementCard: PlacementCardWithoutRegion,
          usePlacementsWithBids: () => new Set<string>(),
          ReclamationSection: () => null,
          DeploymentNameField: () => null
        }}
      />
      <ConfigurationPane
        selectedServiceId={selectedServiceId}
        dependencies={{
          ImageSection: FieldRegisteringSection as never,
          HardwareSection: FieldRegisteringSection as never,
          AdditionalSection: LogsOnlySection as never
        }}
      />
    </TooltipProvider>
  );
}

function PlacementCardWithoutRegion(props: ComponentProps<typeof PlacementCard>) {
  return <PlacementCard {...props} dependencies={{ ...PLACEMENT_CARD_DEPENDENCIES, RegionSelect: () => null }} />;
}

function LogsOnlySection({ serviceIndex }: { serviceIndex: number }) {
  return (
    <LogsCard
      serviceIndex={serviceIndex}
      dependencies={{
        ...LOGS_CARD_DEPENDENCIES,
        ComputeResourcesCard: () => null,
        useServices: () => mock<ReturnType<typeof LOGS_CARD_DEPENDENCIES.useServices>>({ analyticsService: mock<AnalyticsService>() })
      }}
    />
  );
}

/** Panes stand-in that reports the imported services, live sdl, and selection so an import can be asserted end to end. */
function ImportProbePanes({ sdl, selectedServiceId, configurationActions }: ProbePanesProps) {
  const services = useWatch<SdlBuilderFormValuesType>({ name: "services" });
  const titles = Array.isArray(services) ? (services as SdlBuilderFormValuesType["services"]).map(service => service.title) : [];
  return (
    <div>
      <div data-testid="service-titles">{titles.join(",")}</div>
      <div data-testid="sdl">{sdl}</div>
      <div data-testid="selected">{selectedServiceId}</div>
      {configurationActions}
    </div>
  );
}

/** Panes stand-in that reports what the inherited-secrets context hands the configuration cards. */
function InheritedSecretsProbePanes() {
  const inherited = useInheritedSecrets();
  return (
    <div>
      <div data-testid="inherited-source">{inherited?.sourceDseq ?? ""}</div>
      <div data-testid="inherited-names">{[...(inherited?.names ?? [])].join(",")}</div>
    </div>
  );
}

/** Panes stand-in that swaps out the services to drive the reselection subscription. */
function SelectionProbePanes({ selectedServiceId }: ProbePanesProps) {
  const { setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch<SdlBuilderFormValuesType>({ name: "services" });
  const firstServiceId = Array.isArray(services) ? (services as SdlBuilderFormValuesType["services"])[0]?.id : undefined;
  return (
    <div>
      <div data-testid="selected">{selectedServiceId}</div>
      <div data-testid="first-service-id">{firstServiceId ?? ""}</div>
      <button type="button" onClick={() => setValue("services", [defaultService(getValues("placements")[0].id, { title: "service-2" })])}>
        replace services
      </button>
    </div>
  );
}

function templateSourceOf(askedValues: TemplateAskedValue[] = TEMPLATE_ASKED_VALUES): TemplateSource {
  const version = buildTemplateVersion({ id: "ver-4", version: 4, sdl: TEMPLATE_SDL, askedValues: structuredClone(askedValues) });
  return { template: buildMarketplaceTemplate({ title: "Open WebUI", currentVersion: version }), version };
}

interface HeaderProbeProps {
  blockedReason?: string;
  onBlockedAttempt?: () => void;
  onDeploy?: () => void;
}

interface TemplateWorkspaceProbeProps extends WorkspaceProbeProps {
  editorHeader?: ReactNode;
  blockedReason?: string;
  onBlockedAttempt?: () => void;
}

function TemplateProbeWorkspace({ editorHeader, blockedReason, onBlockedAttempt }: TemplateWorkspaceProbeProps) {
  return (
    <div>
      {editorHeader}
      <BlockedRequestProbe blockedReason={blockedReason} onBlockedAttempt={onBlockedAttempt} />
    </div>
  );
}

function TemplateProbeHeader({ blockedReason, onBlockedAttempt, onDeploy }: HeaderProbeProps) {
  return (
    <div>
      <BlockedRequestProbe blockedReason={blockedReason} onBlockedAttempt={onBlockedAttempt} />
      <button type="button" onClick={onDeploy}>
        open review
      </button>
    </div>
  );
}

function BlockedRequestProbe({ blockedReason, onBlockedAttempt }: HeaderProbeProps) {
  return (
    <div>
      <p data-testid="blocked-reason">{blockedReason}</p>
      <button type="button" onClick={() => blockedReason && onBlockedAttempt?.()}>
        request bids
      </button>
    </div>
  );
}

function TemplateProbePanes(props: ProbePanesProps & { configurationHeader?: ReactNode }) {
  return (
    <div>
      {props.configurationHeader}
      <ProviderSelectProbePanes {...props} />
    </div>
  );
}
