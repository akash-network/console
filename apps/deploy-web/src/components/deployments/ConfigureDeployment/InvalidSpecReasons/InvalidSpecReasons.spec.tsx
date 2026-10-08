import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { InvalidSpecReasons } from "./InvalidSpecReasons";

import { act, render, screen, within } from "@testing-library/react";

describe(InvalidSpecReasons.name, () => {
  it("lists what the form refuses before any field is touched", () => {
    setup({ service: { title: "tetris", hasCredentials: true, credentials: { host: "docker.io", username: "", password: "" } } });

    const reasons = within(screen.getByRole("list", { name: "Settings to fix" })).getAllByRole("listitem");

    expect(screen.getByText("Fix these to see which providers can host your deployment:")).toBeInTheDocument();
    expect(reasons.map(reason => reason.textContent)).toEqual([
      "tetris: Registry username is required.",
      "tetris: Registry password must be at least 6 characters."
    ]);
  });

  it("drops a reason as soon as the user fixes it", () => {
    const { form } = setup({ service: { title: "tetris", hasCredentials: true, credentials: { host: "docker.io", username: "", password: "" } } });

    act(() => form().setValue("services.0.credentials.username", "alice"));

    expect(screen.queryByText("tetris: Registry username is required.")).not.toBeInTheDocument();
    expect(screen.getByText("tetris: Registry password must be at least 6 characters.")).toBeInTheDocument();
  });

  it("asks the user to check the settings when the form names nothing to fix", () => {
    setup({ service: { title: "tetris" } });

    expect(screen.getByText("Some settings aren't valid yet. Check them to see which providers can host your deployment.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  function setup(input: { service: Partial<ServiceType> }) {
    const values = defaultServiceWithPlacement({ image: "nginx:latest", ...input.service });

    let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <InvalidSpecReasons />
      </Wrapper>
    );

    return { form: () => form! };
  }
});
