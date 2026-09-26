import { describe, expect, it } from "vitest";

import { AUDIT_SIGNATURE_LOCK_KEY } from "@src/akash/provider-writer.service";
import { REPLAY_HANDOFF_LOCK_KEY } from "@src/pipeline/modules";
import { MIGRATION_LOCK_KEY } from "@src/providers/db.provider";

describe("advisory lock keys", () => {
  it("gives the replay handoff, the audit signatures and the migrations distinct keys", () => {
    expect(new Set([MIGRATION_LOCK_KEY, AUDIT_SIGNATURE_LOCK_KEY, REPLAY_HANDOFF_LOCK_KEY]).size).toBe(3);
  });
});
