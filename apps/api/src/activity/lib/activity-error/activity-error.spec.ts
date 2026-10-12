import createError from "http-errors";
import { describe, expect, it } from "vitest";

import { activityErrorOf } from "./activity-error";

describe(activityErrorOf.name, () => {
  const UNEXPLAINED = { code: "action_failed", message: "Something went wrong on our side." };

  it("takes the code an error carries in its data over its own", () => {
    const error = Object.assign(createError(402, "Not enough credits"), { errorCode: "outer_code", data: { errorCode: "insufficient_balance" } });

    expect(activityErrorOf(error, UNEXPLAINED)).toEqual({ code: "insufficient_balance", message: "Not enough credits" });
  });

  it("takes the error's own code when its data names none", () => {
    const error = createError(409, "The provider has not caught up", { errorCode: "provider_manifest_version_stale" });

    expect(activityErrorOf(error, UNEXPLAINED)).toEqual({ code: "provider_manifest_version_stale", message: "The provider has not caught up" });
  });

  it("falls back to the given code for an exposed error that names none", () => {
    expect(activityErrorOf(createError(400, "Deployment closed"), UNEXPLAINED)).toEqual({ code: "action_failed", message: "Deployment closed" });
  });

  it("answers with the given explanation for an error not meant for the caller", () => {
    expect(activityErrorOf(createError(500, "connection to 10.0.0.4 refused"), UNEXPLAINED)).toEqual(UNEXPLAINED);
  });

  it("answers with the given explanation for an error that is not an HTTP error", () => {
    expect(activityErrorOf(new Error("socket hang up"), UNEXPLAINED)).toEqual(UNEXPLAINED);
  });
});
