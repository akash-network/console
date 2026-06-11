import type { PropsWithChildren } from "react";
import type { Path } from "react-hook-form";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { useRevalidateUniqueness } from "./useRevalidateUniqueness";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

type FieldArrayName = "placements" | "services" | "endpoints";

describe(useRevalidateUniqueness.name, () => {
  it("shows the uniqueness error on every conflicting endpoint row, not just the last", async () => {
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
    await waitFor(() => expect(screen.getAllByText("Placement name must be unique.")).toHaveLength(2));

    editRow("placements", 0, "dcloud-3");

    await waitFor(() => {
      expect(screen.queryByText("Placement name must be unique.")).not.toBeInTheDocument();
    });
  });

  function duplicateSecondRowOnto(name: FieldArrayName, value: string) {
    editRow(name, 1, value);
  }

  function editRow(name: FieldArrayName, index: number, value: string) {
    const input = screen.getByLabelText(`${name}-${index}`);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
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
        mode: "onChange",
        resolver: zodResolver(SdlBuilderFormValuesSchema)
      });
      return <FormProvider {...form}>{children}</FormProvider>;
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
