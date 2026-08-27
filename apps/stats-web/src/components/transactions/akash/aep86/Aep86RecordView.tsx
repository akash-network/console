"use client";
import type { ReactNode } from "react";

import type { Aep86DisplayField } from "./aep86Formatting";
import { toAep86DisplayFields } from "./aep86Formatting";

import { AddressLink } from "@/components/AddressLink";
import { DynamicReactJson } from "@/components/DynamicJsonView";
import { LabelValue } from "@/components/LabelValue";

function renderValue(field: Aep86DisplayField): ReactNode {
  if (field.kind === "address") return <AddressLink address={field.value as string} />;
  if (field.kind === "json") return <DynamicReactJson src={field.value as object} />;

  return <span className={field.key.toLowerCase().includes("hash") ? "font-mono" : undefined}>{field.value as string}</span>;
}

export function Aep86RecordView({ data }: { data: unknown }) {
  const fields = toAep86DisplayFields(data);
  if (!fields.length) return <span className="text-muted-foreground">No fields</span>;

  return fields.map(field => <LabelValue key={field.key} label={field.label} value={renderValue(field)} />);
}
