import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, RamStorageCard } from "./RamStorageCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const EPHEMERAL = { size: 1, unit: "Gi", isPersistent: false, type: "beta2" };
const RAM = { size: 10, unit: "Gi", isPersistent: false, type: "ram", name: "shm", mount: "/dev/shm", isReadOnly: false };
const PERSISTENT = { size: 10, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/data", isReadOnly: false };

describe(RamStorageCard.name, () => {
  it("hides the body when disabled", () => {
    setup({ ram: false });

    expect(screen.getByRole("switch", { name: "Enable RAM storage" })).not.toBeChecked();
    expect(screen.queryByLabelText("RAM storage name")).not.toBeInTheDocument();
  });

  it("appends a RAM storage entry when toggled on", async () => {
    const { getValues } = setup({ ram: false });

    await userEvent.click(screen.getByRole("switch", { name: "Enable RAM storage" }));

    const storage = getValues().services[0].profile.storage;
    expect(storage).toHaveLength(2);
    expect(storage[1]).toMatchObject({ type: "ram", name: "shm", mount: "/dev/shm" });
    expect(screen.getByLabelText("RAM storage name")).toHaveValue("shm");
  });

  it("removes the RAM storage entry when toggled off", async () => {
    const { getValues } = setup({ ram: true });

    await userEvent.click(screen.getByRole("switch", { name: "Enable RAM storage" }));

    expect(getValues().services[0].profile.storage).toHaveLength(1);
    expect(getValues().services[0].profile.storage.some(s => s.type === "ram")).toBe(false);
  });

  it("edits the RAM storage name", async () => {
    const { getValues } = setup({ ram: true });

    const input = screen.getByLabelText("RAM storage name");
    await userEvent.clear(input);
    await userEvent.type(input, "cache");

    expect(getValues().services[0].profile.storage.find(s => s.type === "ram")?.name).toBe("cache");
  });

  it("does not render a type select or read only checkbox", () => {
    setup({ ram: true });

    expect(screen.queryByRole("combobox", { name: "Storage type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Read only" })).not.toBeInTheDocument();
  });

  it("does not offer an add-more or remove control", () => {
    setup({ ram: true });

    expect(screen.queryByRole("button", { name: "Add more" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });

  it("only removes the RAM entry, leaving persistent storage untouched", async () => {
    const { getValues } = setup({ storage: [EPHEMERAL, { ...PERSISTENT }, { ...RAM }] });

    await userEvent.click(screen.getByRole("switch", { name: "Enable RAM storage" }));

    const storage = getValues().services[0].profile.storage;
    expect(storage).toHaveLength(2);
    expect(storage.some(s => s.type === "ram")).toBe(false);
    expect(storage.some(s => s.isPersistent)).toBe(true);
  });

  it("binds the body to the RAM entry even when persistent storage precedes it", () => {
    setup({ storage: [EPHEMERAL, { ...PERSISTENT }, { ...RAM, name: "shm" }] });

    expect(screen.getByLabelText("RAM storage name")).toHaveValue("shm");
  });

  it("shows a uniqueness error under the name input when the RAM name collides with a persistent name", async () => {
    const { trigger } = setupValidated([EPHEMERAL, { ...PERSISTENT, name: "shared" }, { ...RAM, name: "shared" }]);

    await trigger();

    await waitFor(() => {
      expect(screen.getByText("Storage name must be unique")).toBeInTheDocument();
    });
  });

  it("shows a uniqueness error under the mount input when the RAM mount collides with a persistent mount", async () => {
    const { trigger } = setupValidated([EPHEMERAL, { ...PERSISTENT, name: "data", mount: "/shared" }, { ...RAM, name: "shm", mount: "/shared" }]);

    await trigger();

    await waitFor(() => {
      expect(screen.getByText("Storage mount must be unique")).toBeInTheDocument();
    });
  });

  it("shows a size error under the storage input when the RAM size is missing", async () => {
    const { trigger } = setupValidated([EPHEMERAL, { ...PERSISTENT, name: "data", mount: "/mnt/data" }, { ...RAM, size: 0 }]);

    await trigger();

    await waitFor(() => {
      expect(screen.getByText("Storage is required.")).toBeInTheDocument();
    });
  });

  it("shows an off-state hint instead of fields when opened while off and locked", async () => {
    setup({ ram: false, locked: true });

    await userEvent.click(screen.getByRole("button", { name: "Expand RAM Storage" }));

    expect(screen.getByText("RAM storage is off.")).toBeInTheDocument();
    expect(screen.queryByLabelText("RAM storage name")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable RAM storage" })).toBeDisabled();
  });

  it("does not add a RAM volume when an off card is opened", async () => {
    const { getValues } = setup({ ram: false, locked: true });

    await userEvent.click(screen.getByRole("button", { name: "Expand RAM Storage" }));

    expect(getValues().services[0].profile.storage).toHaveLength(1);
    expect(getValues().services[0].profile.storage.some(s => s.type === "ram")).toBe(false);
  });

  it("disables the RAM fields while the pane is locked", () => {
    setup({ ram: true, locked: true });

    expect(screen.getByRole("switch", { name: "Enable RAM storage" })).toBeDisabled();
    expect(screen.getByLabelText("RAM storage name")).toBeDisabled();
    expect(screen.getByLabelText("RAM storage mount")).toBeDisabled();
    expect(screen.getByLabelText("RAM storage")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "RAM storage unit" })).toBeDisabled();
  });

  it("keeps the RAM fields editable while unlocked", async () => {
    const { getValues } = setup({ ram: true });

    const input = screen.getByLabelText("RAM storage name");
    expect(input).toBeEnabled();
    await userEvent.clear(input);
    await userEvent.type(input, "cache");
    expect(getValues().services[0].profile.storage.find(s => s.type === "ram")?.name).toBe("cache");
  });

  function setup(input: { ram?: boolean; locked?: boolean; storage?: SdlBuilderFormValuesType["services"][number]["profile"]["storage"] }) {
    const storage = input.storage ?? (input.ram ? [EPHEMERAL, { ...RAM }] : [EPHEMERAL]);

    const values = defaultServiceWithPlacement({
      profile: { cpu: 0.5, gpu: 1, gpuModels: [{ vendor: "nvidia" }], hasGpu: false, ram: 256, ramUnit: "Mi", storage }
    });

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange" });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <RamStorageCard serviceIndex={0} locked={input.locked} dependencies={{ ...DEPENDENCIES }} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }

  function setupValidated(storage: SdlBuilderFormValuesType["services"][number]["profile"]["storage"]) {
    const values = defaultServiceWithPlacement({
      image: "nginx:latest",
      profile: { cpu: 0.5, gpu: 1, gpuModels: [{ vendor: "nvidia" }], hasGpu: false, ram: 256, ramUnit: "Mi", storage }
    });

    let trigger: () => Promise<boolean> = async () => true;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange", resolver: zodResolver(SdlBuilderFormValuesSchema) });
      trigger = () => form.trigger();
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <RamStorageCard serviceIndex={0} dependencies={{ ...DEPENDENCIES }} />
      </Wrapper>
    );

    return { trigger: () => trigger() };
  }
});
