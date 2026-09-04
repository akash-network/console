"use client";
import { Badge } from "@akashnetwork/ui/components";
import { Database, Scale, Users, Wrench } from "lucide-react";

import type { ProviderVerificationCapability, ProviderVerificationListView } from "@src/types/provider";

const CAPABILITY_LABELS: Record<ProviderVerificationCapability, string> = {
  unspecified: "Unspecified",
  tee_hardware_attestation: "TEE hardware",
  confidential_computing: "Confidential compute",
  persistent_storage: "Persistent storage",
  bare_metal: "Bare metal",
  unknown: "Unknown"
};

type Props = {
  verification: ProviderVerificationListView | null;
};

export const ProviderVerificationListCell: React.FunctionComponent<Props> = ({ verification }) => {
  if (!verification) {
    return <span className="text-xs text-muted-foreground">Not evaluated</span>;
  }

  const { summary } = verification;
  const tier = summary.effectiveTier;
  const capabilities = summary.capabilities;

  return (
    <div className="min-w-[15rem] space-y-1.5 py-1 text-left" data-testid="provider-verification-list-cell">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge variant={tier && tier !== "unknown" ? "secondary" : "outline"} className="h-5 rounded px-1.5 text-xs">
          {tier ?? "Not evaluated"}
        </Badge>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {formatAuditorCount(summary.validAuditorCount)}
        </span>
      </div>

      <div className="flex min-h-5 min-w-0 flex-wrap gap-1">
        {capabilities === null ? (
          <span className="text-xs text-muted-foreground">Capabilities not evaluated</span>
        ) : capabilities.length === 0 ? (
          <span className="text-xs text-muted-foreground">No attested capabilities</span>
        ) : (
          <>
            {capabilities.slice(0, 2).map(capability => (
              <Badge
                key={capability}
                variant="outline"
                className="h-5 max-w-[9rem] truncate rounded px-1.5 text-xs font-normal"
                title={CAPABILITY_LABELS[capability]}
              >
                {CAPABILITY_LABELS[capability]}
              </Badge>
            ))}
            {capabilities.length > 2 && (
              <Badge
                variant="outline"
                className="h-5 rounded px-1.5 text-xs font-normal"
                title={capabilities
                  .slice(2)
                  .map(value => CAPABILITY_LABELS[value])
                  .join(", ")}
              >
                +{capabilities.length - 2}
              </Badge>
            )}
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <CompactState icon={Database} label="Provider-signed inventory" value={stateLabel(summary.snapshotState)} />
        <CompactState icon={Wrench} label="Maintenance" value={stateLabel(summary.maintenanceState)} />
        <CompactState icon={Scale} label="Discrepancy review" value={reviewLabel(summary.reviewState)} />
      </div>
    </div>
  );
};

function CompactState({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap" title={`${label}: ${value}`} aria-label={`${label}: ${value}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{value}</span>
    </span>
  );
}

function formatAuditorCount(value: number | null): string {
  if (value === null) return "Not evaluated";
  return `${value} auditor${value === 1 ? "" : "s"}`;
}

function reviewLabel(value: ProviderVerificationListView["summary"]["reviewState"]): string {
  if (value === "under_review") return "Under review";
  if (value === "grace") return "Grace active";
  return stateLabel(value);
}

function stateLabel(value: string): string {
  if (value === "unknown") return "Not evaluated";
  if (value === "not_posted") return "Not posted";
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
