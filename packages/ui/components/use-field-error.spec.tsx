import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { useFieldError } from "./use-field-error";

import { act, renderHook } from "@testing-library/react";

interface FormValues {
  title: string;
}

describe("useFieldError", () => {
  it("returns undefined when the field has no error", () => {
    const { result } = setup();

    expect(result.current.error).toBeUndefined();
  });

  it("returns the error message once the field is set in error", () => {
    const { result, formRef } = setup();

    act(() => formRef.current?.setError("title", { message: "Invalid name." }));

    expect(result.current.error).toBe("Invalid name.");
  });

  function setup() {
    const formRef: { current?: UseFormReturn<FormValues> } = {};
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<FormValues>({ defaultValues: { title: "service-1" } });
      formRef.current = form;
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    return { ...renderHook(() => useFieldError("title"), { wrapper: Wrapper }), formRef };
  }
});
