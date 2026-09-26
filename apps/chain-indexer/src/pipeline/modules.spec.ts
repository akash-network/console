import { describe, expect, it } from "vitest";

import { AUDIT_SIGNATURE_LOCK_KEY } from "@src/akash/provider-writer.service";
import { INDEX_DEFERRAL_LOCK_KEY } from "@src/db/deferred-index.service";
import { REPLAY_HANDOFF_LOCK_KEY } from "@src/pipeline/modules";
import { MIGRATION_LOCK_KEY } from "@src/providers/db.provider";

describe("advisory lock keys", () => {
  it("gives the migrations, the audit signatures, the index deferral and the replay handoff distinct keys", () => {
    expect(new Set([MIGRATION_LOCK_KEY, AUDIT_SIGNATURE_LOCK_KEY, INDEX_DEFERRAL_LOCK_KEY, REPLAY_HANDOFF_LOCK_KEY]).size).toBe(4);
  });
});
