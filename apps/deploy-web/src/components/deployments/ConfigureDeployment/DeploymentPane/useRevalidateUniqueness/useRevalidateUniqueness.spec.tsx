import type { PropsWithChildren } from "react";
import type { Path } from "react-hook-form";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { storageUniquenessKey } from "../../ConfigurationPane/HardwareSection/HardwareSection";
import { useRevalidateUniqueness } from "./useRevalidateUniqueness";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

type FieldArrayName = "placements" | "services" | "endpoints";

describe(useRevalidateUniqueness.name, () => {
  it("does not surface validation errors before the form is submitted", () => {
    setup({
      name: "endpoints",
      subField: "name",
      values: {
        ...defaultServiceWithPlacement(),
        endpoints: [{ id: "e-1", name: "" }]
      }
    });

    expect(screen.queryByText("Endpoint name is required.")).not.toBeInTheDocument();
  });

  it("shows the uniqueness error on every conflicting endpoint row after submit, not just the last", async () => {
    setup({
      name: "endpoints",
      subField: "name",
      values: {
        ...defaultServiceWithPlacement(),
        endpoints: [
          { id: "e-1", name: "endpoint-1" },
          { id: "e-2", name: "endpoint-2" }
        ]
      }
    });
    duplicateSecondRowOnto("endpoints", "endpoint-1");

    submitForm();

    await waitFor(() => {
      expect(screen.getAllByText("Endpoint name must be unique.")).toHaveLength(2);
    });
  });

  it("clears the stale error on a sibling endpoint row once the conflict is resolved elsewhere", async () => {
    setup({
      name: "endpoints",
      subField: "name",
      values: {
        ...defaultServiceWithPlacement(),
        endpoints: [
          { id: "e-1", name: "endpoint-1" },
          { id: "e-2", name: "endpoint-2" }
        ]
      }
    });
    duplicateSecondRowOnto("endpoints", "endpoint-1");
    submitForm();
    await waitFor(() => expect(screen.getAllByText("Endpoint name must be unique.")).toHaveLength(2));

    editRow("endpoints", 0, "endpoint-3");

    await waitFor(() => {
      expect(screen.queryByText("Endpoint name must be unique.")).not.toBeInTheDocument();
    });
  });

  it("clears the stale error on a sibling placement row once the conflict is resolved elsewhere", async () => {
    setup({
      name: "placements",
      subField: "name",
      values: {
        ...defaultServiceWithPlacement(),
        placements: [
          { id: "p-1", name: "dcloud" },
          { id: "p-2", name: "dcloud-2" }
        ]
      }
    });
    duplicateSecondRowOnto("placements", "dcloud");
    submitForm();
    await waitFor(() => expect(screen.getAllByText("Placement name must be unique.")).toHaveLength(2));

    editRow("placements", 0, "dcloud-3");

    await waitFor(() => {
      expect(screen.queryByText("Placement name must be unique.")).not.toBeInTheDocument();
    });
  });

  it("shows the uniqueness error on every conflicting storage row when names collide", async () => {
    setupStorage([
      { size: 1, unit: "Gi", isPersistent: false, type: "beta2" },
      { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/a" },
      { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data-2", mount: "/mnt/b" }
    ]);

    const secondNameInput = screen.getByLabelText("storage-2-name");
    fireEvent.change(secondNameInput, { target: { value: "data" } });
    fireEvent.blur(secondNameInput);

    submitForm();

    await waitFor(() => {
      expect(screen.getAllByText("Storage name must be unique")).toHaveLength(2);
    });
  });

  it("clears the stale error on a sibling storage row once the conflict is resolved elsewhere", async () => {
    setupStorage([
      { size: 1, unit: "Gi", isPersistent: false, type: "beta2" },
      { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/a" },
      { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/b" }
    ]);

    submitForm();

    await waitFor(() => expect(screen.getAllByText("Storage name must be unique")).toHaveLength(2));

    const firstNameInput = screen.getByLabelText("storage-1-name");
    fireEvent.change(firstNameInput, { target: { value: "data-renamed" } });
    fireEvent.blur(firstNameInput);

    await waitFor(() => {
      expect(screen.queryByText("Storage name must be unique")).not.toBeInTheDocument();
    });
  });

  it("shows the uniqueness error on every conflicting storage row when mounts collide", async () => {
    setupStorage([
      { size: 1, unit: "Gi", isPersistent: false, type: "beta2" },
      { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data-a", mount: "/mnt/data" },
      { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data-b", mount: "/mnt/other" }
    ]);

    const secondMountInput = screen.getByLabelText("storage-2-mount");
    fireEvent.change(secondMountInput, { target: { value: "/mnt/data" } });
    fireEvent.blur(secondMountInput);

    submitForm();

    await waitFor(() => {
      expect(screen.getAllByText("Storage mount must be unique")).toHaveLength(2);
    });
  });

  it("clears the stale mount error on a sibling storage row once the conflict is resolved elsewhere", async () => {
    setupStorage([
      { size: 1, unit: "Gi", isPersistent: false, type: "beta2" },
      { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data-a", mount: "/mnt/data" },
      { size: 1, unit: "Gi", isPersistent: true, type: "beta3", name: "data-b", mount: "/mnt/data" }
    ]);

    submitForm();

    await waitFor(() => expect(screen.getAllByText("Storage mount must be unique")).toHaveLength(2));

    const firstMountInput = screen.getByLabelText("storage-1-mount");
    fireEvent.change(firstMountInput, { target: { value: "/mnt/data-renamed" } });
    fireEvent.blur(firstMountInput);

    await waitFor(() => {
      expect(screen.queryByText("Storage mount must be unique")).not.toBeInTheDocument();
    });
  });

  function duplicateSecondRowOnto(name: FieldArrayName, value: string) {
    editRow(name, 1, value);
  }

  function submitForm() {
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form") as HTMLFormElement);
  }

  function editRow(name: FieldArrayName, index: number, value: string) {
    const input = screen.getByLabelText(`${name}-${index}`);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  }

  function setupStorage(storage: SdlBuilderFormValuesType["services"][number]["profile"]["storage"]) {
    const values = defaultServiceWithPlacement({
      image: "nginx:latest",
      profile: { cpu: 0.5, gpu: 1, gpuModels: [{ vendor: "nvidia" }], hasGpu: false, ram: 256, ramUnit: "Mi", storage }
    });
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: values,
        mode: "onSubmit",
        reValidateMode: "onChange",
        resolver: zodResolver(SdlBuilderFormValuesSchema)
      });
      return (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(() => undefined)}>
            {children}
            <button type="submit">submit</button>
          </form>
        </FormProvider>
      );
    };
    render(
      <Wrapper>
        <StorageHarness serviceIndex={0} />
      </Wrapper>
    );
  }

  function setup<TName extends FieldArrayName>(input: {
    name: TName;
    subField: string;
    values: SdlBuilderFormValuesType;
    selectKey?: (item: SdlBuilderFormValuesType[TName][number]) => string;
  }) {
    const selectKey = input.selectKey ?? ((item: Record<string, unknown>) => String(item[input.subField]));
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: input.values,
        mode: "onSubmit",
        reValidateMode: "onChange",
        resolver: zodResolver(SdlBuilderFormValuesSchema)
      });
      return (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(() => undefined)}>
            {children}
            <button type="submit">submit</button>
          </form>
        </FormProvider>
      );
    };
    render(
      <Wrapper>
        <Harness name={input.name} subField={input.subField} selectKey={selectKey as (item: SdlBuilderFormValuesType[TName][number]) => string} />
      </Wrapper>
    );
  }
});

function Harness<TName extends FieldArrayName>({
  name,
  subField,
  selectKey
}: {
  name: TName;
  subField: string;
  selectKey: (item: SdlBuilderFormValuesType[TName][number]) => string;
}) {
  useRevalidateUniqueness(name, selectKey);

  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const items = (useWatch({ control, name }) ?? []) as unknown[];

  return (
    <>
      {items.map((_, index) => (
        <Controller
          key={index}
          control={control}
          name={`${name}.${index}.${subField}` as Path<SdlBuilderFormValuesType>}
          render={({ field, fieldState }) => (
            <div>
              <input aria-label={`${name}-${index}`} value={(field.value as string) ?? ""} onChange={event => field.onChange(event.target.value)} />
              {fieldState.error && <span>{fieldState.error.message}</span>}
            </div>
          )}
        />
      ))}
    </>
  );
}

function StorageHarness({ serviceIndex }: { serviceIndex: number }) {
  useRevalidateUniqueness(`services.${serviceIndex}.profile.storage`, storageUniquenessKey);

  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const items = (useWatch({ control, name: `services.${serviceIndex}.profile.storage` }) ?? []) as unknown[];

  return (
    <>
      {items.map((_, index) => (
        <div key={index}>
          <Controller
            control={control}
            name={`services.${serviceIndex}.profile.storage.${index}.name` as Path<SdlBuilderFormValuesType>}
            render={({ field, fieldState }) => (
              <div>
                <input aria-label={`storage-${index}-name`} value={(field.value as string) ?? ""} onChange={event => field.onChange(event.target.value)} />
                {fieldState.error && <span>{fieldState.error.message}</span>}
              </div>
            )}
          />
          <Controller
            control={control}
            name={`services.${serviceIndex}.profile.storage.${index}.mount` as Path<SdlBuilderFormValuesType>}
            render={({ field, fieldState }) => (
              <div>
                <input aria-label={`storage-${index}-mount`} value={(field.value as string) ?? ""} onChange={event => field.onChange(event.target.value)} />
                {fieldState.error && <span>{fieldState.error.message}</span>}
              </div>
            )}
          />
        </div>
      ))}
    </>
  );
}
