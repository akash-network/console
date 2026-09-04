import { describe, expect, it } from "vitest";

import { linkedActions } from "./notification-actions";

describe(linkedActions.name, () => {
  it("keeps actions that have a url", () => {
    expect(linkedActions({ label: "Add credits", url: "https://console.akash.network/billing" })).toEqual([
      { label: "Add credits", url: "https://console.akash.network/billing" }
    ]);
  });

  it("returns undefined when every url is missing", () => {
    expect(linkedActions({ label: "Add credits", url: undefined })).toBeUndefined();
  });

  it("drops only the actions whose url is missing", () => {
    expect(linkedActions({ label: "Add credits", url: undefined }, { label: "View billing", url: "https://console.akash.network/billing" })).toEqual([
      { label: "View billing", url: "https://console.akash.network/billing" }
    ]);
  });
});
