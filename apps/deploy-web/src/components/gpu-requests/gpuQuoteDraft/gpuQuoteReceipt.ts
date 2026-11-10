import type { DraftAnswers, GpuQuoteDraft, QuoteStepId, StartingPoint } from "./gpuQuoteDraft";
import {
  describeContact,
  describeGpus,
  describeGpuTotal,
  describeNetwork,
  describeRegion,
  describeSla,
  describeStart,
  describeStorage,
  describeStorageTotal,
  describeTerm
} from "./gpuQuoteDraft";

export type ReceiptRow = { label: string; value: string | null; detail?: string | null };

export type ReceiptSection = { step: QuoteStepId; rows: ReceiptRow[] };

/** A starting point prints the hardware it answered under its own section, since those answers have no step of their own. */
export function describeReceiptSections(steps: QuoteStepId[], draft: GpuQuoteDraft, startingPoint: StartingPoint | undefined): ReceiptSection[] {
  return steps
    .map(step => ({ step, rows: rowsOfStep(step, draft, startingPoint) }))
    .filter(section => section.rows.length > 0);
}

function rowsOfStep(step: QuoteStepId, draft: GpuQuoteDraft, startingPoint: StartingPoint | undefined): ReceiptRow[] {
  switch (step) {
    case "start":
      return [{ label: "Setup", value: startingPoint?.name ?? null }, ...answeredHardwareRows(draft, startingPoint?.answers ?? {})];
    case "gpu":
      return [gpusRow(draft)];
    case "interconnect":
      return [networkRow(draft)];
    case "region":
      return [{ label: "Region", value: describeRegion(draft) }];
    case "storage":
      return [storageRow(draft)];
    case "sla":
      return [{ label: "SLA", value: describeSla(draft.sla) }];
    case "timing":
      return [
        { label: "Term", value: describeTerm(draft.term) },
        { label: "Start", value: describeStart(draft) }
      ];
    case "contact":
      return contactRows(draft);
    case "review":
      return [];
  }
}

function answeredHardwareRows(draft: GpuQuoteDraft, answers: DraftAnswers): ReceiptRow[] {
  const rows: (ReceiptRow | false)[] = [
    answers.gpuModel !== undefined && gpusRow(draft),
    answers.fabric !== undefined && networkRow(draft),
    answers.storageTbPerNode !== undefined && storageRow(draft)
  ];

  return rows.filter((row): row is ReceiptRow => row !== false);
}

function gpusRow(draft: GpuQuoteDraft): ReceiptRow {
  const gpus = describeGpus(draft);
  return { label: "GPUs", value: gpus, detail: gpus && describeGpuTotal(draft.gpuCount) };
}

function networkRow(draft: GpuQuoteDraft): ReceiptRow {
  return { label: "Network", value: describeNetwork(draft) };
}

function storageRow(draft: GpuQuoteDraft): ReceiptRow {
  return { label: "Storage", value: describeStorage(draft), detail: describeStorageTotal(draft) };
}

function contactRows(draft: GpuQuoteDraft): ReceiptRow[] {
  const rows: (ReceiptRow | false)[] = [
    { label: "Contact", value: describeContact(draft) },
    !!draft.company.trim() && { label: "Company", value: draft.company.trim() },
    !!draft.notes.trim() && { label: "Notes", value: draft.notes.trim() }
  ];

  return rows.filter((row): row is ReceiptRow => row !== false);
}
