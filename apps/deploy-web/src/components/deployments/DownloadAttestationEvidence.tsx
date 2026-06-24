"use client";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { ShieldCheck } from "lucide-react";

import { useFlag } from "@src/hooks/useFlag";
import type { ProviderIdentity } from "@src/services/provider-proxy/provider-proxy.service";
import type { LeaseDto } from "@src/types/deployment";
import { getGroupTeeType } from "@src/utils/confidentialCompute";
import { isLeaseLive } from "@src/utils/reclamationUtils";
import { AttestationEvidenceModal } from "./AttestationEvidenceModal";

export const DEPENDENCIES = {
  useFlag,
  AttestationEvidenceModal
};

type Props = {
  lease: LeaseDto;
  provider: ProviderIdentity | undefined | null;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Surfaces the attestation-evidence download for a running Confidential Compute lease. Renders nothing
 * unless the feature flag is on, the lease is live, and the lease's on-chain group declares a TEE type —
 * so the option never appears for non-Confidential-Compute deployments (CON-540).
 */
export function DownloadAttestationEvidence({ lease, provider, dependencies: d = DEPENDENCIES }: Props) {
  const isEnabled = d.useFlag("ui_confidential_compute");
  const [isOpen, setIsOpen] = useState(false);

  if (!isEnabled || !isLeaseLive(lease) || !getGroupTeeType(lease.group)) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <ShieldCheck className="mr-2 h-4 w-4" />
        Attestation evidence
      </Button>

      {isOpen && <d.AttestationEvidenceModal provider={provider} lease={lease} onClose={() => setIsOpen(false)} />}
    </>
  );
}
