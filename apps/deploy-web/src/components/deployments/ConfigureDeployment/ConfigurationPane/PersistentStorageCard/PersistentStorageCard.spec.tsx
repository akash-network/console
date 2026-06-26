import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, PersistentStorageCard } from "./PersistentStorageCard";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const EPHEMERAL = { size: 1, unit: "Gi", isPersistent: false, type: "beta2" };
const PERSISTENT = { size: 10, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/data", isReadOnly: false };
const RAM = { size: 10, unit: "Gi", isPersistent: false, type: "ram", name: "shm", mount: "/dev/shm", isReadOnly: false };

describe(PersistentStorageCard.name, () => {
  it("hides the body when disabled", () => {
    setup({ count: 0 });

    expect(screen.getByRole("switch", { name: "Enable persistent storage" })).not.toBeChecked();
    expect(screen.queryByLabelText("Storage name")).not.toBeInTheDocument();
  });

  it("appends a persistent storage entry when toggled on", async () => {
    const { getValues } = setup({ count: 0 });

    await userEvent.click(screen.getByRole("switch", { name: "Enable persistent storage" }));

    const storage = getValues().services[0].profile.storage;
    expect(storage).toHaveLength(2);
    expect(storage[1]).toMatchObject({ isPersistent: true, type: "beta3", name: "data", mount: "/mnt/data" });
    expect(screen.getByLabelText("Storage name")).toHaveValue("data");
  });

  it("only offers persistent storage types", async () => {
    setup({ count: 1 });

    await userEvent.click(screen.getByRole("combobox", { name: "Storage type" }));

    expect(screen.getByRole("option", { name: "NVMe" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "RAM" })).not.toBeInTheDocument();
  });

  it("removes every persistent storage entry when toggled off", async () => {
    const { getValues } = setup({ count: 2 });

    await userEvent.click(screen.getByRole("switch", { name: "Enable persistent storage" }));

    expect(getValues().services[0].profile.storage).toHaveLength(1);
  });

  it("edits the persistent storage name", async () => {
    const { getValues } = setup({ count: 1 });

    const input = screen.getByLabelText("Storage name");
    await userEvent.clear(input);
    await userEvent.type(input, "data");

    expect(getValues().services[0].profile.storage[1].name).toBe("data");
  });

  it("toggles the read only flag for a persistent entry", async () => {
    const { getValues } = setup({ count: 1 });

    await userEvent.click(within(screen.getByRole("group", { name: "Persistent Storage 1" })).getByRole("checkbox", { name: "Read only" }));

    expect(getValues().services[0].profile.storage[1].isReadOnly).toBe(true);
  });

  it("appends another persistent entry when plus button is clicked", async () => {
    const { getValues } = setup({ count: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Add persistent storage" }));

    expect(await screen.findByRole("group", { name: "Persistent Storage 2" })).toBeInTheDocument();
    expect(getValues().services[0].profile.storage).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Remove Persistent Storage 2" })).toBeInTheDocument();
  });

  it("increments the default name and mount when 'data' is already taken", async () => {
    const { getValues } = setup({ count: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Add persistent storage" }));

    expect(getValues().services[0].profile.storage[2]).toMatchObject({ name: "data-1", mount: "/mnt/data-1" });
  });

  it("keeps incrementing past 'data-1' to the next free name and mount", async () => {
    const { getValues } = setup({
      storage: [EPHEMERAL, { ...PERSISTENT, name: "data", mount: "/mnt/data" }, { ...PERSISTENT, name: "data-1", mount: "/mnt/data-1" }]
    });

    await userEvent.click(screen.getByRole("button", { name: "Add persistent storage" }));

    expect(getValues().services[0].profile.storage[3]).toMatchObject({ name: "data-2", mount: "/mnt/data-2" });
  });

  it("defaults a new entry against live edited names, not the stale field-array snapshot", async () => {
    const { getValues } = setup({ count: 1 });

    const nameInput = screen.getByLabelText("Storage name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "renamed");
    const mountInput = screen.getByLabelText("Storage mount");
    await userEvent.clear(mountInput);
    await userEvent.type(mountInput, "/mnt/renamed");

    await userEvent.click(screen.getByRole("button", { name: "Add persistent storage" }));

    expect(getValues().services[0].profile.storage[2]).toMatchObject({ name: "data", mount: "/mnt/data" });
  });

  it("avoids a RAM volume's name and mount when defaulting a new persistent entry", async () => {
    const { getValues } = setup({ storage: [EPHEMERAL, { ...RAM, name: "data", mount: "/mnt/data" }] });

    await userEvent.click(screen.getByRole("switch", { name: "Enable persistent storage" }));

    expect(getValues().services[0].profile.storage.find(s => s.isPersistent)).toMatchObject({ name: "data-1", mount: "/mnt/data-1" });
  });

  it("does not offer a remove control when only one persistent entry exists", () => {
    setup({ count: 1 });

    expect(screen.queryByRole("button", { name: "Remove Persistent Storage 1" })).not.toBeInTheDocument();
  });

  it("offers a remove control on every entry, including the first, when more than one exists", () => {
    setup({ count: 2 });

    expect(screen.getByRole("button", { name: "Remove Persistent Storage 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Persistent Storage 2" })).toBeInTheDocument();
  });

  it("removes the first persistent entry", async () => {
    const { getValues } = setup({ storage: [EPHEMERAL, { ...PERSISTENT, name: "first" }, { ...PERSISTENT, name: "second" }] });

    await userEvent.click(screen.getByRole("button", { name: "Remove Persistent Storage 1" }));

    const storage = getValues().services[0].profile.storage;
    expect(storage).toHaveLength(2);
    expect(screen.getByLabelText("Storage name")).toHaveValue("second");
  });

  it("removes a non-first persistent entry", async () => {
    const { getValues } = setup({ count: 2 });

    await userEvent.click(screen.getByRole("button", { name: "Remove Persistent Storage 2" }));

    const storage = getValues().services[0].profile.storage;
    expect(storage).toHaveLength(2);
    expect(screen.queryByRole("group", { name: "Persistent Storage 2" })).not.toBeInTheDocument();
  });

  it("hides the remove control again once a single entry remains", async () => {
    setup({ count: 2 });

    await userEvent.click(screen.getByRole("button", { name: "Remove Persistent Storage 2" }));

    expect(screen.queryByRole("button", { name: /Remove Persistent Storage/ })).not.toBeInTheDocument();
  });

  it("renders each persistent entry bound to its own storage", () => {
    setup({
      storage: [EPHEMERAL, { ...PERSISTENT, name: "first" }, { ...PERSISTENT, name: "second" }]
    });

    const first = screen.getByRole("group", { name: "Persistent Storage 1" });
    const second = screen.getByRole("group", { name: "Persistent Storage 2" });
    expect(within(first).getByLabelText("Storage name")).toHaveValue("first");
    expect(within(second).getByLabelText("Storage name")).toHaveValue("second");
  });

  it("ignores RAM entries and stays disabled when only a RAM volume exists", () => {
    setup({ storage: [EPHEMERAL, { ...RAM }] });

    expect(screen.getByRole("switch", { name: "Enable persistent storage" })).not.toBeChecked();
    expect(screen.queryByRole("group", { name: "Persistent Storage 1" })).not.toBeInTheDocument();
  });

  it("renders only the persistent entry when a RAM volume is also present", () => {
    setup({ storage: [EPHEMERAL, { ...RAM }, { ...PERSISTENT, name: "data" }] });

    expect(screen.getByRole("group", { name: "Persistent Storage 1" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Persistent Storage 2" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Storage name")).toHaveValue("data");
  });

  it("removes only persistent entries when toggled off, leaving the RAM volume", async () => {
    const { getValues } = setup({ storage: [EPHEMERAL, { ...RAM }, { ...PERSISTENT }] });

    await userEvent.click(screen.getByRole("switch", { name: "Enable persistent storage" }));

    const storage = getValues().services[0].profile.storage;
    expect(storage).toHaveLength(2);
    expect(storage.some(s => s.type === "ram")).toBe(true);
    expect(storage.some(s => s.isPersistent)).toBe(false);
  });

  it("shows the card collapsed with the chevron visible when disabled", () => {
    setup({ count: 0 });

    expect(screen.getByRole("button", { name: "Expand Persistent Storage" })).toBeInTheDocument();
  });

  it("keeps configured values after collapsing and expanding while enabled", async () => {
    setup({ count: 1 });

    const nameInput = screen.getByLabelText("Storage name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "data");

    await userEvent.click(screen.getByRole("button", { name: "Collapse Persistent Storage" }));
    expect(screen.queryByLabelText("Storage name")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expand Persistent Storage" }));

    expect(screen.getByLabelText("Storage name")).toHaveValue("data");
  });

  it("re-expands the fields when toggled on after being collapsed", async () => {
    setup({ count: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Collapse Persistent Storage" }));
    expect(screen.queryByLabelText("Storage name")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "Enable persistent storage" }));
    await userEvent.click(screen.getByRole("switch", { name: "Enable persistent storage" }));

    expect(screen.getByLabelText("Storage name")).toBeInTheDocument();
  });

  it("shows an off-state hint instead of fields when opened while off and locked", async () => {
    const { getValues } = setup({ count: 0, locked: true });

    await userEvent.click(screen.getByRole("button", { name: "Expand Persistent Storage" }));

    expect(screen.getByText("Persistent storage is off.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Storage name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add persistent storage" })).not.toBeInTheDocument();
    expect(getValues().services[0].profile.storage).toHaveLength(1);
  });

  it("disables every persistent field and the add and remove controls while locked", () => {
    setup({ count: 2, locked: true });

    expect(screen.getByRole("switch", { name: "Enable persistent storage" })).toBeDisabled();
    const group = screen.getByRole("group", { name: "Persistent Storage 1" });
    expect(within(group).getByLabelText("Storage name")).toBeDisabled();
    expect(within(group).getByLabelText("Storage mount")).toBeDisabled();
    expect(within(group).getByLabelText("Persistent storage")).toBeDisabled();
    expect(within(group).getByRole("combobox", { name: "Storage type" })).toBeDisabled();
    expect(within(group).getByRole("checkbox", { name: "Read only" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add persistent storage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Persistent Storage 1" })).toBeDisabled();
  });

  it("shows a uniqueness error under the name input when two persistent names collide", async () => {
    const { trigger } = setupValidated([EPHEMERAL, { ...PERSISTENT, name: "data", mount: "/mnt/a" }, { ...PERSISTENT, name: "data", mount: "/mnt/b" }]);

    await trigger();

    await waitFor(() => {
      const groups = screen.getAllByRole("group", { name: /Persistent Storage/ });
      expect(within(groups[0]).getByText("Storage name must be unique")).toBeInTheDocument();
      expect(within(groups[1]).getByText("Storage name must be unique")).toBeInTheDocument();
    });
  });

  it("shows a uniqueness error under the mount input when two persistent mounts collide", async () => {
    const { trigger } = setupValidated([
      EPHEMERAL,
      { ...PERSISTENT, name: "data-a", mount: "/mnt/data" },
      { ...PERSISTENT, name: "data-b", mount: "/mnt/data" }
    ]);

    await trigger();

    await waitFor(() => {
      const groups = screen.getAllByRole("group", { name: /Persistent Storage/ });
      expect(within(groups[0]).getByText("Storage mount must be unique")).toBeInTheDocument();
      expect(within(groups[1]).getByText("Storage mount must be unique")).toBeInTheDocument();
    });
  });

  it("shows a size error under the storage input when the size is missing", async () => {
    const { trigger } = setupValidated([EPHEMERAL, { ...PERSISTENT, size: 0 }]);

    await trigger();

    await waitFor(() => {
      expect(screen.getByText("Storage is required.")).toBeInTheDocument();
    });
  });

  it("shows a type error under the type select when the type is missing", async () => {
    const { trigger } = setupValidated([EPHEMERAL, { ...PERSISTENT, type: "" }]);

    await trigger();

    await waitFor(() => {
      expect(screen.getByText("Storage type is required")).toBeInTheDocument();
    });
  });

  function setup(input: { count?: number; locked?: boolean; storage?: SdlBuilderFormValuesType["services"][number]["profile"]["storage"] }) {
    const storage = input.storage ?? [EPHEMERAL, ...Array.from({ length: input.count ?? 0 }, () => ({ ...PERSISTENT }))];

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
        <PersistentStorageCard serviceIndex={0} locked={input.locked} dependencies={{ ...DEPENDENCIES }} />
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
        <PersistentStorageCard serviceIndex={0} dependencies={{ ...DEPENDENCIES }} />
      </Wrapper>
    );

    return { trigger: () => trigger() };
  }
});
