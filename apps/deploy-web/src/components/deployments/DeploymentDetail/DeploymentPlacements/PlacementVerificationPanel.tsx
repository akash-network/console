import { type FC, type ReactNode, useId, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title
} from "@akashnetwork/ui/components";
import { InfoCircle, NavArrowRight, WarningTriangle } from "iconoir-react";
import { ShieldCheck } from "lucide-react";

import type { ProviderVerificationCapability, ProviderVerificationTier, ProviderVerificationView } from "@src/types/provider";
import { StatusBadge, type StatusTone } from "../DeploymentStatusBadge";
import type { PlacementSecurityPolicy, PlacementVerificationPolicy } from "./placementVerificationModel";
import { isTierBelow } from "./placementVerificationModel";

export interface PlacementVerificationPanelProps {
  placementName: string;
  policy: PlacementSecurityPolicy;
  verification?: ProviderVerificationView | null;
}

const TIER_LABELS: Record<ProviderVerificationTier, string> = {
  L0: "L0 - Unverified",
  L1: "L1 - Identified",
  L2: "L2 - Verified",
  L3: "L3 - Established",
  L4: "L4 - Trusted",
  unknown: "Not evaluated"
};

const CAPABILITY_LABELS: Record<ProviderVerificationCapability, string> = {
  unspecified: "Unspecified",
  tee_hardware_attestation: "TEE hardware attestation",
  confidential_computing: "Confidential computing",
  persistent_storage: "Persistent storage",
  bare_metal: "Bare metal",
  unknown: "Unknown"
};

const SNAPSHOT_LABELS: Record<ProviderVerificationView["summary"]["snapshotState"], string> = {
  unknown: "Not evaluated",
  not_posted: "Not posted",
  current: "Current",
  stale: "Stale",
  suspended: "Suspended"
};

export const PlacementVerificationPanel: FC<PlacementVerificationPanelProps> = ({ placementName, policy, verification }) => {
  const headingId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  if (!policy.legacySignedBy && !policy.verification && !verification) return null;

  const notices = buildNotices(policy.verification, verification);
  const currentTier = verification?.summary.effectiveTier ?? null;
  const capabilities = verification?.summary.capabilities;
  const status = getCompactStatus(notices, currentTier);

  return (
    <section aria-labelledby={headingId} className="border-b px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h4 id={headingId} className="text-sm font-medium">
              Provider verification
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatPolicySummary(policy)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
          <StatusBadge label={status.label} tone={status.tone} />
          <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
            View details
            <NavArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <DialogV2 open={isOpen} onOpenChange={setIsOpen}>
        <DialogV2Content className="max-w-3xl" aria-describedby={descriptionId}>
          <DialogV2Header>
            <DialogV2Title>Provider verification · {placementName}</DialogV2Title>
            <DialogV2Description id={descriptionId} className="sr-only">
              Placement requirements and current provider verification facts for {placementName}
            </DialogV2Description>
          </DialogV2Header>
          <DialogV2Body className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2 md:gap-8">
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Placement policy</p>
                {policy.legacySignedBy && <LegacyPolicy policy={policy.legacySignedBy} />}
                {policy.verification && <VerificationPolicy policy={policy.verification} />}
                {!policy.legacySignedBy && !policy.verification && <p className="text-sm font-medium">No verification requirement</p>}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Current provider facts</p>
                <Fact label="Auditor-attested tier">
                  <StatusBadge label={currentTier ? TIER_LABELS[currentTier] : "Not evaluated"} tone={getTierTone(currentTier)} />
                </Fact>
                <Fact label="Valid auditors" value={verification?.summary.validAuditorCount?.toString() ?? "Not evaluated"} />
                <Fact label="Attested capabilities" value={formatCapabilities(capabilities)} />
                <Fact label="Provider-signed inventory" value={verification ? SNAPSHOT_LABELS[verification.summary.snapshotState] : "Not evaluated"} />
              </div>
            </div>

            {notices.length > 0 && (
              <div className="space-y-2">
                {notices.map(notice => (
                  <Alert key={notice.key} variant={notice.tone === "warning" ? "warning" : "default"} className="p-4">
                    {notice.tone === "warning" ? <WarningTriangle className="h-4 w-4" /> : <InfoCircle className="h-4 w-4" />}
                    <AlertTitle className="text-sm">{notice.title}</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground">{notice.description}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </DialogV2Body>
          <DialogV2Footer>
            <Button type="button" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogV2Footer>
        </DialogV2Content>
      </DialogV2>
    </section>
  );
};

function formatPolicySummary(policy: PlacementSecurityPolicy): string {
  const parts: string[] = [];

  if (policy.legacySignedBy) parts.push("Legacy auditor policy");
  if (policy.verification) {
    parts.push(`Requires ${policy.verification.minTier}`);
    parts.push(`${policy.verification.minAuditorCount} ${policy.verification.minAuditorCount === 1 ? "auditor" : "auditors"}`);
    if (policy.verification.requiredCapabilities.length > 0) {
      parts.push(formatCapabilities(policy.verification.requiredCapabilities));
    }
  }

  return parts.length > 0 ? parts.join(" · ") : "No verification requirement";
}

function getCompactStatus(notices: VerificationNotice[], currentTier: ProviderVerificationTier | null): { label: string; tone: StatusTone } {
  const warning = notices.find(notice => notice.tone === "warning");
  if (warning) return { label: warning.title, tone: "warning" };
  if (notices.some(notice => notice.key === "inactive")) return { label: "Verification inactive", tone: "pending" };
  if (notices.some(notice => notice.key === "incomplete")) return { label: "Not fully evaluated", tone: "loading" };
  if (!currentTier || currentTier === "unknown") return { label: "Not evaluated", tone: "loading" };

  return { label: TIER_LABELS[currentTier], tone: getTierTone(currentTier) };
}

function getTierTone(tier: ProviderVerificationTier | null): StatusTone {
  if (!tier || tier === "unknown") return "loading";
  return tier === "L0" ? "pending" : "running";
}

const LegacyPolicy: FC<{ policy: NonNullable<PlacementSecurityPolicy["legacySignedBy"]> }> = ({ policy }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium">Legacy signedBy</p>
    {policy.allOf.length > 0 && <AddressPolicy label="All required" addresses={policy.allOf} />}
    {policy.anyOf.length > 0 && <AddressPolicy label="Any required" addresses={policy.anyOf} />}
  </div>
);

const VerificationPolicy: FC<{ policy: PlacementVerificationPolicy }> = ({ policy }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium">AEP-86 policy</p>
    <Fact label="Minimum tier" value={TIER_LABELS[policy.minTier]} />
    <Fact label="Required capabilities" value={formatCapabilities(policy.requiredCapabilities)} />
    <Fact label="Minimum auditors" value={String(policy.minAuditorCount)} />
    {policy.requiredAuditors.length > 0 && (
      <AddressPolicy
        label={policy.auditorMode === "all" ? "All named auditors" : policy.auditorMode === "any" ? "Any named auditor" : "Named auditors"}
        addresses={policy.requiredAuditors}
      />
    )}
  </div>
);

const Fact: FC<{ label: string; value?: string; children?: ReactNode }> = ({ label, value, children }) => (
  <div className="flex min-w-0 items-start justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    {children ?? <span className="min-w-0 text-right font-medium">{value}</span>}
  </div>
);

const AddressPolicy: FC<{ label: string; addresses: string[] }> = ({ label, addresses }) => (
  <div className="text-sm">
    <p className="text-muted-foreground">{label}</p>
    <ul className="mt-1 space-y-1">
      {addresses.map(address => (
        <li key={address} className="break-all font-mono text-xs">
          {address}
        </li>
      ))}
    </ul>
  </div>
);

function formatCapabilities(capabilities: ProviderVerificationCapability[] | null | undefined): string {
  if (capabilities === null || capabilities === undefined) return "Not evaluated";
  if (capabilities.length === 0) return "None";
  return capabilities.map(capability => CAPABILITY_LABELS[capability]).join(", ");
}

interface VerificationNotice {
  key: string;
  title: string;
  description: string;
  tone: "default" | "warning";
}

function buildNotices(policy: PlacementVerificationPolicy | null, verification: ProviderVerificationView | null | undefined): VerificationNotice[] {
  const notices: VerificationNotice[] = [];
  const currentTier = verification?.summary.effectiveTier ?? null;

  if (policy && verification?.moduleActive === false) {
    notices.push({
      key: "inactive",
      title: "Provider verification is not active",
      description: "This placement policy is recorded, but verification is not active on this network.",
      tone: "default"
    });
  }

  if ((policy || verification) && (!verification || !Object.values(verification.completeness).every(Boolean))) {
    notices.push({
      key: "incomplete",
      title: "Verification status incomplete",
      description: "Current verification facts are still syncing and are not fully evaluated.",
      tone: "default"
    });
  }

  if (policy && isTierBelow(currentTier, policy.minTier)) {
    notices.push({
      key: "demotion",
      title: "Provider tier is below policy",
      description: `The current ${currentTier} tier is below this placement's ${policy.minTier} policy. The lease remains open.`,
      tone: "warning"
    });
  }

  if (verification?.summary.reviewState === "grace") {
    notices.push({
      key: "grace",
      title: "Verification grace active",
      description: "The provider's attested tier is under review. Grace preserves the policy tier temporarily; the lease remains open.",
      tone: "warning"
    });
  } else if (verification?.summary.reviewState === "under_review") {
    notices.push({
      key: "review",
      title: "Verification under review",
      description: "A provider verification discrepancy is being reviewed. The lease remains open.",
      tone: "warning"
    });
  }

  if (verification?.summary.maintenanceState === "active") {
    notices.push({
      key: "maintenance-active",
      title: "Provider maintenance active",
      description: formatMaintenanceDescription(verification, "active"),
      tone: "warning"
    });
  } else if (verification?.summary.maintenanceState === "scheduled") {
    notices.push({
      key: "maintenance-scheduled",
      title: "Provider maintenance scheduled",
      description: formatMaintenanceDescription(verification, "scheduled"),
      tone: "default"
    });
  }

  return notices;
}

function formatMaintenanceDescription(verification: ProviderVerificationView, status: "active" | "scheduled"): string {
  const maintenance = verification.maintenance.find(item => item.status === status)?.record;
  const timestamp = status === "active" ? maintenance?.expectedEndsAt : maintenance?.startsAt;
  if (!timestamp) return status === "active" ? "The provider reports an active maintenance window." : "The provider reports an upcoming maintenance window.";

  const label = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
  return status === "active" ? `Expected to end ${label}.` : `Scheduled to start ${label}.`;
}
