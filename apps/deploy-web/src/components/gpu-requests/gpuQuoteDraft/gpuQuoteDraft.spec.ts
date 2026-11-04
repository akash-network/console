import { describe, expect, it } from "vitest";

import type { GpuQuoteDraft } from "./gpuQuoteDraft";
import {
  answersForGpuModel,
  applyStartingPoint,
  asksUplink,
  configurationStartingPoint,
  createBlankDraft,
  CUSTOM_STARTING_POINT,
  describeGpuModel,
  describeMissingAnswers,
  describeNextStep,
  describeReviewLines,
  describeStartingPoint,
  isWholeNodes,
  listMissingAnswers,
  listSteps,
  snapGpuCount,
  STARTER_PACKAGES,
  stepToChange,
  toQuoteRequestData
} from "./gpuQuoteDraft";

const TODAY = "2026-11-04";

describe("gpuQuoteDraft", () => {
  describe(snapGpuCount.name, () => {
    it.each([
      [1, 1],
      [2, 2],
      [3, 4],
      [4, 4],
      [5, 8],
      [8, 8],
      [9, 16],
      [24, 24]
    ])("snaps %i GPUs to %i", (count, expected) => {
      expect(snapGpuCount(count)).toBe(expected);
    });
  });

  describe(isWholeNodes.name, () => {
    it("is true from 8 GPUs on", () => {
      expect(isWholeNodes(7)).toBe(false);
      expect(isWholeNodes(8)).toBe(true);
    });
  });

  describe(configurationStartingPoint.name, () => {
    it("answers the GPU, storage and region the configuration asks for", () => {
      const startingPoint = configurationStartingPoint({
        gpuCount: 3,
        gpuModels: ["h100", "a100"],
        storageBytes: 1.5 * 1024 ** 4,
        regions: ["us-east", "eu-central"]
      });

      expect(startingPoint).toEqual({
        id: "configuration",
        name: "Your configuration",
        use: "What you set up on the Configure page",
        answers: { gpuCount: 4, gpuModel: "h100", otherGpuModel: "", storageTbPerNode: 2, regionMode: "only", areas: ["us", "eu"] }
      });
    });

    it("keeps a model the catalog doesn't list as free text", () => {
      const { answers } = configurationStartingPoint({ gpuCount: 1, gpuModels: ["gaudi3"], storageBytes: 0, regions: [] });

      expect(answers).toEqual({ gpuCount: 1, gpuModel: "other", otherGpuModel: "gaudi3", storageTbPerNode: 1 });
    });

    it("matches a variant of a catalog model to that model", () => {
      const { answers } = configurationStartingPoint({ gpuCount: 1, gpuModels: ["RTX-5090"], storageBytes: 0, regions: [] });

      expect(answers.gpuModel).toBe("rtx5090");
    });

    it("leaves the GPU open when the configuration has no GPU", () => {
      const { answers } = configurationStartingPoint({ gpuCount: 0, gpuModels: [], storageBytes: 0, regions: [] });

      expect(answers).toEqual({ storageTbPerNode: 1 });
    });

    it("maps each provider region to its area once and skips unknown ones", () => {
      const { answers } = configurationStartingPoint({
        gpuCount: 0,
        gpuModels: [],
        storageBytes: 0,
        regions: ["US-West", "na-ca-east", "uk-south", "ap-northeast", "as-southeast", "me-central", "sa-east", "moon-base", "us-east"]
      });

      expect(answers.areas).toEqual(["us", "ca", "uk", "apac", "me", "latam"]);
    });
  });

  describe(answersForGpuModel.name, () => {
    it("matches a searched model to the catalog, keeps an unknown one as typed and ignores a blank search", () => {
      expect(answersForGpuModel(" H200 SXM ")).toEqual({ gpuModel: "h200", otherGpuModel: "" });
      expect(answersForGpuModel(" GB200 ")).toEqual({ gpuModel: "other", otherGpuModel: "GB200" });
      expect(answersForGpuModel("  ")).toBeUndefined();
    });
  });

  describe(applyStartingPoint.name, () => {
    it("applies the package's answers and remembers which one was picked", () => {
      const draft = applyStartingPoint(createBlankDraft("me@example.com"), STARTER_PACKAGES[1]);

      expect(draft).toMatchObject({ startingPoint: "training_cluster", gpuModel: "b200", gpuCount: 32, interconnect: "cluster", fabric: "infiniband" });
    });

    it("keeps earlier answers when switching to custom", () => {
      const withPackage = applyStartingPoint(createBlankDraft("me@example.com"), STARTER_PACKAGES[0]);

      expect(applyStartingPoint(withPackage, CUSTOM_STARTING_POINT)).toEqual({ ...withPackage, startingPoint: "custom" });
    });
  });

  describe(listSteps.name, () => {
    it("asks every question for a custom request of whole servers", () => {
      expect(listSteps(draftWith({ gpuCount: 16 }), {})).toEqual([
        "start",
        "gpu",
        "interconnect",
        "region",
        "storage",
        "sla",
        "price",
        "timing",
        "extras",
        "contact",
        "review"
      ]);
    });

    it("skips the interconnect question below a whole server", () => {
      expect(listSteps(draftWith({ gpuCount: 4 }), {})).not.toContain("interconnect");
    });

    it("skips the questions a package answers", () => {
      const { answers } = STARTER_PACKAGES[0];

      expect(listSteps(draftWith({ gpuCount: 8 }), answers)).toEqual(["start", "region", "sla", "price", "timing", "extras", "contact", "review"]);
    });

    it("still asks for the GPU when the starting point only answers the count", () => {
      expect(listSteps(draftWith({ gpuCount: 1 }), { gpuCount: 1 })).toContain("gpu");
    });

    it("keeps the interconnect question when the starting point leaves it open", () => {
      expect(listSteps(draftWith({ gpuCount: 8 }), { gpuModel: "h100", gpuCount: 8 })).toEqual([
        "start",
        "interconnect",
        "region",
        "storage",
        "sla",
        "price",
        "timing",
        "extras",
        "contact",
        "review"
      ]);
    });
  });

  describe(asksUplink.name, () => {
    it("asks for internet speed unless the starting point answers it", () => {
      expect(asksUplink({})).toBe(true);
      expect(asksUplink({ uplinkGbps: null })).toBe(false);
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

    it.each(["0", "-1", "abc", "1000.01"])("rejects a target price of %s", price => {
      expect(listMissingAnswers(completeDraft({ maxUsdPerGpuHour: price }), TODAY)).toEqual([
        { step: "price", label: "a price between $0 and $1000 per GPU-hour" }
      ]);
      expect(listMissingAnswers(completeDraft({ minUsdPerGpuHour: price }), TODAY)).toHaveLength(1);
    });

    it("treats a blank target price as open to offers", () => {
      expect(listMissingAnswers(completeDraft({ minUsdPerGpuHour: " ", maxUsdPerGpuHour: "" }), TODAY)).toEqual([]);
      expect(lineValue(completeDraft({ minUsdPerGpuHour: " " }), "Target price")).toBe("Open to offers");
    });

    it("accepts a target price of $1000", () => {
      expect(listMissingAnswers(completeDraft({ maxUsdPerGpuHour: "1000" }), TODAY)).toEqual([]);
    });

    it("asks for a lowest price under the highest", () => {
      expect(listMissingAnswers(completeDraft({ minUsdPerGpuHour: "3", maxUsdPerGpuHour: "2" }), TODAY)).toEqual([
        { step: "price", label: "a lowest price under the highest" }
      ]);
      expect(listMissingAnswers(completeDraft({ minUsdPerGpuHour: "2", maxUsdPerGpuHour: "2" }), TODAY)).toEqual([]);
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
      expect(describeGpuModel({ gpuModel: "pro6000", otherGpuModel: "" })).toBe("RTX PRO 6000");
      expect(describeGpuModel({ gpuModel: "other", otherGpuModel: " Gaudi 3 " })).toBe("Gaudi 3");
      expect(describeGpuModel({ gpuModel: "unknown", otherGpuModel: "" })).toBeNull();
    });
  });

  describe(toQuoteRequestData.name, () => {
    it("sends a single GPU without interconnect, with defaults left open", () => {
      const configuration = { summary: "1 vCPU", cpu: 1, memoryBytes: 1, storageBytes: 1, region: null };

      expect(toQuoteRequestData(completeDraft({ interconnect: "cluster" }), { source: "no_fit", configuration })).toEqual({
        category: "quote",
        email: "me@example.com",
        details: undefined,
        source: "no_fit",
        configuration,
        spec: {
          gpu: { model: "A100", count: 1, interconnect: "none" },
          region: { mode: "any", areas: [] },
          uplinkGbps: null,
          storage: { tbPerNode: 1, nvme: true },
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

    it("sends a cluster with its fabric, prices, date and contact details", () => {
      const draft = completeDraft({
        gpuModel: "other",
        otherGpuModel: " GB200 ",
        gpuCount: 16,
        interconnect: "cluster",
        fabric: "roce",
        fabricGbps: 800,
        regionMode: "only",
        areas: ["apac"],
        uplinkGbps: 25,
        storageTbPerNode: 10,
        nvme: false,
        sla: "99.9",
        minUsdPerGpuHour: "2.5",
        maxUsdPerGpuHour: "3",
        term: "12_months",
        start: "date",
        startDate: "2026-12-01",
        couldGrow: true,
        wantsToTalk: true,
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
          gpu: { model: "GB200", count: 16, interconnect: "cluster", fabric: "roce", fabricGbps: 800 },
          region: { mode: "only", areas: ["apac"] },
          uplinkGbps: 25,
          storage: { tbPerNode: 10, nvme: false },
          sla: "99.9",
          targetPrice: { minUsdPerGpuHour: 2.5, maxUsdPerGpuHour: 3 },
          term: "12_months",
          start: { kind: "date", date: "2026-12-01" },
          couldGrow: true,
          wantsToTalk: true,
          company: "Acme",
          phone: "+1 555"
        }
      });
    });

    it("sends linked servers without a fabric and drops areas when anywhere is picked", () => {
      const { spec } = toQuoteRequestData(completeDraft({ gpuCount: 8, interconnect: "server", regionMode: "any", areas: ["eu"] }), {
        source: "gpu_menu"
      });

      expect(spec.gpu).toEqual({ model: "A100", count: 8, interconnect: "server" });
      expect(spec.region).toEqual({ mode: "any", areas: [] });
    });

    it("sends a target price with only one bound", () => {
      const { spec } = toQuoteRequestData(completeDraft({ minUsdPerGpuHour: "1.2" }), { source: "no_bids" });

      expect(spec.targetPrice).toEqual({ minUsdPerGpuHour: 1.2, maxUsdPerGpuHour: undefined });
    });

    it("sends a flexible start", () => {
      const { spec } = toQuoteRequestData(completeDraft({ start: "flexible", startDate: "2026-12-01" }), { source: "no_bids" });

      expect(spec.start).toEqual({ kind: "flexible" });
    });
  });

  describe(describeReviewLines.name, () => {
    it("describes a single GPU request with defaults", () => {
      expect(describeReviewLines(completeDraft())).toEqual([
        { step: "gpu", label: "GPUs", value: "1× A100" },
        { step: "region", label: "Region", value: "Anywhere" },
        { step: "region", label: "Internet", value: "No preference" },
        { step: "storage", label: "Storage", value: "1 TB NVMe" },
        { step: "sla", label: "Uptime", value: "No requirement" },
        { step: "price", label: "Target price", value: "Open to offers" },
        { step: "timing", label: "Term", value: "Month to month" },
        { step: "timing", label: "Start", value: "As soon as possible" },
        { step: "extras", label: "Also", value: "Nothing else" },
        { step: "contact", label: "Contact", value: "me@example.com" }
      ]);
    });

    it("describes a cluster request with every answer", () => {
      const lines = describeReviewLines(
        completeDraft({
          gpuCount: 16,
          interconnect: "cluster",
          fabric: "infiniband",
          fabricGbps: 400,
          regionMode: "except",
          areas: ["me", "us"],
          uplinkGbps: 10,
          storageTbPerNode: 30,
          nvme: false,
          sla: "99.5",
          minUsdPerGpuHour: "2",
          maxUsdPerGpuHour: "3.5",
          term: "24_months",
          start: "date",
          startDate: "2026-12-01",
          couldGrow: true,
          wantsToTalk: true,
          phone: "+1 555",
          company: "Acme"
        })
      );

      expect(lines.map(line => line.value)).toEqual([
        "16× A100 · 2 servers",
        "InfiniBand between servers at 400 Gb/s",
        "Anywhere except United States, Middle East",
        "10 Gbps",
        "30 TB per server",
        "99.5%",
        "$2.00–$3.50 per GPU-hour",
        "2 years or more",
        "On 2026-12-01",
        "Could grow, Wants to talk to someone",
        "me@example.com · +1 555 · Acme"
      ]);
    });

    it.each([
      [{ interconnect: "none" }, "Not needed"],
      [{ interconnect: "server" }, "Linked inside each server"],
      [{ interconnect: "cluster", fabric: "any", fabricGbps: 200 }, "InfiniBand or RoCE between servers at 200 Gb/s"],
      [{ interconnect: "cluster", fabric: "roce", fabricGbps: 800 }, "RoCE (Ethernet) between servers at 800 Gb/s"]
    ] as const)("describes the connection %o as %s", (answers, expected) => {
      expect(lineValue(completeDraft({ gpuCount: 8, ...answers }), "Connection")).toBe(expected);
    });

    it("names one server in the singular", () => {
      expect(lineValue(completeDraft({ gpuCount: 8 }), "GPUs")).toBe("8× A100 · 1 server");
      expect(describeReviewLines(completeDraft({ gpuCount: 8 }))[1]).toEqual({ step: "interconnect", label: "Connection", value: "Not needed" });
    });

    it("lists the notes last, trimmed, when the tenant wrote some", () => {
      const lines = describeReviewLines(completeDraft({ notes: "  Need it for a demo  " }));

      expect(lines.at(-1)).toEqual({ step: "contact", label: "Notes", value: "Need it for a demo" });
    });

    it("leaves out the notes line when the notes are blank", () => {
      expect(lineValue(completeDraft({ notes: "   " }), "Notes")).toBeUndefined();
    });

    it("leaves unanswered lines empty", () => {
      const draft = completeDraft({ gpuModel: null, regionMode: "only", areas: [], start: "date", startDate: "", email: "", maxUsdPerGpuHour: "abc" });

      expect(lineValue(draft, "GPUs")).toBeNull();
      expect(lineValue(draft, "Region")).toBeNull();
      expect(lineValue(draft, "Start")).toBeNull();
      expect(lineValue(draft, "Contact")).toBeNull();
      expect(lineValue(draft, "Target price")).toBeNull();
    });

    it("describes the other answers", () => {
      expect(lineValue(completeDraft({ regionMode: "only", areas: ["uk", "ca"] }), "Region")).toBe("Canada, United Kingdom");
      expect(lineValue(completeDraft({ storageTbPerNode: 0 }), "Storage")).toBe("None");
      expect(lineValue(completeDraft({ maxUsdPerGpuHour: "4" }), "Target price")).toBe("Up to $4.00 per GPU-hour");
      expect(lineValue(completeDraft({ minUsdPerGpuHour: "1.5" }), "Target price")).toBe("From $1.50 per GPU-hour");
      expect(lineValue(completeDraft({ start: "flexible" }), "Start")).toBe("Flexible");
      expect(lineValue(completeDraft({ couldGrow: true }), "Also")).toBe("Could grow");
      expect(lineValue(completeDraft({ email: " me@example.com ", phone: " ", company: " Acme " }), "Contact")).toBe("me@example.com · Acme");
    });
  });

  describe(describeStartingPoint.name, () => {
    it("names what each package answers", () => {
      expect(STARTER_PACKAGES.map(describeStartingPoint)).toEqual([
        "8× H200 · Linked in each server · 8 TB NVMe",
        "32× B200 · Linked across servers · 30 TB NVMe",
        "16× L40S · PCIe only · 4 TB NVMe"
      ]);
    });

    it("names the configuration's GPU, storage and regions", () => {
      const startingPoint = configurationStartingPoint({ gpuCount: 2, gpuModels: ["gaudi3"], storageBytes: 0, regions: ["eu-west", "us-east"] });

      expect(describeStartingPoint(startingPoint)).toBe("2× gaudi3 · 1 TB · United States, Europe");
    });

    it("says any GPU when the configuration names no model, and nothing for custom", () => {
      expect(describeStartingPoint(configurationStartingPoint({ gpuCount: 1, gpuModels: [], storageBytes: 0, regions: [] }))).toBe("1× any GPU · 1 TB");
      expect(describeStartingPoint(CUSTOM_STARTING_POINT)).toBe("");
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

  function lineValue(draft: GpuQuoteDraft, label: string) {
    return describeReviewLines(draft).find(line => line.label === label)?.value;
  }
});
