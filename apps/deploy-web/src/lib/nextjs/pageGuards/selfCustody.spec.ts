import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { SELF_CUSTODY_FLAG } from "@src/hooks/useIsSelfCustodyEnabled";
import type { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isSelfCustodyEnabled } from "./selfCustody";

describe(isSelfCustodyEnabled.name, () => {
  it("returns true when the self_custody flag is enabled in context", async () => {
    const context = setup({ enabled: true });

    expect(await isSelfCustodyEnabled(context)).toBe(true);
    expect(context.services.featureFlagService.isEnabledForCtx).toHaveBeenCalledWith(SELF_CUSTODY_FLAG, context, expect.anything());
  });

  it("returns false when the self_custody flag is disabled in context", async () => {
    const context = setup({ enabled: false });

    expect(await isSelfCustodyEnabled(context)).toBe(false);
  });

  function setup(input: { enabled: boolean }) {
    return mock<AppTypedContext>({
      getCurrentSession: vi.fn().mockResolvedValue(null),
      services: {
        featureFlagService: mock<FeatureFlagService>({
          isEnabledForCtx: vi.fn().mockResolvedValue(input.enabled)
        })
      }
    });
  }
});
