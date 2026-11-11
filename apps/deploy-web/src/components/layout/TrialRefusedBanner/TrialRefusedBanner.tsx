"use client";
import { Banner } from "@akashnetwork/ui/components";

import { SUPPORT_EMAIL } from "@src/config/ui.config";

export function TrialRefusedBanner() {
  return (
    <Banner variant="warning" role="status">
      <span>
        Unable to start trial. Please{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline hover:opacity-80">
          contact support
        </a>{" "}
        for assistance.
      </span>
    </Banner>
  );
}
