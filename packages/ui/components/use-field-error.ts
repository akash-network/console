"use client";
import { useFormContext } from "react-hook-form";

/**
 * Returns the validation error message for the field named `name` from the
 * surrounding react-hook-form context, or undefined when the field is valid.
 * Lets a consumer drive its own error UI (border, message placement) without
 * re-binding the field as a Controller. Must be used within a FormProvider.
 */
export function useFieldError(name: string): { error?: string } {
  const { getFieldState, formState } = useFormContext();
  const { error } = getFieldState(name, formState);
  return { error: error?.message };
}
