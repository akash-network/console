import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { InlineEditInput } from "./inline-edit-input";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

interface FormValues {
  title: string;
}

describe("InlineEditInput", () => {
  it("commits the draft on Enter", async () => {
    const { getValue } = setup({ initialValue: "service-1" });
    const input = screen.getByRole("textbox", { name: "Title" });

    await userEvent.clear(input);
    await userEvent.type(input, "api{Enter}");

    expect(getValue()).toBe("api");
  });

  it("commits exactly once on Enter", async () => {
    const { subscribeToValueChanges } = setup({ initialValue: "service-1" });
    const input = screen.getByRole("textbox", { name: "Title" });

    await userEvent.clear(input);
    await userEvent.type(input, "api");
    const onValueChange = subscribeToValueChanges();
    await userEvent.keyboard("{Enter}");

    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("commits the draft on blur", async () => {
    const { getValue } = setup({ initialValue: "service-1" });
    const input = screen.getByRole("textbox", { name: "Title" });

    await userEvent.clear(input);
    await userEvent.type(input, "api");
    await userEvent.tab();

    expect(getValue()).toBe("api");
  });

  it("restores the committed value on Escape", async () => {
    const { getValue } = setup({ initialValue: "service-1" });
    const input = screen.getByRole("textbox", { name: "Title" });

    await userEvent.clear(input);
    await userEvent.type(input, "draft-name{Escape}");

    expect(getValue()).toBe("service-1");
    expect(input).toHaveValue("service-1");
  });

  it("renders the field error beneath the input", async () => {
    const { setError } = setup({ initialValue: "service-1" });

    act(() => {
      setError("Invalid name.");
    });

    expect(await screen.findByText("Invalid name.")).toBeInTheDocument();
  });

  function setup(input: { initialValue: string }) {
    let values: FormValues = { title: input.initialValue };
    const formRef: { current?: UseFormReturn<FormValues> } = {};
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<FormValues>({ defaultValues: { title: input.initialValue }, mode: "onChange" });
      values = form.watch();
      formRef.current = form;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <InlineEditInput name="title" label="Title" />
      </Wrapper>
    );

    return {
      getValue: () => values.title,
      setError: (message: string) => formRef.current?.setError("title", { message }),
      subscribeToValueChanges: () => {
        const onValueChange = vi.fn();
        formRef.current?.watch(onValueChange);
        return onValueChange;
      }
    };
  }
});
