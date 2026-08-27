"use client";
import { Alert, Badge, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { Database, Scale, ShieldCheck, Users, WalletCards } from "lucide-react";

import type { ProviderVerificationCapability, ProviderVerificationCoin, ProviderVerificationTier, ProviderVerificationView } from "@src/types/provider";

const CAPABILITY_LABELS: Record<ProviderVerificationCapability, string> = {
  unspecified: "Unspecified",
  tee_hardware_attestation: "TEE hardware attestation",
  confidential_computing: "Confidential computing",
  persistent_storage: "Persistent storage",
  bare_metal: "Bare metal",
  unknown: "Unknown"
};

type Props = {
  providerDeclaredTier: string | null;
  verification: ProviderVerificationView | null;
};

export const ProviderVerificationDetails: React.FunctionComponent<Props> = ({ providerDeclaredTier, verification }) => {
  if (!verification) {
    return (
      <Card data-testid="provider-verification-details">
        <CardContent className="p-5">
          <p className="text-sm font-medium">Provider verification has not been evaluated.</p>
          <p className="mt-1 text-xs text-muted-foreground">No indexed AEP-86 state is available for this provider.</p>
        </CardContent>
      </Card>
    );
  }

  const openDiscrepancies = verification.discrepancies.filter(discrepancy => ["pending", "timed_out"].includes(discrepancy.resolutionStatus));
  const activeMaintenance = verification.maintenance.filter(item => ["scheduled", "active"].includes(item.status));

  return (
    <Card className="overflow-hidden" data-testid="provider-verification-details">
      <CardContent className="p-0">
        {verification.moduleActive === false && (
          <Alert className="rounded-none border-x-0 border-t-0" variant="warning">
            The verification module is inactive. These records are visible, but verification placement requirements are not enforced.
          </Alert>
        )}

        {(verification.summary.reviewState === "under_review" || verification.summary.reviewState === "grace") && (
          <Alert className="rounded-none border-x-0 border-t-0" variant="warning">
            {verification.summary.reviewState === "under_review"
              ? "Conflicting auditor attestations are under governance review."
              : `Verification grace is active${verification.grace ? ` at ${verification.grace.preservedTier}` : ""}.`}
          </Alert>
        )}

        {activeMaintenance.length > 0 && (
          <Alert className="rounded-none border-x-0 border-t-0" variant="warning">
            This provider has {activeMaintenance.some(item => item.status === "active") ? "active" : "scheduled"} maintenance.
          </Alert>
        )}

        <section className="grid grid-cols-2 border-b sm:grid-cols-3 xl:grid-cols-5" aria-label="Provider verification summary">
          <SummaryItem icon={ShieldCheck} label="Effective tier" value={verification.summary.effectiveTier ?? "Not evaluated"} />
          <SummaryItem icon={Users} label="Valid auditors" value={formatOptionalInteger(verification.summary.validAuditorCount)} />
          <SummaryItem icon={Database} label="Provider-signed inventory" value={stateLabel(verification.summary.snapshotState)} />
          <SummaryItem icon={Scale} label="Review" value={reviewLabel(verification.summary.reviewState)} />
          <SummaryItem icon={ShieldCheck} label="Self-declared tier" value={providerDeclaredTier || "Not declared"} />
        </section>

        <section className="border-b p-5" aria-labelledby="provider-verification-capabilities">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="provider-verification-capabilities" className="text-sm font-semibold">
                Auditor-attested capabilities
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">Current capabilities from valid attestation records.</p>
            </div>
            <ObservedState verification={verification} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {verification.summary.capabilities === null ? (
              <EmptyState>Not evaluated</EmptyState>
            ) : verification.summary.capabilities.length === 0 ? (
              <EmptyState>No capabilities attested</EmptyState>
            ) : (
              verification.summary.capabilities.map(capability => (
                <Badge key={capability} variant="secondary" className="rounded font-normal">
                  {CAPABILITY_LABELS[capability]}
                </Badge>
              ))
            )}
          </div>
        </section>

        <section className="grid border-b lg:grid-cols-2 lg:divide-x" aria-label="Snapshot and provider bond">
          <SnapshotSection verification={verification} />
          <BondSection verification={verification} />
        </section>

        <DataSection title="Attestation records" description="Raw AEP-86 records; only valid attestations contribute to the provider summary.">
          <div className="overflow-x-auto">
            <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Tier and capabilities</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Auditor deposit</TableHead>
                  <TableHead>Created and expires</TableHead>
                  <TableHead>Escrow</TableHead>
                  <TableHead>Evidence hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!verification.completeness.attestations ? (
                  <EmptyTableRow columns={8}>Not evaluated</EmptyTableRow>
                ) : verification.attestations.length === 0 ? (
                  <EmptyTableRow columns={8}>No current attestations</EmptyTableRow>
                ) : (
                  verification.attestations.map(attestation => (
                    <TableRow key={`${attestation.auditor}-${attestation.auditEscrowId}-${attestation.createdAt ?? "unknown"}`}>
                      <TableCell className="max-w-[220px] break-all font-mono text-xs">{attestation.auditor}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <TierBadge tier={attestation.tier} />
                        <div className="mt-1 text-xs text-muted-foreground">
                          {attestation.capabilities.length > 0 ? attestation.capabilities.map(value => CAPABILITY_LABELS[value]).join(", ") : "No capabilities"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StateBadge value={attestation.status} positive="valid" />
                        <div className="mt-1 text-xs text-muted-foreground">Reason: {humanize(attestation.voidedReason)}</div>
                        <div className="text-xs text-muted-foreground">Fault: {humanize(attestation.faultAttribution)}</div>
                      </TableCell>
                      <TableCell>
                        <div>{formatCoin(attestation.fee)}</div>
                        <div className="text-xs text-muted-foreground">{humanize(attestation.feeStatus)}</div>
                      </TableCell>
                      <TableCell>
                        <div>{formatCoin(attestation.deposit)}</div>
                        <div className="text-xs text-muted-foreground">{humanize(attestation.depositStatus)}</div>
                      </TableCell>
                      <TableCell>
                        <div>{formatTimestamp(attestation.createdAt)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Expires {formatTimestamp(attestation.expiresAt)}</div>
                      </TableCell>
                      <TableCell className="font-mono">#{attestation.auditEscrowId}</TableCell>
                      <TableCell className="max-w-[220px] break-all font-mono text-xs">{attestation.evidenceHash || "Not recorded"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DataSection>

        <DataSection title="Audit escrow lifecycle" description="Current fee and deposit settlement state for this provider's audit requests.">
          <div className="overflow-x-auto">
            <Table className="min-w-[1240px]">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Requested tier</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Provider deposit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timing</TableHead>
                  <TableHead>Settlement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!verification.completeness.auditEscrows ? (
                  <EmptyTableRow columns={8}>Not evaluated</EmptyTableRow>
                ) : verification.auditEscrows.length === 0 ? (
                  <EmptyTableRow columns={8}>No audit escrows</EmptyTableRow>
                ) : (
                  verification.auditEscrows.map(escrow => (
                    <TableRow key={escrow.id}>
                      <TableCell className="font-mono">#{escrow.id}</TableCell>
                      <TableCell>
                        <TierBadge tier={escrow.requestedTier} />
                      </TableCell>
                      <TableCell className="max-w-[220px] break-all font-mono text-xs">{escrow.consumedByAuditor || "Awaiting auditor"}</TableCell>
                      <TableCell>
                        <div>{formatCoin(escrow.fee)}</div>
                        <div className="text-xs text-muted-foreground">{humanize(escrow.feeStatus)}</div>
                      </TableCell>
                      <TableCell>
                        <div>{formatCoin(escrow.providerDeposit)}</div>
                        <div className="text-xs text-muted-foreground">{humanize(escrow.providerDepositStatus)}</div>
                      </TableCell>
                      <TableCell>
                        <StateBadge value={escrow.status} positive="settled" />
                      </TableCell>
                      <TableCell>
                        <div>Opened {formatTimestamp(escrow.openedAt)}</div>
                        <div className="text-xs text-muted-foreground">Consumed {formatTimestamp(escrow.consumedAt)}</div>
                        <div className="text-xs text-muted-foreground">Expires {formatTimestamp(escrow.expiresAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div>{humanize(escrow.settlementReason)}</div>
                        <div className="text-xs text-muted-foreground">Fault: {humanize(escrow.faultAttribution)}</div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DataSection>

        <DataSection title="Maintenance windows" description="Provider maintenance notices recorded on chain.">
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Expected end</TableHead>
                  <TableHead>Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!verification.completeness.maintenance ? (
                  <EmptyTableRow columns={6}>Not evaluated</EmptyTableRow>
                ) : verification.maintenance.length === 0 ? (
                  <EmptyTableRow columns={6}>No maintenance windows</EmptyTableRow>
                ) : (
                  verification.maintenance.map((maintenance, index) => (
                    <TableRow key={maintenance.record?.id ?? `maintenance-${index}`}>
                      <TableCell className="font-mono">{maintenance.record ? `#${maintenance.record.id}` : "Not recorded"}</TableCell>
                      <TableCell>{maintenance.record ? humanize(maintenance.record.maintenanceType) : "Not evaluated"}</TableCell>
                      <TableCell>
                        <StateBadge value={maintenance.status} positive="closed" />
                      </TableCell>
                      <TableCell>{formatTimestamp(maintenance.record?.startsAt ?? null)}</TableCell>
                      <TableCell>{formatTimestamp(maintenance.record?.expectedEndsAt ?? null)}</TableCell>
                      <TableCell>{formatTimestamp(maintenance.record?.closedAt ?? null)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DataSection>

        <DataSection
          title="Open discrepancies and grace"
          description="Conflicting auditor attestations awaiting resolution and any temporary tier preservation."
        >
          {verification.grace ? (
            <div className="grid gap-3 border-b px-5 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Metric label="Grace ID" value={`#${verification.grace.id}`} />
              <Metric label="Preserved tier" value={verification.grace.preservedTier} />
              <Metric label="Status" value={humanize(verification.grace.status)} />
              <Metric label="Started" value={formatTimestamp(verification.grace.startedAt)} />
              <Metric label="Expires" value={formatTimestamp(verification.grace.expiresAt)} />
              <Metric
                label="Source discrepancies"
                value={verification.grace.sourceDiscrepancyIds.length > 0 ? verification.grace.sourceDiscrepancyIds.map(id => `#${id}`).join(", ") : "None"}
              />
            </div>
          ) : !verification.completeness.graces ? (
            <div className="border-b px-5 py-4">
              <EmptyState>Grace not evaluated</EmptyState>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Auditor A</TableHead>
                  <TableHead>Auditor B</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Proposal</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Observed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!verification.completeness.discrepancies ? (
                  <EmptyTableRow columns={7}>Not evaluated</EmptyTableRow>
                ) : openDiscrepancies.length === 0 ? (
                  <EmptyTableRow columns={7}>No open discrepancies</EmptyTableRow>
                ) : (
                  openDiscrepancies.map(discrepancy => (
                    <TableRow key={discrepancy.id}>
                      <TableCell className="font-mono">#{discrepancy.id}</TableCell>
                      <TableCell className="max-w-[230px]">
                        <div className="break-all font-mono text-xs">{discrepancy.auditorA}</div>
                        <TierBadge tier={discrepancy.auditorATier} />
                      </TableCell>
                      <TableCell className="max-w-[230px]">
                        <div className="break-all font-mono text-xs">{discrepancy.auditorB}</div>
                        <TierBadge tier={discrepancy.auditorBTier} />
                      </TableCell>
                      <TableCell>
                        <StateBadge value={discrepancy.resolutionStatus} />
                      </TableCell>
                      <TableCell className="font-mono">
                        {discrepancy.resolutionProposalId === "0" ? "Not submitted" : `#${discrepancy.resolutionProposalId}`}
                      </TableCell>
                      <TableCell>
                        <div>{humanize(discrepancy.resolutionReason)}</div>
                        <div className="text-xs text-muted-foreground">Fault: {humanize(discrepancy.faultAttribution)}</div>
                        {discrepancy.resolutionEvidenceHash && (
                          <div className="mt-1 max-w-[220px] break-all font-mono text-xs text-muted-foreground">{discrepancy.resolutionEvidenceHash}</div>
                        )}
                      </TableCell>
                      <TableCell>{formatTimestamp(discrepancy.timestamp)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DataSection>
      </CardContent>
    </Card>
  );
};

function SnapshotSection({ verification }: { verification: ProviderVerificationView }) {
  const snapshot = verification.snapshot;

  return (
    <div className="min-w-0 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Latest provider-signed inventory</h3>
      </div>
      {!verification.completeness.snapshot ? (
        <EmptyState>Not evaluated</EmptyState>
      ) : !snapshot ? (
        <EmptyState>Not posted</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Metric label="State" value={snapshot.suspended ? "Suspended" : stateLabel(verification.summary.snapshotState)} />
            <Metric label="Posted" value={formatTimestamp(snapshot.postedAt)} />
            <Metric label="Captured" value={formatTimestamp(snapshot.snapshotTimestamp)} />
            <Metric label="Compliance deadline" value={formatTimestamp(snapshot.complianceDeadline)} />
          </div>
          {snapshot.resourceSummary && (
            <div className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <Metric label="vCPU" value={snapshot.resourceSummary.totalVcpus.toLocaleString()} />
              <Metric label="GPU" value={snapshot.resourceSummary.totalGpus.toLocaleString()} />
              <Metric label="Memory" value={`${formatInteger(snapshot.resourceSummary.totalMemoryMb)} MB`} />
              <Metric label="Storage" value={`${formatInteger(snapshot.resourceSummary.totalStorageMb)} MB`} />
              <Metric label="Active leases" value={snapshot.resourceSummary.activeLeases.toLocaleString()} />
              <Metric label="Software" value={snapshot.resourceSummary.softwareVersion || "Not recorded"} />
            </div>
          )}
          <HashValue label="Snapshot hash" value={snapshot.snapshotHash} />
          {snapshot.resourceSummary?.softwareSignature && <HashValue label="Software signature" value={snapshot.resourceSummary.softwareSignature} />}
          {snapshot.resourceSummary?.softwareIdentity && (
            <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
              <Metric label="Software artifact" value={snapshot.resourceSummary.softwareIdentity.artifactRef || "Not recorded"} />
              <Metric
                label="Software digest"
                value={
                  snapshot.resourceSummary.softwareIdentity.digest
                    ? `${snapshot.resourceSummary.softwareIdentity.digestAlgorithm}: ${snapshot.resourceSummary.softwareIdentity.digest}`
                    : "Not recorded"
                }
              />
              <Metric label="Signature type" value={snapshot.resourceSummary.softwareIdentity.signatureType || "Not recorded"} />
              <Metric label="Public key reference" value={snapshot.resourceSummary.softwareIdentity.publicKeyRef || "Not recorded"} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BondSection({ verification }: { verification: ProviderVerificationView }) {
  const bond = verification.bond;

  return (
    <div className="min-w-0 border-t p-5 lg:border-t-0">
      <div className="mb-4 flex items-center gap-2">
        <WalletCards className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Provider bond</h3>
      </div>
      {!verification.completeness.bond ? (
        <EmptyState>Not evaluated</EmptyState>
      ) : !bond ? (
        <EmptyState>No provider bond posted</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Bonded amount" value={formatCoin(bond.bondedAmount)} />
            <Metric label="Required for current tier" value={formatCoin(bond.requiredForCurrentTier)} />
            <Metric label="Slashed" value={bond.slashed ? "Yes" : "No"} />
            <Metric label="Last slash" value={formatTimestamp(bond.lastSlashTime)} />
            <Metric label="Unbonding entries" value={bond.unbondingEntries.length.toString()} />
          </div>
          {bond.unbondingEntries.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              {bond.unbondingEntries.map((entry, index) => (
                <div key={`${entry.completionTime}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>{formatCoin(entry.amount)}</span>
                  <span className="text-muted-foreground">Completes {formatTimestamp(entry.completionTime)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DataSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border-b last:border-b-0">
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SummaryItem({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-r p-4 last:border-r-0 xl:border-b-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="break-words leading-tight">{label}</span>
      </div>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function HashValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 border-t pt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-mono text-xs">{value || "Not recorded"}</p>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function EmptyTableRow({ columns, children }: { columns: number; children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="py-6 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

function ObservedState({ verification }: { verification: ProviderVerificationView }) {
  return (
    <span className="text-xs text-muted-foreground">
      Indexed at height {verification.observedHeight} · {formatTimestamp(verification.observedAt)}
    </span>
  );
}

function TierBadge({ tier }: { tier: ProviderVerificationTier }) {
  return (
    <Badge variant={tier === "unknown" ? "outline" : "secondary"} className="rounded">
      {tier === "unknown" ? "Not evaluated" : tier}
    </Badge>
  );
}

function StateBadge({ value, positive }: { value: string; positive?: string }) {
  const isPositive = value === positive;
  const isNegative = ["expired", "voided", "revoked", "removed", "cancelled", "slashed", "timed_out"].includes(value);

  return (
    <Badge variant={isPositive ? "success" : isNegative ? "destructive" : "outline"} className="whitespace-nowrap rounded font-normal">
      {humanize(value)}
    </Badge>
  );
}

function formatOptionalInteger(value: number | null): string {
  return value === null ? "Not evaluated" : String(value);
}

function formatCoin(value: ProviderVerificationCoin | null): string {
  return value ? `${formatInteger(value.amount)} ${value.denom}` : "Not recorded";
}

function formatInteger(value: string): string {
  try {
    return new Intl.NumberFormat("en-US").format(BigInt(value));
  } catch {
    return value;
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  }).format(date);
}

function reviewLabel(value: ProviderVerificationView["summary"]["reviewState"]): string {
  if (value === "under_review") return "Under review";
  if (value === "grace") return "Grace active";
  return stateLabel(value);
}

function stateLabel(value: string): string {
  if (value === "unknown") return "Not evaluated";
  if (value === "not_posted") return "Not posted";
  return humanize(value);
}

function humanize(value: string): string {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
