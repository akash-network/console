import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { DeploymentDto, DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentUpdate } from "./DeploymentUpdate";
import type { DeploymentUpdateSubmitInput } from "./useDeploymentUpdateSubmit";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const STORED_SDL = `
version: "2.0"
services:
  web:
    image: ghcr.io/acme/storefront-web:2.8.1
    env:
      - MODE=dev
      - API_TOKEN=ac-secret://API_TOKEN
    credentials:
      host: ghcr.io
      username: ac-secret://REGISTRY_USERNAME
      password: ac-secret://REGISTRY_PASSWORD
    expose:
      - port: 3000
        as: 443
        to:
          - global: true
  api:
    image: ghcr.io/acme/storefront-api:2.8.1
    command:
      - node
    args:
      - server.js
    expose:
      - port: 8080
        as: 8080
        to:
          - service: web
  worker:
    image: busybox:1.36
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
        memory:
          size: 2Gi
        storage:
          - size: 10Gi
    api:
      resources:
        cpu:
          units: 1
        memory:
          size: 2Gi
        storage:
          - size: 10Gi
    worker:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
  placement:
    edge-us:
      pricing:
        web:
          denom: uakt
          amount: 1000
        api:
          denom: uakt
          amount: 1000
    edge-eu:
      pricing:
        worker:
          denom: uakt
          amount: 1000
deployment:
  web:
    edge-us:
      profile: web
      count: 3
  api:
    edge-us:
      profile: api
      count: 1
  worker:
    edge-eu:
      profile: worker
      count: 1
`;

const SINGLE_SERVICE_SDL = `
version: "2.0"
services:
  web:
    image: nginx:1.25
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
  placement:
    edge-us:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    edge-us:
      profile: web
      count: 1
`;

const SDL_WITH_LOG_COLLECTOR = SINGLE_SERVICE_SDL.replace(
  "profiles:",
  `  web-log-collector:
    image: ${LOG_COLLECTOR_IMAGE}
profiles:`
)
  .replace(
    "  placement:",
    `    web-log-collector:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 128Mi
        storage:
          - size: 128Mi
  placement:`
  )
  .replace(
    "deployment:",
    `        web-log-collector:
          denom: uakt
          amount: 1000
deployment:
  web-log-collector:
    edge-us:
      profile: web-log-collector
      count: 1`
  );

const RECORDED_VERSION = "cmVjb3JkZWQ=";

describe(DeploymentUpdate.name, () => {
  describe("the placements it shows", () => {
    it("shows every placement the definition declares, each with its services", () => {
      setup();

      const edgeUs = placementCard("edge-us");
      expect(within(edgeUs).getByRole("button", { name: /^web/ })).toBeInTheDocument();
      expect(within(edgeUs).getByRole("button", { name: /^api/ })).toBeInTheDocument();
      expect(within(placementCard("edge-eu")).getByRole("button", { name: /^worker/ })).toBeInTheDocument();
    });

    it("counts the placements and services", () => {
      setup();

      expect(screen.getByText("2 placements · 3 services")).toBeInTheDocument();
    });

    it("counts a single placement and service in the singular", () => {
      setup({ definition: { sdl: SINGLE_SERVICE_SDL } });

      expect(screen.getByText("1 placement · 1 service")).toBeInTheDocument();
    });

    it("leaves the log collector out, since it is managed for the user", () => {
      setup({ definition: { sdl: SDL_WITH_LOG_COLLECTOR } });

      expect(screen.getByText("1 placement · 1 service")).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "web-log-collector" })).not.toBeInTheDocument();
    });

    it.each([
      { named: "no lease at all", leases: [] },
      { named: "no lease list", leases: null }
    ])("names a placement backed by $named without a provider or totals", ({ leases }) => {
      setup({ leases });

      const edgeUs = placementCard("edge-us");
      expect(within(edgeUs).getByRole("heading", { name: "edge-us" })).toBeInTheDocument();
      expect(within(edgeUs).queryByText("Mariner Cloud")).not.toBeInTheDocument();
      expect(within(edgeUs).queryByText("Storage")).not.toBeInTheDocument();
    });

    it("names the region and provider a placement runs on", () => {
      setup();

      const edgeUs = placementCard("edge-us");
      expect(within(edgeUs).getByText("us-east")).toBeInTheDocument();
      expect(within(edgeUs).getByText("Mariner Cloud")).toBeInTheDocument();
    });

    it("names the gpus the console read on a placement's lease", () => {
      setup({ leases: [leaseWithDetectedH100s(), leaseOn("edge-eu", "akash1eu")] });

      expect(within(placementCard("edge-us")).getByText("GPU").parentElement).toHaveTextContent("2\u00d7 H100");
    });

    it("holds the gpu model's place while the reading loads", () => {
      setup({ leases: [leaseWithDetectedH100s(), leaseOn("edge-eu", "akash1eu")], isLoadingDetectedGpus: true });

      expect(within(placementCard("edge-us")).getByTestId("gpu-model-skeleton")).toBeInTheDocument();
    });

    it("names the fields that stay locked after deploy", () => {
      setup();

      expect(screen.getByText(/Some fields are locked after deploy/)).toBeInTheDocument();
    });

    it("shows each service's hardware as fixed for this lease", () => {
      setup();

      const web = serviceSection("web");
      expect(within(web).getByText("Fixed for this lease")).toBeInTheDocument();
      expect(within(web).getByLabelText("vCPU")).toHaveValue("1");
      expect(within(web).getByLabelText("vCPU")).toBeDisabled();
      expect(within(web).getByLabelText("Memory")).toHaveValue("2 Gi");
      expect(within(web).getByLabelText("Ephemeral storage")).toHaveValue("10 Gi");
      expect(within(web).getByLabelText("Instances")).toHaveValue("3");
    });

    it("collapses every service of a placement at once", async () => {
      setup();

      await userEvent.click(within(placementCard("edge-us")).getByRole("button", { name: "Collapse all" }));

      expect(screen.queryByRole("region", { name: "web" })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "api" })).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "worker" })).toBeInTheDocument();
    });
  });

  describe("updating", () => {
    it("keeps Update deployment and Discard changes disabled until something changes", async () => {
      setup();

      expect(updateButton()).toBeDisabled();
      expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled();

      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");

      expect(updateButton()).toBeEnabled();
    });

    it("submits the seeded values beside the edited ones", async () => {
      const { submit } = setup();

      await userEvent.clear(within(serviceSection("web")).getByLabelText("Image"));
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "ghcr.io/acme/storefront-web:2.9.0");
      await userEvent.click(updateButton());

      expect(submit).toHaveBeenCalledTimes(1);
      const [seed, current] = submit.mock.calls[0] as [SdlBuilderFormValuesType, SdlBuilderFormValuesType];
      expect(serviceIn(seed, "web").image).toBe("ghcr.io/acme/storefront-web:2.8.1");
      expect(serviceIn(current, "web").image).toBe("ghcr.io/acme/storefront-web:2.9.0");
    });

    it("refuses an image no registry accepts, without submitting", async () => {
      const { submit } = setup();

      await userEvent.clear(within(serviceSection("web")).getByLabelText("Image"));
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "Not An Image");
      await userEvent.click(updateButton());

      expect(await within(serviceSection("web")).findByText("Invalid docker image name.")).toBeInTheDocument();
      expect(submit).not.toHaveBeenCalled();
    });

    it("points out an emptied image as soon as the field is left", async () => {
      setup();

      await userEvent.clear(within(serviceSection("web")).getByLabelText("Image"));
      await userEvent.tab();

      expect(await within(serviceSection("web")).findByText("Docker image name is required.")).toBeInTheDocument();
    });

    it("discards the edits back to what the deployment runs", async () => {
      setup();

      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:2.8.1");
      expect(updateButton()).toBeDisabled();
    });

    it("shows the refusal the api gave for the document", () => {
      setup({ sdlRefusal: "Invalid SDL: the image is not a valid reference" });

      expect(screen.getByRole("alert")).toHaveTextContent("Invalid SDL: the image is not a valid reference");
    });

    it("holds the form while an update runs", () => {
      setup({ isUpdating: true });

      expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();
      expect(within(serviceSection("web")).getByLabelText("Image")).toBeDisabled();
    });

    it("guards the update on the version the form was seeded from", () => {
      const { submitInput } = setup();

      expect(submitInput()).toMatchObject({ dseq: "1234", manifestVersion: RECORDED_VERSION });
    });

    it("tells the page once an update lands", async () => {
      const { submit, submitInput, onUpdated } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(updateButton());

      act(() => submitInput().onUpdated({ values: submittedValues(submit), manifestVersion: "bmV3" }));

      expect(onUpdated).toHaveBeenCalled();
    });

    it("takes a landed update as the new baseline before the definition refetches", async () => {
      const { submit, submitInput } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(updateButton());

      act(() => submitInput().onUpdated({ values: submittedValues(submit), manifestVersion: "bmV3" }));

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:2.8.1-hotfix");
      expect(updateButton()).toBeDisabled();
      expect(submitInput().manifestVersion).toBe("bmV3");
    });

    it("keeps guarding on the version it had when the api answers an update without one", async () => {
      const { submit, submitInput } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(updateButton());

      act(() => submitInput().onUpdated({ values: submittedValues(submit), manifestVersion: undefined }));

      expect(submitInput().manifestVersion).toBe(RECORDED_VERSION);
    });

    it("keeps edits made after an update landed when its refetch arrives", async () => {
      const { submit, submitInput, showDefinition } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(updateButton());
      act(() => submitInput().onUpdated({ values: submittedValues(submit), manifestVersion: "bmV3" }));

      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-2");
      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:2.8.1-hotfix"), manifestVersion: "bmV3" });

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:2.8.1-hotfix-2");
    });

    it("reloads the form from the new definition once an update lands, leaving nothing to discard", async () => {
      const { submit, submitInput, showDefinition } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(updateButton());

      act(() => submitInput().onUpdated({ values: submittedValues(submit), manifestVersion: "bmV3" }));
      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:2.8.1-hotfix") });

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:2.8.1-hotfix");
      expect(updateButton()).toBeDisabled();
    });

    it("holds the form while it reloads after a change made elsewhere, so nothing typed meanwhile is lost", async () => {
      const { submitInput, showDefinition } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-mine");

      act(() => submitInput().onDefinitionChanged());

      expect(within(serviceSection("web")).getByLabelText("Image")).toBeDisabled();
      expect(updateButton()).toBeDisabled();

      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:3.0.0"), manifestVersion: "bmV3" });

      expect(within(serviceSection("web")).getByLabelText("Image")).toBeEnabled();
    });

    it("reloads at once from a definition that arrived while the form was being edited", async () => {
      const { submitInput, showDefinition } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-mine");
      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:3.0.0"), manifestVersion: "bmV3" });

      act(() => submitInput().onDefinitionChanged());

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:3.0.0");
      expect(within(serviceSection("web")).getByLabelText("Image")).toBeEnabled();
      expect(submitInput().manifestVersion).toBe("bmV3");
    });

    it("lets go of the form when the reload after a conflict fails, keeping what was typed", async () => {
      const { submitInput } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-mine");
      act(() => submitInput().onDefinitionChanged());

      act(() => submitInput().onDefinitionReloadFailed());

      expect(within(serviceSection("web")).getByLabelText("Image")).toBeEnabled();
      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:2.8.1-mine");
    });

    it("does not reload over later edits once a failed reload has let go of the form", async () => {
      const { submitInput, showDefinition } = setup();
      act(() => submitInput().onDefinitionChanged());
      act(() => submitInput().onDefinitionReloadFailed());
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-later");

      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:3.0.0"), manifestVersion: "bmV3" });

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:2.8.1-later");
    });

    it("keeps the services the user collapsed when its own update comes back", async () => {
      const { submit, submitInput, showDefinition } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(updateButton());
      await userEvent.click(within(placementCard("edge-us")).getByRole("button", { name: "Collapse all" }));
      act(() => submitInput().onUpdated({ values: submittedValues(submit), manifestVersion: "bmV3" }));

      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:2.8.1-hotfix"), manifestVersion: "bmV3" });

      expect(screen.queryByRole("region", { name: "web" })).not.toBeInTheDocument();
    });

    it("ignores a late copy of the definition a landed update replaced", async () => {
      const { submit, submitInput, showDefinition } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(updateButton());
      act(() => submitInput().onUpdated({ values: submittedValues(submit), manifestVersion: "bmV3" }));

      showDefinition({ sdl: STORED_SDL, manifestVersion: RECORDED_VERSION, name: "renamed-meanwhile" });

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:2.8.1-hotfix");
      expect(submitInput().manifestVersion).toBe("bmV3");
    });

    it("reloads over unsaved edits once the api reports the deployment changed elsewhere", async () => {
      const { submitInput, showDefinition } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-mine");

      act(() => submitInput().onDefinitionChanged());
      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:3.0.0"), manifestVersion: "bmV3" });

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:3.0.0");
    });

    it("diffs a later edit against the definition the form reloaded", async () => {
      const { submit, submitInput, showDefinition } = setup();
      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:3.0.0"), manifestVersion: "bmV3" });

      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-hotfix");
      await userEvent.click(updateButton());

      const [seed] = submit.mock.calls[0] as [SdlBuilderFormValuesType];
      expect(serviceIn(seed, "web").image).toBe("ghcr.io/acme/storefront-web:3.0.0");
      expect(submitInput().manifestVersion).toBe("bmV3");
    });

    it("keeps unsaved edits when the definition refreshes on its own", async () => {
      const { showDefinition } = setup();
      await userEvent.type(within(serviceSection("web")).getByLabelText("Image"), "-mine");

      showDefinition({ sdl: STORED_SDL.replace("storefront-web:2.8.1", "storefront-web:3.0.0") });

      expect(within(serviceSection("web")).getByLabelText("Image")).toHaveValue("ghcr.io/acme/storefront-web:2.8.1-mine");
    });
  });

  describe("variables and secrets", () => {
    it("masks a variable's value until it is revealed", async () => {
      setup();
      await openTab("web", /Vars & secrets/);

      const value = within(serviceSection("web")).getByLabelText("MODE value");
      expect(value).toHaveAttribute("type", "password");

      await userEvent.click(within(serviceSection("web")).getByRole("button", { name: "Show MODE value" }));

      expect(value).toHaveAttribute("type", "text");
    });

    it("shows a kept secret by name, with no value to read or type", async () => {
      setup();
      await openTab("web", /Vars & secrets/);

      const web = serviceSection("web");
      expect(within(web).getByLabelText("Secret 1 name")).toHaveValue("API_TOKEN");
      expect(within(web).getByLabelText("Secret 1 name")).toHaveAttribute("readonly");
      expect(within(web).getByLabelText("API_TOKEN value")).toBeDisabled();
      expect(within(web).getByLabelText("API_TOKEN value")).toHaveAttribute("placeholder", "Enter new value to update");
    });

    it("changes and removes a variable", async () => {
      const { submit } = setup();
      await openTab("web", /Vars & secrets/);
      const web = serviceSection("web");

      await userEvent.click(within(web).getByRole("button", { name: "Remove MODE" }));
      await userEvent.click(updateButton());

      const [, current] = submit.mock.calls[0] as [SdlBuilderFormValuesType, SdlBuilderFormValuesType];
      expect(serviceIn(current, "web").env?.map(variable => variable.key)).toEqual(["API_TOKEN"]);
    });

    it("shows a variable renamed onto a secret's name as the clash, and sends nothing", async () => {
      const { submit } = setup();
      await openTab("web", /Vars & secrets/);
      const web = serviceSection("web");

      await userEvent.clear(within(web).getByLabelText("Variable 1 name"));
      await userEvent.type(within(web).getByLabelText("Variable 1 name"), "API_TOKEN");
      await userEvent.click(updateButton());

      expect(await within(web).findByText("This service already has a secret named API_TOKEN.")).toBeInTheDocument();
      expect(submit).not.toHaveBeenCalled();
    });

    it("keeps a secret's removal for when secrets can be edited, since nothing here could add it back", async () => {
      setup();
      await openTab("web", /Vars & secrets/);

      expect(within(serviceSection("web")).getByRole("button", { name: "Remove API_TOKEN" })).toBeDisabled();
    });

    it("adds a variable from the Add menu", async () => {
      const { submit } = setup();
      await openTab("web", /Vars & secrets/);
      const web = serviceSection("web");

      await userEvent.click(within(web).getByRole("button", { name: "Add" }));
      await userEvent.click(screen.getByRole("menuitem", { name: /Variable/ }));
      await userEvent.type(within(web).getByLabelText("Variable 2 name"), "LOG_LEVEL");
      await userEvent.type(within(web).getByLabelText("LOG_LEVEL value"), "debug");
      await userEvent.click(updateButton());

      const [, current] = submit.mock.calls[0] as [SdlBuilderFormValuesType, SdlBuilderFormValuesType];
      expect(serviceIn(current, "web").env).toContainEqual(expect.objectContaining({ key: "LOG_LEVEL", value: "debug" }));
    });

    it("offers no way to add a secret yet", async () => {
      setup();
      await openTab("web", /Vars & secrets/);

      await userEvent.click(within(serviceSection("web")).getByRole("button", { name: "Add" }));

      expect(screen.getByRole("menuitem", { name: /Secret/ })).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("command and ports", () => {
    it("edits the command and its arguments", async () => {
      const { submit } = setup();
      await openTab("api", /Command/);
      const api = serviceSection("api");

      await userEvent.clear(within(api).getByRole("textbox", { name: "Command" }));
      await userEvent.type(within(api).getByRole("textbox", { name: "Command" }), "bun");
      await userEvent.click(updateButton());

      const [, current] = submit.mock.calls[0] as [SdlBuilderFormValuesType, SdlBuilderFormValuesType];
      expect(serviceIn(current, "api").command).toEqual({ command: "bun", arg: "server.js" });
    });

    it("shows each exposed port with its protocol and routing, none of which can change yet", () => {
      setup();

      const web = serviceSection("web");
      expect(within(web).getByLabelText("Port (internal)")).toHaveValue("3000");
      expect(within(web).getByLabelText("Port (internal)")).toBeDisabled();
      expect(within(web).getByLabelText("As (external)")).toHaveValue("443");
      expect(within(web).getByLabelText("Protocol")).toHaveValue("HTTP");
      expect(within(web).getByLabelText("Routing")).toHaveValue("Public (any IP)");
      expect(within(serviceSection("api")).getByLabelText("Routing")).toHaveValue("Internal");
    });
  });

  describe("the private registry", () => {
    it("shows the host and keeps the credentials without showing them", async () => {
      setup();

      await userEvent.click(within(serviceSection("web")).getByRole("button", { name: /Private registry/ }));

      const web = serviceSection("web");
      expect(within(web).getByLabelText("Registry host")).toHaveValue("ghcr.io");
      expect(within(web).getByLabelText("Registry username")).toBeDisabled();
      expect(within(web).getByLabelText("Registry username")).toHaveAttribute("placeholder", "Kept from your deployment");
      expect(within(web).getByLabelText("Registry password")).toBeDisabled();
    });

    it("stops pulling from a private registry", async () => {
      const { submit } = setup();
      await userEvent.click(within(serviceSection("web")).getByRole("button", { name: /Private registry/ }));

      await userEvent.click(within(serviceSection("web")).getByRole("button", { name: "Stop using a private registry" }));
      await userEvent.click(updateButton());

      const [, current] = submit.mock.calls[0] as [SdlBuilderFormValuesType, SdlBuilderFormValuesType];
      expect(serviceIn(current, "web")).toMatchObject({ hasCredentials: false, credentials: undefined });
    });

    it("says a public image has no registry to change yet", async () => {
      setup();

      await userEvent.click(within(serviceSection("worker")).getByRole("button", { name: /Private registry/ }));

      expect(within(serviceSection("worker")).getByText(/pulls a public image/)).toBeInTheDocument();
    });
  });

  describe("a deployment it cannot update", () => {
    it("shows a closed deployment read-only and offers a redeploy instead", async () => {
      const { onRedeploy } = setup({ deploymentState: "closed" });

      expect(within(serviceSection("web")).getByLabelText("Image")).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Update deployment" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

      expect(onRedeploy).toHaveBeenCalled();
    });

    it.each([
      { named: "a copy only this browser holds", definition: { source: "local" as const, manifestVersion: undefined } },
      { named: "no usable copy at all", definition: { source: "absent" as const, manifestVersion: undefined } }
    ])("falls back to the raw editor for $named", ({ definition }) => {
      setup({ definition });

      expect(screen.getByText("raw-editor")).toBeInTheDocument();
      expect(screen.getByText(/has no up-to-date copy/)).toBeInTheDocument();
      expect(screen.queryByText("2 placements · 3 services")).not.toBeInTheDocument();
    });

    it.each([
      { named: "no sdl", definition: { sdl: undefined } },
      { named: "no manifest version to guard on", definition: { manifestVersion: undefined } }
    ])("falls back to the raw editor for an api copy with $named", ({ definition }) => {
      setup({ definition });

      expect(screen.getByText("raw-editor")).toBeInTheDocument();
      expect(screen.getByText(/has no up-to-date copy/)).toBeInTheDocument();
    });

    it("falls back to the raw editor when the stored copy cannot be read into the form", () => {
      setup({ definition: { sdl: "services: [not, a, map" } });

      expect(screen.getByText("raw-editor")).toBeInTheDocument();
      expect(screen.getByText("The configuration the console stored could not be read into the form, so it is shown as raw SDL.")).toBeInTheDocument();
    });

    it("never mounts the raw editor while the definition arrives", () => {
      const { showDefinition, rawEditorRenders } = setup({ definition: { source: "resolving", sdl: undefined, manifestVersion: undefined } });

      showDefinition({ source: "api", sdl: STORED_SDL, manifestVersion: RECORDED_VERSION });

      expect(screen.getByText("2 placements · 3 services")).toBeInTheDocument();
      expect(rawEditorRenders()).toBe(0);
    });

    it("waits for the definition before showing anything", () => {
      setup({ definition: { source: "resolving", sdl: undefined } });

      expect(screen.getByTestId("deployment-update-resolving")).toBeInTheDocument();
      expect(screen.queryByText("raw-editor")).not.toBeInTheDocument();
    });
  });

  function placementCard(name: string) {
    return screen.getByRole("group", { name: `Placement ${name}` });
  }

  function serviceSection(title: string) {
    return screen.getByRole("region", { name: title });
  }

  function updateButton() {
    return screen.getByRole("button", { name: "Update deployment" });
  }

  async function openTab(service: string, tab: RegExp) {
    await userEvent.click(within(serviceSection(service)).getByRole("tab", { name: tab }));
  }

  function submittedValues(submit: ReturnType<typeof vi.fn>) {
    return (submit.mock.calls[0] as [SdlBuilderFormValuesType, SdlBuilderFormValuesType])[1];
  }

  function serviceIn(values: SdlBuilderFormValuesType, title: string) {
    const service = values.services.find(candidate => candidate.title === title);
    if (!service) throw new Error(`no service ${title}`);
    return service;
  }

  function leaseOn(placement: string, provider: string) {
    return mock<LeaseDto>({
      id: `${placement}-lease`,
      provider,
      state: "active",
      cpuAmount: 2,
      memoryAmount: 4 * 1024 ** 3,
      storageAmount: 20 * 1024 ** 3,
      gpuAmount: 0,
      group: mock<DeploymentGroup>({ group_spec: mock<DeploymentGroup["group_spec"]>({ name: placement, resources: [] }) })
    });
  }

  function leaseWithDetectedH100s() {
    const lease = leaseOn("edge-us", "akash1us");
    lease.gpuAmount = 2;
    lease.detectedGpus = {
      services: [{ service: "web", gpus: [{ vendor: "nvidia", model: null, displayName: "H100", memoryMb: 0, interface: null, count: 2 }] }],
      driverVersion: null,
      detectedAt: "2026-09-21T10:00:00.000Z"
    };
    return lease;
  }

  function setup(
    input: {
      definition?: Partial<DeploymentDefinition>;
      deploymentState?: string;
      isUpdating?: boolean;
      sdlRefusal?: string | null;
      leases?: LeaseDto[] | null;
      isLoadingDetectedGpus?: boolean;
    } = {}
  ) {
    const submit = vi.fn();
    let capturedSubmitInput: DeploymentUpdateSubmitInput | undefined;
    const useDeploymentUpdateSubmit: typeof DEPENDENCIES.useDeploymentUpdateSubmit = submitInput => {
      capturedSubmitInput = submitInput;
      return { submit, isUpdating: input.isUpdating ?? false, sdlRefusal: input.sdlRefusal ?? null };
    };
    const onUpdated = vi.fn();
    const onRedeploy = vi.fn();
    const RawEditor = vi.fn(() => <div>raw-editor</div>);
    const deployment = mock<DeploymentDto>({ dseq: "1234", state: input.deploymentState ?? "active" });
    const leases = input.leases === undefined ? [leaseOn("edge-us", "akash1us"), leaseOn("edge-eu", "akash1eu")] : input.leases;
    const providers = [
      mock<ApiProviderList>({ owner: "akash1us", organization: "Mariner Cloud", attributes: [{ key: "region", value: "us-east" }] }),
      mock<ApiProviderList>({ owner: "akash1eu", organization: "Harbor Compute", attributes: [{ key: "region", value: "eu-west" }] })
    ];

    const definitionOf = (overrides: Partial<DeploymentDefinition>): DeploymentDefinition => ({
      sdl: STORED_SDL,
      name: "acme-storefront",
      source: "api",
      manifestVersion: RECORDED_VERSION,
      ...input.definition,
      ...overrides
    });

    const tabFor = (definition: DeploymentDefinition) => (
      <DeploymentUpdate
        deployment={deployment}
        leases={leases}
        providers={providers}
        isLoadingDetectedGpus={input.isLoadingDetectedGpus}
        definition={definition}
        onUpdated={onUpdated}
        onRedeploy={onRedeploy}
        fallback={<RawEditor />}
        dependencies={{ ...DEPENDENCIES, useDeploymentUpdateSubmit }}
      />
    );
    const { rerender } = render(tabFor(definitionOf({})), { wrapper: TooltipProvider });

    const showDefinition = (overrides: Partial<DeploymentDefinition>) => rerender(tabFor(definitionOf(overrides)));
    const submitInput = () => {
      if (!capturedSubmitInput) throw new Error("the submit hook was never called");
      return capturedSubmitInput;
    };

    return { submit, onUpdated, onRedeploy, showDefinition, submitInput, rawEditorRenders: () => RawEditor.mock.calls.length };
  }
});
