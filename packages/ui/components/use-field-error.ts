"use client";
import { useFormContext, useFormState } from "react-hook-form";

/**
 * Returns the validation error message for the field named `name` from the
 * surrounding react-hook-form context, or undefined when the field is valid.
 * Lets a consumer drive its own error UI (border, message placement) without
 * re-binding the field as a Controller. Must be used within a FormProvider.
 *
 * Subscribes via `useFormState({ name })` so the consumer re-renders when this
 * field's error changes. Reading `getFieldState` against the context formState
 * alone does not establish that subscription, so errors would otherwise only
 * surface on an unrelated re-render.
 */
export function useFieldError(name: string): { error?: string } {
  const { getFieldState } = useFormContext();
  const formState = useFormState();
  const { error } = getFieldState(name, formState);
  return { error: error?.message };
}
