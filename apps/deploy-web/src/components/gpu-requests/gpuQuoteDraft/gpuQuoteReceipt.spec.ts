import { describe, expect, it } from "vitest";

import type { GpuQuoteDraft } from "./gpuQuoteDraft";
import { applyStartingPoint, createBlankDraft, CUSTOM_STARTING_POINT, listSteps, STARTER_PACKAGES } from "./gpuQuoteDraft";
import { describeReceiptSections } from "./gpuQuoteReceipt";

describe(describeReceiptSections.name, () => {
  it("prints a package's hardware under the setup, then one section per question", () => {
    const [inferenceFleet] = STARTER_PACKAGES;
    const draft = applyStartingPoint(createBlankDraft("me@example.com"), inferenceFleet);

    expect(describeReceiptSections(listSteps(inferenceFleet.answers), draft, inferenceFleet)).toEqual([
      {
        step: "start",
        rows: [
          { label: "Setup", value: "Inference fleet" },
          { label: "GPUs", value: "2 nodes × 8 NVIDIA B300", detail: "16 GPUs total" },
          { label: "Network", value: "NVLink + InfiniBand" },
          { label: "Storage", value: "4 TB NVMe per node", detail: "8 TB total" }
        ]
      },
      { step: "region", rows: [{ label: "Region", value: "Anywhere" }] },
      { step: "sla", rows: [{ label: "SLA", value: "No requirement" }] },
      {
        step: "timing",
        rows: [
          { label: "Term", value: "Month to month" },
          { label: "Start", value: "As soon as possible" }
        ]
      },
      { step: "contact", rows: [{ label: "Contact", value: "me@example.com" }] }
    ]);
  });

  it("gives custom hardware a section per question and lists the company and notes the tenant wrote", () => {
    const draft = customDraft({ gpuModel: "h100", gpuCount: 24, fabric: "roce", storageTbPerNode: 0, company: " Acme ", notes: " Needs MIG " });

    expect(describeReceiptSections(listSteps({}), draft, CUSTOM_STARTING_POINT)).toEqual(
      expect.arrayContaining([
        { step: "start", rows: [{ label: "Setup", value: "Custom" }] },
        { step: "gpu", rows: [{ label: "GPUs", value: "3 nodes × 8 NVIDIA H100", detail: "24 GPUs total" }] },
        { step: "interconnect", rows: [{ label: "Network", value: "NVLink + RoCE" }] },
        { step: "storage", rows: [{ label: "Storage", value: "None", detail: null }] },
        {
          step: "contact",
          rows: [
            { label: "Contact", value: "me@example.com" },
            { label: "Company", value: "Acme" },
            { label: "Notes", value: "Needs MIG" }
          ]
        }
      ])
    );
  });

  it("leaves unanswered rows empty and drops the review step", () => {
    const steps = listSteps({});
    const sections = describeReceiptSections(steps, customDraft({ gpuModel: null, startingPoint: null }), undefined);

    expect(sections.map(section => section.step)).toEqual(steps.filter(step => step !== "review"));
    expect(sections[0].rows).toEqual([{ label: "Setup", value: null }]);
    expect(sections[1].rows).toEqual([{ label: "GPUs", value: null, detail: null }]);
  });

  function customDraft(answers: Partial<GpuQuoteDraft>): GpuQuoteDraft {
    return { ...applyStartingPoint(createBlankDraft("me@example.com"), CUSTOM_STARTING_POINT), ...answers };
  }
});
