import createError from "http-errors";
import { describe, expect, it } from "vitest";

import { activityErrorOf } from "./activity-error";

describe(activityErrorOf.name, () => {
  const UNEXPLAINED = { code: "action_failed", message: "Something went wrong on our side." };

  it("passes on the message and code of an error meant for the caller", () => {
    expect(activityErrorOf(createError(402, "Not enough credits", { errorCode: "insufficient_balance" }), UNEXPLAINED)).toEqual({
      code: "insufficient_balance",
      message: "Not enough credits"
    });
  });

  it("takes the code an error carries in its data over its own", () => {
    const error = Object.assign(createError(402, "Not enough credits"), { errorCode: "outer_code", data: { errorCode: "inner_code" } });

    expect(activityErrorOf(error, UNEXPLAINED)).toEqual({ code: "inner_code", message: "Not enough credits" });
  });

  it("falls back to the unexplained code for an exposed error that names none", () => {
    expect(activityErrorOf(createError(400, "Deployment is not open"), UNEXPLAINED)).toEqual({ code: "action_failed", message: "Deployment is not open" });
  });

  it("answers the unexplained failure for an error not meant for the caller", () => {
    expect(activityErrorOf(createError(500, "connection to 10.0.0.4 refused"), UNEXPLAINED)).toBe(UNEXPLAINED);
  });

  it("answers the unexplained failure for an error that is not an HTTP error", () => {
    expect(activityErrorOf(new Error("socket hang up"), UNEXPLAINED)).toBe(UNEXPLAINED);
  });
});
