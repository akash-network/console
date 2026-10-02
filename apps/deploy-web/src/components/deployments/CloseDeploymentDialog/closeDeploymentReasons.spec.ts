import { describe, expect, it } from "vitest";

import { toCloseReasonInput } from "./closeDeploymentReasons";

describe(toCloseReasonInput.name, () => {
  it("sends the trimmed details along with the other reason", () => {
    expect(toCloseReasonInput("other", "  Moved to our own cluster  ")).toEqual({ closeReason: "other", closeReasonDetails: "Moved to our own cluster" });
  });

  it("sends no details for the other reason when only whitespace was typed", () => {
    expect(toCloseReasonInput("other", "   ")).toEqual({ closeReason: "other", closeReasonDetails: undefined });
  });

  it("drops details typed under the other reason once a listed reason is picked", () => {
    expect(toCloseReasonInput("cost_or_budget", "Moved to our own cluster")).toEqual({ closeReason: "cost_or_budget", closeReasonDetails: undefined });
  });
});
