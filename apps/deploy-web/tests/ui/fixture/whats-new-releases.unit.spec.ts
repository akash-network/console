import { describe, expect, it } from "vitest";

import { ORGANIZATIONS_RELEASE_ID } from "@src/components/whats-new/organizationsRelease";
import { WHATS_NEW_RELEASE_IDS } from "./whats-new-releases";

describe("WHATS_NEW_RELEASE_IDS", () => {
  it("includes the organizations release the app announces", () => {
    expect(WHATS_NEW_RELEASE_IDS).toContain(ORGANIZATIONS_RELEASE_ID);
  });
});
