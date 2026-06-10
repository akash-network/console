import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { EndpointRow } from "./EndpointRow";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("EndpointRow", () => {
  it("renders the endpoint name in an editable field", () => {
    setup({});

    expect(screen.getByRole("textbox", { name: "Endpoint name" })).toHaveValue("endpoint-1");
  });

  it("removes the endpoint", async () => {
    const { onRemove } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Remove endpoint-1" }));

    expect(onRemove).toHaveBeenCalled();
  });

  function setup(input: { name?: string }) {
    const name = input.name ?? "endpoint-1";
    const values: SdlBuilderFormValuesType = { ...defaultServiceWithPlacement(), endpoints: [{ id: "e-1", name }] };
    const onRemove = vi.fn();
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ul aria-label="IP endpoints">
          <EndpointRow endpoint={values.endpoints![0]} endpointIndex={0} onRemove={onRemove} />
        </ul>
      </Wrapper>
    );

    return { onRemove };
  }
});
