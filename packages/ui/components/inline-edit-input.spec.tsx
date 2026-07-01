import type { PropsWithChildren } from "react";
import type { Resolver, UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { InlineEditInput } from "./inline-edit-input";

import { act, render, screen, waitFor } from "@testing-library/react";
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

  it("renders its own error message beneath the input by default", () => {
    const { setError, getInput } = setup({ initialValue: "service-1" });

    act(() => {
      setError("Invalid name.");
    });

    const input = getInput();
    expect(input).toHaveClass("text-destructive");
    expect(screen.getByText("Invalid name.")).toBeInTheDocument();
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent("Invalid name.");
  });

  it("suppresses its own message and links the external id when suppressErrorMessage is set", () => {
    const { setError, getInput } = setup({ initialValue: "service-1", suppressErrorMessage: true, errorMessageId: "err-1" });

    act(() => {
      setError("Invalid name.");
    });

    expect(getInput()).toHaveAttribute("aria-describedby", "err-1");
    expect(getInput()).toHaveClass("text-destructive");
    expect(screen.queryByText("Invalid name.")).not.toBeInTheDocument();
  });

  it("does not link or render an error while the field is valid", () => {
    const { getInput } = setup({ initialValue: "service-1" });

    expect(getInput()).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Invalid name.")).not.toBeInTheDocument();
  });

  it("signals the field blur so onTouched validation runs when the field is left", async () => {
    const resolver: Resolver<FormValues> = async values => ({ values, errors: { title: { type: "manual", message: "Invalid name." } } });
    const { getInput } = setup({ initialValue: "service-1", mode: "onTouched", resolver });

    expect(getInput()).not.toHaveClass("text-destructive");

    await userEvent.click(getInput());
    await userEvent.tab();

    await waitFor(() => expect(getInput()).toHaveClass("text-destructive"));
  });

  function setup(input: { initialValue: string; suppressErrorMessage?: boolean; errorMessageId?: string; mode?: "onChange" | "onTouched"; resolver?: Resolver<FormValues> }) {
    let values: FormValues = { title: input.initialValue };
    const formRef: { current?: UseFormReturn<FormValues> } = {};
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<FormValues>({ defaultValues: { title: input.initialValue }, mode: input.mode ?? "onChange", resolver: input.resolver });
      values = form.watch();
      formRef.current = form;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <InlineEditInput name="title" label="Title" suppressErrorMessage={input.suppressErrorMessage} errorMessageId={input.errorMessageId} />
      </Wrapper>
    );

    return {
      getValue: () => values.title,
      getInput: () => screen.getByRole("textbox", { name: "Title" }),
      setError: (message: string) => formRef.current?.setError("title", { message }),
      subscribeToValueChanges: () => {
        const onValueChange = vi.fn();
        formRef.current?.watch(onValueChange);
        return onValueChange;
      }
    };
  }
});
