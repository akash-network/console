import { describe, expect, it } from "vitest";

import type { DraftAnswers, GpuQuoteDraft, StartingPointSpec } from "./gpuQuoteDraft";
import {
  answersForGpuModel,
  applyStartingPoint,
  configurationStartingPoint,
  countUnits,
  createBlankDraft,
  CUSTOM_STARTING_POINT,
  describeContact,
  describeGpuModel,
  describeGpus,
  describeMissingAnswers,
  describeNetwork,
  describeNextStep,
  describeRegion,
  describeSla,
  describeStart,
  describeStartingPointCard,
  describeStorage,
  describeStorageTotal,
  describeTerm,
  listMissingAnswers,
  listSteps,
  snapGpuCount,
  STARTER_PACKAGES,
  stepToChange,
  toIsoDate,
  toQuoteRequestData,
  withGpuModel
} from "./gpuQuoteDraft";

const TODAY = "2026-11-04";
const SUMMARY = "1 vCPU · 1 GiB memory · 1 GiB storage";

describe("gpuQuoteDraft", () => {
  describe(snapGpuCount.name, () => {
    it.each([
      [1, "h100", 8],
      [8, "h100", 8],
      [9, null, 16],
      [0, "h100", 8],
      [1, "gb300", 72],
      [73, "gb300", 144]
    ])("snaps %i GPUs of %s to %i", (count, gpuModel, expected) => {
      expect(snapGpuCount(count, gpuModel)).toBe(expected);
    });
  });

  describe(countUnits.name, () => {
    it("counts whole nodes of 8, or whole racks of 72 for a rack-scale model", () => {
      expect(countUnits({ gpuCount: 16, gpuModel: "b300" })).toEqual({ unit: { name: "node", gpuCount: 8 }, count: 2 });
      expect(countUnits({ gpuCount: 144, gpuModel: "gb300" })).toEqual({ unit: { name: "rack", gpuCount: 72 }, count: 2 });
    });
  });

  describe(withGpuModel.name, () => {
    it("keeps the count when the new model comes in the same unit", () => {
      expect(withGpuModel(draftWith({ gpuModel: "h100", gpuCount: 24 }), "b300")).toMatchObject({ gpuModel: "b300", gpuCount: 24 });
    });

    it("starts over at one unit when the new model comes in another unit size", () => {
      expect(withGpuModel(draftWith({ gpuModel: "h100", gpuCount: 24 }), "gb300")).toMatchObject({ gpuModel: "gb300", gpuCount: 72 });
      expect(withGpuModel(draftWith({ gpuModel: "gb300", gpuCount: 144 }), "other")).toMatchObject({ gpuModel: "other", gpuCount: 8 });
    });
  });

  describe(configurationStartingPoint.name, () => {
    it("answers the GPU, storage and region the configuration asks for, rounding the GPUs up to whole nodes", () => {
      const startingPoint = configurationStartingPoint(
        {
          gpuCount: 3,
          gpuModels: ["h100", "a100"],
          storageBytes: 1.5 * 1024 ** 4,
          regions: ["us-east", "eu-central"]
        },
        "8 vCPU · 3× H100 · 64 GiB memory · 1.5 TiB storage"
      );

      expect(startingPoint).toEqual({
        id: "configuration",
        name: "Your configuration",
        use: "What you set up on the Configure page",
        detail: "8 vCPU · 3× H100 · 64 GiB memory · 1.5 TiB storage",
        answers: { gpuCount: 8, gpuModel: "h100", otherGpuModel: "", storageTbPerNode: 2, regionMode: "only", areas: ["us", "eu"] }
      });
    });

    it("rounds a rack-scale model up to whole racks", () => {
      const { answers } = configurationStartingPoint({ gpuCount: 4, gpuModels: ["gb300"], storageBytes: 0, regions: [] }, SUMMARY);

      expect(answers.gpuCount).toBe(72);
    });

    it("keeps a model the catalog doesn't list as free text", () => {
      const { answers } = configurationStartingPoint({ gpuCount: 1, gpuModels: ["gaudi3"], storageBytes: 0, regions: [] }, SUMMARY);

      expect(answers).toEqual({ gpuCount: 8, gpuModel: "other", otherGpuModel: "gaudi3" });
    });

    it("matches a variant of a catalog model to that model", () => {
      const { answers } = configurationStartingPoint({ gpuCount: 1, gpuModels: ["RTX-5090"], storageBytes: 0, regions: [] }, SUMMARY);

      expect(answers.gpuModel).toBe("rtx5090");
    });

    it("leaves the GPU open when the configuration has no GPU", () => {
      const { answers } = configurationStartingPoint({ gpuCount: 0, gpuModels: [], storageBytes: 2 * 1024 ** 4, regions: [] }, SUMMARY);

      expect(answers).toEqual({ storageTbPerNode: 2 });
    });

    it.each([0, 10 * 1024 ** 3, 1024 ** 4 - 1])("leaves the storage question open for %i bytes, less than a terabyte", storageBytes => {
      const { answers } = configurationStartingPoint({ gpuCount: 1, gpuModels: ["h100"], storageBytes, regions: [] }, SUMMARY);

      expect(answers).not.toHaveProperty("storageTbPerNode");
    });

    it("answers one terabyte for exactly one terabyte of storage", () => {
      const { answers } = configurationStartingPoint({ gpuCount: 1, gpuModels: ["h100"], storageBytes: 1024 ** 4, regions: [] }, SUMMARY);

      expect(answers.storageTbPerNode).toBe(1);
    });

    it("maps each provider region to its area once and skips unknown ones", () => {
      const { answers } = configurationStartingPoint(
        {
          gpuCount: 0,
          gpuModels: [],
          storageBytes: 0,
          regions: ["US-West", "na-ca-east", "uk-south", "ap-northeast", "as-southeast", "me-central", "sa-east", "moon-base", "us-east"]
        },
        SUMMARY
      );

      expect(answers.areas).toEqual(["us", "ca", "uk", "apac", "me", "latam"]);
    });
  });

  describe(answersForGpuModel.name, () => {
    it("matches a searched model to the catalog, keeps an unknown one as typed and ignores a blank search", () => {
      expect(answersForGpuModel(" H200 SXM ")).toEqual({ gpuModel: "h200", otherGpuModel: "" });
      expect(answersForGpuModel("pro6000se")).toEqual({ gpuModel: "pro6000", otherGpuModel: "" });
      expect(answersForGpuModel(" GB200 ")).toEqual({ gpuModel: "other", otherGpuModel: "GB200" });
      expect(answersForGpuModel("  ")).toBeUndefined();
    });
  });

  describe(applyStartingPoint.name, () => {
    it("applies the package's answers and remembers which one was picked", () => {
      const draft = applyStartingPoint(createBlankDraft("me@example.com"), STARTER_PACKAGES[1]);

      expect(draft).toMatchObject({ startingPoint: "training_cluster", gpuModel: "gb300", gpuCount: 72, fabric: "infiniband", storageTbPerNode: 30 });
    });

    it("keeps earlier answers when switching to custom", () => {
      const withPackage = applyStartingPoint(createBlankDraft("me@example.com"), STARTER_PACKAGES[0]);

      expect(applyStartingPoint(withPackage, CUSTOM_STARTING_POINT)).toEqual({ ...withPackage, startingPoint: "custom" });
    });

    it("rounds the count up to whole units of the model it ends up with", () => {
      const draft = applyStartingPoint(createBlankDraft("me@example.com"), { ...CUSTOM_STARTING_POINT, answers: { gpuModel: "gb300" } });

      expect(draft).toMatchObject({ gpuModel: "gb300", gpuCount: 72, fabric: "infiniband", storageTbPerNode: 10 });
    });
  });

  describe(listSteps.name, () => {
    it("asks every question for a custom request", () => {
      expect(listSteps({})).toEqual(["start", "gpu", "interconnect", "region", "storage", "sla", "timing", "contact", "review"]);
    });

    it("skips the hardware questions a package answers", () => {
      expect(listSteps(STARTER_PACKAGES[0].answers)).toEqual(["start", "region", "sla", "timing", "contact", "review"]);
    });

    it("still asks for the GPU when the starting point only answers the count", () => {
      expect(listSteps({ gpuCount: 8 })).toContain("gpu");
    });

    it("keeps the network question when the starting point leaves it open", () => {
      expect(listSteps({ gpuModel: "h100", gpuCount: 8 })).toEqual(["start", "interconnect", "region", "storage", "sla", "timing", "contact", "review"]);
    });
  });

  describe(stepToChange.name, () => {
    it("goes to the question's step, or to the starting point when it answered the question", () => {
      expect(stepToChange(["start", "gpu"], "gpu")).toBe("gpu");
      expect(stepToChange(["start", "region"], "gpu")).toBe("start");
    });
  });

  describe(listMissingAnswers.name, () => {
    it("finds nothing missing in a complete draft", () => {
      expect(listMissingAnswers(completeDraft(), TODAY)).toEqual([]);
    });

    it("asks for a GPU model when none is chosen or the other model is blank", () => {
      expect(listMissingAnswers(completeDraft({ gpuModel: null }), TODAY)).toEqual([{ step: "gpu", label: "a GPU model" }]);
      expect(listMissingAnswers(completeDraft({ gpuModel: "other", otherGpuModel: "  " }), TODAY)).toEqual([{ step: "gpu", label: "a GPU model" }]);
    });

    it("asks for a region when only or except has none picked", () => {
      expect(listMissingAnswers(completeDraft({ regionMode: "except", areas: [] }), TODAY)).toEqual([{ step: "region", label: "at least one region" }]);
      expect(listMissingAnswers(completeDraft({ regionMode: "only", areas: ["eu"] }), TODAY)).toEqual([]);
    });

    it("asks to leave a region open when every area is excluded", () => {
      const everyArea = ["us", "ca", "eu", "uk", "apac", "me", "latam"] as const;

      expect(listMissingAnswers(completeDraft({ regionMode: "except", areas: [...everyArea] }), TODAY)).toEqual([
        { step: "region", label: "a region to leave open" }
      ]);
      expect(listMissingAnswers(completeDraft({ regionMode: "except", areas: everyArea.slice(1) }), TODAY)).toEqual([]);
      expect(listMissingAnswers(completeDraft({ regionMode: "only", areas: [...everyArea] }), TODAY)).toEqual([]);
    });

    it("asks for a start date from today on when starting on a date", () => {
      expect(listMissingAnswers(completeDraft({ start: "date", startDate: "" }), TODAY)).toEqual([{ step: "timing", label: "a start date" }]);
      expect(listMissingAnswers(completeDraft({ start: "date", startDate: "2026-11-03" }), TODAY)).toEqual([
        { step: "timing", label: "a start date from today on" }
      ]);
      expect(listMissingAnswers(completeDraft({ start: "date", startDate: TODAY }), TODAY)).toEqual([]);
      expect(listMissingAnswers(completeDraft({ start: "asap", startDate: "2020-01-01" }), TODAY)).toEqual([]);
    });

    it("asks for an email address", () => {
      expect(listMissingAnswers(completeDraft({ email: " " }), TODAY)).toEqual([{ step: "contact", label: "an email address" }]);
    });

    it.each(["me@nope", "not-an-email", "a b@example.com"])("asks for a valid email address instead of %s", email => {
      expect(listMissingAnswers(completeDraft({ email }), TODAY)).toEqual([{ step: "contact", label: "a valid email address" }]);
    });

    it("accepts an email address with surrounding spaces", () => {
      expect(listMissingAnswers(completeDraft({ email: "  dana@example.com " }), TODAY)).toEqual([]);
    });
  });

  describe(describeMissingAnswers.name, () => {
    it("names each missing answer once", () => {
      expect(
        describeMissingAnswers(
          [
            { step: "gpu", label: "a GPU model" },
            { step: "region", label: "at least one region" },
            { step: "region", label: "at least one region" },
            { step: "timing", label: "a start date" }
          ],
          "send"
        )
      ).toBe("Add a GPU model, at least one region and a start date to send.");
    });

    it("names a single missing answer on its own", () => {
      expect(describeMissingAnswers([{ step: "gpu", label: "a GPU model" }], "continue")).toBe("Add a GPU model to continue.");
    });
  });

  describe(describeGpuModel.name, () => {
    it("names a catalog GPU by its label and another GPU by what was typed", () => {
      expect(describeGpuModel({ gpuModel: "pro6000", otherGpuModel: "" })).toBe("RTX PRO 6000 Server Edition");
      expect(describeGpuModel({ gpuModel: "other", otherGpuModel: " Gaudi 3 " })).toBe("Gaudi 3");
      expect(describeGpuModel({ gpuModel: "unknown", otherGpuModel: "" })).toBeNull();
    });
  });

  describe(toQuoteRequestData.name, () => {
    it("links every request across servers over its network, leaving internet speed and price open", () => {
      const configuration = { summary: "1 vCPU", cpu: 1, memoryBytes: 1, storageBytes: 1, region: null };

      expect(toQuoteRequestData(completeDraft(), { source: "no_fit", configuration })).toEqual({
        category: "quote",
        email: "me@example.com",
        details: undefined,
        source: "no_fit",
        configuration,
        spec: {
          gpu: { model: "A100", count: 8, interconnect: "cluster", fabric: "infiniband" },
          region: { mode: "any", areas: [] },
          uplinkGbps: null,
          storage: { tbPerNode: 10, nvme: true },
          sla: null,
          targetPrice: null,
          term: "month_to_month",
          start: { kind: "asap" },
          couldGrow: false,
          wantsToTalk: false,
          company: undefined,
          phone: undefined
        }
      });
    });

    it("sends every answer with its date and contact details trimmed", () => {
      const draft = completeDraft({
        gpuModel: "other",
        otherGpuModel: " GB200 ",
        gpuCount: 16,
        fabric: "roce",
        regionMode: "only",
        areas: ["apac"],
        storageTbPerNode: 12,
        nvme: false,
        sla: "99.9",
        term: "12_months",
        start: "date",
        startDate: "2026-12-01",
        email: " me@example.com ",
        phone: " +1 555 ",
        company: " Acme ",
        notes: " Training run "
      });

      expect(toQuoteRequestData(draft, { source: "requests_page" })).toEqual({
        category: "quote",
        email: "me@example.com",
        details: "Training run",
        source: "requests_page",
        configuration: undefined,
        spec: {
          gpu: { model: "GB200", count: 16, interconnect: "cluster", fabric: "roce" },
          region: { mode: "only", areas: ["apac"] },
          uplinkGbps: null,
          storage: { tbPerNode: 12, nvme: false },
          sla: "99.9",
          targetPrice: null,
          term: "12_months",
          start: { kind: "date", date: "2026-12-01" },
          couldGrow: false,
          wantsToTalk: false,
          company: "Acme",
          phone: "+1 555"
        }
      });
    });

    it("drops areas when anywhere is picked and sends a flexible start", () => {
      const { spec } = toQuoteRequestData(completeDraft({ regionMode: "any", areas: ["eu"], start: "flexible", startDate: "2026-12-01" }), {
        source: "gpu_menu"
      });

      expect(spec.region).toEqual({ mode: "any", areas: [] });
      expect(spec.start).toEqual({ kind: "flexible" });
    });

    it("sends rack storage as the share of each eight-GPU server", () => {
      const { spec } = toQuoteRequestData(completeDraft({ gpuModel: "gb300", gpuCount: 144, storageTbPerNode: 30, nvme: true }), { source: "gpu_menu" });

      expect(spec.storage).toEqual({ tbPerNode: 3.33, nvme: true });
    });
  });

  describe(describeGpus.name, () => {
    it("names the units, the GPUs in each and the full model name", () => {
      expect(describeGpus(completeDraft({ gpuModel: "b300", gpuCount: 16 }))).toBe("2 nodes × 8 NVIDIA B300");
      expect(describeGpus(completeDraft({ gpuModel: "gb300", gpuCount: 72 }))).toBe("1 rack × 72 NVIDIA GB300");
      expect(describeGpus(completeDraft({ gpuModel: "other", otherGpuModel: "Gaudi 3", gpuCount: 8 }))).toBe("1 node × 8 Gaudi 3");
      expect(describeGpus(completeDraft({ gpuModel: null }))).toBeNull();
    });
  });

  describe(describeNetwork.name, () => {
    it.each([
      ["h100", "infiniband", "NVLink + InfiniBand"],
      ["mi300x", "roce", "Infinity Fabric + RoCE"],
      ["pro6000", "infiniband", "InfiniBand"],
      ["other", "any", "InfiniBand or RoCE"]
    ] as const)("describes %s over %s as %s", (gpuModel, fabric, expected) => {
      expect(describeNetwork({ gpuModel, fabric })).toBe(expected);
    });
  });

  describe("request lines", () => {
    it("describes the region, storage, uptime, term, start and contact", () => {
      expect(describeRegion({ regionMode: "only", areas: ["uk", "ca"] })).toBe("Canada, United Kingdom");
      expect(describeRegion({ regionMode: "except", areas: ["me", "us"] })).toBe("Anywhere except United States, Middle East");
      expect(describeRegion({ regionMode: "only", areas: [] })).toBeNull();
      expect(describeStorage({ storageTbPerNode: 4, nvme: true, gpuModel: "b300" })).toBe("4 TB NVMe per node");
      expect(describeStorage({ storageTbPerNode: 30, nvme: false, gpuModel: "gb300" })).toBe("30 TB per rack");
      expect(describeStorage({ storageTbPerNode: 0, nvme: true, gpuModel: "b300" })).toBe("None");
      expect(describeStorageTotal({ storageTbPerNode: 500, gpuModel: "b300", gpuCount: 32 })).toBe("2,000 TB total");
      expect(describeStorageTotal({ storageTbPerNode: 0, gpuModel: "b300", gpuCount: 32 })).toBeNull();
      expect(describeSla("99.5")).toBe("99.5% uptime");
      expect(describeSla(null)).toBe("No requirement");
      expect(describeTerm("24_months")).toBe("2 years or more");
      expect(describeStart({ start: "flexible", startDate: "" })).toBe("Flexible");
      expect(describeStart({ start: "date", startDate: "2026-12-01" })).toBe("Dec 1, 2026");
      expect(describeStart({ start: "date", startDate: "" })).toBeNull();
      expect(describeContact({ email: " me@example.com ", phone: " +1 555 " })).toBe("me@example.com · +1 555");
      expect(describeContact({ email: " ", phone: "" })).toBeNull();
    });
  });

  describe(describeStartingPointCard.name, () => {
    it("lays out each package as its GPUs and the same three specs", () => {
      expect(STARTER_PACKAGES.map(describeStartingPointCard)).toEqual([
        {
          gpuCount: 16,
          model: "B300",
          memory: "NVIDIA · 288 GB",
          specs: [
            { label: "Nodes", value: "2 × 8 GPUs" },
            { label: "Network", value: "NVLink + InfiniBand" },
            { label: "Storage", value: "4 TB / node" }
          ]
        },
        {
          gpuCount: 72,
          model: "GB300",
          memory: "NVIDIA · 288 GB",
          specs: [
            { label: "Racks", value: "1 × 72 GPUs" },
            { label: "Network", value: "NVLink + InfiniBand" },
            { label: "Storage", value: "30 TB / rack" }
          ]
        },
        {
          gpuCount: 8,
          model: "PRO 6000",
          memory: "NVIDIA RTX · 96 GB",
          specs: [
            { label: "Nodes", value: "1 × 8 GPUs" },
            { label: "Network", value: "InfiniBand" },
            { label: "Storage", value: "8 TB / node" }
          ]
        }
      ]);
    });

    it("dashes every spec custom leaves to its own step", () => {
      expect(describeStartingPointCard(CUSTOM_STARTING_POINT)).toEqual({
        gpuCount: undefined,
        model: "Any GPU",
        memory: null,
        specs: [
          { label: "Nodes", value: "—" },
          { label: "Network", value: "—" },
          { label: "Storage", value: "—" }
        ]
      });
    });

    it.each([
      [{ gpuCount: 8 }, "Nodes", "1 × 8 GPUs"],
      [{ gpuModel: "gb300", gpuCount: 144 }, "Racks", "2 × 72 GPUs"],
      [{ fabric: "roce" }, "Network", "RoCE"],
      [{ gpuModel: "mi300x", fabric: "any" }, "Network", "Infinity Fabric + InfiniBand or RoCE"],
      [{ storageTbPerNode: 0 }, "Storage", "0 TB / node"]
    ] satisfies [DraftAnswers, StartingPointSpec["label"], string][])("describes %o with %s %s", (answers, label, value) => {
      const { specs } = describeStartingPointCard({ ...CUSTOM_STARTING_POINT, answers });

      expect(specs.find(spec => spec.label === label)?.value).toBe(value);
    });

    it("names a GPU outside the catalog without its memory", () => {
      const startingPoint = configurationStartingPoint({ gpuCount: 1, gpuModels: ["gb200"], storageBytes: 0, regions: [] }, SUMMARY);

      expect(describeStartingPointCard(startingPoint)).toMatchObject({ gpuCount: 8, model: "gb200", memory: null });
    });
  });

  describe(toIsoDate.name, () => {
    it("writes the local calendar day with zero-padded month and day", () => {
      expect(toIsoDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    });
  });

  describe(describeNextStep.name, () => {
    const WEDNESDAY_10_AM = new Date(2026, 10, 4, 10, 0);

    it("promises each lane's business-hours window when the api names no reply time", () => {
      expect(describeNextStep({ lane: "sales", firstReplyDueAt: null }, WEDNESDAY_10_AM)).toBe("Our team will reply within 4 business hours.");
      expect(describeNextStep({ lane: "automated", firstReplyDueAt: null }, WEDNESDAY_10_AM)).toBe("We'll get back to you within one business day.");
    });

    it("names a reply time later today by its hour", () => {
      const firstReplyDueAt = new Date(2026, 10, 4, 14, 0).toISOString();

      expect(describeNextStep({ lane: "sales", firstReplyDueAt }, WEDNESDAY_10_AM)).toBe("Our team will reply by 2 PM today.");
    });

    it("names a reply time tomorrow with its minutes", () => {
      const firstReplyDueAt = new Date(2026, 10, 5, 9, 30).toISOString();

      expect(describeNextStep({ lane: "automated", firstReplyDueAt }, WEDNESDAY_10_AM)).toBe("We'll get back to you by 9:30 AM tomorrow.");
    });

    it("names a reply time after tomorrow by its weekday", () => {
      const firstReplyDueAt = new Date(2026, 10, 9, 13, 0).toISOString();

      expect(describeNextStep({ lane: "sales", firstReplyDueAt }, WEDNESDAY_10_AM)).toBe("Our team will reply by Monday 1 PM.");
    });
  });

  function draftWith(answers: Partial<GpuQuoteDraft>): GpuQuoteDraft {
    return { ...createBlankDraft("me@example.com"), ...answers };
  }

  function completeDraft(answers: Partial<GpuQuoteDraft> = {}): GpuQuoteDraft {
    return draftWith({ gpuModel: "a100", ...answers });
  }
});
