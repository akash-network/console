import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { ConfigurationPane } from "./ConfigurationPane";

import { render, screen } from "@testing-library/react";

describe("ConfigurationPane", () => {
  it("shows the selected service title", () => {
    const values = defaultServiceWithPlacement({ title: "api" });
    setup({ values, selectedServiceId: values.services[0].id as string });

    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("shows no target when nothing is selected", () => {
    const values = defaultServiceWithPlacement({ title: "api" });
    setup({ values, selectedServiceId: null });

    expect(screen.queryByText("api")).not.toBeInTheDocument();
  });

  function setup(input: { values: SdlBuilderFormValuesType; selectedServiceId: string | null }) {
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: input.values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    return render(
      <Wrapper>
        <ConfigurationPane selectedServiceId={input.selectedServiceId} />
      </Wrapper>
    );
  }
});
