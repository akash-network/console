import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types/sdlBuilder/sdlBuilder";
import { kvArrayToObject } from "@src/utils/keyValue/keyValue";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, LogsCard } from "./LogsCard";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(LogsCard.name, () => {
  it("shows the switch off and no provider in the header summary when log forwarding is disabled", () => {
    setup();

    expect(screen.getByRole("switch", { name: "Enable log forwarding" })).not.toBeChecked();
    expect(screen.queryByText("Datadog")).not.toBeInTheDocument();
  });

  it("shows the switch on and the provider in the header summary when log forwarding is already enabled", () => {
    setup({ withLogForwarding: true });

    expect(screen.getByRole("switch", { name: "Enable log forwarding" })).toBeChecked();
    expect(screen.getByText("Datadog")).toBeInTheDocument();
  });

  it("shows the switch on for a restored collector whose id was reassigned on import", () => {
    setup({ withLogForwarding: true, collectorId: "imported-random-id" });

    expect(screen.getByRole("switch", { name: "Enable log forwarding" })).toBeChecked();
  });

  it("highlights the card after submit when the collector's Datadog config is invalid", async () => {
    const { submit, container } = setup({ withLogForwarding: true, invalidProviderConfig: true });

    await submit();

    await waitFor(() => expect(container.querySelector(".border-destructive")).not.toBeNull());
  });

  it("does not highlight the card before the form is submitted", async () => {
    const { trigger, container } = setup({ withLogForwarding: true, invalidProviderConfig: true });

    await trigger();

    expect(container.querySelector(".border-destructive")).toBeNull();
  });

  it("does not surface errors when the modal is closed before submitting", async () => {
    const { toggleSwitch, container, getErrors } = setup();

    await toggleSwitch();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(container.querySelector(".border-destructive")).toBeNull();
    expect(getErrors().services).toBeUndefined();
  });

  it("adds the collector and opens the modal when the switch is turned on", async () => {
    const { getValues, toggleSwitch } = setup();

    await toggleSwitch();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(getValues().services.some(isLogCollectorService)).toBe(true);
  });

  it("adds the collector and opens the modal when a disabled card's header is clicked", async () => {
    const { getValues, openViaHeader } = setup();

    await openViaHeader();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(getValues().services.some(isLogCollectorService)).toBe(true);
  });

  it("opens the modal for editing when an enabled card's header is clicked", async () => {
    const { openViaHeader } = setup({ withLogForwarding: true });

    await openViaHeader();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Datadog regional URL")).toBeInTheDocument();
  });

  it("removes the collector without opening the modal when the switch is turned off", async () => {
    const { getValues, toggleSwitch } = setup({ withLogForwarding: true });

    await toggleSwitch();

    expect(getValues().services.some(isLogCollectorService)).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reveals the Datadog fields and collector resources in the modal", async () => {
    const { toggleSwitch } = setup();

    await toggleSwitch();

    expect(screen.getByLabelText("Datadog regional URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Datadog API key")).toBeInTheDocument();
    expect(screen.getByLabelText("CPU Count")).toBeInTheDocument();
  });

  it("keeps the collector on Save after enabling", async () => {
    const { getValues, toggleSwitch } = setup();

    await toggleSwitch();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const collector = getValues().services.find(isLogCollectorService);
    expect(collector?.title).toBe("service-1-log-collector");
  });

  it("removes the just-added collector on Cancel after enabling", async () => {
    const { getValues, toggleSwitch } = setup();

    await toggleSwitch();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(getValues().services.some(isLogCollectorService)).toBe(false);
  });

  describe("analytics", () => {
    it("tracks log_collector_enabled when a fresh enable is saved", async () => {
      const { analyticsService, toggleSwitch } = setup();

      await toggleSwitch();
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(analyticsService.track).toHaveBeenCalledWith("log_collector_enabled", { category: "deployments" });
    });

    it("tracks log_collector_disabled when forwarding is turned off", async () => {
      const { analyticsService, toggleSwitch } = setup({ withLogForwarding: true });

      await toggleSwitch();

      expect(analyticsService.track).toHaveBeenCalledWith("log_collector_disabled", { category: "deployments" });
    });

    it("does not track enabled when a fresh enable is cancelled", async () => {
      const { analyticsService, toggleSwitch } = setup();

      await toggleSwitch();
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(analyticsService.track).not.toHaveBeenCalledWith("log_collector_enabled", expect.anything());
    });

    it("does not track enabled when an already-enabled card is edited and saved", async () => {
      const { analyticsService, openViaHeader } = setup({ withLogForwarding: true });

      await openViaHeader();
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(analyticsService.track).not.toHaveBeenCalledWith("log_collector_enabled", expect.anything());
    });
  });

  it("stores the Datadog provider settings on the collector service's env", async () => {
    const { getValues, toggleSwitch } = setup();

    await toggleSwitch();
    await userEvent.type(screen.getByLabelText("Datadog regional URL"), "datadoghq.eu");
    await userEvent.type(screen.getByLabelText("Datadog API key"), "secret-key");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const collector = getValues().services.find(isLogCollectorService);
    const env = kvArrayToObject(collector?.env ?? []);
    expect(env.DD_SITE).toBe("datadoghq.eu");
    expect(env.DD_API_KEY).toBe("secret-key");
  });

  it("edits the collector's compute profile through the resource controls", async () => {
    const { getValues, openViaHeader } = setup({ withLogForwarding: true });

    await openViaHeader();
    const cpu = screen.getByLabelText("CPU Count");
    await userEvent.clear(cpu);
    await userEvent.type(cpu, "2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const collector = getValues().services.find(isLogCollectorService);
    expect(collector?.profile.cpu).toBe(2);
  });

  it("reverts edits to the previous version on Cancel when editing an enabled card", async () => {
    const { getValues, openViaHeader } = setup({ withLogForwarding: true });

    await openViaHeader();
    const url = screen.getByLabelText("Datadog regional URL");
    await userEvent.clear(url);
    await userEvent.type(url, "datadoghq.eu");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const collector = getValues().services.find(isLogCollectorService);
    expect(collector).toBeDefined();
    expect(kvArrayToObject(collector?.env ?? []).DD_SITE).toBe("datadoghq.com");
  });

  it("disables the switch and opens an enabled card read-only while locked", async () => {
    const { openViaHeader } = setup({ withLogForwarding: true, locked: true });

    expect(screen.getByRole("switch", { name: "Enable log forwarding" })).toBeDisabled();

    await openViaHeader();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Datadog regional URL")).toBeDisabled();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  describe("when the parent service is renamed outside the modal", () => {
    it("keeps a single collector paired and re-syncs its title", async () => {
      const { getValues, renameParent } = setup({ withLogForwarding: true });

      act(() => renameParent("api"));

      await waitFor(() => {
        const collectors = getValues().services.filter(isLogCollectorService);
        expect(collectors).toHaveLength(1);
        expect(collectors[0].title).toBe("api-log-collector");
      });
    });

    it("re-points the collector's POD_LABEL_SELECTOR at the renamed parent", async () => {
      const { getValues, renameParent } = setup({ withLogForwarding: true });

      act(() => renameParent("api"));

      await waitFor(() => {
        const collector = getValues().services.find(isLogCollectorService);
        const env = kvArrayToObject(collector?.env ?? []);
        expect(env.POD_LABEL_SELECTOR).toBe("akash.network/manifest-service=api");
      });
    });

    it("still reports log forwarding as enabled in the header summary after a rename", async () => {
      const { renameParent } = setup({ withLogForwarding: true });

      act(() => renameParent("api"));

      await waitFor(() => expect(screen.getByText("Datadog")).toBeInTheDocument());
    });
  });

  function setup(input: { withLogForwarding?: boolean; locked?: boolean; collectorId?: string; invalidProviderConfig?: boolean } = {}) {
    const values = defaultServiceWithPlacement();
    if (input.withLogForwarding) {
      const parent = values.services[0];
      parent.image = "nginx:latest";
      values.services.push({
        ...parent,
        id: input.collectorId ?? `${parent.id}-log-collector`,
        title: `${parent.title}-log-collector`,
        image: LOG_COLLECTOR_IMAGE,
        expose: [],
        env: [
          { key: "PROVIDER", value: "DATADOG" },
          { key: "DD_API_KEY", value: input.invalidProviderConfig ? "" : "existing" },
          { key: "DD_SITE", value: input.invalidProviderConfig ? "" : "datadoghq.com" }
        ]
      });
    }

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });

    let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange", resolver: zodResolver(SdlBuilderFormValuesSchema) });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    const { container } = render(
      <Wrapper>
        <LogsCard serviceIndex={0} locked={input.locked} dependencies={{ ...DEPENDENCIES, useServices }} />
      </Wrapper>
    );

    return {
      container,
      analyticsService,
      getValues: () => (form as UseFormReturn<SdlBuilderFormValuesType>).getValues(),
      getErrors: () => (form as UseFormReturn<SdlBuilderFormValuesType>).formState.errors,
      trigger: () => (form as UseFormReturn<SdlBuilderFormValuesType>).trigger(),
      submit: () => (form as UseFormReturn<SdlBuilderFormValuesType>).handleSubmit(() => undefined)(),
      renameParent: (title: string) =>
        (form as UseFormReturn<SdlBuilderFormValuesType>).setValue("services.0.title", title, { shouldDirty: true, shouldTouch: true }),
      toggleSwitch: () => userEvent.click(screen.getByRole("switch", { name: "Enable log forwarding" })),
      openViaHeader: () => userEvent.click(screen.getByText(/^Logs/))
    };
  }
});
