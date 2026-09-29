import type { FieldErrors } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";

/** Each message names the service or placement it belongs to, because the form lists several with the same fields. */
export function listInvalidFieldMessages(values: SdlBuilderFormValuesType, errors: FieldErrors<SdlBuilderFormValuesType>): string[] {
  const messages = Object.entries(errors).flatMap(([field, error]) => {
    if (field === "services") return messagesByEntry(error, index => values.services?.[index]?.title);
    if (field === "placements") return messagesByEntry(error, index => values.placements?.[index]?.name);
    return collectMessages(error);
  });

  return [...new Set(messages)];
}

function messagesByEntry(errors: unknown, entryName: (index: number) => string | undefined): string[] {
  if (!isRecord(errors)) return [];

  const entryMessages = childErrors(errors).flatMap(([key, error]) => {
    const name = /^\d+$/.test(key) ? entryName(Number(key)) : undefined;
    return collectMessages(error).map(message => (name ? `${name}: ${message}` : message));
  });

  return [...ownMessage(errors), ...entryMessages];
}

function collectMessages(error: unknown): string[] {
  if (!isRecord(error)) return [];

  return [...ownMessage(error), ...childErrors(error).flatMap(([, child]) => collectMessages(child))];
}

function ownMessage(error: Record<string, unknown>): string[] {
  return typeof error.message === "string" && error.message ? [error.message] : [];
}

/** A field error's `ref` is the registered DOM element, whose React-internal properties cycle back into the tree. */
function childErrors(error: Record<string, unknown>): [string, unknown][] {
  return Object.entries(error).filter(([key]) => key !== "ref");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
