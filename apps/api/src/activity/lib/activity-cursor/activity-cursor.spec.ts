import { describe, expect, it } from "vitest";

import { decodeActivityCursor, encodeActivityCursor } from "./activity-cursor";

describe("activity cursor", () => {
  const POSITION = { createdAt: "2026-10-05T10:15:30.123Z", id: "0b6f2c1e-6d0a-4f43-9f43-7d2b0c6a8e11" };

  it("reads back the position it was encoded from", () => {
    expect(decodeActivityCursor(encodeActivityCursor(POSITION))).toEqual(POSITION);
  });

  it("encodes a position into a value safe to put in a URL", () => {
    expect(encodeActivityCursor(POSITION)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["is not base64url JSON", "not a cursor"],
    ["holds JSON of the wrong shape", Buffer.from(JSON.stringify({ createdAt: POSITION.createdAt })).toString("base64url")],
    ["names a time that is not an ISO timestamp", Buffer.from(JSON.stringify(["yesterday", POSITION.id])).toString("base64url")],
    ["names an id that is not a uuid", Buffer.from(JSON.stringify([POSITION.createdAt, "42"])).toString("base64url")]
  ])("refuses a cursor that %s with a 400", (_, cursor) => {
    expect(() => decodeActivityCursor(cursor)).toThrow(expect.objectContaining({ status: 400, message: "Invalid cursor" }));
  });
});
