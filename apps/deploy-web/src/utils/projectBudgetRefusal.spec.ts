import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { readProjectBudgetRefusal } from "./projectBudgetRefusal";

describe(readProjectBudgetRefusal.name, () => {
  it("names the project whose budget refused the deposit", () => {
    const refusal = new ApiError(
      403,
      { code: "project_budget_exceeded", message: "over budget", data: { projectIds: ["storefront", "marketing"] } },
      "forbidden"
    );

    expect(readProjectBudgetRefusal(refusal)).toEqual({ projectId: "storefront" });
  });

  it("recognizes a refusal that names no project", () => {
    expect(readProjectBudgetRefusal(new ApiError(403, { code: "project_budget_exceeded", data: { projectIds: [] } }, "forbidden"))).toEqual({});
    expect(readProjectBudgetRefusal(new ApiError(403, { code: "project_budget_exceeded" }, "forbidden"))).toEqual({});
  });

  it("is null for any other failure", () => {
    expect(readProjectBudgetRefusal(new ApiError(403, { code: "project_forbidden", data: { projectIds: ["storefront"] } }, "forbidden"))).toBeNull();
    expect(readProjectBudgetRefusal(new Error("project_budget_exceeded"))).toBeNull();
  });
});
